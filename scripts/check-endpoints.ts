import WebSocket from "ws";

/**
 * 접속 경로 점검.
 *
 * 브라우저는 두 곳에 붙는다. 웹(HTTP)과 협업 서버(WebSocket)다. 터널이나
 * 리버스 프록시 뒤에서는 둘 다 열려 있어야 편집기가 동작하는데, 실패해도
 * 화면에는 "오프라인"이라고만 나와서 어디가 막혔는지 알기 어렵다.
 *
 * 실행: npm run check -- https://study.19921005.xyz wss://collab.19921005.xyz
 *       (인자를 주지 않으면 로컬만 확인한다)
 *
 * 두 번째 인자는 협업 서버 주소다. 생략하면 NEXT_PUBLIC_COLLAB_URL을 쓴다.
 */

const WEB_PORT = process.env.PORT ?? "7171";
const COLLAB_PORT = process.env.COLLAB_PORT ?? "7172";

interface Check {
  label: string;
  run: () => Promise<string>;
}

function http(url: string): Check {
  return {
    label: url,
    run: async () => {
      const response = await fetch(url, { redirect: "manual" });
      return `HTTP ${response.status}`;
    },
  };
}

function websocket(url: string): Check {
  return {
    label: url,
    run: () =>
      new Promise((resolve) => {
        const socket = new WebSocket(url, { handshakeTimeout: 8000 });

        const done = (message: string) => {
          try {
            socket.close();
          } catch {
            // 이미 닫혔으면 무시한다.
          }
          resolve(message);
        };

        socket.on("open", () => done("열림"));
        socket.on("error", (error: Error) => done(`실패 — ${error.message}`));
        socket.on("unexpected-response", (_request, response) =>
          done(
            `HTTP ${response.statusCode} — WebSocket이 아닌 응답. ` +
              `프록시가 협업 서버가 아닌 곳으로 보내고 있다.`,
          ),
        );

        setTimeout(() => done("시간 초과 — 경로가 열려 있지 않다"), 9000);
      }),
  };
}

async function main() {
  const publicOrigin = process.argv[2]?.replace(/\/$/, "");

  const checks: Check[] = [
    http(`http://127.0.0.1:${WEB_PORT}/login`),
    websocket(`ws://127.0.0.1:${COLLAB_PORT}`),
  ];

  if (publicOrigin) {
    // 협업 서버는 별도 호스트일 수 있다. 웹 주소에 경로를 붙여 짐작하면
    // 실제로 쓰는 주소와 달라져 점검이 거짓말을 한다.
    const collabOrigin =
      process.argv[3]?.replace(/\/$/, "") ??
      process.env.NEXT_PUBLIC_COLLAB_URL ??
      null;

    checks.push(http(`${publicOrigin}/login`), http(`${publicOrigin}/api/mcp`));

    if (collabOrigin) {
      checks.push(websocket(collabOrigin));
    } else {
      console.log(
        "  협업 서버 주소를 알 수 없어 건너뜁니다.\n" +
          "    NEXT_PUBLIC_COLLAB_URL을 설정하거나 두 번째 인자로 주세요.",
      );
    }
  }

  for (const check of checks) {
    const result = await check.run().catch((error: unknown) =>
      error instanceof Error ? `실패 — ${error.message}` : "실패",
    );

    console.log(`  ${check.label}\n    → ${result}`);
  }

  if (!publicOrigin) {
    console.log(
      "\n공개 주소도 확인하려면: npm run check -- https://study.19921005.xyz",
    );
  }
}

main();
