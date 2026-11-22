import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkApiTypes,
  generateApiTypes,
  type OpenApiDocument,
  openApiToTypeScript,
} from "./generate-api-types.mts";

const ROOT = path.resolve(import.meta.dirname, "..");

test("OpenAPI スキーマのプリミティブ・Union・参照・オブジェクトを決定論的に変換する", () => {
  const spec: OpenApiDocument = {
    paths: {
      "/api/items": {
        get: {
          parameters: [
            { name: "limit", in: "query", required: false, schema: { type: "integer" } },
          ],
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Item" },
                  },
                },
              },
            },
          },
        },
        post: {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateItem" },
              },
            },
          },
          responses: {
            "204": {},
          },
        },
      },
    },
    components: {
      schemas: {
        CreateItem: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            note: { anyOf: [{ type: "string" }, { type: "null" }] },
            role: { enum: ["admin", "user"] },
          },
        },
        Item: {
          type: "object",
          required: ["id", "status"],
          properties: {
            id: { type: "string" },
            status: { const: "active", type: "string" },
            meta: { type: "object", additionalProperties: { type: "string" } },
          },
        },
      },
    },
  };

  const first = openApiToTypeScript(spec);
  const second = openApiToTypeScript(spec);

  assert.equal(first, second);
  assert.equal(first.includes("\r\n"), false);
  assert.match(first, /"/);
  assert.match(first, /note\?: string \| null;/);
  assert.match(first, /role\?: "admin" \| "user";/);
  assert.match(first, /status: "active";/);
  assert.match(first, /\[key: string\]: string;/);
  assert.match(first, /"application\/json": Array<components\["schemas"\]\["Item"\]>;/);
  assert.match(first, /requestBody: \{/);
  assert.match(first, /204: \{\s+content\?: never;\s+\};/);
});

test("allOf で Union を含む複数メンバーを結合する際に各メンバーを括弧で囲む", () => {
  const spec: OpenApiDocument = {
    components: {
      schemas: {
        Item: { type: "string" },
        SingleAllOf: {
          allOf: [{ $ref: "#/components/schemas/Item" }],
        },
        UnionIntersection: {
          allOf: [
            {
              anyOf: [
                { type: "object", required: ["a"], properties: { a: { type: "string" } } },
                { type: "object", required: ["b"], properties: { b: { type: "string" } } },
              ],
            },
            { type: "object", required: ["id"], properties: { id: { type: "string" } } },
          ],
        },
      },
    },
  };

  const output = openApiToTypeScript(spec);

  assert.match(output, /SingleAllOf: components\["schemas"\]\["Item"\];/);
  assert.match(
    output,
    /UnionIntersection: \(\{\s+a: string;\s+\} \| \{\s+b: string;\s+\}\) & \(\{\s+id: string;\s+\}\);/,
  );
});

test("現行の生成済み型ファイルに対して checkApiTypes が最新と判定する", () => {
  const result = checkApiTypes({ root: ROOT });

  assert.equal(result.upToDate, true);
});

test("ドリフトした型ファイルに対して checkApiTypes が差分ありと判定する", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "api-types-test-"));
  try {
    const targetPath = path.join(tempDir, "schema.d.ts");
    writeFileSync(targetPath, "// drifted\n", "utf8");

    const result = checkApiTypes({ root: ROOT, targetPath });

    assert.equal(result.upToDate, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generateApiTypes で一時ファイルへ生成した直後は checkApiTypes が最新と判定する", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "api-types-test-"));
  try {
    const outputPath = path.join(tempDir, "schema.d.ts");
    generateApiTypes({ root: ROOT, outputPath });

    const result = checkApiTypes({ root: ROOT, targetPath: outputPath });

    assert.equal(result.upToDate, true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
