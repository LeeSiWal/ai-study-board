import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  findResourceById,
  listResources,
  resolvePermissions,
} from "../store";
import { buildResourceTree, type ResourceNode } from "../store/resource-tree";
import type { User } from "../store/types";
import { readDocumentBlocks } from "./document-reader";

/**
 * 워크스페이스를 MCP 서버로 노출한다 — 아키텍처 §15.4
 *
 * 읽기는 바로 하되, 쓰기는 제안만 만든다. §3.3의 원칙은 연결 출처와 무관하게
 * 적용된다. 외부 AI는 워크스페이스 정책 바깥에 있으므로 오히려 더 엄격하다.
 *
 * 권한 판정은 §17의 `resolvePermissions`를 그대로 쓴다. 별도 경로를 만들면
 * 두 곳이 어긋나고, 어긋나는 쪽이 대개 새는 쪽이 된다.
 */

export interface McpContext {
  user: User;
  workspaceId: string;
}

/** 권한이 있는 리소스만 남긴다(§16.5). */
function visibleTree(context: McpContext): ResourceNode[] {
  const allowed = listResources(context.workspaceId).filter(
    (resource) => resolvePermissions(resource.id, context.user.id).length > 0,
  );

  return buildResourceTree(allowed);
}

function renderTree(nodes: ResourceNode[], depth = 0): string[] {
  return nodes.flatMap((node) => [
    `${"  ".repeat(depth)}- [${node.type}] ${node.title} (id: ${node.id})`,
    ...renderTree(node.children, depth + 1),
  ]);
}

export function buildMcpServer(context: McpContext): McpServer {
  const server = new McpServer(
    { name: "ai-study-board", version: "0.1.0" },
    {
      instructions:
        "이 서버는 공동 학습 워크스페이스입니다. 문서를 읽을 수 있고, 수정은 " +
        "제안으로만 만들 수 있습니다. 제안은 워크스페이스 멤버가 확인하고 " +
        "승인해야 문서에 반영됩니다.",
    },
  );

  server.registerTool(
    "list_pages",
    {
      title: "페이지 목록",
      description:
        "워크스페이스의 페이지 트리를 돌려줍니다. 문서, 화이트보드, 파일이 " +
        "한 트리에 섞여 있고 각 항목의 id로 read_page를 호출할 수 있습니다.",
      inputSchema: {},
    },
    async () => {
      const lines = renderTree(visibleTree(context));

      return {
        content: [
          {
            type: "text",
            text: lines.length
              ? lines.join("\n")
              : "접근할 수 있는 페이지가 없습니다.",
          },
        ],
      };
    },
  );

  server.registerTool(
    "read_page",
    {
      title: "페이지 읽기",
      description:
        "문서 본문을 블록 단위로 읽습니다. 각 블록에는 blockId가 있고, " +
        "propose_edit으로 수정을 제안할 때 이 id로 대상을 지목합니다.",
      inputSchema: {
        resourceId: z.string().describe("list_pages가 돌려준 페이지 id"),
      },
    },
    async ({ resourceId }) => {
      const resource = findResourceById(resourceId);

      if (!resource || resource.workspaceId !== context.workspaceId) {
        return errorResult("그런 페이지가 없습니다.");
      }

      if (resolvePermissions(resourceId, context.user.id).length === 0) {
        return errorResult("이 페이지에 접근할 권한이 없습니다.");
      }

      if (resource.type !== "DOCUMENT") {
        return errorResult(
          `${resource.type} 타입은 아직 읽을 수 없습니다. 문서만 지원합니다.`,
        );
      }

      const blocks = await readDocumentBlocks(
        resourceId,
        context.workspaceId,
        context.user.id,
        context.user.displayName,
      );

      const body = blocks.length
        ? blocks
            .map((block) => `[${block.blockId}] (${block.type}) ${block.text}`)
            .join("\n")
        : "(문서가 비어 있습니다.)";

      return {
        content: [{ type: "text", text: `# ${resource.title}\n\n${body}` }],
      };
    },
  );

  server.registerTool(
    "search_pages",
    {
      title: "페이지 검색",
      description: "제목으로 페이지를 찾습니다.",
      inputSchema: { query: z.string().min(1).describe("검색어") },
    },
    async ({ query }) => {
      const needle = query.trim().toLowerCase();

      const matches = listResources(context.workspaceId)
        .filter(
          (resource) =>
            resource.title.toLowerCase().includes(needle) &&
            resolvePermissions(resource.id, context.user.id).length > 0,
        )
        .map(
          (resource) =>
            `- [${resource.type}] ${resource.title} (id: ${resource.id})`,
        );

      return {
        content: [
          {
            type: "text",
            text: matches.length
              ? matches.join("\n")
              : `"${query}"와 일치하는 페이지가 없습니다.`,
          },
        ],
      };
    },
  );

  return server;
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}
