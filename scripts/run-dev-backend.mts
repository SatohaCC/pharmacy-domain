import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DEV_DATABASE_URL = "postgresql://pharmacy:pharmacy@127.0.0.1:5432/pharmacy";

const MIGRATION_CHECK_SCRIPT = `
import json
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from app.infrastructure.config import load_settings
from app.infrastructure.persistence.database import create_app_engine

cfg = Config("alembic.ini")
heads = sorted(ScriptDirectory.from_config(cfg).get_heads())
engine = create_app_engine(load_settings().effective_database_target)
try:
    with engine.connect() as conn:
        current = sorted(MigrationContext.configure(conn).get_current_heads())
finally:
    engine.dispose()

print(json.dumps({"ok": current == heads, "current": current, "heads": heads}))
`.trim();

/** 起動引数と環境変数から起動前マイグレーション確認の要否を判定する。 */
export function shouldCheckMigrations(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): boolean {
  return args.includes("uvicorn") && env.SKIP_MIGRATION_CHECK !== "1";
}

/** Alembic の現在リビジョンと head を比較し、未適用マイグレーションがあればエラー内容を返す。 */
export function checkDatabaseMigrationUpToDate(
  pythonPath: string,
  backendDir: string,
  env: NodeJS.ProcessEnv,
): { ok: true } | { ok: false; reason: string } {
  const check = spawnSync(pythonPath, ["-B", "-c", MIGRATION_CHECK_SCRIPT], {
    cwd: backendDir,
    env,
    encoding: "utf8",
  });
  if (check.error) {
    return { ok: false, reason: check.error.message };
  }
  if (check.status !== 0) {
    return {
      ok: false,
      reason:
        check.stderr.trim() ||
        check.stdout.trim() ||
        "マイグレーション状態の確認に失敗しました。",
    };
  }
  try {
    const parsed = JSON.parse(check.stdout.trim()) as {
      ok: boolean;
      current: string[];
      heads: string[];
    };
    if (parsed.ok) {
      return { ok: true };
    }
    const currentText = parsed.current.length > 0 ? parsed.current.join(", ") : "未初期化";
    const headText = parsed.heads.join(", ");
    return {
      ok: false,
      reason: `DB のマイグレーションが最新ではありません (current: ${currentText}, head: ${headText})。\`pnpm db:migrate\` を実行してください。`,
    };
  } catch {
    return {
      ok: false,
      reason: `マイグレーション状態の解析に失敗しました: ${check.stdout.trim()}`,
    };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const backendDir = path.join(repoRoot, "backend");
  const pythonPath =
    process.platform === "win32"
      ? path.join(backendDir, ".venv", "Scripts", "python.exe")
      : path.join(backendDir, ".venv", "bin", "python");

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("実行する Python モジュール引数を指定してください。");
    process.exit(1);
  }

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (!env.DATABASE_URL?.trim() && !env.DATABASE_PATH?.trim()) {
    env.DATABASE_URL = DEFAULT_DEV_DATABASE_URL;
  }

  if (shouldCheckMigrations(args, env)) {
    const migrationCheck = checkDatabaseMigrationUpToDate(pythonPath, backendDir, env);
    if (!migrationCheck.ok) {
      console.error(migrationCheck.reason);
      process.exit(1);
    }
  }

  const result = spawnSync(pythonPath, ["-B", ...args], {
    cwd: backendDir,
    env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}
