import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function installGitHooks(root: string): boolean {
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  const topLevel = spawnSync("git", ["-C", root, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (topLevel.status !== 0 || path.resolve(topLevel.stdout.trim()) !== path.resolve(root)) return false;

  const current = spawnSync("git", ["-C", root, "config", "--path", "--get", "core.hooksPath"], { encoding: "utf8" });
  if (current.status !== 0 && current.status !== 1) throw new Error("Gitフック設定を読み込めませんでした。");
  const currentPath = current.stdout.trim();
  const hooksDir = path.resolve(root, ".githooks");
  const installed = Boolean(currentPath) && path.resolve(root, currentPath) === hooksDir;
  const saved = installed
    ? spawnSync("git", ["-C", root, "config", "--local", "--get", "template.previousHooksPath"], { encoding: "utf8" })
    : undefined;
  if (saved && saved.status !== 0 && saved.status !== 1) {
    throw new Error("以前のGitフック設定を読み込めませんでした。");
  }
  const previous = installed ? saved?.stdout.trim() : currentPath || git("rev-parse", "--git-path", "hooks");

  // 以前の設定はローカルGit設定だけに保存し、リポジトリへ書き込まない。
  if (previous) {
    const previousDir = path.resolve(root, previous);
    if (
      existsSync(previousDir) &&
      readdirSync(previousDir, { withFileTypes: true }).some(
        (entry) =>
          !entry.isDirectory() &&
          !entry.name.endsWith(".sample") &&
          entry.name !== "pre-commit" &&
          entry.name !== "commit-msg" &&
          entry.name !== "pre-push",
      )
    ) {
      if (installed) git("config", "--local", "core.hooksPath", previousDir);
      console.warn("既存のGitフックを維持するため、自動設定をスキップしました。");
      return false;
    }
    if (!installed) git("config", "--local", "template.previousHooksPath", previousDir);
  }
  for (const event of ["pre-commit", "commit-msg", "pre-push"]) chmodSync(path.join(hooksDir, event), 0o755);
  git("config", "--local", "core.hooksPath", ".githooks");
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "..");
  if (!process.env.CI && installGitHooks(root)) {
    console.log("ローカルパスとコミットメッセージの検査を設定しました。");
  }
}
