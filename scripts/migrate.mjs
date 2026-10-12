// Applies the migrations in drizzle/ to DATABASE_URL (Neon). Migrations
// already applied are skipped, so running it again does nothing.
//   pnpm db:migrate
//   node scripts/migrate.mjs --production-only
// With --production-only (the Vercel build command, vercel.json) it only runs
// on production deploys (VERCEL_ENV=production). Previews share production's
// database, so they mustn't migrate it from unmerged PRs (docs/decisions.md).
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

if (process.argv.includes("--production-only") && process.env.VERCEL_ENV !== "production") {
  console.log(`Not a production deploy (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}): migrations skipped.`);
  process.exit(0);
}

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
console.log("Migrations applied.");
