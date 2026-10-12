import { describe, expect, it } from "vitest";
import { ForbiddenError, contextFor, requireOwner, type HouseholdContext } from "./context";

describe("HouseholdContext", () => {
  it("can't be built from a raw household id", () => {
    // @ts-expect-error a plain object isn't a HouseholdContext: it has to come from a membership lookup.
    const forged: HouseholdContext = { userId: "kris", householdId: "someone-elses", role: "owner" };
    expect(forged).toBeDefined();
  });

  it("can't be changed once made", () => {
    const ctx = contextFor({ userId: "kris", householdId: "h1", role: "member" });
    expect(() => Object.assign(ctx, { householdId: "h2" })).toThrow();
    expect(ctx.householdId).toBe("h1");
  });
});

describe("requireOwner", () => {
  it("lets the owner through", () => {
    expect(() => requireOwner(contextFor({ userId: "kris", householdId: "h1", role: "owner" }))).not.toThrow();
  });

  it("refuses a member", () => {
    expect(() => requireOwner(contextFor({ userId: "sam", householdId: "h1", role: "member" }))).toThrow(ForbiddenError);
  });
});
