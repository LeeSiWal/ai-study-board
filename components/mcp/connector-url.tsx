"use client";

import { Check, Copy, Plug } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * SET-03 커스텀 커넥터 안내 — 아키텍처 §15.4
 *
 * OAuth를 붙이기 전에는 여기가 복잡했다. 토큰을 발급하고, 브리지 파일을
 * 내려받고, 절대 경로를 손으로 적고, 설정 파일을 찾아 붙여넣고, 앱을
 * 재시작해야 했다. 다섯 단계 중 하나라도 틀리면 이유를 알 수 없이 실패했다.
 *
 * 이제 주소 한 줄이다. 나머지는 클라이언트가 메타데이터를 읽고 알아서 한다.
 * 그래서 이 컴포넌트가 화면 맨 위에 있고, 토큰 발급은 아래로 내려갔다.
 */
export function McpConnectorUrl() {
  const [origin, setOrigin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 주소는 브라우저가 어디로 접속했는지에 달렸다. 서버에서 렌더할 때와
  // 다를 수 있어 마운트 후에 읽는다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/api/mcp` : "";

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section
      data-testid="connector-url"
      className="bg-surface space-y-4 rounded-xl border p-5"
    >
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Plug aria-hidden className="size-4" />
          Claude에 연결하기
        </h2>
        <p className="text-text-secondary mt-1 text-xs">
          Claude Desktop이나 claude.ai의 <strong>커넥터 추가</strong>에서 아래
          주소만 넣으면 됩니다. 설정 파일을 고칠 필요도, 토큰을 복사할 필요도
          없습니다.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <code className="bg-surface-subtle min-w-0 flex-1 truncate rounded border px-2 py-1.5 font-mono text-xs">
          {url || "…"}
        </code>
        <Button size="sm" variant="outline" disabled={!url} onClick={() => void copy()}>
          {copied ? (
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

      <ol className="text-text-secondary space-y-1.5 text-xs">
        <li>
          <strong className="text-text-primary">1.</strong> 설정 → 커넥터 →
          커스텀 커넥터 추가에 위 주소를 붙여넣습니다.
        </li>
        <li>
          <strong className="text-text-primary">2.</strong> 이 사이트의 로그인
          화면이 열립니다. 로그인하고 <strong>연결 승인</strong>을 누릅니다.
        </li>
        <li>
          <strong className="text-text-primary">3.</strong> 끝입니다. 도구 네
          개가 Claude에 나타납니다.
        </li>
      </ol>

      <p className="text-text-tertiary text-[11px]">
        {/* 승인 화면에도 같은 말이 있지만, 연결을 결심하기 전에 한 번 더 본다. */}
        Claude는 문서를 읽고 수정을 <strong>제안</strong>만 할 수 있습니다.
        제안은 사람이 승인해야 문서에 반영됩니다. 연결은 아래 목록이나 Claude
        쪽에서 언제든 끊을 수 있습니다.
      </p>
    </section>
  );
}
