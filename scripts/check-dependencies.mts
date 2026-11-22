import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

/** pnpm のルートと frontend に直接インストールされていない依存を列挙する。 */
export function findMissingDependencies(root: string): { manifest: string; name: string }[] {
  return [".", "frontend"].flatMap((workspace) => {
    const manifest = path.posix.join(workspace, "package.json");
    const config: PackageManifest = JSON.parse(readFileSync(path.join(root, manifest), "utf8"));
    const names = Object.keys({ ...config.dependencies, ...config.devDependencies }).sort();
    return names
      .filter((name) => !Object.hasOwn(config.optionalDependencies ?? {}, name))
      .filter((name) => !existsSync(path.join(root, workspace, "node_modules", name, "package.json")))
      .map((name) => ({ manifest, name }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const missing = findMissingDependencies(path.resolve(import.meta.dirname, ".."));
  if (missing.length === 0) {
    console.log("必要な JavaScript 依存がインストールされています。");
  } else {
    for (const { manifest, name } of missing) console.error(`${manifest}: ${name} が未インストールです。`);
    console.error("リポジトリのルートで pnpm install --frozen-lockfile を実行してください。");
    process.exitCode = 1;
  }
}
