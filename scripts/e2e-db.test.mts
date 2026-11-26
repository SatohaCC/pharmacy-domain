import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveDisposableE2eDbPath } from "./e2e-db.mts";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("通常の DATABASE_PATH が設定されていても無視して既定の .cache パスを返す", () => {
  const resolved = resolveDisposableE2eDbPath(repoRoot, {
    DATABASE_PATH: "data/app.db",
  });
  assert.equal(resolved, path.join(repoRoot, ".cache", "playwright-e2e.db"));
});

test("E2E_DATABASE_PATH の相対パスは backend/ 基準で正規化される", () => {
  const resolved = resolveDisposableE2eDbPath(repoRoot, {
    E2E_DATABASE_PATH: "../.cache/custom-e2e.db",
  });
  assert.equal(resolved, path.join(repoRoot, ".cache", "custom-e2e.db"));
});

test("一時ディレクトリ配下の絶対パスを許可する", () => {
  const tmpTarget = path.join(os.tmpdir(), "pharmacy-domain-test.db");
  const resolved = resolveDisposableE2eDbPath(repoRoot, {
    E2E_DATABASE_PATH: tmpTarget,
  });
  assert.equal(resolved, path.resolve(tmpTarget));
});

test(".cache と一時ディレクトリ以外のパスは安全ガードで拒否する", () => {
  assert.throws(
    () =>
      resolveDisposableE2eDbPath(repoRoot, {
        E2E_DATABASE_PATH: "data/app.db",
      }),
    /E2E_DATABASE_PATH/,
  );
});
