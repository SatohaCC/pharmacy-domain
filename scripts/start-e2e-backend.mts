import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const backendDir = path.join(repoRoot, "backend");
const pythonPath =
  process.platform === "win32"
    ? path.join(backendDir, ".venv", "Scripts", "python.exe")
    : path.join(backendDir, ".venv", "bin", "python");

const dbPath =
  process.env.DATABASE_PATH?.trim() || path.join(repoRoot, ".cache", "playwright-e2e.db");
mkdirSync(path.dirname(dbPath), { recursive: true });

// 毎回クリーンな DB で E2E テストを開始するため、既存の SQLite ファイルを削除する。
for (const suffix of ["", "-wal", "-shm"]) {
  const target = `${dbPath}${suffix}`;
  if (existsSync(target)) {
    rmSync(target, { force: true });
  }
}

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_PATH: dbPath,
};

execFileSync(pythonPath, ["-B", "-m", "alembic", "upgrade", "head"], {
  cwd: backendDir,
  env,
  stdio: "inherit",
});

const server = spawn(
  pythonPath,
  ["-B", "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
  {
    cwd: backendDir,
    env,
    stdio: "inherit",
  },
);

const shutdown = (signal: NodeJS.Signals) => {
  if (!server.killed) {
    server.kill(signal);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.on("exit", (code) => {
  process.exit(code ?? 0);
});
