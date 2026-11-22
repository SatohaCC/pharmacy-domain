import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("不足した直接依存を表示し、インストール後に成功する", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "template-deps-test-"));
  try {
    mkdirSync(path.join(root, "frontend"));
    mkdirSync(path.join(root, "scripts"));
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ devDependencies: { concurrently: "*" } }));
    writeFileSync(path.join(root, "frontend/package.json"), JSON.stringify({
      dependencies: { zod: "*", optional: "*" },
      devDependencies: { "@types/node": "*" },
      optionalDependencies: { optional: "*" },
    }));
    const script = path.join(root, "scripts/check-dependencies.mts");
    copyFileSync(path.join(import.meta.dirname, "check-dependencies.mts"), script);

    const missing = spawnSync(process.execPath, [script], { encoding: "utf8" });

    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /^package\.json: concurrently が未インストールです。$/m);
    assert.match(missing.stderr, /^frontend\/package\.json: @types\/node が未インストールです。$/m);
    assert.match(missing.stderr, /^frontend\/package\.json: zod が未インストールです。$/m);
    assert.doesNotMatch(missing.stderr, /optional/);
    assert.match(missing.stderr, /pnpm install --frozen-lockfile/);

    for (const directory of ["node_modules/concurrently", "frontend/node_modules/zod", "frontend/node_modules/@types/node"]) {
      const packagePath = path.join(root, directory);
      mkdirSync(packagePath, { recursive: true });
      writeFileSync(path.join(packagePath, "package.json"), "{}");
    }

    const installed = spawnSync(process.execPath, [script], { encoding: "utf8" });

    assert.equal(installed.status, 0, installed.stderr);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});
