import { createHash, randomBytes } from "node:crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * MCP OAuth 2.1 흐름 — 아키텍처 §15.4
 *
 * 사용자가 클라이언트에 서버 주소 하나만 넣으면 나머지가 자동으로 진행되는지
 * 확인한다. 그래서 이 테스트는 클라이언트가 하는 일을 그대로 흉내 낸다 —
 * 메타데이터를 읽고, 스스로 등록하고, 인가를 받고, 토큰을 교환한다.
 *
 * 사람이 손대는 지점은 딱 하나, "연결 승인" 버튼이다.
 */

const REDIRECT_URI = "http://localhost:9999/oauth/callback";

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  return { verifier, challenge };
}

/** 클라이언트가 스스로 등록한다(RFC 7591). 사람이 client_id를 만들지 않는다. */
async function registerClient(request: APIRequestContext, name: string) {
  const response = await request.post("/api/oauth/register", {
    data: { client_name: name, redirect_uris: [REDIRECT_URI] },
  });

  expect(response.status()).toBe(201);
  return (await response.json()).client_id as string;
}

/**
 * 리다이렉트 목적지를 가로챈다.
 *
 * 실제 클라이언트라면 자기 루프백 서버가 받는다. 테스트에서는 그 서버를
 * 띄우는 대신 브라우저가 그 주소로 가는 순간을 잡아 code를 읽는다.
 */
async function interceptCallback(page: Page) {
  await page.route(`${REDIRECT_URI}*`, (route) =>
    route.fulfill({ status: 200, body: "callback" }),
  );
}

test("클라이언트가 스스로 등록하고 사용자가 승인하면 MCP에 접근할 수 있다", async ({
  page,
  request,
}) => {
  // ── 1. 메타데이터 발견 ──
  // 클라이언트가 아는 것은 서버 주소뿐이다. 여기서 나머지를 알아낸다.
  const protectedResource = await (
    await request.get("/.well-known/oauth-protected-resource/api/mcp")
  ).json();

  const asMetadata = await (
    await request.get("/.well-known/oauth-authorization-server")
  ).json();

  expect(protectedResource.authorization_servers).toContain(asMetadata.issuer);
  expect(asMetadata.code_challenge_methods_supported).toEqual(["S256"]);

  // ── 2. 동적 등록 ──
  // 개발 서버를 공유해서 이전 실행의 클라이언트가 남아 있다. 이름에 시각을
  // 넣고 그 전체로 좁혀야 목록에서 내 것만 집힌다.
  const clientName = `자동 등록 ${Date.now()}`;
  const clientId = await registerClient(request, clientName);

  // ── 3. 인가 ──
  const { verifier, challenge } = pkce();
  const state = randomBytes(8).toString("hex");

  const authorizeUrl = new URL(asMetadata.authorization_endpoint);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("resource", protectedResource.resource);
  authorizeUrl.searchParams.set("state", state);

  await interceptCallback(page);
  await page.goto(authorizeUrl.toString());

  // 로그인하지 않았으면 로그인으로 보내되, 끝나면 이 요청으로 되돌아와야 한다.
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByTestId("quick-login-user-siwol").click();
  await page.waitForURL(/\/oauth\/authorize/);

  // 사용자가 판단할 근거가 화면에 있어야 한다.
  await expect(page.getByRole("heading")).toContainText(clientName);
  await expect(page.getByText("수정은 제안으로만 남깁니다.")).toBeVisible();
  await expect(page.getByText(REDIRECT_URI)).toBeVisible();

  await page.getByRole("button", { name: "연결 승인" }).click();
  await page.waitForURL(`${REDIRECT_URI}*`);

  const callback = new URL(page.url());
  const code = callback.searchParams.get("code");

  // state를 그대로 돌려줘야 클라이언트가 자기 요청임을 확인할 수 있다.
  expect(callback.searchParams.get("state")).toBe(state);
  expect(code).toBeTruthy();

  // ── 4. 토큰 교환 ──
  const tokenResponse = await request.post(asMetadata.token_endpoint, {
    form: {
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    },
  });

  expect(tokenResponse.status()).toBe(200);
  // 토큰이 캐시에 남으면 안 된다.
  expect(tokenResponse.headers()["cache-control"]).toContain("no-store");

  const tokens = await tokenResponse.json();
  expect(tokens.token_type).toBe("Bearer");

  // ── 5. 토큰으로 MCP 도구를 부른다 ──
  const tools = await request.post("/api/mcp", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
  });

  expect(tools.status()).toBe(200);
  const names = (await tools.json()).result.tools.map(
    (tool: { name: string }) => tool.name,
  );
  expect(names).toContain("list_pages");
  expect(names).toContain("propose_edit");

  // ── 6. 리프레시 ──
  // 액세스 토큰은 한 시간이면 끝난다. 갱신되지 않으면 사용자가 매시간 다시
  // 승인해야 한다.
  const refreshed = await request.post(asMetadata.token_endpoint, {
    form: {
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: clientId,
    },
  });

  expect(refreshed.status()).toBe(200);
  const next = await refreshed.json();
  expect(next.access_token).not.toBe(tokens.access_token);

  // 회전한다 — 쓴 리프레시 토큰은 두 번째부터 거절된다.
  const replay = await request.post(asMetadata.token_endpoint, {
    form: {
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: clientId,
    },
  });

  expect(replay.status()).toBe(400);
  expect((await replay.json()).error).toBe("invalid_grant");

  // ── 7. 사용자가 연결을 끊는다 ──
  // 승인만 되고 취소가 안 되면 사용자는 승인 자체를 망설인다.
  await page.goto("/settings/mcp");

  const row = page
    .getByTestId("oauth-connections")
    .getByRole("listitem")
    .filter({ hasText: clientName });
  await expect(row).toHaveCount(1);

  page.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: /연결 끊기/ }).click();
  await expect(row).toHaveCount(0);

  // 끊은 뒤에는 방금까지 쓰던 토큰이 통하지 않아야 한다.
  const afterRevoke = await request.post("/api/mcp", {
    headers: { authorization: `Bearer ${next.access_token}` },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    failOnStatusCode: false,
  });
  expect(afterRevoke.status()).toBe(401);
});

