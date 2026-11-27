import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { shouldCheckMigrations } from "./run-dev-backend.mts";

const scriptPath = path.resolve(import.meta.dirname, "run-dev-backend.mts");

test("shouldCheckMigrations は uvicorn 実行時のみ有効になる", () => {
  assert.equal(shouldCheckMigrations(["-m", "uvicorn", "app.main:app"], {}), true);
  assert.equal(
    shouldCheckMigrations(["-m", "uvicorn", "app.main:app"], { SKIP_MIGRATION_CHECK: "1" }),
    false,
  );
  assert.equal(shouldCheckMigrations(["-m", "alembic", "upgrade", "head"], {}), false);
});

test("未適用マイグレーションの DB では uvicorn 起動を停止し、適用後は通過する", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "dev-backend-guard-"));
  const dbPath = path.join(tempDir, "dev.sqlite3");
  const env = { ...process.env, DATABASE_PATH: dbPath };

  try {
    const blocked = spawnSync(
      process.execPath,
      [scriptPath, "-m", "uvicorn", "--version"],
      { env, encoding: "utf8" },
    );
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /pnpm db:migrate/);

    const nonUvicorn = spawnSync(
      process.execPath,
      [scriptPath, "-m", "alembic", "current"],
      { env, encoding: "utf8" },
    );
    assert.equal(nonUvicorn.status, 0, nonUvicorn.stderr);

    const migrated = spawnSync(
      process.execPath,
      [scriptPath, "-m", "alembic", "upgrade", "head"],
      { env, encoding: "utf8" },
    );
    assert.equal(migrated.status, 0, migrated.stderr);

    const allowed = spawnSync(
      process.execPath,
      [scriptPath, "-m", "uvicorn", "--version"],
      { env, encoding: "utf8" },
    );
    assert.equal(allowed.status, 0, allowed.stderr);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
