import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { importCounts } from "@/db/schema";
import { IMPORTS_PER_HOUR } from "@/recipes/review";
import type { HouseholdContext } from "./context";

// Rate limiting imports (PP-163). Counted per person (ctx.userId), in recipes
// saved rather than requests, since one import can take several requests.

export type Reservation = { ok: true } | { ok: false; retryMinutes: number };

function rows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

/**
 * Counts `n` recipes against the signed-in person's hourly limit, if they fit.
 * One statement, so two imports at once can't both slip under it. When they
 * don't fit, nothing is counted and it says how long until the hour is up.
 */
export async function reserveImports(ctx: HouseholdContext, n: number, limit = IMPORTS_PER_HOUR): Promise<Reservation> {
  if (n <= 0) return { ok: true };
  const db = getDb();
  const count = sql`${n}::int`;
  const max = sql`${limit}::int`;
  const expired = sql`${importCounts.windowStart} <= now() - interval '1 hour'`;
  const counted = rows(
    await db.execute(sql`
      insert into ${importCounts} ("user_id", "window_start", "count")
      select ${ctx.userId}, now(), ${count} where ${count} <= ${max}
      on conflict ("user_id") do update set
        "window_start" = case when ${expired} then now() else ${importCounts.windowStart} end,
        "count" = case when ${expired} then excluded."count" else ${importCounts.count} + excluded."count" end
      where (case when ${expired} then excluded."count" else ${importCounts.count} + excluded."count" end) <= ${max}
      returning "user_id"
    `),
  );
  if (counted.length > 0) return { ok: true };
  const [row] = rows<{ seconds: number | null }>(
    await db.execute(sql`
      select extract(epoch from (${importCounts.windowStart} + interval '1 hour' - now()))::float as "seconds"
      from ${importCounts} where "user_id" = ${ctx.userId}
    `),
  );
  return { ok: false, retryMinutes: Math.max(1, Math.ceil((row?.seconds ?? 3600) / 60)) };
}
