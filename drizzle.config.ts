import { defineConfig } from "drizzle-kit";

// DATABASE_URL (not needed to generate) comes from the environment, or like
// Next.js from .env.local then .env: values already set aren't overwritten,
// so .env.local wins. Either file may be missing.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
