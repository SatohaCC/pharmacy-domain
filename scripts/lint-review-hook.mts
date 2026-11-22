import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FAILURE_THRESHOLD = 2;
export const MAX_SUMMARY_ITEMS = 10;

const FAILURES_DIR_PARTS = [".cache", "agent-failures"] as const;
const REVIEW_DIR_PARTS = [".cache", "lint-review"] as const;
const SUMMARY_FILE_NAME = "failure-summary.md";
const MAX_TRANSCRIPT_BYTES = 32 * 1024 * 1024;

// TypeScript の TSxxxx や一般単語との誤衝突を避けるため、既知の Ruff ルール接頭辞を明示する。
const RUFF_CODE_PREFIXES =
  "TID|RUF|PLC|PLE|PLR|PLW|ASYNC|PERF|FURB|TRY|SIM|RET|ARG|PTH|ERA|PGH|PIE|PYI|DTZ|BLE|FBT|ISC|ICN|INP|LOG|SLF|SLOT|INT|FIX|NPY|FAST|AIR|DOC|YTT|ANN|COM|EXE|T10|T20|UP|C4|C90|EM|FA|PT|DJ|PD|TD|PL|E|W|F|I|N|D|S|B|A|G|Q";
const RUFF_HEADER_RE = new RegExp(
  `^(?:${RUFF_CODE_PREFIXES})\\d{3,4}\\s+(?:\\[[^\\]]+\\]\\s+)?\\S`,
);
const RUFF_CODE_IN_SUMMARY_RE = new RegExp(`(?:^|[\\s:(])((?:${RUFF_CODE_PREFIXES})\\d{3,4})\\b`);
const ANSI_ESCAPE_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, "g");

const EXCEPTION_CLASSES =
  "AssertionError|SyntaxError|TypeError|ReferenceError|ValueError|ImportError|ModuleNotFoundError|AttributeError|KeyError|RuntimeError|ParserError";
const EXCEPTION_LINE_RE = new RegExp(`^(?:E\\s+)?(?:${EXCEPTION_CLASSES}):`);
const EXCEPTION_CAUSE_RE = new RegExp(`\\b(${EXCEPTION_CLASSES})\\b(?::\\s*([^|]+))?`);

export interface HookToolCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

export interface HookPayload {
  cwd?: string;
  workspacePaths?: string[];
  transcriptPath?: string;
  stepIdx?: number;
  toolCall?: HookToolCall;
  error?: string;
}

export interface FailureRecord {
  timestamp: string;
  tool: string;
  target: string;
  errorSummary: string;
  cause?: string;
  signature: string;
}

export interface PreToolUseResult {
  decision: "allow" | "deny";
  reason?: string;
}

function getFailuresDir(root: string): string {
  return path.join(root, ...FAILURES_DIR_PARTS);
}

function getReviewDir(root: string): string {
  return path.join(root, ...REVIEW_DIR_PARTS);
}

function getMarkerPath(root: string, reviewKey: string): string {
  return path.join(getReviewDir(root), `reviewed-${reviewKey}.json`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, "");
}

function sanitizeText(text: string, root: string, maxLength = 240): string {
  const resolvedRoot = path.resolve(root);
  const candidates = Array.from(
    new Set([
      root,
      resolvedRoot,
      resolvedRoot.replaceAll("\\", "/"),
      resolvedRoot.replaceAll("/", "\\"),
    ]),
  )
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  let sanitized = stripAnsi(text);
  for (const candidate of candidates) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(candidate), "gi"), "<workspace>");
  }

  sanitized = sanitized.replace(/\s+/g, " ").trim();
  if (sanitized.length > maxLength) {
    return `${sanitized.slice(0, maxLength - 3)}...`;
  }
  return sanitized;
}

function normalizeTarget(rawTarget: string, root: string): string {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    return "manual";
  }
  if (
    path.isAbsolute(trimmed) ||
    (!/\s/.test(trimmed) && (trimmed.includes("/") || trimmed.includes("\\")))
  ) {
    const relative = path.relative(path.resolve(root), path.resolve(root, trimmed));
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      return sanitizeText(relative.replaceAll("\\", "/"), root, 120);
    }
  }
  return sanitizeText(trimmed, root, 120);
}

