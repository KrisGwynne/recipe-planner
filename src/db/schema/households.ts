import { pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
});

export const householdRole = pgEnum("household_role", ["owner", "member"]);

// Many-to-many, so a user could belong to several households later. For now
// one household per user (decisions 2026-10-11), enforced by the unique index
// on user_id; drop it in a migration if a household switcher ever comes.
export const householdMembers = pgTable(
  "household_members",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: householdRole("role").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (member) => [
    primaryKey({ columns: [member.householdId, member.userId] }),
    uniqueIndex("household_members_one_per_user").on(member.userId),
  ],
);
