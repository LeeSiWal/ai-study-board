import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 설정.
 *
 * 두 서버를 모두 띄운다. 동시 편집은 협업 서버 없이 검증할 수 없다.
 * 개발 중 이미 떠 있으면 재사용한다(`reuseExistingServer`).
 */

/**
 * 개발 서버와 같은 포트를 쓰고, 떠 있으면 재사용한다.
 *
 * 테스트를 별도 포트로 격리하려 했으나 Next.js 16이 같은 디렉터리에서 dev
 * 서버를 두 개 띄우지 못한다. 그래서 테스트는 개발 서버를 공유한다.
 *
 * 대가는 테스트가 개발용 문서를 헤집는다는 것이다. 실제로 "할 일 목록과 표"
 * 테스트가 이전 실행이 남긴 표 때문에 절반쯤 실패했었다. 각 테스트가 고유한
 * 문구를 쓰거나 문서를 비우고 시작하는 이유가 이것이다.
 */
const WEB_PORT = 7171;
const COLLAB_PORT = 7172;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],

  use: {
    // 다른 기기에서 접속했을 때를 재현하려면 E2E_BASE_URL로 LAN 주소를 준다.
    baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      command: "npm run dev:collab",
      port: COLLAB_PORT,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev:web",
      port: WEB_PORT,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
