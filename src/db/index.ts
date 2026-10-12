import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Any Postgres database with our schema: Neon in the app, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | undefined;

/**
 * The app's database (Neon over HTTP), created on first use so builds don't
 * need DATABASE_URL.
 */
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL isn't set. Add it to .env (see .env.example).");
    db = drizzle(neon(url), { schema });
  }
  return db;
}
