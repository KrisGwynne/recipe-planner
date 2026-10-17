import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

// Rate limiting imports (PP-163; decisions 2026-10-11: a Postgres counter
// table, not an extra service). One row per person: how many recipes they've
// saved since `window_start`. The window starts again an hour after it began.
export const importCounts = pgTable("import_counts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  windowStart: timestamp("window_start", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});
