import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  clearReviewArtifacts,
  extractDiagnosticSnippet,
  extractFailureCause,
  handlePostToolUse,
  handlePreToolUse,
  isGitCommitCommand,
  markReviewed,
  recordToolFailure,
  summarizeRepeatedFailures,
} from "./lint-review-hook.mts";

function createTempRepo(): { root: string; git: (...args: string[]) => string } {
  const root = mkdtempSync(path.join(os.tmpdir(), "lint-review-hook-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

  git("init", "--quiet");
  git("config", "user.name", "Test User");
  git("config", "user.email", "test@example.com");
  writeFileSync(path.join(root, ".gitignore"), ".cache/\n", "utf8");
  writeFileSync(path.join(root, "README.md"), "init\n", "utf8");
  git("add", ".gitignore", "README.md");
  git("commit", "-m", "chore: initial commit", "--quiet");

  return { root, git };
}

test("isGitCommitCommand は git commit のみを検出し、他コマンドやヘルプを除外する", () => {
  assert.equal(isGitCommitCommand('git commit -m "feat: add"'), true);
  assert.equal(isGitCommitCommand('git -C frontend commit --amend -m "fix: msg"'), true);
  assert.equal(isGitCommitCommand('pnpm check && git commit -m "fix: ok"'), true);

  assert.equal(isGitCommitCommand("git status -s"), false);
  assert.equal(isGitCommitCommand("git commit --help"), false);
  assert.equal(isGitCommitCommand("git commit -h"), false);
  assert.equal(isGitCommitCommand("pnpm test"), false);
});

test("2 回以上繰り返した失敗のみサマリーに含め、ローカルパスをサニタイズする", () => {
  const { root } = createTempRepo();
  try {
    const privateFile = path.join(root, "frontend", "src", "app", "page.tsx");
    recordToolFailure({
      root,
      toolName: "run_command",
      args: { CommandLine: "pnpm typecheck" },
      error: `Error in ${privateFile}: TS4104 readonly mismatch`,
    });

    const afterFirst = summarizeRepeatedFailures({ root });
    assert.equal(afterFirst.count, 0);

    recordToolFailure({
      root,
      toolName: "run_command",
      args: { CommandLine: "pnpm typecheck" },
      error: `Error in ${privateFile}: TS4104 readonly mismatch`,
    });
    recordToolFailure({
      root,
      toolName: "edit_file",
      args: { Path: path.join(root, "backend", "app", "main.py") },
      error: "single typo",
    });

    const afterSecond = summarizeRepeatedFailures({ root });
    assert.equal(afterSecond.count, 1);
    assert.match(afterSecond.markdown, /\[2回\] `run_command` \(pnpm typecheck\):/);
    assert.match(afterSecond.markdown, /<workspace>/);
    assert.equal(afterSecond.markdown.includes(root), false);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});

test("handlePreToolUse は未確認の git commit を 1 回止め、markReviewed 後に許可する", () => {
  const { root, git } = createTempRepo();
  try {
    assert.equal(
      handlePreToolUse(
        { toolCall: { name: "run_command", args: { CommandLine: "pnpm test" } } },
        root,
      ).decision,
      "allow",
    );

    writeFileSync(path.join(root, "sample.ts"), "export const value = 1;\n", "utf8");
    git("add", "sample.ts");

    const denied = handlePreToolUse(
      { toolCall: { name: "run_command", args: { CommandLine: 'git commit -m "feat: sample"' } } },
      root,
    );
    assert.equal(denied.decision, "deny");
    assert.match(denied.reason ?? "", /code-review/);
    assert.match(denied.reason ?? "", /git-commit/);
    assert.match(denied.reason ?? "", /mark-reviewed/);
    assert.equal(existsSync(path.join(root, ".cache", "lint-review", "failure-summary.md")), true);

    markReviewed({ root, note: "静的ルール対象外のためそのままコミット" });
    const allowed = handlePreToolUse(
      { toolCall: { name: "run_command", args: { CommandLine: 'git commit -m "feat: sample"' } } },
      root,
    );
    assert.equal(allowed.decision, "allow");

    writeFileSync(path.join(root, "sample.ts"), "export const value = 2;\n", "utf8");
    git("add", "sample.ts");
    const deniedAgain = handlePreToolUse(
      { toolCall: { name: "run_command", args: { CommandLine: 'git commit -m "feat: sample"' } } },
      root,
    );
    assert.equal(deniedAgain.decision, "deny");
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});

test("handlePostToolUse は失敗記録と git commit 成功後のキャッシュ削除を行う", () => {
  const { root, git } = createTempRepo();
  try {
    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: "pnpm lint" } },
        error: "exit status 1: Biome restricted import",
      },
      root,
    );
    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: "pnpm lint" } },
        error: "exit status 1: Biome restricted import",
      },
      root,
    );

    const summary = summarizeRepeatedFailures({ root });
    assert.equal(summary.count, 1);

    writeFileSync(path.join(root, "extra.ts"), "export const ok = true;\n", "utf8");
    git("add", "extra.ts");
    const { markerPath } = markReviewed({ root, note: "テスト" });
    assert.equal(existsSync(markerPath), true);

    const summaryBeforeCommit = readFileSync(
      (() => {
        handlePreToolUse(
          {
            toolCall: {
              name: "run_command",
              args: { CommandLine: 'git commit -m "feat: extra"' },
            },
          },
          root,
        );
        return markerPath;
      })(),
      "utf8",
    );
    assert.match(summaryBeforeCommit, /reviewKey/);

    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: 'git commit -m "feat: extra"' } },
      },
      root,
    );

    assert.equal(existsSync(markerPath), false);
    assert.equal(summarizeRepeatedFailures({ root }).count, 0);

    clearReviewArtifacts(root);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});

