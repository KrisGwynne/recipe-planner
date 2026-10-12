import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function request(path: string, cookie?: string) {
  return new NextRequest(`https://recipes.example${path}`, cookie ? { headers: { cookie } } : undefined);
}

describe("proxy", () => {
  it("sends signed-out visitors to sign-in, remembering where they were going", () => {
    const response = proxy(request("/plans?week=2"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("callbackUrl")).toBe("/plans?week=2");
  });

  it("lets signed-in visitors through", () => {
    const response = proxy(request("/plans", "__Secure-authjs.session-token=abc"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets anyone see public pages", () => {
    for (const path of ["/sign-in", "/invite/abc123", "/api/auth/signin"]) {
      expect(proxy(request(path)).headers.get("location"), path).toBeNull();
    }
  });

  it("sets a Content-Security-Policy with a fresh nonce on every response", () => {
    const passed = proxy(request("/plans", "authjs.session-token=abc"));
    const redirected = proxy(request("/plans"));
    const nonce = (response: Response) => response.headers.get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];

    expect(nonce(passed)).toBeTruthy();
    expect(nonce(redirected)).toBeTruthy();
    expect(nonce(passed)).not.toBe(nonce(redirected));
  });

  it("passes the nonce on to rendering in the request headers", () => {
    const response = proxy(request("/sign-in"));
    const csp = response.headers.get("content-security-policy");
    // NextResponse.next({ request: { headers } }) forwards them as x-middleware-request-*.
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
    expect(csp).toContain(`'nonce-${response.headers.get("x-middleware-request-x-nonce")}'`);
  });
});
