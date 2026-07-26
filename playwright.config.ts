import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 설정.
 *
 * 두 서버를 모두 띄운다. 동시 편집은 협업 서버 없이 검증할 수 없다.
 * 개발 중 이미 떠 있으면 재사용한다(`reuseExistingServer`).
 */

const WEB_PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],

  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      command: "npm run dev:collab",
      port: Number(process.env.COLLAB_PORT ?? 1234),
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `npm run dev:web -- --port ${WEB_PORT}`,
      port: WEB_PORT,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
