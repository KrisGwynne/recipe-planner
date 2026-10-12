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
});
