import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_API_TYPES_RELATIVE_PATH = path.join(
  "frontend",
  "src",
  "shared",
  "lib",
  "api",
  "schema.d.ts",
);

export interface OpenApiSchema {
  $ref?: string;
  const?: unknown;
  enum?: readonly unknown[];
  anyOf?: readonly OpenApiSchema[];
  oneOf?: readonly OpenApiSchema[];
  allOf?: readonly OpenApiSchema[];
  type?: string | readonly string[];
  items?: OpenApiSchema | boolean;
  prefixItems?: readonly OpenApiSchema[];
  properties?: Record<string, OpenApiSchema>;
  required?: readonly string[];
  additionalProperties?: boolean | OpenApiSchema;
}

export interface OpenApiParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: OpenApiSchema;
}

export interface OpenApiMediaType {
  schema?: OpenApiSchema;
}

export interface OpenApiOperation {
  parameters?: readonly OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, OpenApiMediaType | undefined>;
  };
  responses?: Record<
    string,
    {
      content?: Record<string, OpenApiMediaType | undefined>;
    }
  >;
}

export interface OpenApiDocument {
  paths?: Record<string, Record<string, OpenApiOperation | undefined> | undefined>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
  };
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;
const SCHEMA_REF_PREFIX = "#/components/schemas/";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPropertyKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function indentSpaces(depth: number): string {
  return "  ".repeat(depth);
}

function schemaToTs(schema: OpenApiSchema | undefined, depth: number): string {
  if (!schema) {
    return "unknown";
  }

  if (typeof schema.$ref === "string") {
    if (schema.$ref.startsWith(SCHEMA_REF_PREFIX)) {
      const schemaName = schema.$ref.slice(SCHEMA_REF_PREFIX.length);
      return `components["schemas"][${JSON.stringify(schemaName)}]`;
    }
    return "unknown";
  }

  if (Object.hasOwn(schema, "const")) {
    return schema.const === undefined ? "unknown" : (JSON.stringify(schema.const) ?? "unknown");
  }

  if (Array.isArray(schema.enum)) {
    const values = Array.from(
      new Set(schema.enum.map((value) => JSON.stringify(value) ?? "unknown")),
    );
    return values.length > 0 ? values.join(" | ") : "never";
  }

  if (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf)) {
    const variants = schema.anyOf ?? schema.oneOf ?? [];
    const rendered = Array.from(new Set(variants.map((item) => schemaToTs(item, depth))));
    return rendered.length > 0 ? rendered.join(" | ") : "unknown";
  }

  if (Array.isArray(schema.allOf)) {
    const rendered = Array.from(new Set(schema.allOf.map((item) => schemaToTs(item, depth))));
    if (rendered.length === 0) return "unknown";
    if (rendered.length === 1) return rendered[0];
    return rendered.map((part) => `(${part})`).join(" & ");
  }

  if (Array.isArray(schema.type)) {
    const rendered = Array.from(
      new Set(
        schema.type.map((itemType) =>
          schemaToTs({ ...schema, type: itemType } satisfies OpenApiSchema, depth),
        ),
      ),
    );
    return rendered.length > 0 ? rendered.join(" | ") : "unknown";
  }

  if (schema.type === "string") return "string";
  if (schema.type === "number" || schema.type === "integer") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "null") return "null";

  if (schema.type === "array") {
    if (Array.isArray(schema.prefixItems)) {
      const tupleItems = schema.prefixItems.map((item) => schemaToTs(item, depth));
      return `[${tupleItems.join(", ")}]`;
    }
    if (isRecord(schema.items)) {
      return `Array<${schemaToTs(schema.items as OpenApiSchema, depth)}>`;
    }
    return "unknown[]";
  }

  if (
    schema.type === "object" ||
    isRecord(schema.properties) ||
    schema.additionalProperties !== undefined
  ) {
    const propEntries = isRecord(schema.properties)
      ? Object.entries(schema.properties).sort(([a], [b]) => a.localeCompare(b))
      : [];
    const requiredSet = new Set(Array.isArray(schema.required) ? schema.required : []);
    const lines: string[] = [];

    for (const [propName, propSchema] of propEntries) {
      const opt = requiredSet.has(propName) ? "" : "?";
      const rendered = schemaToTs(propSchema as OpenApiSchema, depth + 1);
      lines.push(`${indentSpaces(depth + 1)}${formatPropertyKey(propName)}${opt}: ${rendered};`);
    }

    if (schema.additionalProperties === true) {
      lines.push(`${indentSpaces(depth + 1)}[key: string]: unknown;`);
    } else if (isRecord(schema.additionalProperties)) {
      const valueType = schemaToTs(schema.additionalProperties as OpenApiSchema, depth + 1);
      lines.push(`${indentSpaces(depth + 1)}[key: string]: ${valueType};`);
    }

    if (lines.length === 0) {
      return schema.additionalProperties === false
        ? "Record<string, never>"
        : "Record<string, unknown>";
    }
    return `{\n${lines.join("\n")}\n${indentSpaces(depth)}}`;
  }

  return "unknown";
}