function extractTarget(
  toolName: string,
  args: Record<string, unknown> | undefined,
  root: string,
): string {
  if (!args) {
    return toolName;
  }

  if (toolName === "run_command" && typeof args.CommandLine === "string") {
    return sanitizeText(args.CommandLine, root, 120);
  }

  const rawPath =
    typeof args.Path === "string"
      ? args.Path
      : typeof args.TargetFile === "string"
        ? args.TargetFile
        : null;
  if (rawPath) {
    return normalizeTarget(rawPath, root);
  }

  return toolName;
}

function normalizeFreeformText(text: string, maxLength = 80): string {
  return text
    .replace(/:\d+:\d+/g, "")
    .replace(/\(\d+,\d+\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, maxLength);
}

/** 失敗要約から同一原因を束ねるための正規化キー（TS/Biome/Ruff/mypy 等）を抽出する。 */
export function extractFailureCause(errorSummary: string): string | null {
  const tsMatch = /\b(TS\d{4})\b/.exec(errorSummary);
  if (tsMatch) {
    return `ts:${tsMatch[1]}`;
  }

  const biomeLintMatch = /\b(lint\/[a-zA-Z0-9/_-]+)\b/.exec(errorSummary);
  if (biomeLintMatch) {
    return `biome:${biomeLintMatch[1]}`;
  }

  if (
    /\bformat\b.*Formatter would have printed/i.test(errorSummary) ||
    /Formatter would have printed the following content/i.test(errorSummary)
  ) {
    return "biome:format";
  }

  const ruffMatch = RUFF_CODE_IN_SUMMARY_RE.exec(errorSummary);
  if (ruffMatch) {
    return `ruff:${ruffMatch[1]}`;
  }

  if (/\bWould reformat:/i.test(errorSummary)) {
    return "ruff:format";
  }

  const mypyMatch = /:\s+error:\s+.+?\[([a-z0-9-]+)\](?:\s*(?:\||$))/i.exec(errorSummary);
  if (mypyMatch) {
    return `mypy:${mypyMatch[1].toLowerCase()}`;
  }

  const importLinterBrokenMatch = /([^|]+?)\s+BROKEN\b/.exec(errorSummary);
  if (importLinterBrokenMatch) {
    const contractName = importLinterBrokenMatch[1]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 60);
    return `import-linter:${contractName}`;
  }

  if (/Contracts:\s+\d+\s+kept,\s+[1-9]\d*\s+broken\b/.test(errorSummary)) {
    return "import-linter:broken-contract";
  }

  const exceptionMatch = EXCEPTION_CAUSE_RE.exec(errorSummary);
  if (exceptionMatch) {
    const className = exceptionMatch[1];
    const message = exceptionMatch[2] ? normalizeFreeformText(exceptionMatch[2], 50) : "";
    return message ? `err:${className}:${message}` : `err:${className}`;
  }

  return null;
}

function buildFailureSignature(
  toolName: string,
  target: string,
  errorSummary: string,
  cause: string | null,
): string {
  if (cause) {
    if (cause.startsWith("reason:")) {
      return `${toolName}|cause:${cause}`;
    }
    return `cause:${cause}`;
  }
  return `${toolName}|${target}|${normalizeFreeformText(errorSummary, 100)}`;
}

interface TranscriptStepEntry {
  step_index?: unknown;
  content?: unknown;
  truncated_fields?: unknown;
}

