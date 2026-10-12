// An in-memory Postgres (PGlite) with every migration applied, for tests.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Db } from "./index";

// Tests make a fresh database each time; the previous one is closed first so
// a test worker holds one at a time (each takes tens of MB).
let previous: PGlite | undefined;

export async function createTestDb(): Promise<Db> {
  await previous?.close();
  const client = new PGlite();
  previous = client;
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}
