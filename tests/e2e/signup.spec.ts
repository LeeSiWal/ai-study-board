import { expect, test } from "@playwright/test";

/**
 * AUTH-02 회원가입 — UI 명세 §7
 *
 * 가입한 사용자가 시드 워크스페이스에 MEMBER로 합류하는지 확인한다. 지금
 * 단계에서 검증하려는 것이 협업이라, 가입 직후 다른 사람이 있는 문서에
 * 들어가는 것이 이 기능의 핵심이다.
 */

test("가입하면 워크스페이스 멤버가 되어 바로 문서로 들어간다", async ({
  page,
}) => {
  await page.goto("/signup");

  // 이미 있는 이메일은 그 필드 옆에서 막는다(§8).
  await page.getByLabel("이름").fill("중복 시험");
  await page.getByLabel("이메일").fill("siwol@example.com");
  await page.getByLabel("비밀번호").fill("abcd1234");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page.getByText("이미 가입된 이메일입니다.")).toBeVisible();

  // 짧은 비밀번호도 그 필드 옆에서 막는다.
  const email = `tester-${Date.now()}@example.com`;
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("short");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(
    page.getByText("비밀번호는 8자 이상이어야 합니다."),
  ).toBeVisible();

  // 정상 가입 → 자동 로그인 → 문서
  await page.getByLabel("비밀번호").fill("abcd1234");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await page.waitForURL("**/doc/**");

  // 편집 권한이 있어야 한다. MEMBER는 view·comment·edit을 갖는다(§17).
  await expect(page.getByTestId("editor")).toHaveAttribute(
    "contenteditable",
    "true",
  );
  await expect(page.getByRole("note")).toHaveCount(0);

  // 시드 워크스페이스의 페이지 트리가 보여야 한다.
  await expect(page.getByRole("navigation", { name: "페이지 트리" })).toContainText(
    "2주차",
  );
});

test("가입한 계정으로 다시 로그인할 수 있다", async ({ page, context }) => {
  const email = `returning-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("이름").fill("재로그인 시험");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("abcd1234");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await page.waitForURL("**/doc/**");

  // 세션 쿠키를 지워 로그아웃한다. /api/auth/signout은 CSRF 토큰을 요구해서
  // 페이지를 열어 누르는 방식으로는 통과하지 못한다.
  await context.clearCookies();

  // 비밀번호는 해시로 저장된다. 평문 비교였다면 여기서 통과해도 의미가 없다.
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("abcd1234");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL("**/doc/**");

  await expect(page.getByTestId("save-status")).toBeVisible();
});