function findStepEntryInJsonl(
  filePath: string,
  stepIdx: number,
): { content?: string; truncated_fields?: string[] } | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    if (statSync(filePath).size > MAX_TRANSCRIPT_BYTES) {
      return null;
    }
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    const stepIdxStr = String(stepIdx);
    // 最新の失敗ステップは末尾付近に記録されるため逆順で探索する。
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (!line.includes('"step_index"') || !line.includes(stepIdxStr)) {
        continue;
      }
      let parsed: TranscriptStepEntry;
      try {
        parsed = JSON.parse(line) as TranscriptStepEntry;
      } catch {
        continue;
      }
      if (parsed.step_index !== stepIdx) {
        continue;
      }
      return {
        content: typeof parsed.content === "string" ? parsed.content : undefined,
        truncated_fields: Array.isArray(parsed.truncated_fields)
          ? parsed.truncated_fields.filter((item): item is string => typeof item === "string")
          : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function readTranscriptStepContent(transcriptPath: string, stepIdx: number): string | null {
  if (!transcriptPath || !Number.isInteger(stepIdx) || stepIdx < 0) {
    return null;
  }
  const entry = findStepEntryInJsonl(transcriptPath, stepIdx);
  if (!entry) {
    return null;
  }
  if (entry.truncated_fields?.includes("content")) {
    const fullPath = path.join(path.dirname(transcriptPath), "transcript_full.jsonl");
    const fullEntry = findStepEntryInJsonl(fullPath, stepIdx);
    if (fullEntry?.content !== undefined) {
      return fullEntry.content;
    }
  }
  return entry.content ?? null;
}

function parseCommandStepOutput(content: string): { exitCode: number | null; output: string } {
  const separatorMatch = /\r?\nCommand output:(?:\r?\n|$)/.exec(content);
  const header = separatorMatch ? content.slice(0, separatorMatch.index) : content;
  const output = separatorMatch
    ? content.slice(separatorMatch.index + separatorMatch[0].length)
    : content;
  const codeMatch = /^Command exited with code (\d+)\./m.exec(header);
  const exitCode = codeMatch ? Number.parseInt(codeMatch[1], 10) : null;
  return { exitCode, output };
}

function isGenericErrorMessage(error: string): boolean {
  const trimmed = error.trim();
  if (!trimmed) {
    return true;
  }
  return /^(?:exit status \d+|command (?:exited|failed)(?: with (?:exit )?code \d+)?|process exited with code \d+|non-zero exit(?: code| status)?(?:\s+\d+)?)\.?$/i.test(
    trimmed,
  );
}

function isNoiseLine(line: string): boolean {
  if (!line) {
    return true;
  }
  return (
    /^Error:\s*ERR_PNPM_/i.test(line) ||
    /^\[ELIFECYCLE\]\s*Command failed/i.test(line) ||
    /^ELIFECYCLE\b/.test(line) ||
    /^[×✖]\s+"pnpm\b/.test(line) ||
    /^│/.test(line) ||
    /^Log:\s/i.test(line) ||
    /^[╔╗╚╝║═─━┌┐└┘├┤┬┴┼▶◀▲▼\s]+$/.test(line)
  );
}

function addUniqueSnippet(collected: string[], seen: Set<string>, line: string): void {
  const cleaned = line.replace(/\s*━+\s*$/, "").trim();
  if (!cleaned || seen.has(cleaned)) {
    return;
  }
  seen.add(cleaned);
  collected.push(cleaned);
}

/** コマンド出力から pnpm ラッパー等を除いた具体的なエラー診断行を最大 2 行抽出する。 */
export function extractDiagnosticSnippet(output: string, root: string): string | null {
  const rawLines = stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim());

  const collected: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawLines.length && collected.length < 2; i += 1) {
    const line = rawLines[i];
    if (isNoiseLine(line)) {
      continue;
    }

    const isBiomeHeader = /\blint\/[a-zA-Z0-9/_-]+\b/.test(line) || /\bformat\s+━+/.test(line);
    const isHighSignal =
      /\berror\s+TS\d{4}:/.test(line) ||
      isBiomeHeader ||
      /^[^\s:]+:\d+:\d+:\s+[A-Z]{1,4}\d{3,4}\b/.test(line) ||
      RUFF_HEADER_RE.test(line) ||
      /^Would reformat:\s+\S/.test(line) ||
      /^[^\s:]+:\d+(?::\d+)?:\s+error:\s+/.test(line) ||
      /\bBROKEN\b/.test(line) ||
      /^Contracts:\s+\d+\s+kept,\s+[1-9]\d*\s+broken\b/.test(line) ||
      /^FAIL\s+\S/.test(line) ||
      /^FAILED\s+\S/.test(line) ||
      /^not ok\s+\d+\s+-\s+/.test(line) ||
      EXCEPTION_LINE_RE.test(line);

    if (!isHighSignal) {
      continue;
    }

    addUniqueSnippet(collected, seen, line);

    if (isBiomeHeader && collected.length < 2) {
      for (let j = i + 1; j <= Math.min(rawLines.length - 1, i + 3); j += 1) {
        const nextLine = rawLines[j];
        if (!isNoiseLine(nextLine) && /^[×✖]\s+\S/.test(nextLine)) {
          addUniqueSnippet(collected, seen, nextLine);
          break;
        }
      }
    }
  }

  if (collected.length === 0) {
    for (let i = 0; i < rawLines.length && collected.length < 2; i += 1) {
      const line = rawLines[i];
      if (isNoiseLine(line)) {
        continue;
      }
      const isFallbackError =
        /^(?:fatal|error|Error|ParserError|CommandNotFoundException):/.test(line) ||
        (/\berror:\s+\S/i.test(line) && !/\b(?:0|no)\s+errors?\b/i.test(line)) ||
        /^[×✖]\s+\S/.test(line);
      if (isFallbackError) {
        addUniqueSnippet(collected, seen, line);
      }
    }
  }

  if (collected.length === 0) {
    return null;
  }

  return sanitizeText(collected.join(" | "), root, 240);
}

