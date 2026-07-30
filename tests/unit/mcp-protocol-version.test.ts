import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

import { protocolVersionError } from "@/lib/mcp/http";

/**
 * 전송 계층이 SDK와 어긋나지 않는지 본다.
 *
 * 한 번 어긋났었다. 목록을 손으로 적어 뒀는데 SDK가 새 버전을 지원하게
 * 되면서, SDK가 2025-11-25로 협상해 놓고 그 다음 요청을 우리 검사가
 * 400으로 막았다. 서버가 자기가 합의한 버전을 스스로 거부한 것이다.
 *
 * 증상이 고약했다. initialize는 200이라 연결은 성립하고, 바로 다음
 * tools/list만 죽는다. 클라이언트에는 "연결됨 + 툴 0개"로 보여서 어디를
 * 봐야 할지 알 수 없다.
 *
 * 그래서 "목록이 맞는지"가 아니라 "SDK와 같은지"를 검사한다. 특정 버전
 * 문자열을 적어 두면 그게 또 낡는다.
 */
describe("MCP 프로토콜 버전 검사", () => {
  it("SDK가 지원하는 모든 버전을 통과시킨다", () => {
    for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
      expect(protocolVersionError(withVersion(version)), version).toBeNull();
    }
  });

  it("SDK가 협상 결과로 돌려주는 최신 버전을 통과시킨다", () => {
    // initialize 응답에 실려 나가는 값이다. 이걸 막으면 그 다음 요청이
    // 전부 죽는다.
    expect(protocolVersionError(withVersion(LATEST_PROTOCOL_VERSION))).toBeNull();
  });

  it("헤더가 없으면 통과시킨다", () => {
    // initialize 요청에는 헤더가 없는 것이 정상이다.
    expect(protocolVersionError(new Request("https://example.com"))).toBeNull();
  });

  it("모르는 버전은 막고 지원 범위를 알려준다", () => {
    const error = protocolVersionError(withVersion("1999-01-01"));

    expect(error).toContain("1999-01-01");
    expect(error).toContain(LATEST_PROTOCOL_VERSION);
  });
});

function withVersion(version: string): Request {
  return new Request("https://example.com", {
    headers: { "mcp-protocol-version": version },
  });
}
