import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tiptap은 DOM 위에서만 동작한다. Playwright가 막혀 있는 동안
    // 편집기 로직을 검증할 수 있는 통로다.
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": new URL("./", import.meta.url).pathname },
  },
});
