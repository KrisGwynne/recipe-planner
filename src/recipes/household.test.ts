import { describe, expect, it } from "vitest";
import { cookedDay, cookedHistory, cookedSummary } from "./household";

const today = "2026-10-14";

describe("cookedDay", () => {
  it("says today, the day and month, and the year only when it isn't this year's", () => {
    expect(cookedDay("2026-10-14", today)).toBe("today");
    expect(cookedDay("2026-10-02", today)).toBe("2 Oct");
    expect(cookedDay("2025-08-21", today)).toBe("21 Aug 2025");
  });
});

describe("cookedSummary (design A)", () => {
  it("counts and gives the last day", () => {
    expect(cookedSummary([], today)).toBe("Not cooked yet");
    expect(cookedSummary(["2026-10-02"], today)).toBe("Cooked once · last on 2 Oct");
    expect(cookedSummary(["2026-10-14", "2026-10-02"], today)).toBe("Cooked twice · last today");
    expect(cookedSummary(["2026-10-02", "2026-09-14", "2026-08-21"], today)).toBe("Cooked 3 times · last on 2 Oct");
  });
});

describe("cookedHistory (design F)", () => {
  it("names up to three days, then how many more", () => {
    expect(cookedHistory([], today)).toBe("Not cooked yet");
    expect(cookedHistory(["2026-10-02", "2026-09-14", "2026-08-21"], today)).toBe("Cooked 3 times: 2 Oct, 14 Sep, 21 Aug");
    expect(
      cookedHistory(["2026-10-14", "2026-09-14", "2026-08-21", "2026-07-01", "2026-01-05", "2025-12-25", "2025-11-01"], today),
    ).toBe("Cooked 7 times: today, 14 Sep, 21 Aug and 4 more");
  });
});
