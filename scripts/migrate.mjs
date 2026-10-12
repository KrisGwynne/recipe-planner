// Applies the migrations in drizzle/ to DATABASE_URL (Neon).
//   pnpm db:migrate
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

try {
  process.loadEnvFile();
} catch {}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL isn't set. Add it to .env (see .env.example).");

await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
console.log("Migrations applied.");
