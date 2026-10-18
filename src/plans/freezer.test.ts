import { describe, expect, it } from "vitest";
import { ago, frozenLabel } from "./freezer";

describe("ago", () => {
  it("says how long ago, in days, weeks, months or years", () => {
    const today = "2026-10-12";
    expect(ago(today, today)).toBe("today");
    expect(ago("2026-10-11", today)).toBe("yesterday");
    expect(ago("2026-10-07", today)).toBe("5 days ago");
    expect(ago("2026-10-04", today)).toBe("1 week ago");
    expect(ago("2026-09-21", today)).toBe("3 weeks ago");
    expect(ago("2026-08-01", today)).toBe("2 months ago");
    expect(ago("2025-10-01", today)).toBe("1 year ago");
  });
});

describe("frozenLabel", () => {
  it("is to freeze before the cook's day and frozen from then", () => {
    expect(frozenLabel({ servings: 4, frozenOn: "2026-10-13" }, "2026-10-12")).toBe("4 to freeze");
    expect(frozenLabel({ servings: 1.5, frozenOn: "2026-10-12" }, "2026-10-12")).toBe("1½ frozen");
  });
});
