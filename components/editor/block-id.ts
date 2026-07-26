import { Extension } from "@tiptap/core";
import { isChangeOrigin } from "@tiptap/extension-collaboration";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * 블록마다 영속 ID를 부여하는 확장.
 *
 * AI 수정 제안은 `blockId`로 대상 블록을 지목한다(아키텍처 §14의
 * `replace_block`, `insert_after`). ProseMirror는 노드에 안정적인 신원을 주지
 * 않으므로 — 위치는 편집할 때마다 밀리고 노드 객체는 매 트랜잭션 새로
 * 만들어진다 — 제안 기능이 성립하려면 이 확장이 필요하다.
 *
 * 두 가지를 지킨다.
 *
 * 1. ID가 없는 블록에 새 UUID를 부여한다.
 * 2. ID가 겹치면 뒤에 오는 블록에 새 UUID를 준다.
 *
 * 2번이 필요한 이유는 블록 분할 때문이다. Enter로 문단을 나누면 ProseMirror가
 * 속성을 복사하므로 같은 ID를 가진 블록이 둘 생긴다. `keepOnSplit: false`로
 * 대부분 막지만, 붙여넣기나 복제 명령까지 덮지는 못한다.
 */

const DEFAULT_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "taskItem",
  "horizontalRule",
];

export interface BlockIdOptions {
  types: string[];
}

export const BlockId = Extension.create<BlockIdOptions>({
  name: "blockId",

  addOptions() {
    return { types: DEFAULT_TYPES };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) =>
              attributes.blockId
                ? { "data-block-id": attributes.blockId as string }
                : {},
            // 분할된 블록은 ID를 물려받지 않고 새로 발급받는다.
            keepOnSplit: false,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    const types = new Set(this.options.types);

    return [
      new Plugin({
        key: new PluginKey("blockId"),

        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          // 원격 변경에는 ID를 붙이지 않는다. 그 블록을 만든 클라이언트가
          // 이미 부여했고, 양쪽이 동시에 발급하면 서로 덮어쓰게 된다.
          if (transactions.every(isChangeOrigin)) {
            return null;
          }

          const seen = new Set<string>();
          const transaction = newState.tr;
          let changed = false;

          newState.doc.descendants((node, position) => {
            if (!types.has(node.type.name)) return;

            const current: unknown = node.attrs.blockId;

            if (
              typeof current === "string" &&
              current.length > 0 &&
              !seen.has(current)
            ) {
              seen.add(current);
              return;
            }

            const next = crypto.randomUUID();
            seen.add(next);
            transaction.setNodeAttribute(position, "blockId", next);
            changed = true;
          });

          return changed ? transaction : null;
        },
      }),
    ];
  },
});