test("인가 코드는 한 번만 쓸 수 있고 PKCE가 맞아야 한다", async ({
  page,
  request,
}) => {
  const clientId = await registerClient(request, `재사용 시험 ${Date.now()}`);
  const { verifier, challenge } = pkce();

  await page.goto("/login");
  await page.getByTestId("quick-login-user-siwol").click();
  await page.waitForURL("**/doc/**");

  await interceptCallback(page);

  const authorizeUrl = new URL("/oauth/authorize", page.url());
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  await page.goto(authorizeUrl.toString());
  await page.getByRole("button", { name: "연결 승인" }).click();
  await page.waitForURL(`${REDIRECT_URI}*`);

  const code = new URL(page.url()).searchParams.get("code")!;

  // 엉뚱한 verifier로는 교환되지 않는다. 코드가 새더라도 이 검사가 막는다.
  const wrong = await request.post("/api/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: randomBytes(32).toString("base64url"),
    },
  });
  expect(wrong.status()).toBe(400);

  // verifier가 틀렸어도 코드는 이미 소비됐다. 맞는 verifier로도 못 쓴다.
  // 공격자가 verifier를 무차별로 시도할 기회를 한 번으로 줄인다.
  const retry = await request.post("/api/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    },
  });
  expect(retry.status()).toBe(400);
  expect((await retry.json()).error).toBe("invalid_grant");
});

test("등록되지 않은 redirect_uri로는 리다이렉트하지 않는다", async ({
  page,
  request,
}) => {
  const clientId = await registerClient(request, `주소 시험 ${Date.now()}`);

  await page.goto("/login");
  await page.getByTestId("quick-login-user-siwol").click();
  await page.waitForURL("**/doc/**");

  const url = new URL("/oauth/authorize", page.url());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", "https://evil.example.com/steal");
  url.searchParams.set("code_challenge", pkce().challenge);
  url.searchParams.set("code_challenge_method", "S256");

  await page.goto(url.toString());

  // 오류를 그 주소로 보내면 우리 도메인이 공개 리다이렉터가 된다.
  // 화면에 세우고 끝낸다.
  await expect(page).toHaveURL(/\/oauth\/authorize/);
  await expect(
    page.getByText("등록되지 않은 redirect_uri입니다"),
  ).toBeVisible();
});

test("토큰 없이 MCP를 부르면 메타데이터 주소를 알려준다", async ({ request }) => {
  const response = await request.post("/api/mcp", {
    data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    failOnStatusCode: false,
  });

  expect(response.status()).toBe(401);

  // 이 한 줄이 자동 연결의 출발점이다. 클라이언트는 여기서 인가 서버를 찾는다.
  const challenge = response.headers()["www-authenticate"];
  expect(challenge).toContain(
    "resource_metadata=\"http://127.0.0.1:7171/.well-known/oauth-protected-resource/api/mcp\"",
  );
});