/** コマンドラインが git commit 実行（--help 等を除く）に該当するか判定する。 */
export function isGitCommitCommand(commandLine: string): boolean {
  if (!commandLine.trim()) {
    return false;
  }
  if (/\s(?:-h|--help)(?=\s|$)/.test(commandLine)) {
    return false;
  }
  return /\bgit\b(?:\s+(?:-C\s+\S+|-[^\s]+))*\s+commit\b/.test(commandLine);
}

function runGit(root: string, args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function getHeadSha(root: string): string {
  try {
    const sha = runGit(root, ["rev-parse", "HEAD"]).trim();
    return sha || "NO_HEAD";
  } catch {
    return "NO_HEAD";
  }
}

function stripQuotedSegments(commandLine: string): string {
  return commandLine.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '""');
}

function hasCommitAllFlag(commandLine?: string): boolean {
  if (!commandLine) {
    return false;
  }
  const stripped = stripQuotedSegments(commandLine);
  const match = /\bgit\b(?:\s+(?:-C\s+\S+|-[^\s]+))*\s+commit\b([^;&|\r\n]*)/.exec(stripped);
  if (!match) {
    return false;
  }
  const commitArgs = match[1] ?? "";
  return /\s(?:-[A-Za-z]*a[A-Za-z]*|--all)(?=\s|$)/.test(commitArgs);
}

function getCommitDiff(root: string, commandLine?: string, headSha?: string): string {
  try {
    if (hasCommitAllFlag(commandLine)) {
      if (headSha && headSha !== "NO_HEAD") {
        return runGit(root, ["diff", "HEAD"]);
      }
      const staged = runGit(root, ["diff", "--cached"]);
      const unstaged = runGit(root, ["diff"]);
      if (!staged.trim()) {
        return unstaged;
      }
      if (!unstaged.trim()) {
        return staged;
      }
      return `${staged}\n${unstaged}`;
    }
    const staged = runGit(root, ["diff", "--cached"]);
    if (staged.trim()) {
      return staged;
    }
    return "";
  } catch {
    return "";
  }
}

/** 現在の HEAD とコミット対象差分から一意なレビューキーを算出する。 */
export function computeReviewKey(
  root: string,
  commandLine?: string,
): { headSha: string; diffText: string; reviewKey: string } | null {
  const headSha = getHeadSha(root);
  const diffText = getCommitDiff(root, commandLine, headSha);
  if (!diffText.trim()) {
    return null;
  }
  const reviewKey = createHash("sha256")
    .update(`${headSha}\0${diffText}`)
    .digest("hex")
    .slice(0, 16);
  return { headSha, diffText, reviewKey };
}

