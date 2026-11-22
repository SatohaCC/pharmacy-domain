import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { checkLocalPaths } from "./check-local-paths.mts";

const root = path.resolve(import.meta.dirname, "..");
const [event, ...args] = process.argv.slice(2);
if (event !== "pre-commit" && event !== "commit-msg" && event !== "pre-push") {
  throw new Error("未対応のGitフックです。");
}

function isMergeSubject(header: string): boolean {
  if (!/^Merge \S/.test(header)) return false;

  const merge = spawnSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-path", "MERGE_HEAD"], {
    encoding: "utf8",
  });
  if (merge.status === 0 && existsSync(merge.stdout.trim())) return true;

  // マージコミットを amend するときは、既存の件名をそのまま使える。
  const last = spawnSync("git", ["-C", root, "log", "-1", "--format=%P%n%B"], { encoding: "utf8" });
  const [parents, ...messageLines] = last.stdout.split(/\r?\n/);
  const subject = messageLines.find((line) => line.trim())?.trimEnd();
  return last.status === 0 && (parents?.split(" ").length ?? 0) > 1 && subject === header;
}

if (event === "pre-commit") {
  const problems = checkLocalPaths({ root, staged: true });
  for (const problem of problems) console.error(`${problem.file}:${problem.line}: ローカルの絶対パスを検出しました。`);
  if (problems.length) {
    console.error("コミットを中止しました。ステージ済みの内容を修正してください。");
    process.exit(1);
  }
}

const previous = spawnSync("git", ["-C", root, "config", "--local", "--get", "template.previousHooksPath"], { encoding: "utf8" });
if (previous.status !== 0 && previous.status !== 1) throw new Error("以前のGitフック設定を読み込めませんでした。");
const previousPath = previous.stdout.trim();
if (previousPath && path.resolve(root, previousPath) !== path.join(root, ".githooks")) {
  const result = spawnSync("git", ["-C", root, "-c", `core.hooksPath=${previousPath}`, "hook", "run", "--ignore-missing", event, "--", ...args], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (event === "commit-msg") {
  const [messageFile] = args;
  if (!messageFile) throw new Error("Git からコミットメッセージのパスが渡されませんでした。");
  const cleanup = spawnSync("git", ["-C", root, "config", "--get", "commit.cleanup"], {
    encoding: "utf8",
  });
  if (cleanup.status !== 0 && cleanup.status !== 1) {
    throw new Error("コミットの cleanup 設定を読み込めませんでした。");
  }
  const mode = cleanup.stdout.trim() || "default";
  // エディタを開かない git commit -m などでは、既定でコメント行も保存される。
  const stripComments = mode === "strip" || (mode === "default" && process.env.GIT_EDITOR !== ":");
  const stripArgs = stripComments ? ["stripspace", "--strip-comments"] : ["stripspace"];
  const result = spawnSync("git", ["-C", root, ...stripArgs], {
    input: readFileSync(messageFile, "utf8"),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error("コミットメッセージを読み取れませんでした。");
  const header = result.stdout.split("\n", 1)[0] ?? "";
  const conventional =
    /^(?:(?:fixup|squash|amend)! )?[a-z][a-z0-9-]*(?:\([^()\s][^()]*\))?!?: \S/;
  const reverted = /^(?:Revert|Reapply) ".+"$/;
  if (!conventional.test(header) && !reverted.test(header) && !isMergeSubject(header)) {
    console.error("コミットの件名を Conventional Commits 形式にしてください（例: fix(ui): ボタンの表示を修正）。");
    process.exitCode = 1;
  }
}
