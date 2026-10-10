import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests hit a real PostgreSQL test database (guanemx_test).
// Run with: npm run test:integration
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup-env.ts"],
    // DB-backed suites share one schema; run files sequentially.
    fileParallelism: false,
    pool: "forks",
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});