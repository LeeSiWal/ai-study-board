"use client";

import { Check, Copy, KeyRound, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * SET-03 들어오는 MCP 연결 — 아키텍처 §15.4
 *
 * Claude Desktop이나 Claude Code 같은 외부 AI가 이 워크스페이스에 붙을 때
 * 쓰는 접속 토큰을 관리한다.
 *
 * 원문은 발급 응답에서 한 번만 나온다. 서버는 해시만 갖고 있어서 다시
 * 보여줄 방법이 없다. 그 사실을 화면에서 분명히 말해야 사용자가 그 순간
 * 복사한다.
 */

/** 발급 응답. 원문과 브리지 경로는 이 순간에만 존재한다. */
interface IssuedTokenValue {
  name: string;
  token: string;
  bridgePath: string;
}

interface TokenSummary {
  id: string;
  name: string;
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function McpAccessTokens() {
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 방금 발급된 원문. 화면을 떠나면 다시 볼 수 없다. */
  const [issued, setIssued] = useState<IssuedTokenValue | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/mcp/tokens");
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "토큰을 불러오지 못했습니다.");
      }

      setTokens(body.tokens as TokenSummary[]);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "토큰을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 서버에서 목록을 끌어오는 구독이다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setIssuing(true);
    setError(null);

    try {
      const response = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "토큰을 발급하지 못했습니다.");
      }

      setIssued({
        name: body.name,
        token: body.token,
        bridgePath: body.bridgePath,
      });
      setName("");
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "토큰을 발급하지 못했습니다.",
      );
    } finally {
      setIssuing(false);
    }
  }

  async function revoke(token: TokenSummary) {
    if (
      !window.confirm(
        `"${token.name}" 토큰을 폐기할까요? 이 토큰을 쓰던 AI 도구는 즉시 접근할 수 없게 됩니다.`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/mcp/tokens?id=${token.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "토큰을 폐기하지 못했습니다.");
      }

      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "토큰을 폐기하지 못했습니다.",
      );
    }
  }

  return (
    <section className="bg-surface space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound aria-hidden className="size-4" />이 워크스페이스를 AI에 연결
        </h2>
        <p className="text-text-secondary mt-1 text-xs">
          Claude Desktop이나 Claude Code 같은 도구가 이 워크스페이스의 문서를
          읽고 수정을 제안할 수 있습니다. 수정은 제안으로만 만들어지며, 승인해야
          문서에 반영됩니다.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-3 py-2 text-xs"
        >
          {error}
        </p>
      ) : null}

      {issued ? <IssuedToken issued={issued} onDone={() => setIssued(null)} /> : null}

      <form onSubmit={issue} className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="token-name">토큰 이름</Label>
          <Input
            id="token-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="예: 내 노트북 Claude Code"
          />
        </div>
        <Button type="submit" disabled={issuing || !name.trim()}>
          {issuing ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              발급 중…
            </>
          ) : (
            "토큰 발급"
          )}
        </Button>
      </form>

      <div>
        <h3 className="text-text-secondary mb-2 text-xs font-medium">
          발급된 토큰 {tokens.length > 0 ? `(${tokens.length})` : ""}
        </h3>

        {loading && !tokens.length ? (
          <p className="text-text-secondary text-xs">불러오는 중…</p>
        ) : null}

        {!tokens.length && !loading ? (
          <p className="text-text-tertiary text-xs">
            아직 발급한 토큰이 없습니다.
          </p>
        ) : null}

        <ul className="space-y-2">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="border-border flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{token.name}</p>
                <p className="text-text-tertiary font-mono text-[11px]">
                  {token.hint}
                </p>
              </div>
              <p className="text-text-secondary shrink-0 text-[11px]">
                {token.lastUsedAt
                  ? `마지막 사용 ${new Date(token.lastUsedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : "사용 기록 없음"}
              </p>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${token.name} 폐기`}
                onClick={() => void revoke(token)}
              >
                <Trash2 aria-hidden className="text-danger size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * 발급 직후 화면.
 *
 * 다시 볼 수 없다는 사실이 가장 중요한 정보다. 복사 버튼과 설정 조각을
 * 함께 주어 사용자가 손으로 조립하지 않게 한다.
 */
