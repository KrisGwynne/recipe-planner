import { describe, expect, it } from "vitest";
import { approx, formatMinutes } from "./format";

describe("formatMinutes", () => {
  it("shows minutes under an hour", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(35)).toBe("35 min");
    expect(formatMinutes(59)).toBe("59 min");
  });

  it("shows hours and minutes from an hour up", () => {
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(80)).toBe("1 hr 20 min");
    expect(formatMinutes(180)).toBe("3 hr");
  });
});

describe("approx", () => {
  it("prefixes estimated values with ~", () => {
    expect(approx("825 kcal", true)).toBe("~825 kcal");
    expect(approx("672 kcal", false)).toBe("672 kcal");
  });
});
