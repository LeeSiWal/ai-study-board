"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * 승인한 앱 목록 — SET-03
 *
 * 연결을 시작하는 곳만 있고 끊는 곳이 없으면, 사용자는 승인을 되돌릴 수
 * 없다고 느낀다. 그 느낌이 승인 자체를 망설이게 만든다.
 */

interface Connection {
  clientId: string;
  name: string;
  authorizedAt: string;
}

export function ConnectedApps() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/oauth/connections");
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "연결을 불러오지 못했습니다.");
      }

      setConnections(body.connections as Connection[]);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "연결을 불러오지 못했습니다.",
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function disconnect(connection: Connection) {
    if (
      !window.confirm(
        `"${connection.name}"의 연결을 끊을까요? 이 앱은 즉시 워크스페이스에 접근할 수 없게 됩니다.`,
      )
    ) {
      return;
    }

    const response = await fetch(
      `/api/oauth/connections?clientId=${encodeURIComponent(connection.clientId)}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      setError("연결을 끊지 못했습니다.");
      return;
    }

    await refresh();
  }

  return (
    <div data-testid="oauth-connections">
      <h3 className="text-text-secondary mb-2 text-xs font-medium">
        연결된 앱 {connections.length > 0 ? `(${connections.length})` : ""}
      </h3>

      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}

      {loaded && !connections.length ? (
        <p className="text-text-tertiary text-xs">아직 연결된 앱이 없습니다.</p>
      ) : null}

      <ul className="space-y-2">
        {connections.map((connection) => (
          <li
            key={connection.clientId}
            className="border-border flex items-center gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{connection.name}</p>
              <p className="text-text-tertiary text-[11px]">
                {new Date(connection.authorizedAt).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                에 승인
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${connection.name} 연결 끊기`}
              onClick={() => void disconnect(connection)}
            >
              <Trash2 aria-hidden className="text-danger size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
