import { describe, expect, it } from "vitest";
import { hasSessionCookie, isPublicPath } from "./routes";

describe("isPublicPath", () => {
  it("lets anyone see the landing, sign-in, legal and invite pages and Auth.js routes", () => {
    for (const path of ["/", "/sign-in", "/sign-in/error", "/privacy", "/terms", "/invite/abc123", "/api/auth/callback/google"]) {
      expect(isPublicPath(path), path).toBe(true);
    }
  });

  it("protects everything else", () => {
    for (const path of ["/recipes", "/recipes/lemony-tuna", "/plans", "/import", "/compare", "/household", "/invite", "/sign-inx", "/api/recipes"]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });
});

describe("hasSessionCookie", () => {
  const cookies = (...names: string[]) => ({ has: (name: string) => names.includes(name) });

  it("finds the session cookie over HTTP and HTTPS", () => {
    expect(hasSessionCookie(cookies("authjs.session-token"))).toBe(true);
    expect(hasSessionCookie(cookies("__Secure-authjs.session-token"))).toBe(true);
  });

  it("ignores other cookies", () => {
    expect(hasSessionCookie(cookies())).toBe(false);
    expect(hasSessionCookie(cookies("authjs.csrf-token", "authjs.callback-url"))).toBe(false);
  });
});
