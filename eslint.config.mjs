import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // No debug logging in app code. Tests may log.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  // Household data goes through the data-access layer (src/data, PP-155): only
  // it, the database module and auth may touch the database. Tests may too.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/data/**", "src/db/**", "src/auth/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "drizzle-orm", message: "Query household data through @/data (the data-access layer)." },
          ],
          patterns: [
            {
              group: ["@/db/*", "drizzle-orm/*", "**/db", "**/db/*"],
              message: "Query household data through @/data (the data-access layer).",
            },
            {
              group: ["@/data/*", "!@/data/index"],
              message: "Import from @/data, not its files: contexts only come from requireHousehold.",
            },
          ],
        },
      ],
    },
  },
  // Everything in src/data runs on the server only: each file imports
  // "server-only", so the build fails if browser code pulls one in. Tests and
  // test helpers (test-*.ts) are exempt.
  {
    files: ["src/data/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "src/data/test-*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program:not(:has(ImportDeclaration[source.value='server-only']))",
          message: 'Files in src/data must import "server-only".',
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "next-env.d.ts",
    // Built design files (generated from designs/src by npm run designs).
    "designs/**",
    // Generated from schema/recipe.schema.json by npm run schema:types.
    "src/types/recipe.ts",
  ]),
]);
