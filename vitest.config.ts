import { defineConfig } from "vitest/config";

// Test setup: docs/knowledge/tech-conventions.md#tooling. Unit tests never call AWS or DeepSeek.
export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  test: {
    globals: true,
    passWithNoTests: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"]
  }
});
