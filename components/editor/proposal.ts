import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import type { AiOperation, DocumentBlock } from "@/lib/contracts/ai";

/**
 * AI 제안을 문서에 반영한다 — 아키텍처 §14
 *
 * 대상은 위치가 아니라 `blockId`다. 위치는 사람이 편집할 때마다 밀리지만
 * blockId는 BlockId 확장이 유지하므로, 제안을 만든 뒤 문서가 조금 바뀌어도
 * 같은 블록을 가리킨다.
 */

/** 문서를 AI에게 넘길 형태로 뽑는다. */
export function collectBlocks(editor: Editor): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  editor.state.doc.descendants((node) => {
    const blockId: unknown = node.attrs.blockId;
    if (typeof blockId !== "string" || !blockId) return;

    blocks.push({
      blockId,
      type: node.type.name,
      text: node.textContent,
    });
  });

  return blocks;
}

function findBlock(
  editor: Editor,
  blockId: string,
): { position: number; node: ProseMirrorNode } | null {
  let found: { position: number; node: ProseMirrorNode } | null = null;

  editor.state.doc.descendants((node, position) => {
    if (found) return false;
    if (node.attrs.blockId === blockId) {
      found = { position, node };
      return false;
    }
    return true;
  });

  return found;
}

/**
 * 승인된 operation을 순서대로 반영하고, 실제로 반영된 개수를 돌려준다.
 *
 * 매 operation마다 대상을 다시 찾는 이유는 앞선 변경으로 위치가 밀리기
 * 때문이다. blockId가 안정적이라 재조회가 안전하다.
 *
 * 트랜잭션에 `aiProposalId` 메타를 실어 사람이 친 변경과 구분한다. 활동
 * 기록이 "누가 무엇을 승인했는지" 남길 때 이 표시를 쓴다.
 */
export function applyOperations(
  editor: Editor,
  proposalId: string,
  operations: AiOperation[],
): number {
  let applied = 0;

  for (const operation of operations) {
    const target = findBlock(editor, operation.blockId);
    if (!target) continue;

    const { position, node } = target;

    const ran = editor
      .chain()
      .command(({ tr }) => {
        tr.setMeta("aiProposalId", proposalId);

        switch (operation.type) {
          case "replace_block":
            // 노드 자체가 아니라 인라인 내용만 바꾼다. 그래야 blockId를
            // 포함한 속성이 그대로 남는다.
            tr.replaceWith(
              position + 1,
              position + node.nodeSize - 1,
              editor.schema.text(operation.content),
            );
            return true;

          case "insert_after": {
            const paragraph = editor.schema.nodes.paragraph;
            if (!paragraph) return false;

            tr.insert(
              position + node.nodeSize,
              paragraph.create(null, editor.schema.text(operation.content)),
            );
            return true;
          }

          case "delete_block":
            tr.delete(position, position + node.nodeSize);
            return true;
        }
      })
      .run();

    if (ran) applied += 1;
  }

  return applied;
}

/** Diff 표시에 쓸 현재 본문. 대상 블록이 사라졌으면 null. */
export function currentTextOf(editor: Editor, blockId: string): string | null {
  return findBlock(editor, blockId)?.node.textContent ?? null;
}
