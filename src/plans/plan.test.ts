import { describe, expect, it } from "vitest";
import {
  addDays,
  defaultPlanName,
  defaultStartDate,
  formatDay,
  formatLongDate,
  formatPortions,
  formatRange,
  groupPlans,
  planEnd,
  planInput,
  today,
} from "./plan";

describe("today", () => {
  it("is the date in the UK", () => {
    // 23:30 UTC on 12 October is already the 13th in British Summer Time.
    expect(today(new Date("2026-10-12T23:30:00Z"))).toBe("2026-10-13");
    // In winter the UK is on UTC.
    expect(today(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
  });
});

describe("dates", () => {
  it("adds days across months, years and the clocks changing", () => {
    expect(addDays("2026-10-12", 6)).toBe("2026-10-18");
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-12-29", 5)).toBe("2027-01-03");
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(planEnd({ startDate: "2026-10-12", days: 7 })).toBe("2026-10-18");
  });

  it("formats days and ranges as the design does", () => {
    expect(formatDay("2026-10-12")).toBe("Mon 12 Oct");
    expect(formatLongDate("2026-10-19", "2026-10-13")).toBe("Monday 19 October");
    expect(formatLongDate("2027-01-04", "2026-10-13")).toBe("Monday 4 January 2027");
    expect(formatRange({ startDate: "2026-10-12", days: 7 })).toBe("Mon 12 – Sun 18 Oct");
    expect(formatRange({ startDate: "2026-09-28", days: 7 })).toBe("Mon 28 Sep – Sun 4 Oct");
    expect(formatRange({ startDate: "2026-10-05", days: 7 }, { weekdays: false })).toBe("5 – 11 Oct");
    expect(formatRange({ startDate: "2026-10-12", days: 1 })).toBe("Mon 12 Oct");
    expect(formatRange({ startDate: "2026-12-28", days: 7 })).toBe("Mon 28 Dec 2026 – Sun 3 Jan 2027");
  });

  it("names a new plan after its start date", () => {
    expect(defaultPlanName("2026-10-19")).toBe("Week of 19 Oct");
  });
});

describe("defaultStartDate", () => {
  it("is the day after the latest plan ends", () => {
    const plans = [
      { startDate: "2026-10-12", days: 7 },
      { startDate: "2026-10-19", days: 3 },
      { startDate: "2026-10-05", days: 7 },
    ];
    expect(defaultStartDate(plans, "2026-10-13")).toBe("2026-10-22");
  });

  it("is today when there are no plans or the latest has ended", () => {
    expect(defaultStartDate([], "2026-10-13")).toBe("2026-10-13");
    expect(defaultStartDate([{ startDate: "2026-10-05", days: 7 }], "2026-10-13")).toBe("2026-10-13");
    // Ends yesterday: tomorrow would be today anyway.
    expect(defaultStartDate([{ startDate: "2026-10-06", days: 7 }], "2026-10-13")).toBe("2026-10-13");
  });
});

describe("groupPlans", () => {
  it("splits into plans covering today, coming up (soonest first) and past (newest first)", () => {
    const plan = (startDate: string, days = 7) => ({ startDate, days });
    const groups = groupPlans(
      [plan("2026-09-28"), plan("2026-10-26"), plan("2026-10-12"), plan("2026-10-19"), plan("2026-10-05"), plan("2026-10-13", 1)],
      "2026-10-13",
    );
    expect(groups.current.map((p) => p.startDate)).toEqual(["2026-10-12", "2026-10-13"]);
    expect(groups.upcoming.map((p) => p.startDate)).toEqual(["2026-10-19", "2026-10-26"]);
    expect(groups.past.map((p) => p.startDate)).toEqual(["2026-10-05", "2026-09-28"]);
  });

  it("counts a plan's first and last days as covering today", () => {
    expect(groupPlans([{ startDate: "2026-10-13", days: 7 }], "2026-10-13").current).toHaveLength(1);
    expect(groupPlans([{ startDate: "2026-10-07", days: 7 }], "2026-10-13").current).toHaveLength(1);
  });
});

describe("planInput", () => {
  const valid = { name: "This week", startDate: "2026-10-12", days: "7", people: "2" };

  it("reads the form's strings", () => {
    expect(planInput.parse(valid)).toEqual({ name: "This week", startDate: "2026-10-12", days: 7, people: 2 });
  });

  it("explains a missing or long name", () => {
    expect(planInput.safeParse({ ...valid, name: "  " }).error?.issues[0].message).toBe("Enter a name for the plan");
    expect(planInput.safeParse({ ...valid, name: "x".repeat(51) }).error?.issues[0].message).toBe(
      "Use 50 characters or fewer",
    );
  });

  it("refuses dates that don't exist and numbers out of range", () => {
    expect(planInput.safeParse({ ...valid, startDate: "2026-02-30" }).success).toBe(false);
    expect(planInput.safeParse({ ...valid, startDate: "" }).success).toBe(false);
    expect(planInput.safeParse({ ...valid, days: "0" }).success).toBe(false);
    expect(planInput.safeParse({ ...valid, people: "13" }).success).toBe(false);
  });
});

describe("formatPortions", () => {
  it("uses halves", () => {
    expect([0.5, 1, 1.5, 4].map(formatPortions)).toEqual(["½", "1", "1½", "4"]);
  });
});
