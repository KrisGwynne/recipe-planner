// An in-memory Postgres (PGlite) with every migration applied, for tests.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Db } from "./index";

// Starting Postgres and migrating takes seconds, so each test worker does it
// once and every test gets a clone of that database (a fraction of a
// second). The previous clone is closed first, so a worker holds two at most.
let template: Promise<PGlite> | undefined;
let previous: PGlite | undefined;

async function migratedTemplate(): Promise<PGlite> {
  const client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  return client;
}

export async function createTestDb(): Promise<Db> {
  template ??= migratedTemplate();
  await previous?.close();
  const client = await (await template).clone();
  previous = client;
  return drizzle(client, { schema });
}