/** ツール実行時の失敗情報を HEAD SHA ごとの JSONL ファイルへ追記する。 */
export function recordToolFailure({
  root,
  toolName,
  args,
  error,
  target,
  causeOverride,
}: {
  root: string;
  toolName: string;
  args?: Record<string, unknown>;
  error: string;
  target?: string;
  causeOverride?: string;
}): FailureRecord {
  const headSha = getHeadSha(root);
  const failuresDir = getFailuresDir(root);
  mkdirSync(failuresDir, { recursive: true });

  const resolvedTarget =
    target !== undefined ? normalizeTarget(target, root) : extractTarget(toolName, args, root);
  const errorSummary = sanitizeText(error, root, 240);
  const cause = causeOverride ?? extractFailureCause(errorSummary);
  const record: FailureRecord = {
    timestamp: new Date().toISOString(),
    tool: toolName,
    target: resolvedTarget,
    errorSummary,
    ...(cause ? { cause } : {}),
    signature: buildFailureSignature(toolName, resolvedTarget, errorSummary, cause),
  };

  const logPath = path.join(failuresDir, `${headSha}.jsonl`);
  appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

/** レビュー手戻りや非ツール失敗を明示的に失敗ログへ記録する。 */
export function recordManualFailure({
  root,
  reason,
  target = "manual",
  toolName = "manual",
}: {
  root: string;
  reason: string;
  target?: string;
  toolName?: string;
}): FailureRecord {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("--reason に失敗・手戻りの原因を指定してください。");
  }
  const sanitizedReason = sanitizeText(trimmedReason, root, 240);
  const detectedCause =
    extractFailureCause(sanitizedReason) ?? `reason:${normalizeFreeformText(sanitizedReason, 80)}`;
  const trimmedTarget = target.trim();
  const resolvedTarget =
    trimmedTarget && trimmedTarget !== "manual" ? normalizeTarget(trimmedTarget, root) : "manual";

  return recordToolFailure({
    root,
    toolName: toolName.trim() || "manual",
    target: resolvedTarget,
    error: sanitizedReason,
    causeOverride: detectedCause,
  });
}

function truncateTarget(target: string, maxLength = 55): string {
  if (target.length <= maxLength) {
    return target;
  }
  return `${target.slice(0, maxLength - 3)}...`;
}

function formatTargets(targets: Set<string>): string {
  const list = Array.from(targets);
  if (list.length === 0) {
    return "unknown";
  }
  if (list.length === 1) {
    return list[0];
  }
  if (list.length === 2) {
    return list.map((item) => truncateTarget(item)).join(", ");
  }
  const head = list
    .slice(0, 2)
    .map((item) => truncateTarget(item))
    .join(", ");
  return `${head} 他${list.length - 2}件`;
}

/** 指定 HEAD 以降に閾値以上繰り返された失敗を集計し、短い Markdown を返す。 */
export function summarizeRepeatedFailures({
  root,
  headSha = getHeadSha(root),
  threshold = FAILURE_THRESHOLD,
}: {
  root: string;
  headSha?: string;
  threshold?: number;
}): { count: number; markdown: string } {
  const logPath = path.join(getFailuresDir(root), `${headSha}.jsonl`);
  if (!existsSync(logPath)) {
    return {
      count: 0,
      markdown: `# 前回コミット以降の失敗サマリー（閾値: ${threshold}回以上）\n\n前回コミット以降、${threshold} 回以上繰り返した失敗はありません。\n`,
    };
  }

  const lines = readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean);
  const counts = new Map<string, { count: number; latest: FailureRecord; targets: Set<string> }>();

  for (const line of lines) {
    let parsed: FailureRecord;
    try {
      parsed = JSON.parse(line) as FailureRecord;
    } catch {
      continue;
    }
    if (!parsed.signature) {
      continue;
    }
    const entry = counts.get(parsed.signature);
    if (entry) {
      entry.count += 1;
      entry.latest = parsed;
      if (parsed.target) {
        entry.targets.add(parsed.target);
      }
    } else {
      const targets = new Set<string>();
      if (parsed.target) {
        targets.add(parsed.target);
      }
      counts.set(parsed.signature, { count: 1, latest: parsed, targets });
    }
  }

  const repeated = Array.from(counts.values())
    .filter((item) => item.count >= threshold)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SUMMARY_ITEMS);

  if (repeated.length === 0) {
    return {
      count: 0,
      markdown: `# 前回コミット以降の失敗サマリー（閾値: ${threshold}回以上）\n\n前回コミット以降、${threshold} 回以上繰り返した失敗はありません。\n`,
    };
  }

  const bullets = repeated.map(
    ({ count, latest, targets }) =>
      `- [${count}回] \`${latest.tool}\` (${formatTargets(targets)}): ${latest.errorSummary}`,
  );
  return {
    count: repeated.length,
    markdown: `# 前回コミット以降の失敗サマリー（閾値: ${threshold}回以上）\n\n${bullets.join("\n")}\n`,
  };
}

