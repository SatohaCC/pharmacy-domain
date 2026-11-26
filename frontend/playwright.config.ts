import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../.cache/playwright-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "../.cache/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://localhost:13000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // 開発サーバーと DB・ポートが衝突しないよう E2E 専用ポートで起動する
  webServer: [
    {
      command: "node ../scripts/start-e2e-backend.mts",
      url: "http://127.0.0.1:18000/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        E2E_BACKEND_PORT: "18000",
        CORS_ORIGINS: "http://localhost:13000,http://127.0.0.1:13000",
      },
    },
    {
      command: "pnpm exec next dev --turbopack --port 13000",
      url: "http://localhost:13000",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        BACKEND_URL: "http://127.0.0.1:18000",
      },
    },
  ],
});
