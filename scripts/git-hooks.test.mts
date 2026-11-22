import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { installGitHooks } from "./install-git-hooks.mts";

test("コミットを遮断し、正常なコミットと既存pushフックを維持する", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "git-hook-test-"));
  const sourceRoot = path.resolve(import.meta.dirname, "..");
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  try {
    git("init", "--quiet", "--initial-branch=main");
    git("config", "--local", "core.hooksPath", ".git/hooks");
    git("config", "--local", "core.commentChar", "#");
    git("config", "--local", "commit.cleanup", "default");
    git("config", "--local", "commit.gpgSign", "false");
    git("config", "--local", "merge.ff", "true");
    mkdirSync(path.join(root, "scripts"));
    for (const name of ["run-git-hook.mts", "check-local-paths.mts"]) cpSync(path.join(sourceRoot, "scripts", name), path.join(root, "scripts", name));
    cpSync(path.join(sourceRoot, ".githooks"), path.join(root, ".githooks"), { recursive: true });
    const previousPush = path.join(root, ".git", "hooks", "pre-push");
    writeFileSync(previousPush, "#!/bin/sh\nexit 23\n");
    chmodSync(previousPush, 0o755);
    const previousCommitMsg = path.join(root, ".git", "hooks", "commit-msg");
    writeFileSync(previousCommitMsg, "#!/bin/sh\nprintf '\\n\\nprevious hook ran\\n' >> \"$1\"\n");
    chmodSync(previousCommitMsg, 0o755);
    installGitHooks(root);
    installGitHooks(root);

    const privatePath = ["C:", "Users", "example", "project"].join("/");
    writeFileSync(path.join(root, "sample.txt"), privatePath);
    git("add", "sample.txt");
    // 作業ツリーが安全でも、ステージ済みの混入を検出する。
    writeFileSync(path.join(root, "sample.txt"), "safe\n");
    const gitArgs = ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.invalid"];
    const commitArgs = [...gitArgs, "commit", "-m"];
    const validHeader = "fix(test): 正常なコミットを確認する";
    const blocked = spawnSync("git", [...commitArgs, validHeader], { encoding: "utf8" });
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /コミットを中止/);
    assert.equal(blocked.stderr.includes(privatePath), false);
    git("add", "sample.txt");
    const invalid = spawnSync("git", [...commitArgs, "形式違反"], { encoding: "utf8" });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Conventional Commits/);

    const unrelatedMerge = spawnSync("git", [...commitArgs, "Merge その他の変更"], { encoding: "utf8" });
    assert.notEqual(unrelatedMerge.status, 0);
    assert.match(unrelatedMerge.stderr, /Conventional Commits/);

    const commented = spawnSync("git", [...commitArgs, "# 件名として保存される行", "-m", validHeader], {
      encoding: "utf8",
    });
    assert.notEqual(commented.status, 0);
    assert.match(commented.stderr, /Conventional Commits/);

    const allowed = spawnSync(
      "git",
      [...gitArgs, "-c", "commit.cleanup=strip", "commit", "-m", "# 取り除かれるコメント", "-m", validHeader],
      { encoding: "utf8" },
    );

    assert.equal(allowed.status, 0, allowed.stderr);
    assert.equal(git("log", "-1", "--format=%s"), validHeader);
    assert.match(git("log", "-1", "--format=%B"), /previous hook ran/);
    assert.equal(spawnSync("git", ["-C", root, "hook", "run", "pre-push"]).status, 23);

    git("config", "--local", "core.commentChar", ";");
    const messageFile = path.join(root, ".git", "COMMIT_EDITMSG");
    for (const header of [
      `Revert "${validHeader}"`,
      `Reapply "${validHeader}"`,
      `fixup! ${validHeader}`,
      "feat(api)!: API を変更する",
    ]) {
      writeFileSync(messageFile, `; コメント\n\n${header}\n`);

      const generated = spawnSync(
        "git",
        [...gitArgs, "-c", "commit.cleanup=strip", "hook", "run", "commit-msg", "--", messageFile],
        { encoding: "utf8" },
      );

      assert.equal(generated.status, 0, generated.stderr);
    }

    const main = git("branch", "--show-current");
    git("switch", "-c", "maintenance");
    writeFileSync(path.join(root, "maintenance.txt"), "safe\n");
    git("add", "maintenance.txt");
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", validHeader);
    git("switch", main);
    const mergeHeader = "Merge https://example.invalid/maintenance";

    const merge = spawnSync(
      "git",
      [...gitArgs, "merge", "--no-ff", "--no-edit", "-m", mergeHeader, "maintenance"],
      { encoding: "utf8" },
    );
    assert.equal(merge.status, 0, merge.stderr);
    assert.equal(git("log", "-1", "--format=%s"), mergeHeader);
    const amend = spawnSync("git", [...gitArgs, "commit", "--amend", "--no-edit"], { encoding: "utf8" });

    assert.equal(amend.status, 0, amend.stderr);
    assert.equal(git("log", "-1", "--format=%s"), mergeHeader);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});

test("親の Git 設定と引き継ぎ対象外のフックを維持する", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "git-hook-test-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  try {
    git("init", "--quiet");
    git("config", "--local", "core.hooksPath", ".git/hooks");
    const nested = path.join(root, "template");
    mkdirSync(nested);
    assert.equal(installGitHooks(nested), false);
    writeFileSync(path.join(root, ".git", "hooks", "post-commit"), "#!/bin/sh\nexit 23\n");
    assert.equal(installGitHooks(root), false);
    assert.equal(git("config", "--local", "--get", "core.hooksPath"), ".git/hooks");
    git("config", "--local", "template.previousHooksPath", ".git/hooks");
    git("config", "--local", "core.hooksPath", ".githooks");
    assert.equal(installGitHooks(root), false);
    assert.equal(
      path.resolve(root, git("config", "--local", "--get", "core.hooksPath")),
      path.join(root, ".git", "hooks"),
    );
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});
