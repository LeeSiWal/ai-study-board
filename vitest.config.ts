import { defineConfig } from "vitest/config";

/**
 * 단위 테스트와 통합 테스트를 나눈다.
 *
 * 단위(`tests/unit`)는 브라우저 환경에서 순수 로직만 돌린다. Tiptap이 DOM
 * 위에서만 동작해서 jsdom이 필요하다.
 *
 * 통합(`tests/integration`)은 실제 PostgreSQL에 붙는다. 파일 상단의
 * `@vitest-environment node`로 환경을 바꾼다. 둘을 같은 명령에 묶으면
 * 단위 테스트가 인프라에 묶여 느려지고 잘 깨진다.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include:
      process.env.VITEST_SCOPE === "integration"
        ? ["tests/integration/**/*.test.ts"]
        : ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": new URL("./", import.meta.url).pathname },
  },
});