test("handlePostToolUse はトランスクリプトの対象ステップから具体的なエラー行を抽出し、誤検知を防ぐ", () => {
  const { root, git } = createTempRepo();
  const logsDir = mkdtempSync(path.join(os.tmpdir(), "lint-review-logs-"));
  const headSha = git("rev-parse", "HEAD");
  const esc = String.fromCharCode(27);

  try {
    const transcriptPath = path.join(logsDir, "transcript.jsonl");
    const privateFile = path.join(root, "frontend", "src", "app", "page.tsx");
    const entries = [
      {
        step_index: 11,
        content: [
          "Created At: 2026-11-21T10:00:00+09:00",
          "Command exited with code 1.",
          "",
          "Command output:",
          `${esc}[31m${privateFile}:12:3: error TS4104: The type 'readonly string[]' is 'readonly'.${esc}[0m`,
          "src/Button.tsx:5:1 lint/style/useConst ━━━━",
          "  × This let declares a variable that is never reassigned.",
        ].join("\n"),
      },
      {
        step_index: 12,
        content: [
          "Command exited with code 1.",
          "",
          "Command output:",
          "frontend/src/Form.tsx(7,5): error TS4104: readonly mismatch",
        ].join("\n"),
      },
      {
        step_index: 13,
        content: [
          "Command exited with code 0.",
          "",
          "Command output:",
          "Command exited with code 1. (printed in stdout fixture)",
        ].join("\n"),
      },
    ];
    writeFileSync(
      transcriptPath,
      `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      "utf8",
    );

    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: "pnpm typecheck" } },
        error: "exit status 1",
        transcriptPath,
        stepIdx: 11,
      },
      root,
    );

    const logPath = path.join(root, ".cache", "agent-failures", `${headSha}.jsonl`);
    const linesAfterFirst = readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean);
    assert.equal(linesAfterFirst.length, 1);
    assert.match(linesAfterFirst[0], /error TS4104/);
    assert.match(linesAfterFirst[0], /<workspace>/);
    assert.equal(linesAfterFirst[0].includes(esc), false);
    assert.equal(linesAfterFirst[0].includes(root), false);

    // ヘッダが code 0 の場合は本文に code 1 文字列があっても失敗記録しない。
    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: "pnpm test" } },
        transcriptPath,
        stepIdx: 13,
      },
      root,
    );
    const linesAfterSuccess = readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean);
    assert.equal(linesAfterSuccess.length, 1);

    // payload.error が空でもヘッダが code 1 なら失敗を抽出・記録して 2 回目として集約する。
    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: "pnpm check" } },
        transcriptPath,
        stepIdx: 12,
      },
      root,
    );
    const summary = summarizeRepeatedFailures({ root });
    assert.equal(summary.count, 1);
    assert.match(summary.markdown, /\[2回\] `run_command` \(pnpm typecheck, pnpm check\):/);
    assert.match(summary.markdown, /TS4104/);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    assert.equal(path.dirname(logsDir), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
    rmSync(logsDir, { recursive: true, force: true });
  }
});

test("transcript_full.jsonl フォールバック時に pnpm ラッパーを除外して実エラーを抽出する", () => {
  const { root, git } = createTempRepo();
  const logsDir = mkdtempSync(path.join(os.tmpdir(), "lint-review-full-"));
  const headSha = git("rev-parse", "HEAD");

  try {
    const transcriptPath = path.join(logsDir, "transcript.jsonl");
    const transcriptFullPath = path.join(logsDir, "transcript_full.jsonl");

    writeFileSync(
      transcriptPath,
      `${JSON.stringify({
        step_index: 21,
        truncated_fields: ["content"],
        content: "Command exited with code 1.\n\nCommand output:\n$ pnpm typecheck\n...",
      })}\n`,
      "utf8",
    );
    writeFileSync(
      transcriptFullPath,
      `${JSON.stringify({
        step_index: 21,
        content: [
          "Command exited with code 1.",
          "",
          "Command output:",
          "Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL",
          '  × "pnpm recursive exec" failed in frontend',
          "  │ nested path",
          "[ELIFECYCLE] Command failed with exit code 1.",
          "frontend/src/main.ts(3,1): error TS5033: Could not write file.",
          "Log: /tmp/task.log",
        ].join("\n"),
      })}\n`,
      "utf8",
    );

    const directSnippet = extractDiagnosticSnippet(
      "Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL\nfrontend/src/main.ts(3,1): error TS5033: Could not write file.",
      root,
    );
    assert.match(directSnippet ?? "", /error TS5033/);
    assert.equal((directSnippet ?? "").includes("ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL"), false);

    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: "pnpm typecheck" } },
        error: "exit status 1",
        transcriptPath,
        stepIdx: 21,
      },
      root,
    );

    const logPath = path.join(root, ".cache", "agent-failures", `${headSha}.jsonl`);
    const saved = JSON.parse(readFileSync(logPath, "utf8").trim()) as {
      errorSummary: string;
      cause?: string;
    };
    assert.match(saved.errorSummary, /error TS5033: Could not write file\./);
    assert.equal(saved.errorSummary.includes("ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL"), false);
    assert.equal(saved.errorSummary.includes("ELIFECYCLE"), false);
    assert.equal(saved.cause, "ts:TS5033");
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    assert.equal(path.dirname(logsDir), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
    rmSync(logsDir, { recursive: true, force: true });
  }
});

test("エラー原因ベースのグルーピングと失敗した git commit でのキャッシュ保護を確認する", () => {
  const { root, git } = createTempRepo();
  const logsDir = mkdtempSync(path.join(os.tmpdir(), "lint-review-commit-fail-"));

  try {
    recordToolFailure({
      root,
      toolName: "run_command",
      args: { CommandLine: "pnpm lint" },
      error: "src/a.tsx(10,2): error TS4104: readonly mismatch",
    });
    recordToolFailure({
      root,
      toolName: "run_command",
      args: { CommandLine: "pnpm check && pnpm test" },
      error: "src/b.tsx(25,9): error TS4104: The type 'readonly string[]' is 'readonly'",
    });

    const summary = summarizeRepeatedFailures({ root });
    assert.equal(summary.count, 1);
    assert.match(summary.markdown, /\[2回\] `run_command` \(pnpm lint, pnpm check && pnpm test\):/);

    assert.equal(
      extractFailureCause("src/foo.ts:1:1 lint/style/noRestrictedImports"),
      "biome:lint/style/noRestrictedImports",
    );
    assert.equal(
      extractFailureCause(
        "src/Switch.tsx format | × Formatter would have printed the following content:",
      ),
      "biome:format",
    );
    assert.equal(extractFailureCause("app/main.py:12:5: TID251 Banned import"), "ruff:TID251");
    assert.equal(extractFailureCause("F401 [*] `os` imported but unused"), "ruff:F401");
    assert.equal(
      extractFailureCause("app/main.py:12: error: Incompatible return value type [return-value]"),
      "mypy:return-value",
    );
    assert.equal(
      extractFailureCause("Contracts: 1 kept, 1 broken. | Clean Architecture Layering BROKEN"),
      "import-linter:clean architecture layering",
    );

    writeFileSync(path.join(root, "staged.ts"), "export const x = 1;\n", "utf8");
    git("add", "staged.ts");
    const { markerPath } = markReviewed({ root, note: "確認済み" });
    assert.equal(existsSync(markerPath), true);

    const transcriptPath = path.join(logsDir, "transcript.jsonl");
    writeFileSync(
      transcriptPath,
      `${JSON.stringify({
        step_index: 31,
        content: "Command exited with code 1.\n\nCommand output:\nfatal: hook aborted commit",
      })}\n`,
      "utf8",
    );

    handlePostToolUse(
      {
        toolCall: { name: "run_command", args: { CommandLine: 'git commit -m "feat: staged"' } },
        transcriptPath,
        stepIdx: 31,
      },
      root,
    );
    assert.equal(existsSync(markerPath), true);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    assert.equal(path.dirname(logsDir), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
    rmSync(logsDir, { recursive: true, force: true });
  }
});

test("recordManualFailure と record-failure CLI で非ツール失敗を記録・集約できる", () => {
  const { root } = createTempRepo();
  const scriptPath = fileURLToPath(new URL("./lint-review-hook.mts", import.meta.url));
  const privateTargetA = path.join(root, "frontend", "src", "A.tsx");
  const privateTargetB = path.join(root, "frontend", "src", "B.tsx");

  try {
    execFileSync(
      process.execPath,
      [
        scriptPath,
        "record-failure",
        "--reason",
        "StyleX の共有トークン未使用でレビュー修正",
        "--target",
        privateTargetA,
      ],
      { cwd: root, encoding: "utf8" },
    );
    execFileSync(
      process.execPath,
      [
        scriptPath,
        "record-failure",
        "--reason",
        "StyleX の共有トークン未使用でレビュー修正",
        "--target",
        privateTargetB,
      ],
      { cwd: root, encoding: "utf8" },
    );

    const summary = summarizeRepeatedFailures({ root });
    assert.equal(summary.count, 1);
    assert.match(
      summary.markdown,
      /\[2回\] `manual` \(frontend\/src\/A\.tsx, frontend\/src\/B\.tsx\): StyleX の共有トークン未使用でレビュー修正/,
    );
    assert.equal(summary.markdown.includes(root), false);

    assert.throws(() => {
      execFileSync(process.execPath, [scriptPath, "record-failure"], {
        cwd: root,
        encoding: "utf8",
        stdio: "pipe",
      });
    });
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});

test("extractDiagnosticSnippet は Ruff 接頭辞の誤マッチで TAP ヘッダ等を拾わない", () => {
  const { root } = createTempRepo();
  try {
    const tapFailure = [
      "TAP version 13",
      "# Subtest: reports a failure",
      "not ok 1 - reports a failure",
      "  ---",
      "  duration_ms: 1.23",
      "  ...",
      "AssertionError: expected 1 to equal 2",
    ].join("\n");

    const tapSnippet = extractDiagnosticSnippet(tapFailure, root);
    assert.equal(
      tapSnippet,
      "not ok 1 - reports a failure | AssertionError: expected 1 to equal 2",
    );

    const ruffSnippet = extractDiagnosticSnippet(
      "F401 [*] `os` imported but unused\nTID251 Banned import",
      root,
    );
    assert.equal(ruffSnippet, "F401 [*] `os` imported but unused | TID251 Banned import");
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});

test("handlePreToolUse は git commit -a / --all 時に未ステージの追跡変更も含めてレビューを要求する", () => {
  const { root, git } = createTempRepo();
  try {
    writeFileSync(path.join(root, "staged.ts"), "export const x = 1;\n", "utf8");
    git("add", "staged.ts");
    markReviewed({ root, note: "staged のみ確認" });

    writeFileSync(path.join(root, "README.md"), "modified tracked file\n", "utf8");

    const deniedShort = handlePreToolUse(
      { toolCall: { name: "run_command", args: { CommandLine: 'git commit -am "feat: change"' } } },
      root,
    );
    assert.equal(deniedShort.decision, "deny");

    const deniedLong = handlePreToolUse(
      {
        toolCall: {
          name: "run_command",
          args: { CommandLine: 'git commit --all -m "feat: change"' },
        },
      },
      root,
    );
    assert.equal(deniedLong.decision, "deny");

    const allowedMessageOnly = handlePreToolUse(
      {
        toolCall: {
          name: "run_command",
          args: { CommandLine: 'git commit -m "fix: -a option"' },
        },
      },
      root,
    );
    assert.equal(allowedMessageOnly.decision, "allow");

    git("add", "README.md");
    markReviewed({ root, note: "全変更を確認" });
    const allowedAfterReview = handlePreToolUse(
      { toolCall: { name: "run_command", args: { CommandLine: 'git commit -am "feat: change"' } } },
      root,
    );
    assert.equal(allowedAfterReview.decision, "allow");
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});