/** 集計した失敗サマリーを .cache/lint-review/failure-summary.md へ書き出す。 */
export function writeFailureSummary(root: string): {
  count: number;
  summaryPath: string;
  markdown: string;
} {
  const { count, markdown } = summarizeRepeatedFailures({ root });
  const reviewDir = getReviewDir(root);
  mkdirSync(reviewDir, { recursive: true });
  const summaryPath = path.join(reviewDir, SUMMARY_FILE_NAME);
  writeFileSync(summaryPath, markdown, "utf8");
  return { count, summaryPath, markdown };
}

/** コミット完了後に確認済みマーカーと失敗ログを整理する。 */
export function clearReviewArtifacts(root: string): void {
  const reviewDir = getReviewDir(root);
  if (existsSync(reviewDir)) {
    try {
      for (const entry of readdirSync(reviewDir)) {
        if (entry.startsWith("reviewed-") && entry.endsWith(".json")) {
          rmSync(path.join(reviewDir, entry), { force: true });
        }
      }
      rmSync(path.join(reviewDir, SUMMARY_FILE_NAME), { force: true });
    } catch {
      // キャッシュ削除失敗でコミット後処理を止めない。
    }
  }

  const failuresDir = getFailuresDir(root);
  if (existsSync(failuresDir)) {
    try {
      for (const entry of readdirSync(failuresDir)) {
        if (entry.endsWith(".jsonl")) {
          rmSync(path.join(failuresDir, entry), { force: true });
        }
      }
    } catch {
      // キャッシュ削除失敗でコミット後処理を止めない。
    }
  }
}

