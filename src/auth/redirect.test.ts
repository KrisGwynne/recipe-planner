import { describe, expect, it } from "vitest";
import { HOME, resolveRedirect, safeCallbackPath } from "./redirect";

describe("safeCallbackPath", () => {
  it("keeps paths on this site, with their query", () => {
    expect(safeCallbackPath("/plans")).toBe("/plans");
    expect(safeCallbackPath("/recipes?q=tuna")).toBe("/recipes?q=tuna");
    expect(safeCallbackPath("/invite/abc123")).toBe("/invite/abc123");
  });

  it("sends anything else home", () => {
    for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", undefined, null, ["/plans"]]) {
      expect(safeCallbackPath(value)).toBe(HOME);
    }
  });
});

describe("resolveRedirect", () => {
  const base = "https://recipes.example";

  it("allows relative and same-origin URLs", () => {
    expect(resolveRedirect("/plans", base)).toBe("https://recipes.example/plans");
    expect(resolveRedirect("https://recipes.example/plans", base)).toBe("https://recipes.example/plans");
  });

  it("refuses other sites", () => {
    expect(resolveRedirect("https://evil.example/plans", base)).toBe(`${base}${HOME}`);
    expect(resolveRedirect("//evil.example", base)).toBe(`${base}${HOME}`);
    expect(resolveRedirect("not a url", base)).toBe(`${base}${HOME}`);
  });
});
