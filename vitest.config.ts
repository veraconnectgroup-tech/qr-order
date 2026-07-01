import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/__tests__/**/*.test.ts",
      "src/__tests__/**/*.test.tsx",
      "src/lib/**/__tests__/**/*.test.ts",
    ],
    exclude: ["e2e/**", "node_modules/**"],
    testTimeout: 120_000,
    hookTimeout: 30_000,
    pool: "forks",
    maxWorkers: Math.min(4, Math.max(1, (os.cpus()?.length ?? 2) - 1)),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
