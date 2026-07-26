import { Editor } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

import { BlockId } from "@/components/editor/block-id";

/**
 * blockId 확장 검증.
 *
 * AI 수정 제안은 blockId로 대상 블록을 지목한다(아키텍처 §14). ID가 없거나
 * 겹치면 `replace_block`이 엉뚱한 블록을 고치므로, 이 확장의 성질은 AI 기능
 * 전체가 기대는 전제다.
 */

const editors: Editor[] = [];

function createEditor(document: Y.Doc) {
  const element = window.document.createElement("div");
  window.document.body.appendChild(element);

  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document }),
      BlockId,
    ],
  });

  editors.push(editor);
  return editor;
}

/** 문서 안의 모든 blockId를 문서 순서대로 모은다. */
function blockIds(editor: Editor): string[] {
  const ids: string[] = [];

  editor.state.doc.descendants((node) => {
    const id: unknown = node.attrs.blockId;
    if (typeof id === "string" && id.length > 0) ids.push(id);
  });

  return ids;
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

describe("blockId 확장", () => {
  it("입력한 블록마다 ID를 부여한다", () => {
    const editor = createEditor(new Y.Doc());

    editor.commands.setContent("<p>첫 문단</p><p>둘째 문단</p>");
    editor.commands.insertContent("<p>셋째 문단</p>");

    const ids = blockIds(editor);

    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it("모든 ID가 문서 안에서 유일하다", () => {
    const editor = createEditor(new Y.Doc());

    editor.commands.setContent(
      "<p>하나</p><h2>둘</h2><ul><li><p>셋</p></li><li><p>넷</p></li></ul><blockquote><p>다섯</p></blockquote>",
    );

    const ids = blockIds(editor);

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("블록을 나눠도 ID가 겹치지 않는다", () => {
    const editor = createEditor(new Y.Doc());

    editor.commands.setContent("<p>나눌 문단입니다</p>");
    const before = blockIds(editor);

    // 문단 가운데에 커서를 두고 나눈다. 속성이 복사되면 ID가 겹친다.
    editor.commands.setTextSelection(4);
    editor.commands.splitBlock();

    const after = blockIds(editor);

    expect(after.length).toBe(before.length + 1);
    expect(new Set(after).size).toBe(after.length);
  });

  it("기존 블록의 ID는 편집해도 유지된다", () => {
    const editor = createEditor(new Y.Doc());

    editor.commands.setContent("<p>원래 문단</p>");
    const [originalId] = blockIds(editor);

    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent(" 덧붙인 문장");

    // AI 제안이 baseVersion 시점의 blockId를 들고 있어도 유효해야 한다.
    expect(blockIds(editor)).toContain(originalId);
  });
});

describe("Collaboration 결합", () => {
  it("한쪽 편집기의 입력이 다른 쪽에 병합된다", () => {
    const documentA = new Y.Doc();
    const documentB = new Y.Doc();

    // 협업 서버 없이 두 문서를 직접 잇는다. 서버를 거치는 경로는
    // scripts/verify-collab.ts가 따로 확인한다.
    documentA.on("update", (update) => Y.applyUpdate(documentB, update));
    documentB.on("update", (update) => Y.applyUpdate(documentA, update));

    const editorA = createEditor(documentA);
    const editorB = createEditor(documentB);

    editorA.commands.setContent("<p>시월이 쓴 문장</p>");

    expect(editorB.getText()).toContain("시월이 쓴 문장");

    editorB.commands.setTextSelection(editorB.state.doc.content.size - 1);
    editorB.commands.insertContent(" 그리고 민지가 덧붙임");

    expect(editorA.getText()).toContain("민지가 덧붙임");
  });

  it("원격에서 온 블록의 ID를 다시 발급하지 않는다", () => {
    const documentA = new Y.Doc();
    const documentB = new Y.Doc();

    documentA.on("update", (update) => Y.applyUpdate(documentB, update));
    documentB.on("update", (update) => Y.applyUpdate(documentA, update));

    const editorA = createEditor(documentA);
    const editorB = createEditor(documentB);

    editorA.commands.setContent("<p>원격 전파 확인</p>");

    // 양쪽이 같은 ID를 봐야 AI 제안이 어느 클라이언트에서든 같은 블록을
    // 가리킨다. 원격 변경에 ID를 새로 붙이면 여기서 어긋난다.
    const idsFromA = blockIds(editorA);

    expect(idsFromA.length).toBeGreaterThan(0);
    expect(blockIds(editorB)).toEqual(idsFromA);
  });
});
