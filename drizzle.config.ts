import { defineConfig } from "drizzle-kit";

// Reads DATABASE_URL from .env when there is one (not needed to generate).
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