function IssuedToken({
  issued,
  onDone,
}: {
  issued: IssuedTokenValue;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [client, setClient] = useState<"code" | "desktop">("code");

  const origin =
    typeof window === "undefined" ? "http://localhost:7171" : window.location.origin;

  /**
   * 클라이언트마다 설정 모양이 다르다.
   *
   * Claude Code는 HTTP 서버에 헤더를 붙일 수 있다. Claude Desktop은 원격
   * 서버에 OAuth 흐름을 요구해서 Bearer 헤더를 넣을 자리가 없다. 그래서
   * 로컬 브리지를 자식 프로세스로 띄우고 토큰을 환경변수로 넘긴다.
   */
  const configs = {
    code: JSON.stringify(
      {
        mcpServers: {
          "ai-study-board": {
            type: "http",
            url: `${origin}/api/mcp`,
            headers: { Authorization: `Bearer ${issued.token}` },
          },
        },
      },
      null,
      2,
    ),
    desktop: JSON.stringify(
      {
        mcpServers: {
          "ai-study-board": {
            command: "npx",
            args: ["-y", "tsx", `${issued.bridgePath}`],
            env: {
              AI_STUDY_MCP_URL: `${origin}/api/mcp`,
              AI_STUDY_MCP_TOKEN: issued.token,
            },
          },
        },
      },
      null,
      2,
    ),
  };

  async function copy(value: string, kind: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div
      data-testid="issued-token"
      className="border-warning/40 bg-warning/5 space-y-3 rounded-xl border p-4"
    >
      <p className="text-warning flex items-center gap-2 text-sm font-medium">
        <TriangleAlert aria-hidden className="size-4" />
        지금 복사하세요. 이 토큰은 다시 볼 수 없습니다.
      </p>

      <div className="flex items-center gap-2">
        <code className="bg-surface min-w-0 flex-1 truncate rounded border px-2 py-1.5 font-mono text-xs">
          {issued.token}
        </code>
        <Button size="sm" variant="outline" onClick={() => void copy(issued.token, "token")}>
          {copied === "token" ? (
            <>
              <Check aria-hidden className="size-3.5" /> 복사됨
            </>
          ) : (
            <>
              <Copy aria-hidden className="size-3.5" /> 복사
            </>
          )}
        </Button>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {(
              [
                ["code", "Claude Code"],
                ["desktop", "Claude Desktop"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setClient(key)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  client === key
                    ? "bg-primary text-primary-foreground"
                    : "border-border hover:bg-surface-subtle border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void copy(configs[client], "config")}
          >
            {copied === "config" ? (
              <>
                <Check aria-hidden className="size-3.5" /> 복사됨
              </>
            ) : (
              <>
                <Copy aria-hidden className="size-3.5" /> 설정 복사
              </>
            )}
          </Button>
        </div>

        <pre className="bg-surface overflow-x-auto rounded border p-3 text-[11px] leading-relaxed">
          {configs[client]}
        </pre>

        <p className="text-text-tertiary mt-1.5 text-[11px]">
          {client === "desktop" ? (
            <>
              Claude Desktop은 원격 서버에 OAuth를 요구해서 Bearer 헤더를 넣을
              자리가 없습니다. 로컬 브리지가 그 사이를 메웁니다.
              <br />
              설정 파일 위치: macOS{" "}
              <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
            </>
          ) : (
            <>
              설정 파일 위치: <code>~/.claude.json</code> 또는 프로젝트의{" "}
              <code>.mcp.json</code>
            </>
          )}
        </p>
      </div>

      <Button size="sm" variant="ghost" onClick={onDone}>
        복사했습니다
      </Button>
    </div>
  );
}
