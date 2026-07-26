import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * 데이터베이스 연결.
 *
 * Next.js 개발 서버는 HMR로 모듈을 다시 평가한다. 그때마다 새 연결 풀을
 * 만들면 곧 PostgreSQL의 연결 한도에 닿는다. globalThis에 붙여 재사용한다.
 *
 * 협업 서버도 같은 모듈을 쓴다. 프로세스가 다르므로 풀도 따로 생기지만,
 * 스키마와 쿼리는 공유한다.
 */

const CLIENT_KEY = Symbol.for("ai-study-board.db-client");

type GlobalWithClient = typeof globalThis & {
  [CLIENT_KEY]?: ReturnType<typeof postgres>;
};

function client() {
  const scope = globalThis as GlobalWithClient;

  if (!scope[CLIENT_KEY]) {
    const url = process.env.DATABASE_URL;

    if (!url) {
      throw new Error(
        "DATABASE_URL 환경변수가 없습니다. .env.local을 확인하세요.",
      );
    }

    scope[CLIENT_KEY] = postgres(url, { max: 10 });
  }

  return scope[CLIENT_KEY];
}

export const db = drizzle(client(), { schema });

export { schema };
