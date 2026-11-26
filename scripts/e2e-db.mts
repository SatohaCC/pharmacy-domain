import os from "node:os";
import path from "node:path";

function isWithinDirectory(targetPath: string, allowedDir: string): boolean {
  const relative = path.relative(path.resolve(allowedDir), path.resolve(targetPath));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * 破棄可能な E2E 専用 SQLite データベースパスを解決・検証する。
 * 通常アプリ用の DATABASE_PATH は参照せず、E2E_DATABASE_PATH のみを受け付ける。
 */
export function resolveDisposableE2eDbPath(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const resolvedRoot = path.resolve(repoRoot);
  const backendDir = path.join(resolvedRoot, "backend");
  const cacheDir = path.join(resolvedRoot, ".cache");
  const tempDir = os.tmpdir();
  const defaultPath = path.join(cacheDir, "playwright-e2e.db");

  const rawConfigured = env.E2E_DATABASE_PATH?.trim();
  if (!rawConfigured) {
    return defaultPath;
  }

  const candidate = path.isAbsolute(rawConfigured)
    ? path.resolve(rawConfigured)
    : path.resolve(backendDir, rawConfigured);

  if (!isWithinDirectory(candidate, cacheDir) && !isWithinDirectory(candidate, tempDir)) {
    throw new Error(
      `E2E_DATABASE_PATH はリポジトリの .cache 配下または一時ディレクトリ配下を指定してください: ${candidate}`,
    );
  }

  return candidate;
}
