import {
  authorizationServerMetadata,
  metadataPreflight,
  metadataResponse,
} from "@/lib/oauth/metadata";

/**
 * GET /.well-known/oauth-authorization-server — RFC 8414
 *
 * 클라이언트는 보호 리소스 문서에서 인가 서버 주소를 얻고 여기로 온다.
 * 여기서 인가·토큰·등록 엔드포인트를 읽어 스스로 흐름을 진행한다.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  return metadataResponse(authorizationServerMetadata(request));
}

export async function OPTIONS() {
  return metadataPreflight();
}
