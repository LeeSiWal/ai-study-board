import { expect, test } from "@playwright/test";

/**
 * SET-03 들어오는 MCP 연결 — 아키텍처 §15.4
 *
 * 이 화면의 핵심은 "토큰을 다시 볼 수 없다"는 사실을 사용자가 그 순간
 * 알아채게 하는 것이다. 서버가 해시만 갖고 있어 복구할 방법이 없다.
 */

test("MCP 접속 토큰을 발급하고 폐기한다", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("quick-login-user-siwol").click();
  await page.waitForURL("**/doc/**");

  await page.goto("/settings/mcp");

  const name = `테스트 클라이언트 ${Date.now()}`;
  await page.getByLabel("토큰 이름").fill(name);
  await page.getByRole("button", { name: "토큰 발급" }).click();

  // 다시 볼 수 없다는 경고가 원문과 함께 나와야 한다.
  const issued = page.getByTestId("issued-token");
  await expect(issued).toContainText("지금 복사하세요");
  // 목록의 힌트(mcp_abcd…wxyz)가 아니라 잘리지 않은 원문이어야 한다.
  // 설정 파일 경로 안내에도 code 요소가 있어 첫 번째로 좁힌다.
  await expect(issued.locator("code").first()).toHaveText(/^mcp_[\w-]{20,}$/);

  // 손으로 조립하지 않도록 클라이언트 설정을 통째로 준다.
  await expect(issued).toContainText('"mcpServers"');
  await expect(issued).toContainText("/api/mcp");

  // Claude Desktop은 설정 모양이 다르다. 브리지를 자식 프로세스로 띄운다.
  await issued.getByRole("button", { name: "Claude Desktop" }).click();
  await expect(issued).toContainText("AI_STUDY_MCP_TOKEN");
  await expect(issued).toContainText("mcp-bridge");

  await issued.getByRole("button", { name: "복사했습니다" }).click();
  await expect(issued).toBeHidden();

  // 목록에는 힌트만 남고 원문은 사라진다.
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("…");

  page.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: `${name} 폐기` }).click();
  await expect(page.getByRole("listitem").filter({ hasText: name })).toHaveCount(
    0,
  );
});