/** 現在のステージ済み差分を確認済みとしてマークする。 */
export function markReviewed({ root, note = "" }: { root: string; note?: string }): {
  reviewKey: string;
  markerPath: string;
} {
  const computed = computeReviewKey(root);
  if (!computed) {
    throw new Error("ステージ済みの変更がないため確認マーカーを作成できません。");
  }
  const reviewDir = getReviewDir(root);
  mkdirSync(reviewDir, { recursive: true });
  const markerPath = getMarkerPath(root, computed.reviewKey);
  writeFileSync(
    markerPath,
    JSON.stringify(
      {
        reviewKey: computed.reviewKey,
        headSha: computed.headSha,
        note,
        reviewedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  return { reviewKey: computed.reviewKey, markerPath };
}

/** PreToolUse フック: git commit 実行前に未確認の差分があれば SKILL 実行を促して 1 回停止する。 */
export function handlePreToolUse(payload: HookPayload, root: string): PreToolUseResult {
  const toolName = payload.toolCall?.name;
  const commandLine =
    typeof payload.toolCall?.args?.CommandLine === "string"
      ? payload.toolCall.args.CommandLine
      : "";

  if (toolName !== "run_command" || !isGitCommitCommand(commandLine)) {
    return { decision: "allow" };
  }

  const computed = computeReviewKey(root, commandLine);
  if (!computed) {
    return { decision: "allow" };
  }

  if (existsSync(getMarkerPath(root, computed.reviewKey))) {
    return { decision: "allow" };
  }

  const { count } = writeFailureSummary(root);
  const reason = [
    "コミット前チェックが未完了のため git commit を一時停止しました。",
    "1. `.agents/skills/code-review/SKILL.md` に従い、ステージ済み差分（`git diff --cached`）をレビューしてください（同一のステージ済み差分で直前に完了済みなら再実行不要）。",
    "2. `.agents/skills/git-commit/SKILL.md` を読み込み、ステージ済み差分と `.cache/lint-review/failure-summary.md`（2回以上の失敗: " +
      `${count}件）から、既存リンター設定や独自リンターで品質を縛れるか判断してください（静的判定できない項目は無理にリンター化不要）。`,
    '3. 確認後（修正やリンター追加を行った場合はステージ後）に `node scripts/lint-review-hook.mts mark-reviewed --note "<レビュー・判断結果>"` を実行してから再コミットしてください。',
  ].join("\n");

  return { decision: "deny", reason };
}

/** PostToolUse フック: 失敗ツール実行の記録、または git commit 成功後のキャッシュ整理を行う。 */
export function handlePostToolUse(payload: HookPayload, root: string): Record<string, never> {
  const toolName = payload.toolCall?.name ?? "unknown";
  const args = payload.toolCall?.args;
  const rawError = typeof payload.error === "string" ? payload.error.trim() : "";
  let effectiveError = rawError;

  const transcriptPath = typeof payload.transcriptPath === "string" ? payload.transcriptPath : "";
  const stepIdx = payload.stepIdx;

  if (transcriptPath && typeof stepIdx === "number" && Number.isInteger(stepIdx) && stepIdx >= 0) {
    if (rawError && isGenericErrorMessage(rawError)) {
      const content = readTranscriptStepContent(transcriptPath, stepIdx);
      if (content) {
        const { output } = parseCommandStepOutput(content);
        const snippet = extractDiagnosticSnippet(output, root);
        if (snippet) {
          effectiveError = snippet;
        }
      }
    } else if (!rawError && toolName === "run_command") {
      const content = readTranscriptStepContent(transcriptPath, stepIdx);
      if (content) {
        const { exitCode, output } = parseCommandStepOutput(content);
        if (exitCode !== null && exitCode !== 0) {
          const snippet = extractDiagnosticSnippet(output, root);
          effectiveError = snippet ?? `exit status ${exitCode}`;
        }
      }
    }
  }

  if (effectiveError) {
    recordToolFailure({ root, toolName, args, error: effectiveError });
    return {};
  }

  const commandLine = typeof args?.CommandLine === "string" ? args.CommandLine : "";
  if (toolName === "run_command" && isGitCommitCommand(commandLine)) {
    clearReviewArtifacts(root);
  }

  return {};
}

function resolveWorkspaceRoot(payload?: HookPayload): string {
  const fallback = path.resolve(import.meta.dirname, "..");
  const candidate = payload?.workspacePaths?.[0] || payload?.cwd || process.cwd();
  try {
    const topLevel = execFileSync("git", ["-C", candidate, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
    return topLevel || fallback;
  } catch {
    return fallback;
  }
}

function readFlagArg(argv: string[], flag: string): string {
  const prefix = `${flag}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === flag && typeof argv[i + 1] === "string") {
      return argv[i + 1];
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return "";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const subcommand = process.argv[2];

  if (subcommand === "pre-tool") {
    try {
      const payload = JSON.parse(readFileSync(0, "utf8")) as HookPayload;
      const root = resolveWorkspaceRoot(payload);
      console.log(JSON.stringify(handlePreToolUse(payload, root)));
    } catch (error) {
      console.error("lint-review-hook pre-tool 実行エラー:", error);
      console.log(JSON.stringify({ decision: "allow" }));
    }
  } else if (subcommand === "post-tool") {
    try {
      const payload = JSON.parse(readFileSync(0, "utf8")) as HookPayload;
      const root = resolveWorkspaceRoot(payload);
      console.log(JSON.stringify(handlePostToolUse(payload, root)));
    } catch (error) {
      console.error("lint-review-hook post-tool 実行エラー:", error);
      console.log("{}");
    }
  } else if (subcommand === "mark-reviewed") {
    const root = resolveWorkspaceRoot();
    const note = readFlagArg(process.argv.slice(3), "--note");
    const { reviewKey, markerPath } = markReviewed({ root, note });
    const relativeMarker = path.relative(root, markerPath).replaceAll("\\", "/");
    console.log(`コミット前チェックを記録しました (key=${reviewKey}, marker=${relativeMarker})`);
  } else if (subcommand === "record-failure") {
    const cliArgs = process.argv.slice(3);
    const reason = readFlagArg(cliArgs, "--reason");
    if (!reason.trim()) {
      console.error(
        '使い方: node scripts/lint-review-hook.mts record-failure --reason "<原因>" [--target "<対象>"] [--tool "<種別>"]',
      );
      process.exit(1);
    }
    const target = readFlagArg(cliArgs, "--target") || "manual";
    const toolName = readFlagArg(cliArgs, "--tool") || "manual";
    const root = resolveWorkspaceRoot();
    const record = recordManualFailure({ root, reason, target, toolName });
    console.log(
      `失敗記録を追記しました (tool=${record.tool}, target=${record.target}, cause=${record.cause ?? "none"})`,
    );
  } else {
    console.error(
      "使い方: node scripts/lint-review-hook.mts <pre-tool|post-tool|mark-reviewed|record-failure>",
    );
    process.exit(1);
  }
}
