import { expect, test } from "@playwright/test";

test("存続状態の初回変更で一覧の再取得中も画面のスクロール位置を保つ", async ({ page }) => {
  const now = "2026-11-26T00:00:00Z";
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `test-corporation-${index}`,
    category: "corporation",
    name: `検証用企業 ${index + 1}`,
    representative_name: `代表者 ${index + 1}`,
    corporate_number: null,
    address: "",
    status: "active",
    created_at: now,
    updated_at: now,
  }));
  const filteredRequest = Promise.withResolvers<void>();
  const respondToFilter = Promise.withResolvers<void>();

  await page.setViewportSize({ width: 1536, height: 700 });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "test-admin",
        email: "admin@example.com",
        display_name: "検証用管理者",
        affiliation_type: "vendor",
        tenant_id: null,
        roles: ["vendor_admin"],
        status: "active",
        created_at: now,
        updated_at: now,
      },
    }),
  );
  await page.route(
    (url) => url.pathname === "/api/corporations",
    async (route) => {
      if (new URL(route.request().url()).searchParams.get("status") === "active") {
        filteredRequest.resolve();
        await respondToFilter.promise;
        await route.fulfill({
          json: {
            items: items.map((item) => ({ ...item, name: `存続中 ${item.name}` })),
            total: items.length,
          },
        });
        return;
      }
      await route.fulfill({ json: { items, total: items.length } });
    },
  );

  await page.goto("/vendor/corporations");
  await expect(page.getByText("検証用企業 1", { exact: true })).toBeVisible();
  const editLink = page.getByRole("link", { name: "基本情報を編集" }).first();
  await expect(editLink).toHaveAttribute("href", "/vendor/corporations/test-corporation-0/edit");
  const filter = page.getByRole("combobox", { name: "存続状態フィルタ" });
  const filterTop = await filter.evaluate((element) => element.getBoundingClientRect().top);
  await page.evaluate((top) => window.scrollTo({ top: top - 24, behavior: "instant" }), filterTop);
  await expect(filter).toBeInViewport({ ratio: 1 });
  const scroll = () => page.evaluate(() => window.scrollY);
  const before = await scroll();
  expect(before).toBeGreaterThan(0);

  try {
    await filter.click();
    await page.getByRole("option", { name: "存続（active）" }).click();
    await filteredRequest.promise;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.getByRole("status")).toHaveText("企業一覧を更新中…");
    expect(await scroll()).toBe(before);
    await expect(page.getByText("検証用企業 1", { exact: true })).toBeVisible({ timeout: 1500 });
  } finally {
    respondToFilter.resolve();
  }
  await expect(page.getByText("存続中 検証用企業 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toBeEmpty();
  expect(await scroll()).toBe(before);
});
