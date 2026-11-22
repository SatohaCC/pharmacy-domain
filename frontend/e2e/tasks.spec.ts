import { expect, test } from "@playwright/test";

function makeRunPrefix() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("タスク管理フルスタック CRUD（SQLite 永続化）", () => {
  const prefixesToCleanup: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const prefix of prefixesToCleanup.splice(0)) {
      const res = await request.get("/api/tasks", { params: { q: prefix } });
      if (!res.ok()) continue;
      const body = (await res.json()) as { items?: Array<{ id: string; title: string }> };
      for (const item of body.items ?? []) {
        await request.delete(`/api/tasks/${encodeURIComponent(item.id)}`);
      }
    }
  });

  test("トップページから遷移し、作成・再読み込み永続化・完了切替・編集・絞り込み・削除を一貫して行える", async ({
    page,
  }) => {
    const prefix = makeRunPrefix();
    prefixesToCleanup.push(prefix);

    const initialTitle = `${prefix} SQLite検証`;
    const updatedTitle = `${prefix} 更新済みタスク`;

    await page.goto("/");
    await page.getByRole("link", { name: "タスク管理" }).click();
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByRole("heading", { level: 1, name: "タスク管理" })).toBeVisible();

    const createForm = page.getByRole("form", { name: "タスクを作成" });
    await createForm.getByRole("button", { name: "タスクを追加" }).click();
    await expect(createForm.getByText("タイトルを入力してください")).toBeVisible();
    await expect(createForm.getByRole("textbox", { name: /タイトル/ })).toBeFocused();

    await createForm.getByRole("textbox", { name: /タイトル/ }).fill(initialTitle);
    await createForm.getByRole("textbox", { name: "詳細メモ" }).fill("永続化の E2E テスト");
    await createForm.getByRole("radio", { name: "高" }).click();

    const createResponsePromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/tasks") && response.request().method() === "POST",
    );
    await createForm.getByRole("button", { name: "タスクを追加" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    await expect(page.getByText(initialTitle, { exact: true })).toBeVisible();
    await expect(page.getByText("タスクを追加しました")).toBeVisible();

    // ブラウザをリロードしても SSR（serverApiRequest）+ SQLite から再表示されることを確認する。
    await page.reload();
    await expect(page.getByText(initialTitle, { exact: true })).toBeVisible();

    const togglePatchPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/tasks/") && response.request().method() === "PATCH",
    );
    await page.getByRole("checkbox", { name: `「${initialTitle}」を完了にする` }).click();
    expect((await togglePatchPromise).status()).toBe(200);

    await page.reload();
    const rowAfterReload = page.getByRole("listitem").filter({ hasText: initialTitle });
    await expect(rowAfterReload.getByText("完了", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `「${initialTitle}」の操作` }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible();
    const editTitle = editDialog.getByRole("textbox", { name: /タイトル/ });
    await editTitle.fill(updatedTitle);
    await editDialog.getByRole("radio", { name: "低" }).click();

    const editPatchPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/tasks/") && response.request().method() === "PATCH",
    );
    await editDialog.getByRole("button", { name: "変更を保存" }).click();
    expect((await editPatchPromise).status()).toBe(200);

    await page.reload();
    const updatedRow = page.getByRole("listitem").filter({ hasText: updatedTitle });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow.getByText("優先度: 低")).toBeVisible();

    const filterArea = page.getByRole("search", { name: "タスク絞り込み" });
    await filterArea.getByRole("searchbox", { name: "キーワード検索" }).fill(prefix);
    await filterArea.getByRole("radio", { name: "完了", exact: true }).click();
    await expect(updatedRow).toBeVisible();

    await filterArea.getByRole("radio", { name: "未完了", exact: true }).click();
    await expect(page.getByText("条件に一致するタスクはありません")).toBeVisible();

    await filterArea.getByRole("button", { name: "条件をリセット" }).click();
    await expect(updatedRow).toBeVisible();

    await page.getByRole("button", { name: `「${updatedTitle}」の操作` }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();

    const deleteDialog = page.getByRole("dialog");
    const deletePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/tasks/") && response.request().method() === "DELETE",
    );
    await deleteDialog.getByRole("button", { name: "削除する" }).click();
    expect((await deletePromise).status()).toBe(204);

    await page.reload();
    await expect(page.getByText(updatedTitle, { exact: true })).toBeHidden();
  });

  test("狭い画面とダークテーマ・reduced-motion でもレイアウトが崩れない", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/tasks");

    await expect(page.getByRole("heading", { level: 1, name: "タスク管理" })).toBeVisible();
    const submitButton = page.getByRole("button", { name: "タスクを追加" });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveCSS("transition-duration", "0s");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
