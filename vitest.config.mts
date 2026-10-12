import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // server-only throws outside React Server Components; tests are allowed.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    // Each test worker holds an in-memory Postgres of about 0.5 GB (src/db/test-db.ts),
    // so cap the workers, and allow time for each one's first database.
    maxWorkers: 4,
    hookTimeout: 30_000,
    // Component tests (.tsx) run in jsdom; everything else in Node.
    projects: [
      { extends: true, test: { name: "node", include: ["**/*.test.ts"], exclude: ["node_modules/**", ".claude/**"], environment: "node" } },
      {
        extends: true,
        test: {
          name: "dom",
          include: ["**/*.test.tsx"],
          exclude: ["node_modules/**", ".claude/**"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
