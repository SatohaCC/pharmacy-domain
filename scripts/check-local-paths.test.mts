import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkLocalPaths, containsLocalPath, isAbsoluteLink } from "./check-local-paths.mts";

test("Windows・Unixの個人パス、file URI、UNCパスを検出する", () => {
  const samples = [
    ["C:", "Users", "example", "project"].join("\\"),
    ["D:", "work", "project"].join("/"),
    ["", "Users", "example", "project"].join("/"),
    ["", "home", "example", "project"].join("/"),
    ["", "home", "example"].join("/"),
    ["", "Users", "Example User", "project"].join("/"),
    ["", "root", "project"].join("/"),
    "file:" + "///example/project",
    ["", "", "machine", "share", "project"].join("\\"),
    ["C:", "Users", "example"].join("%5C"),
  ];
  for (const sample of samples) assert.equal(containsLocalPath(sample), true);
});

test("相対パス、APIパス、通常のURL、ワークスペース変数は許可する", () => {
  for (const sample of ["../backend", "/api/health", "https://example.com/docs", "${workspaceFolder}/backend"])
    assert.equal(containsLocalPath(sample), false);
  assert.equal(isAbsoluteLink("../environment"), false);
  assert.equal(isAbsoluteLink(["", "opt", "environment"].join("/")), true);
  assert.equal(isAbsoluteLink(["C:", "environment"].join("\\")), true);
});

test("未追跡・無視対象・ステージ内容を区別して検査する", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "local-path-check-"));
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args]);
  try {
    git("init", "--quiet");
    writeFileSync(path.join(root, ".gitignore"), ".cache/\n");
    const privatePath = ["C:", "Users", "example", "project"].join("/");
    mkdirSync(path.join(root, ".cache"));
    writeFileSync(path.join(root, ".cache", "ignored.txt"), privatePath);
    writeFileSync(path.join(root, "sample.txt"), `safe\n${privatePath}\n`);
    assert.deepEqual(checkLocalPaths({ root }), [{ file: "sample.txt", line: 2 }]);
    git("add", "sample.txt", ".gitignore");
    writeFileSync(path.join(root, "sample.txt"), "safe\n");
    assert.deepEqual(checkLocalPaths({ root }), []);
    assert.deepEqual(checkLocalPaths({ root, staged: true }), [{ file: "sample.txt", line: 2 }]);
    git("add", "sample.txt");
    assert.deepEqual(checkLocalPaths({ root, staged: true }), []);
  } finally {
    // 作成した専用の一時ディレクトリだけを削除する。
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});
