import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { checkSourceFile } from "../frontend/scripts/check-source-boundaries.mts";

const sourceRoot = path.resolve("frontend/src");

test("エイリアスと相対パスで同じ禁止レイヤーを検出する", () => {
  const file = path.join(sourceRoot, "shared/ui/button/Button.tsx");
  const code = [
    'import type { TaskItem } from "@/features/tasks/tasksApi";',
    'export * from "../../../app/page";',
    'export const load = () => import(`../../lib/api/apiClient`);',
    'type Status = import("../../components/status-card/StatusCard").StatusCardProps;',
    'const direct = require("../../../features/tasks/tasksApi");',
    'export * from "@//features/tasks/tasksApi";',
    'import { other } from "@/shared/ui/alert/Alert";',
    'const label = "@/features/tasks/tasksApi";',
  ].join("\n");

  const issues = checkSourceFile(sourceRoot, file, code);

  assert.deepEqual(issues.map(({ line }) => line), [1, 2, 3, 4, 5, 6]);
  assert.ok(issues.every(({ message }) => message.includes("依存方向")));
});

test("共有コンポーネントと機能から内部 UI への参照を拒否する", () => {
  const cases = [
    ["shared/components/card/Card.tsx", "../../ui/internal/mergeDescribedBy"],
    ["features/tasks/module.ts", "../../shared/ui/internal/mergeDescribedBy"],
    ["app/page.tsx", "@/shared/ui/internal/mergeDescribedBy"],
  ];

  for (const [file, target] of cases) {
    const issues = checkSourceFile(sourceRoot, path.join(sourceRoot, file), `export * from ${JSON.stringify(target)};`);
    assert.equal(issues.length, 1, file);
    assert.match(issues[0].message, /依存方向/);
  }
});

test("直接・名前付きの StyleX 定義とトークンの非相対参照を検出する", () => {
  const file = path.join(sourceRoot, "shared/ui/button/Button.tsx");
  const code = [
    'import * as css from "@stylexjs/stylex";',
    'import { create as defineStyles } from "@stylexjs/stylex";',
    'import { tokens } from "@/shared/styles/tokens.stylex";',
    'const a = css.create({});',
    'const b = css["create"]({});',
    'const c = defineStyles({});',
    'function local(css: { create(): void }) { css.create(); }',
  ].join("\n");

  const issues = checkSourceFile(sourceRoot, file, code);

  assert.deepEqual(issues.map(({ line }) => line), [3, 4, 5, 6]);
  assert.match(issues[0].message, /相対パス/);
  assert.ok(issues.slice(1).every(({ message }) => message.includes("*.styles.ts")));
});

test("正規のスタイルファイルと検証用スタイルを許可する", () => {
  const code = [
    'import * as stylex from "@stylexjs/stylex";',
    'import { tokens } from "../../styles/tokens.stylex";',
    'export const styles = stylex.create({ button: { color: tokens.text } });',
  ].join("\n");

  for (const name of ["Button.styles.ts", "Button.test.tsx", "Button.stories.tsx"]) {
    const file = path.join(sourceRoot, "shared/ui/button", name);
    assert.deepEqual(checkSourceFile(sourceRoot, file, code), []);
  }
});
