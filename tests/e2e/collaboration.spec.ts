import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 0 검증.
 *
 * 아키텍처 §25의 첫 번째 가설 — "여러 사용자가 정말 같은 문서를 동시에
 * 편집하는가" — 을 자동으로 확인한다. 브라우저 컨텍스트를 두 개 열어야
 * 검증되는 성질이라 단위 테스트로는 대체할 수 없다.
 */

const DOCUMENT_PATH = "/w/workspace-ai-papers/doc/res-self-attention";

async function loginAs(page: Page, userId: string) {
  await page.goto("/login");
  await page.getByTestId(`quick-login-${userId}`).click();
  await page.waitForURL(`**${DOCUMENT_PATH}`);
}

/** 협업 서버와 동기화가 끝나야 서로의 변경이 오간다. */
async function waitForSync(page: Page) {
  await expect(page.getByTestId("connection-status")).toHaveText("저장됨", {
    timeout: 20_000,
  });
}

test("두 사용자가 같은 문서를 동시에 편집한다", async ({ browser }) => {
  const siwolContext = await browser.newContext();
  const minjiContext = await browser.newContext();

  const siwol = await siwolContext.newPage();
  const minji = await minjiContext.newPage();

  await loginAs(siwol, "user-siwol");
  await loginAs(minji, "user-minji");

  await expect(siwol.getByTestId("current-user")).toHaveText("시월");
  await expect(minji.getByTestId("current-user")).toHaveText("민지");

  await waitForSync(siwol);
  await waitForSync(minji);

  // 문서가 실행 간에 남아 있어도 흔들리지 않도록 매번 다른 문장을 쓴다.
  const fromSiwol = `시월이 쓴 문장 ${Date.now()}`;
  await siwol.locator(".tiptap").click();
  await siwol.keyboard.type(fromSiwol);

  await expect(minji.locator(".tiptap")).toContainText(fromSiwol, {
    timeout: 15_000,
  });

  // 반대 방향도 확인한다. 한쪽만 흐르는 구조일 수 있기 때문이다.
  const fromMinji = `민지가 쓴 문장 ${Date.now()}`;
  await minji.locator(".tiptap").click();
  await minji.keyboard.press("End");
  await minji.keyboard.type(fromMinji);

  await expect(siwol.locator(".tiptap")).toContainText(fromMinji, {
    timeout: 15_000,
  });

  await siwolContext.close();
  await minjiContext.close();
});

test("편집한 블록에 영속 ID가 붙는다", async ({ page }) => {
  await loginAs(page, "user-siwol");
  await waitForSync(page);

  await page.locator(".tiptap").click();
  await page.keyboard.type(`블록 ID 확인 ${Date.now()}`);

  const blockIds = await page
    .locator(".tiptap [data-block-id]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-block-id")),
    );

  expect(blockIds.length).toBeGreaterThan(0);
  expect(blockIds.every((id) => typeof id === "string" && id.length > 0)).toBe(
    true,
  );
  // AI 제안이 블록을 지목하려면 ID가 문서 안에서 유일해야 한다.
  expect(new Set(blockIds).size).toBe(blockIds.length);
});

test("편집 권한이 없는 멤버는 읽기 전용으로 연결된다", async ({ page }) => {
  // 소연은 GUEST라 view·comment만 가진다.
  await loginAs(page, "user-soyeon");

  await expect(page.getByRole("note")).toHaveText(
    "읽기 전용입니다. 이 페이지를 편집할 권한이 없습니다.",
  );
  await expect(page.locator(".tiptap")).toHaveAttribute(
    "contenteditable",
    "false",
  );
});
