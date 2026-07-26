import { expect, test, type Page } from "@playwright/test";

const WORKSPACE = "/w/workspace-ai-papers";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByTestId("quick-login-user-siwol").click();
  await page.waitForURL(`**${WORKSPACE}/doc/res-self-attention`);
}

test("워크스페이스 홈, 멤버, 활동과 설정을 탐색한다", async ({ page }) => {
  await login(page);
  await page.goto(WORKSPACE);
  await expect(page.getByRole("heading", { name: /좋은 하루예요/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "최근 작업" })).toBeVisible();

  await page.getByRole("link", { name: "멤버" }).click();
  await expect(page.getByRole("heading", { name: "멤버", exact: true })).toBeVisible();
  await page.getByLabel("초대 이메일").fill("new@example.com");
  await page.getByRole("button", { name: "초대" }).click();
  await expect(page.getByText(/초대를 보냈습니다/)).toBeVisible();

  await page.getByRole("link", { name: "활동" }).click();
  await page.getByRole("button", { name: "MCP", exact: true }).click();
  await expect(page.getByText(/issue.create를 실행/)).toBeVisible();

  await page.getByRole("link", { name: "설정" }).click();
  await page.getByLabel("워크스페이스 이름").fill("AI 논문 스터디 시즌 2");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("저장했습니다.")).toBeVisible();
});

test("통합 검색에서 문서와 확장 리소스를 연다", async ({ page }) => {
  await login(page);
  await page.goto(`${WORKSPACE}/search`);
  await page.getByPlaceholder("페이지, 자료 또는 내용을 검색하세요").fill("Attention");
  await expect(page.getByText(/Self-Attention 정리/).first()).toBeVisible();
  await page.getByText("Attention Is All You Need.pdf", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "자료 상세" })).toBeVisible();
  await page.getByRole("button", { name: "처리 완료 시연" }).click();
  await expect(page.getByText("READY", { exact: true })).toBeVisible();
});

test("화이트보드에 포스트잇을 추가하고 편집한다", async ({ page }) => {
  await login(page);
  await page.goto(`${WORKSPACE}/board/res-week1-board`);
  await page.getByRole("button", { name: "포스트잇" }).click();
  const notes = page.getByLabel("포스트잇 내용");
  await expect(notes).toHaveCount(2);
  await notes.last().fill("Q, K, V 관계");
  await expect(notes.last()).toHaveValue("Q, K, V 관계");
});

test("개인 AI와 MCP 연결 승인 흐름을 완료한다", async ({ page }) => {
  await login(page);
  await page.goto("/settings/ai");
  await page.getByPlaceholder("OpenAI 호환 서버 URL").fill("http://localhost:11434/v1");
  await page.getByPlaceholder(/API 키/).fill("secret-key");
  await page.getByRole("button", { name: "연결 테스트 및 저장" }).click();
  await expect(page.getByText("개인 OpenAI 호환 서버")).toBeVisible();

  await page.goto("/settings/mcp");
  await page.getByRole("button", { name: "연결 테스트" }).click();
  await page.getByRole("button", { name: "실행 시연" }).click();
  const dialog = page.getByRole("dialog", { name: "MCP 실행 승인" });
  await expect(dialog).toContainText("외부 서비스로 전송");
  await dialog.getByRole("button", { name: "이번만 허용" }).click();
  await expect(page.getByText(/issue.create가 완료/)).toBeVisible();
});
