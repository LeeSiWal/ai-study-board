import { NextResponse } from "next/server";

import { selectAdapter } from "@/lib/ai";
import { currentUser } from "@/lib/auth";
import { readContentVersion } from "@/lib/collab/version";
import {
  aiProposalSchema,
  aiRunRequestSchema,
  type AiProposal,
} from "@/lib/contracts/ai";
import { resolvePermissions } from "@/lib/store";

/**
 * POST /api/ai/runs
 *
 * 아키텍처 §13의 AI Run. 권한 확인 → 게이트웨이 호출 → 결과 반환.
 *
 * `answer`는 텍스트를 스트리밍하고, `propose`는 구조화된 제안을 JSON으로
 * 돌려준다. 제안에는 협업 서버에서 읽은 `baseVersion`을 붙인다. 클라이언트가
 * 보낸 값을 믿지 않는 이유는, 그 값이 곧 충돌 판정의 기준이기 때문이다.
 */
export async function POST(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = aiRunRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const runRequest = parsed.data;
  const permissions = resolvePermissions(runRequest.resourceId, user.id);

  if (permissions.length === 0) {
    return NextResponse.json(
      { error: "이 페이지에 접근할 권한이 없습니다." },
      { status: 403 },
    );
  }

  // 제안은 문서를 바꾸는 일이므로 편집 권한이 있어야 만들 수 있다.
  if (runRequest.operationType === "propose" && !permissions.includes("edit")) {
    return NextResponse.json(
      { error: "이 페이지를 편집할 권한이 없습니다." },
      { status: 403 },
    );
  }

  const adapter = selectAdapter();

  try {
    if (runRequest.operationType === "propose") {
      const baseVersion = await readContentVersion(runRequest.resourceId);
      const draft = await adapter.propose(runRequest, request.signal);

      // 모델이 존재하지 않는 blockId를 지목하면 적용할 수 없다. 조용히
      // 엉뚱한 블록을 고치느니 여기서 걸러낸다.
      const known = new Set(runRequest.blocks.map((block) => block.blockId));
      const operations = draft.operations.filter((operation) =>
        known.has(operation.blockId),
      );

      const proposal: AiProposal = aiProposalSchema.parse({
        id: crypto.randomUUID(),
        resourceId: runRequest.resourceId,
        baseVersion,
        modelLabel: adapter.label,
        summary: draft.summary,
        operations,
      });

      return NextResponse.json(proposal);
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const chunk of adapter.answer(runRequest, request.signal)) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "생성에 실패했습니다.";
          controller.enqueue(encoder.encode(`\n\n[오류] ${message}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI 실행에 실패했습니다.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