function renderOperation(operation: OpenApiOperation, depth: number): string {
  const lines: string[] = [];
  const params = Array.isArray(operation.parameters) ? operation.parameters : [];
  const grouped = new Map<string, OpenApiParameter[]>();
  for (const param of params) {
    if (!param || typeof param.in !== "string" || typeof param.name !== "string") continue;
    const list = grouped.get(param.in) ?? [];
    list.push(param);
    grouped.set(param.in, list);
  }

  if (grouped.size > 0) {
    const paramLines: string[] = [];
    for (const location of ["query", "path", "header"]) {
      const items = grouped.get(location);
      if (!items?.length) continue;
      const itemLines = items
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => {
          const opt = item.required ? "" : "?";
          const tsType = schemaToTs(item.schema, depth + 3);
          return `${indentSpaces(depth + 3)}${formatPropertyKey(item.name)}${opt}: ${tsType};`;
        });
      paramLines.push(
        `${indentSpaces(depth + 2)}${location}: {\n${itemLines.join("\n")}\n${indentSpaces(depth + 2)}};`,
      );
    }
    if (paramLines.length > 0) {
      lines.push(
        `${indentSpaces(depth + 1)}parameters: {\n${paramLines.join("\n")}\n${indentSpaces(depth + 1)}};`,
      );
    }
  }

  const reqJsonSchema = operation.requestBody?.content?.["application/json"]?.schema;
  if (reqJsonSchema) {
    const opt = operation.requestBody?.required ? "" : "?";
    lines.push(`${indentSpaces(depth + 1)}requestBody${opt}: {`);
    lines.push(`${indentSpaces(depth + 2)}content: {`);
    lines.push(
      `${indentSpaces(depth + 3)}"application/json": ${schemaToTs(reqJsonSchema, depth + 4)};`,
    );
    lines.push(`${indentSpaces(depth + 2)}};`);
    lines.push(`${indentSpaces(depth + 1)}};`);
  }

  const responses = isRecord(operation.responses)
    ? Object.entries(operation.responses).sort(([a], [b]) => a.localeCompare(b))
    : [];
  lines.push(`${indentSpaces(depth + 1)}responses: {`);
  for (const [statusCode, responseObj] of responses) {
    const key = /^[0-9]+$/.test(statusCode) ? statusCode : JSON.stringify(statusCode);
    const jsonSchema = responseObj?.content?.["application/json"]?.schema;
    if (jsonSchema) {
      lines.push(`${indentSpaces(depth + 2)}${key}: {`);
      lines.push(`${indentSpaces(depth + 3)}content: {`);
      lines.push(
        `${indentSpaces(depth + 4)}"application/json": ${schemaToTs(jsonSchema, depth + 5)};`,
      );
      lines.push(`${indentSpaces(depth + 3)}};`);
      lines.push(`${indentSpaces(depth + 2)}};`);
    } else {
      lines.push(`${indentSpaces(depth + 2)}${key}: {`);
      lines.push(`${indentSpaces(depth + 3)}content?: never;`);
      lines.push(`${indentSpaces(depth + 2)}};`);
    }
  }
  lines.push(`${indentSpaces(depth + 1)}};`);

  return `{\n${lines.join("\n")}\n${indentSpaces(depth)}}`;
}

