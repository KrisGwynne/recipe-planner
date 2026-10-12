import "server-only";

// Every household-scoped read and write in src/data takes a HouseholdContext
// and filters on its householdId. A context only comes from the signed-in
// user's membership (requireHousehold in ./session), never from an id sent by
// the browser: the brand below means one can't be built by hand outside
// src/data (and eslint stops anything outside src/data importing contextFor).

declare const brand: unique symbol;

export type Role = "owner" | "member";

export type HouseholdContext = {
  readonly userId: string;
  readonly householdId: string;
  readonly role: Role;
  readonly [brand]: true;
};

/** For src/data only: the context for a membership looked up in the database. */
export function contextFor({ userId, householdId, role }: { userId: string; householdId: string; role: Role }) {
  return Object.freeze({ userId, householdId, role }) as HouseholdContext;
}

/** Thrown when someone tries something their role doesn't allow. */
export class ForbiddenError extends Error {
  constructor(message = "Only the household's owner can do that") {
    super(message);
  }
}

/** For owner-only actions (invites, settings). */
export function requireOwner(ctx: HouseholdContext): void {
  if (ctx.role !== "owner") throw new ForbiddenError();
}
