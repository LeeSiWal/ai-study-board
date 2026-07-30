import { eq, sql } from "drizzle-orm";

import type { WhiteboardScene } from "../contracts/whiteboard";
import { EMPTY_WHITEBOARD_SCENE, whiteboardSceneSchema } from "../contracts/whiteboard";
import { db, schema } from "../db";

export interface StoredWhiteboard {
  scene: WhiteboardScene;
  version: number;
  updatedAt: Date | null;
}

export async function readWhiteboard(
  resourceId: string,
): Promise<StoredWhiteboard> {
  const row = await db.query.whiteboards.findFirst({
    where: eq(schema.whiteboards.resourceId, resourceId),
  });

  if (!row) {
    return { scene: EMPTY_WHITEBOARD_SCENE, version: 0, updatedAt: null };
  }

  const parsed = whiteboardSceneSchema.safeParse(JSON.parse(row.scene));
  if (!parsed.success) {
    throw new Error("저장된 화이트보드 장면이 올바르지 않습니다.");
  }

  return { scene: parsed.data, version: row.version, updatedAt: row.updatedAt };
}

export async function storeWhiteboard(
  resourceId: string,
  scene: WhiteboardScene,
): Promise<number> {
  const [row] = await db
    .insert(schema.whiteboards)
    .values({ resourceId, scene: JSON.stringify(scene), version: 1 })
    .onConflictDoUpdate({
      target: schema.whiteboards.resourceId,
      set: {
        scene: JSON.stringify(scene),
        version: sql`${schema.whiteboards.version} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ version: schema.whiteboards.version });

  return row.version;
}
