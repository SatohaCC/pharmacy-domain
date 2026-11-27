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

/** frontend/biome.json の $schema バージョンと実際の @biomejs/biome バージョンの不一致を返す。 */
export function findBiomeSchemaMismatch(
  root: string,
): { expected: string; actual: string } | null {
  const biomeConfigPath = path.join(root, "frontend/biome.json");
  const biomePkgPath = path.join(root, "frontend/node_modules/@biomejs/biome/package.json");
  if (!existsSync(biomeConfigPath) || !existsSync(biomePkgPath)) {
    return null;
  }
  const config = JSON.parse(readFileSync(biomeConfigPath, "utf8")) as { $schema?: string };
  const pkg = JSON.parse(readFileSync(biomePkgPath, "utf8")) as { version?: string };
  const match = config.$schema?.match(/\/schemas\/([^/]+)\/schema\.json$/);
  if (!match || !pkg.version) {
    return null;
  }
  return match[1] === pkg.version ? null : { expected: pkg.version, actual: match[1] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "..");
  const missing = findMissingDependencies(root);
  const biomeMismatch = findBiomeSchemaMismatch(root);
  if (missing.length === 0 && biomeMismatch === null) {
    console.log("必要な JavaScript 依存がインストールされています。");
  } else {
    for (const { manifest, name } of missing) console.error(`${manifest}: ${name} が未インストールです。`);
    if (missing.length > 0) {
      console.error("リポジトリのルートで pnpm install --frozen-lockfile を実行してください。");
    }
    if (biomeMismatch !== null) {
      console.error(
        `frontend/biome.json の $schema (${biomeMismatch.actual}) が @biomejs/biome (${biomeMismatch.expected}) と一致しません。frontend/biome.json の $schema を更新してください。`,
      );
    }
    process.exitCode = 1;
  }
}
