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

function resetVendorAuthTables(): void {
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
  .serial("システムベンダー認証とアカウント発行フロー", () => {
    const adminEmail = "initial-admin@vendor.example.com";
    const adminPassword = "InitialVendorAdmin123!";
    const staffEmail = "vendor-staff@vendor.example.com";
    const staffName = "ベンダー 運用社員";

    test.beforeAll(() => {
      resetVendorAuthTables();
    });

    test("コンソールから初期管理者を発行し、Webでログイン・社員発行・再ログインできる", async ({
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

      // 1. Webで初期管理者ログイン。
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "システムベンダーログイン" })).toBeVisible();

      await page.getByLabel(/メールアドレス/).fill(adminEmail);
      await page.locator('input[name="password"]').fill(adminPassword);
      await page.getByRole("button", { name: "ログイン" }).click();

      await page.waitForURL("**/vendor/users");
      await expect(page.getByRole("heading", { name: "ベンダーアカウント管理" })).toBeVisible();
      await expect(page.getByText(`初期システム管理者（${adminEmail}）`)).toBeVisible();

      // リロードしても Cookie 認証状態が維持される。
      await page.reload();
      await expect(page.getByText(`初期システム管理者（${adminEmail}）`)).toBeVisible();

      // 2. Web画面から安全なパスワード自動生成を使って新しいベンダー社員を発行する。
      await page.locator('input[name="display_name"]').fill(staffName);
      await page.locator('input[name="email"]').fill(staffEmail);
      await page.getByRole("button", { name: "安全なパスワードを自動生成" }).click();

      const generatedPassword = await page.locator('input[name="password"]').inputValue();
      expect(generatedPassword.length).toBeGreaterThanOrEqual(13);

      await page.getByRole("button", { name: "ベンダー社員アカウントを発行" }).click();
      await expect(page.getByText("ベンダー社員アカウントを発行しました")).toBeVisible();
      await expect(page.getByText(staffEmail).first()).toBeVisible();

      // 3. ログアウトし、未認証で /vendor/users にアクセスできないことを確認。
      await page.getByRole("button", { name: "ログアウト" }).click();
      await page.waitForURL("**/login");

      await page.goto("/vendor/users");
      await page.waitForURL("**/login");

      // 4. Webで発行したベンダー社員アカウントでログインできることを確認。
      await page.getByLabel(/メールアドレス/).fill(staffEmail);
      await page.locator('input[name="password"]').fill(generatedPassword);
      await page.getByRole("button", { name: "ログイン" }).click();

      await page.waitForURL("**/vendor/users");
      await expect(page.getByText(`${staffName}（${staffEmail}）`)).toBeVisible();
      await expect(page.getByText("一般社員アカウントでログインしています")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "ベンダー社員アカウントの発行" }),
      ).not.toBeVisible();
    });

    test("ダークテーマ・狭い幅・モーション低減・キーボード操作でも崩れずログインできる", async ({
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

      await page.waitForURL("**/vendor/users");
      await expect(page.getByRole("heading", { name: "ベンダーアカウント管理" })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  });
