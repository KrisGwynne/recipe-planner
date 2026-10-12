// Applies the migrations in drizzle/ to DATABASE_URL (Neon). Migrations
// already applied are skipped, so running it again does nothing.
//   pnpm db:migrate
// Vercel runs it before every build (vercel.json): production migrates the
// production database when a PR is merged, and each preview migrates its own
// Neon branch, which the Neon integration makes per preview and passes in as
// DATABASE_URL (docs/decisions.md).
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

// DATABASE_URL comes from the environment, or like Next.js from .env.local
// then .env: values already set aren't overwritten, so .env.local wins.
// Either file may be missing.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL isn't set. Add it to .env or .env.local (see .env.example).");

await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
console.log(`Migrations applied${process.env.VERCEL_ENV ? ` (${process.env.VERCEL_ENV})` : ""}.`);
