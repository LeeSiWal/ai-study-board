"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as Y from "yjs";

/**
 * 한 문서에 대한 협업 세션.
 *
 * 연결·동기화 상태와 접속자 목록은 상단 바(§6)와 편집기(§11)가 함께 봐야
 * 하는데 둘은 화면에서 떨어져 있다. 세션이 Yjs 문서와 프로바이더를 소유하고
 * 두 곳에 컨텍스트로 넘긴다.
 */

export type SaveStatus =
  | { kind: "connecting" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "offline" }
  | { kind: "failed"; reason: string };

export interface Peer {
  clientId: number;
  displayName: string;
  cursorColor: string;
}

interface DocumentSessionValue {
  provider: HocuspocusProvider | null;
  status: SaveStatus;
  /** 자신을 제외한 접속자. */
  peers: Peer[];
}

const DocumentSessionContext = createContext<DocumentSessionValue | null>(null);

export function useDocumentSession(): DocumentSessionValue {
  const value = useContext(DocumentSessionContext);

  if (!value) {
    throw new Error("useDocumentSession은 DocumentSession 안에서만 쓸 수 있습니다.");
  }

  return value;
}

interface DocumentSessionProps {
  resourceId: string;
  documentName: string;
  children: React.ReactNode;
}

export function DocumentSession({
  resourceId,
  documentName,
  children,
}: DocumentSessionProps) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: "connecting" });
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    const document = new Y.Doc();

    const instance = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://127.0.0.1:1234",
      name: documentName,
      document,

      // 토큰은 짧게 만료된다(§17). 함수로 넘기면 재연결할 때마다 새로
      // 발급받으므로 만료가 곧 연결 종료로 이어지지 않는다.
      token: async () => {
        const response = await fetch(
          `/api/resources/${resourceId}/collaboration-token`,
          { method: "POST" },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "협업 토큰을 발급받지 못했습니다.");
        }

        const body: { token: string } = await response.json();
        return body.token;
      },

      onStatus: ({ status: next }) => {
        setStatus((current) => {
          if (next !== "connected") return { kind: "offline" };
          // 연결됐지만 아직 동기화 전이면 저장됐다고 말하지 않는다.
          return current.kind === "saved" ? current : { kind: "saving" };
        });
      },

      onSynced: () => setStatus({ kind: "saved" }),

      onUnsyncedChanges: ({ number }) =>
        setStatus((current) =>
          current.kind === "offline" || current.kind === "failed"
            ? current
            : { kind: number > 0 ? "saving" : "saved" },
        ),

      onAuthenticationFailed: ({ reason }) =>
        setStatus({ kind: "failed", reason }),

      onAwarenessChange: ({ states }) => {
        const self = instance.awareness?.clientID;

        setPeers(
          states
            .filter((state) => state.clientId !== self)
            .map((state) => {
              const user = (state as { user?: Record<string, unknown> }).user;

              return {
                clientId: state.clientId,
                displayName:
                  typeof user?.name === "string" ? user.name : "알 수 없음",
                cursorColor:
                  typeof user?.color === "string" ? user.color : "#929aa5",
              };
            }),
        );
      },
    });

    // 외부 시스템의 핸들을 자식에게 노출하는 것이라 effect에서 설정한다.
    // 렌더 중에 만들면 StrictMode의 이중 호출에서 WebSocket이 하나 샌다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProvider(instance);

    return () => {
      instance.destroy();
      document.destroy();
      setProvider(null);
      setPeers([]);
    };
  }, [documentName, resourceId]);

  const value = useMemo<DocumentSessionValue>(
    () => ({ provider, status, peers }),
    [provider, status, peers],
  );

  return <DocumentSessionContext value={value}>{children}</DocumentSessionContext>;
}
