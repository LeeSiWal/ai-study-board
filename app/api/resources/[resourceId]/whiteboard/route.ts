import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { whiteboardSceneSchema } from "@/lib/contracts/whiteboard";
import { findResourceById, resolvePermissions } from "@/lib/store";
import { readWhiteboard, storeWhiteboard } from "@/lib/store/whiteboards";

const MAX_SCENE_BYTES = 15 * 1024 * 1024;

async function authorizedResource(resourceId: string, edit = false) {
  const user = await currentUser();
  if (!user) return { error: "로그인이 필요합니다.", status: 401 } as const;

  const resource = await findResourceById(resourceId);
  if (!resource || resource.type !== "WHITEBOARD") {
    return { error: "화이트보드를 찾을 수 없습니다.", status: 404 } as const;
  }

  const permissions = await resolvePermissions(resourceId, user.id);
  if (!permissions.includes(edit ? "edit" : "view")) {
    return { error: "화이트보드 접근 권한이 없습니다.", status: 403 } as const;
  }

  return { resource, permissions } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const { resourceId } = await params;
  const access = await authorizedResource(resourceId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  return NextResponse.json(await readWhiteboard(resourceId));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const { resourceId } = await params;
  const access = await authorizedResource(resourceId, true);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_SCENE_BYTES) {
    return NextResponse.json(
      { error: "화이트보드 용량이 15MB를 초과했습니다." },
      { status: 413 },
    );
  }

  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_SCENE_BYTES) {
    return NextResponse.json(
      { error: "화이트보드 용량이 15MB를 초과했습니다." },
      { status: 413 },
    );
  }

  const parsed = whiteboardSceneSchema.safeParse(
    (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })(),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "화이트보드 데이터가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const version = await storeWhiteboard(resourceId, parsed.data);
  return NextResponse.json({ version });
}