/** OpenAPI ドキュメントから TypeScript 型定義ファイルを生成する。 */
export function openApiToTypeScript(spec: OpenApiDocument): string {
  const sections: string[] = [
    "/**",
    " * このファイルは `pnpm gen:api-types` により自動生成されます。直接編集しないでください。",
    " */",
    "",
  ];

  const pathEntries = isRecord(spec.paths)
    ? Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b))
    : [];

  if (pathEntries.length === 0) {
    sections.push("export type paths = Record<string, never>;");
  } else {
    sections.push("export interface paths {");
    for (const [routePath, pathItem] of pathEntries) {
      if (!isRecord(pathItem)) continue;
      sections.push(`${indentSpaces(1)}${JSON.stringify(routePath)}: {`);
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method];
        if (!operation) continue;
        sections.push(`${indentSpaces(2)}${method}: ${renderOperation(operation, 2)};`);
      }
      sections.push(`${indentSpaces(1)}};`);
    }
    sections.push("}");
  }

  sections.push("");

  const schemaEntries = isRecord(spec.components?.schemas)
    ? Object.entries(spec.components.schemas).sort(([a], [b]) => a.localeCompare(b))
    : [];

  if (schemaEntries.length === 0) {
    sections.push("export interface components {", "  schemas: Record<string, never>;", "}");
  } else {
    sections.push("export interface components {", "  schemas: {");
    for (const [schemaName, schemaObj] of schemaEntries) {
      sections.push(
        `${indentSpaces(2)}${formatPropertyKey(schemaName)}: ${schemaToTs(schemaObj, 2)};`,
      );
    }
    sections.push("  };", "}");
  }

  return `${sections.join("\n").replaceAll("\r\n", "\n")}\n`;
}

function getBackendPythonPath(root: string): string {
  return process.platform === "win32"
    ? path.join(root, "backend", ".venv", "Scripts", "python.exe")
    : path.join(root, "backend", ".venv", "bin", "python");
}

/** FastAPI の create_app().openapi() から OpenAPI スキーマ JSON を取得する。 */
export function fetchBackendOpenApi(root: string): OpenApiDocument {
  const pythonPath = getBackendPythonPath(root);
  const rawJson = execFileSync(
    pythonPath,
    [
      "-B",
      "-c",
      "import json; from app.main import create_app; print(json.dumps(create_app().openapi(), ensure_ascii=False, sort_keys=True))",
    ],
    { cwd: path.join(root, "backend"), encoding: "utf8" },
  );
  return JSON.parse(rawJson) as OpenApiDocument;
}

/** Backend の OpenAPI スキーマから TypeScript 型定義文字列を生成して返す。 */
export function renderApiTypes(root: string): string {
  return openApiToTypeScript(fetchBackendOpenApi(root));
}

/** OpenAPI 型定義ファイルを生成・保存し、その内容を返す。 */
export function generateApiTypes({
  root,
  outputPath = path.join(root, DEFAULT_API_TYPES_RELATIVE_PATH),
}: {
  root: string;
  outputPath?: string;
}): string {
  const content = renderApiTypes(root);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, "utf8");
  return content;
}

/** 生成済みの OpenAPI 型定義ファイルが最新かどうかを検証する。 */
export function checkApiTypes({
  root,
  targetPath = path.join(root, DEFAULT_API_TYPES_RELATIVE_PATH),
}: {
  root: string;
  targetPath?: string;
}): { upToDate: boolean; expected: string; actual: string | null } {
  const expected = renderApiTypes(root);
  const actual = existsSync(targetPath)
    ? readFileSync(targetPath, "utf8").replaceAll("\r\n", "\n")
    : null;
  return { upToDate: actual === expected, expected, actual };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "..");
  if (process.argv.includes("--check")) {
    const result = checkApiTypes({ root });
    if (!result.upToDate) {
      console.error(
        "OpenAPI 生成型に差分があります。pnpm gen:api-types を実行して更新してください。",
      );
      process.exit(1);
    }
    console.log("OpenAPI 生成型は最新です。");
  } else {
    generateApiTypes({ root });
    console.log("frontend/src/shared/lib/api/schema.d.ts を生成しました。");
  }
}
