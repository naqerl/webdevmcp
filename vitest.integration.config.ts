import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.spec.ts"],
    environment: "node",
    globals: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
