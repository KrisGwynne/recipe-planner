import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { households } from "./households";

// Invite links (PP-156): single use, 7 days, revocable. Only a SHA-256 hash of
// the token is stored, so the database alone can't be used to join.
export const householdInvites = pgTable(
  "household_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    // An invite from a deleted account stops working with it.
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { mode: "date", withTimezone: true }),
    usedBy: text("used_by").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
  },
  (invite) => [
    uniqueIndex("household_invites_token_hash").on(invite.tokenHash),
    index("household_invites_household_id").on(invite.householdId),
  ],
);
