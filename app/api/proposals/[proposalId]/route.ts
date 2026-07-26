import { NextResponse } from "next/server";
import { z } from "zod";

import { currentUser } from "@/lib/auth";
import { readContentVersion } from "@/lib/collab/version";
import { resolvePermissions } from "@/lib/store";
import { findProposal, resolveProposal } from "@/lib/store/proposals";

/**
 * POST /api/proposals/:proposalId — 승인 또는 거절 (아키텍처 §21)
 *
 * 승인은 **선점**이다. 문서에 반영하기 전에 이 호출로 제안을 차지한다.
 * 두 사람이 동시에 누르면 한 명만 성공하고, 다른 한 명은 409를 받는다.
 * 반대 순서로 하면 둘 다 반영해 같은 변경이 두 번 들어간다.
 */

const bodySchema = z.object({ action: z.enum(["approve", "reject"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { proposalId } = await params;
  const proposal = findProposal(proposalId);

  if (!proposal) {
    return NextResponse.json(
      { error: "제안을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const permissions = resolvePermissions(proposal.resourceId, user.id);

  if (!permissions.includes("edit")) {
    return NextResponse.json(
      { error: "이 페이지를 편집할 권한이 없습니다." },
      { status: 403 },
    );
  }

  if (proposal.status !== "pending") {
    return NextResponse.json(
      { error: "이 AI 제안은 이미 다른 멤버가 처리했습니다." },
      { status: 409 },
    );
  }

  if (parsed.data.action === "reject") {
    resolveProposal(proposalId, "rejected", user.id);
    return NextResponse.json({ ok: true });
  }

  // 승인 전에 문서가 그 사이 바뀌었는지 다시 확인한다(§14).
  try {
    const version = await readContentVersion(proposal.resourceId);

    if (version !== proposal.baseVersion) {
      return NextResponse.json(
        {
          error:
            "제안이 생성된 후 문서가 변경되었습니다. 변경 내용을 다시 확인해주세요.",
          currentVersion: version,
        },
        { status: 409 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "협업 서버에서 버전을 읽지 못했습니다." },
      { status: 502 },
    );
  }

  const claimed = resolveProposal(proposalId, "applied", user.id);

  if (!claimed) {
    return NextResponse.json(
      { error: "이 AI 제안은 이미 다른 멤버가 처리했습니다." },
      { status: 409 },
    );
  }

  return NextResponse.json({ proposal: claimed });
}
