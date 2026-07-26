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
  title: string;
  setTitle: (title: string) => void;
  /** 자신을 제외한 접속자. */
  peers: Peer[];
}

const DocumentSessionContext = createContext<DocumentSessionValue | null>(null);

/**
 * 협업 서버 주소.
 *
 * 기본값을 127.0.0.1로 고정하면 브라우저가 자기 자신의 루프백을 찾는다.
 * 개발 서버를 다른 기기에서 열면 연결이 영영 안 된다. 그래서 지금 페이지를
 * 받아온 호스트를 그대로 쓰고, 배포처럼 협업 서버가 다른 곳에 있을 때만
 * NEXT_PUBLIC_COLLAB_URL로 덮어쓴다.
 */
function collaborationUrl(): string {
  const configured = process.env.NEXT_PUBLIC_COLLAB_URL;
  if (configured) return configured;

  const port = process.env.NEXT_PUBLIC_COLLAB_PORT ?? "1234";
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";

  return `${protocol}://${window.location.hostname}:${port}`;
}

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
  initialTitle: string;
  children: React.ReactNode;
}

export function DocumentSession({
  resourceId,
  documentName,
  initialTitle,
  children,
}: DocumentSessionProps) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: "connecting" });
  const [peers, setPeers] = useState<Peer[]>([]);
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    const document = new Y.Doc();

    const instance = new HocuspocusProvider({
      url: collaborationUrl(),
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

    const handleOffline = () => setStatus({ kind: "offline" });
    const handleOnline = () => {
      setStatus({ kind: "connecting" });
      instance.connect();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // 외부 시스템의 핸들을 자식에게 노출하는 것이라 effect에서 설정한다.
    // 렌더 중에 만들면 StrictMode의 이중 호출에서 WebSocket이 하나 샌다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProvider(instance);

    return () => {
      instance.destroy();
      document.destroy();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      setProvider(null);
      setPeers([]);
    };
  }, [documentName, resourceId]);

  const value = useMemo<DocumentSessionValue>(
    () => ({ provider, status, peers, title, setTitle }),
    [provider, status, peers, title],
  );

  return <DocumentSessionContext value={value}>{children}</DocumentSessionContext>;
}
