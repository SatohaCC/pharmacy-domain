import { expect, test } from "@playwright/test";

test("トップページでバックエンドのヘルスステータスを表示・更新できる", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "サンプルページ" })).toBeVisible();
  await expect(page.getByText("バックエンド API")).toBeVisible();
  await expect(page.getByText("ok (template-backend)")).toBeVisible();

  const refreshed = page.waitForResponse((response) => response.url().endsWith("/api/health"));
  await page.getByRole("button", { name: "状態を更新" }).click();
  expect((await refreshed).ok()).toBeTruthy();
  await expect(page.getByText("ok (template-backend)")).toBeVisible();
});

test("狭い画面とダークテーマでも内容が収まり、モーションを低減できる", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "サンプルページ" })).toBeVisible();
  await expect(page.locator("main")).toHaveCSS("padding-left", "20px");
  await expect(page.getByRole("button", { name: "状態を更新", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole("button", { name: "状態を更新", exact: true })).toHaveCSS(
    "transition-duration",
    "0s",
  );
});

test("APIの失敗を表示し、更新操作で復帰できる", async ({ page }) => {
  let healthy = false;
  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      status: healthy ? 200 : 503,
      contentType: "application/json",
      body: JSON.stringify(
        healthy ? { status: "ok", service: "template-backend" } : { detail: "unavailable" },
      ),
    });
  });
  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: "エラー: HTTP 503" })).toBeVisible();
  healthy = true;
  await page.getByRole("button", { name: "状態を更新" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ok (template-backend)" })).toBeVisible();
});

test("不正な形式のヘルス応答をエラーとして表示する", async ({ page }) => {
  await page.route("**/api/health", (route) => route.fulfill({ json: {} }));
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("エラー: Invalid health response");
});

test("トップページでセキュリティヘッダーとアイコンが正しく配信される", async ({
  page,
  request,
}) => {
  const consoleWarnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") {
      consoleWarnings.push(msg.text());
    }
  });

  const response = await page.goto("/");
  expect(response).not.toBeNull();
  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toBe(
    "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  );
  expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
  expect(headers["cross-origin-resource-policy"]).toBe("same-origin");

  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute("content", "light dark");
  await expect(page.locator('meta[name="text-scale"]')).toHaveAttribute("content", "scale");
  expect(
    consoleWarnings.some(
      (text) => text.includes("Permissions-Policy") || text.includes("Unrecognized feature"),
    ),
  ).toBe(false);

  const iconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
  expect(iconHref).toBeTruthy();
  const iconResponse = await request.get(iconHref ?? "/icon.svg");
  expect(iconResponse.status()).toBe(200);
});
