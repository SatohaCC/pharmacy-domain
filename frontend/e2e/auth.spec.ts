import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const repoRoot = path.resolve(process.cwd(), "..");
const backendDir = path.join(repoRoot, "backend");
const pythonPath =
  process.platform === "win32"
    ? path.join(backendDir, ".venv", "Scripts", "python.exe")
    : path.join(backendDir, ".venv", "bin", "python");
const e2eDbPath = (() => {
  const configured = process.env.E2E_DATABASE_PATH?.trim();
  if (!configured) {
    return path.join(repoRoot, ".cache", "playwright-e2e.db");
  }
  return path.isAbsolute(configured)
    ? path.resolve(configured)
    : path.resolve(backendDir, configured);
})();

function resetAuthAndCorporationTables(): void {
  execFileSync(
    pythonPath,
    [
      "-B",
      "-c",
      [
        "import os, sqlite3",
        "conn = sqlite3.connect(os.environ['DATABASE_PATH'])",
        "conn.execute('DELETE FROM auth_refresh_sessions')",
        "conn.execute('DELETE FROM auth_role_assignments')",
        "conn.execute('DELETE FROM auth_users')",
        "conn.execute('DELETE FROM corporate_relation_revisions')",
        "conn.execute('DELETE FROM corporate_relations')",
        "conn.execute('DELETE FROM corporation_history')",
        "conn.execute('DELETE FROM corporations')",
        "conn.commit()",
        "conn.close()",
      ].join("; "),
    ],
    {
      cwd: backendDir,
      env: { ...process.env, DATABASE_PATH: e2eDbPath },
      encoding: "utf8",
    },
  );
}

function runBootstrapCli(args: { email: string; name: string; password: string }): string {
  return execFileSync(
    pythonPath,
    [
      "-B",
      "-m",
      "app.cli.bootstrap_vendor_admin",
      "--email",
      args.email,
      "--name",
      args.name,
      "--password-stdin",
    ],
    {
      cwd: backendDir,
      env: { ...process.env, DATABASE_PATH: e2eDbPath },
      input: `${args.password}\n`,
      encoding: "utf8",
    },
  );
}

