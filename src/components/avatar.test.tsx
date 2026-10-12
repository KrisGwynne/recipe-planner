import { describe, expect, it } from "vitest";
import { initial } from "./avatar";

describe("initial", () => {
  it("is the first letter, in capitals", () => {
    expect(initial("kris Gwynne")).toBe("K");
    expect(initial("  alex@example.com")).toBe("A");
  });

  it("falls back to ? with no name", () => {
    expect(initial("")).toBe("?");
    expect(initial(null)).toBe("?");
  });
});
