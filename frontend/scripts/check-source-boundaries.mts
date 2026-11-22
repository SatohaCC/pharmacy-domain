import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type NodePath, parseSync, traverse, type types } from "@babel/core";

const sharedRules = [
  {
    sources: ["shared/ui"],
    forbidden: ["app", "features", "shared/components", "shared/lib"],
  },
  {
    sources: ["shared/components"],
    forbidden: ["app", "features", "shared/lib", "shared/ui/internal"],
  },
  { sources: ["app", "features"], forbidden: ["shared/ui/internal"] },
];

type SourceIssue = { line: number; message: string };
type ModuleLiteral = types.StringLiteral | types.TemplateLiteral;

function isUnder(file: string, directory: string): boolean {
  return file === directory || file.startsWith(`${directory}/`);
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function isModuleReference(reference: NodePath<ModuleLiteral>): boolean {
  switch (reference.parent.type) {
    case "ImportDeclaration":
    case "ExportNamedDeclaration":
    case "ExportAllDeclaration":
    case "ImportExpression":
      return reference.key === "source";
    case "TSExternalModuleReference":
      return reference.key === "expression";
    case "TSImportType":
      return reference.key === "source" || reference.key === "argument";
    case "CallExpression": {
      const callee = reference.parent.callee;
      return (
        reference.listKey === "arguments" &&
        reference.key === 0 &&
        (callee.type === "Import" ||
          (callee.type === "Identifier" &&
            callee.name === "require" &&
            !reference.scope.getBinding("require")))
      );
    }
    default:
      return false;
  }
}

function isStylexCreate(call: NodePath<types.CallExpression>): boolean {
  const { callee } = call.node;
  const identifier = callee.type === "MemberExpression" ? callee.object : callee;
  if (identifier.type !== "Identifier") return false;

  const imported = call.scope.getBinding(identifier.name)?.path;
  const declaration = imported?.parentPath;
  if (!declaration?.isImportDeclaration() || declaration.node.source.value !== "@stylexjs/stylex") {
    return false;
  }
  if (callee.type === "Identifier" && imported?.isImportSpecifier()) {
    const { imported: name } = imported.node;
    return (name.type === "Identifier" ? name.name : name.value) === "create";
  }
  if (
    callee.type === "MemberExpression" &&
    (imported?.isImportNamespaceSpecifier() || imported?.isImportDefaultSpecifier())
  ) {
    return callee.computed
      ? callee.property.type === "StringLiteral" && callee.property.value === "create"
      : callee.property.type === "Identifier" && callee.property.name === "create";
  }
  return false;
}

/** リポジトリ内の依存先と StyleX の記述場所を検査する。 */
export function checkSourceFile(sourceRoot: string, file: string, source: string): SourceIssue[] {
  const relativeFile = path.relative(sourceRoot, file).split(path.sep).join("/");
  const forbidden = sharedRules.find(({ sources }) =>
    sources.some((directory) => isUnder(relativeFile, directory)),
  )?.forbidden;
  const isSharedUI =
    isUnder(relativeFile, "shared/ui") || isUnder(relativeFile, "shared/components");
  const isProduction = !/\.(?:test|spec|stories)\.[cm]?[jt]sx?$/.test(relativeFile);
  const ast = parseSync(source, {
    configFile: false,
    babelrc: false,
    sourceType: "unambiguous",
    parserOpts: { plugins: /\.[jt]sx$/.test(file) ? ["typescript", "jsx"] : ["typescript"] },
  });
  if (!ast) throw new Error(`${relativeFile} を解析できませんでした。`);

  const issues: SourceIssue[] = [];
  const checkReference = (reference: NodePath<ModuleLiteral>, specifier: string) => {
    if (!isModuleReference(reference)) return;
    const line = reference.node.loc?.start.line ?? 1;
    const relative = isRelative(specifier);
    const target = relative
      ? path.resolve(path.dirname(file), specifier)
      : specifier.startsWith("@/")
        ? path.join(sourceRoot, specifier.slice(2))
        : undefined;
    if (target && forbidden) {
      const targetFile = path.relative(sourceRoot, target).split(path.sep).join("/");
      if (forbidden.some((directory) => isUnder(targetFile, directory))) {
        issues.push({ line, message: `依存方向の規約により ${specifier} を参照できません。` });
      }
    }
    if (isProduction && !relative && /\.stylex(?:\.[cm]?[jt]sx?)?$/.test(specifier)) {
      issues.push({
        line,
        message: `StyleX モジュール ${specifier} は相対パスで参照してください。`,
      });
    }
  };

  traverse(ast, {
    StringLiteral(reference) {
      checkReference(reference, reference.node.value);
    },
    TemplateLiteral(reference) {
      const literal = reference.node.quasis[0]?.value.cooked;
      if (reference.node.expressions.length === 0 && literal != null) {
        checkReference(reference, literal);
      }
    },
    CallExpression(call) {
      if (
        isSharedUI &&
        isProduction &&
        !relativeFile.endsWith(".styles.ts") &&
        isStylexCreate(call)
      ) {
        issues.push({
          line: call.node.loc?.start.line ?? 1,
          message: "stylex.create() は *.styles.ts に置いてください。",
        });
      }
    },
  });

  return issues;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceRoot = path.resolve(import.meta.dirname, "../src");
  const files = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
  for (const file of files) {
    for (const issue of checkSourceFile(sourceRoot, file, readFileSync(file, "utf8"))) {
      console.error(`${path.relative(process.cwd(), file)}:${issue.line}: ${issue.message}`);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) console.log("フロントエンドの依存方向と StyleX の配置を確認しました。");
}
