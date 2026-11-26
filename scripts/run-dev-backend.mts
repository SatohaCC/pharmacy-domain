import { spawnSync } from "node:child_process";
import path from "node:path";

const DEFAULT_DEV_DATABASE_URL = "postgresql://pharmacy:pharmacy@127.0.0.1:5432/pharmacy";

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