test.describe
  .serial("共通認証・ロールモデルと企業登録・ベンダーアカウント発行フロー", () => {
    const adminEmail = "initial-admin@vendor.example.com";
    const adminPassword = "InitialVendorAdmin123!";
    const staffEmail = "vendor-staff@vendor.example.com";
    const staffName = "ベンダー 運用社員";

    test.beforeAll(() => {
      resetAuthAndCorporationTables();
    });

    test("コンソール初期管理者発行 → Webログイン → 企業登録・編集 → ベンダー社員発行 → 社員ログインと企業登録ができる", async ({
      page,
    }) => {
      const cliOutput = runBootstrapCli({
        email: adminEmail,
        name: "初期システム管理者",
        password: adminPassword,
      });
      expect(cliOutput).toContain("初期ベンダー管理アカウントを発行しました");

      // 2回目のコンソール発行は拒否される。
      expect(() =>
        runBootstrapCli({
          email: "second-admin@vendor.example.com",
          name: "2人目管理者",
          password: adminPassword,
        }),
      ).toThrow();

      // 1. Webで初期管理者ログイン → 法人管理画面（/vendor/corporations）へ遷移する。
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "システムベンダーログイン" })).toBeVisible();

      await page.getByLabel(/メールアドレス/).fill(adminEmail);
      await page.locator('input[name="password"]').fill(adminPassword);
      await page.getByRole("button", { name: "ログイン" }).click();

      await page.waitForURL("**/vendor/corporations");
      await expect(
        page.getByRole("heading", { name: "導入企業（法人・個人開設者）管理" }),
      ).toBeVisible();
      await expect(page.getByText(`初期システム管理者（${adminEmail}）`)).toBeVisible();

      // リロードしても Cookie 認証状態が維持される。
      await page.reload();
      await expect(page.getByText(`初期システム管理者（${adminEmail}）`)).toBeVisible();

      // 2. 法人管理画面で新しい薬局法人を登録し、基本情報を編集する。
      await page.locator('input[name="name"]').fill("株式会社さくら薬局");
      await page.locator('input[name="corporate_number"]').fill("1234567890123");
      await page.locator('input[name="address"]').fill("東京都新宿区1-2-3");
      await page.getByRole("button", { name: "企業（法人・個人）を登録" }).click();

      await expect(page.getByText("企業（テナント）を登録しました")).toBeVisible();
      await expect(page.getByText("株式会社さくら薬局").first()).toBeVisible();

      await page.getByRole("button", { name: "基本情報を編集" }).click();
      await page.locator('input[name="edit_address"]').fill("東京都渋谷区4-5-6");
      await page.getByRole("button", { name: "基本情報を保存" }).click();
      await expect(page.getByText("企業の基本情報を更新しました")).toBeVisible();
      await expect(page.getByText("所在地: 東京都渋谷区4-5-6")).toBeVisible();

      // 3. 上部ナビゲーションからベンダー社員管理（/vendor/users）へ移動し、一般社員を発行する。
      await page.getByRole("link", { name: "ベンダー社員管理" }).click();
      await page.waitForURL("**/vendor/users");
      await expect(page.getByRole("heading", { name: "ベンダーアカウント管理" })).toBeVisible();

      await page.locator('input[name="display_name"]').fill(staffName);
      await page.locator('input[name="email"]').fill(staffEmail);
      await page.getByRole("button", { name: "安全なパスワードを自動生成" }).click();

      const generatedPassword = await page.locator('input[name="password"]').inputValue();
      expect(generatedPassword.length).toBeGreaterThanOrEqual(13);

      await page.getByRole("button", { name: "ベンダー社員アカウントを発行" }).click();
      await expect(page.getByText("ベンダー社員アカウントを発行しました")).toBeVisible();
      await expect(page.getByText(staffEmail).first()).toBeVisible();

      // 4. ログアウトし、未認証で /vendor/corporations や /vendor/users にアクセスできないことを確認。
      await page.getByRole("button", { name: "ログアウト" }).click();
      await page.waitForURL("**/login");

      await page.goto("/vendor/corporations");
      await page.waitForURL("**/login");

      // 5. Webで発行したベンダー社員アカウント（vendor_member）でログインし、企業登録ができることを確認。
      await page.getByLabel(/メールアドレス/).fill(staffEmail);
      await page.locator('input[name="password"]').fill(generatedPassword);
      await page.getByRole("button", { name: "ログイン" }).click();

      await page.waitForURL("**/vendor/corporations");
      await expect(page.getByText(`${staffName}（${staffEmail}）`)).toBeVisible();
      await expect(page.getByText("株式会社さくら薬局").first()).toBeVisible();

      await page.locator('input[name="name"]').fill("株式会社あおぞら薬局");
      await page.locator('input[name="corporate_number"]').fill("9876543210123");
      await page.getByRole("button", { name: "企業（法人・個人）を登録" }).click();
      await expect(page.getByText("株式会社あおぞら薬局").first()).toBeVisible();

      // 一般社員が /vendor/users へ移動すると社員発行フォームは非表示で案内が表示される。
      await page.getByRole("link", { name: "ベンダー社員管理" }).click();
      await page.waitForURL("**/vendor/users");
      await expect(page.getByText("一般社員アカウントでログインしています")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "ベンダー社員アカウントの発行" }),
      ).not.toBeVisible();
    });

    test("ダークテーマ・狭い幅・モーション低減・キーボード操作でも崩れずログインと法人管理画面を表示できる", async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      await page.setViewportSize({ width: 360, height: 800 });

      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "システムベンダーログイン" })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      const emailField = page.getByLabel(/メールアドレス/);
      await emailField.focus();
      await emailField.fill(adminEmail);
      const passwordField = page.locator('input[name="password"]');
      await passwordField.focus();
      await passwordField.fill(adminPassword);
      await passwordField.press("Enter");

      await page.waitForURL("**/vendor/corporations");
      await expect(
        page.getByRole("heading", { name: "導入企業（法人・個人開設者）管理" }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  });
