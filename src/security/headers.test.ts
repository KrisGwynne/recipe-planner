import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { contentSecurityPolicy, newNonce, securityHeaders } from "./headers";

/** The policy as { directive: sources }. */
function parse(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy.split("; ").map((directive) => {
      const [name, ...sources] = directive.split(" ");
      return [name, sources];
    }),
  );
}

const production = { dev: false, vercelEnv: "production" };

describe("contentSecurityPolicy", () => {
  it("only runs scripts with the request's nonce", () => {
    const csp = parse(contentSecurityPolicy("abc123", production));
    expect(csp["script-src"]).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(csp["script-src"]).not.toContain("'unsafe-inline'");
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
  });

  it("allows inline styles, which React and next/image write as attributes", () => {
    expect(parse(contentSecurityPolicy("n", production))["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it("can't be framed, and forms can only post here or to Google sign-in", () => {
    const csp = parse(contentSecurityPolicy("n", production));
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["form-action"]).toEqual(["'self'", "https://accounts.google.com"]);
  });

  it("loads images and connects to this site only (avatars come through /_next/image)", () => {
    const csp = parse(contentSecurityPolicy("n", production));
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:"]);
    expect(csp["connect-src"]).toEqual(["'self'"]);
  });

  it("upgrades insecure requests, except in development", () => {
    expect(parse(contentSecurityPolicy("n", production))).toHaveProperty("upgrade-insecure-requests");
    expect(parse(contentSecurityPolicy("n", { dev: true }))).not.toHaveProperty("upgrade-insecure-requests");
  });

  it("allows eval in development only, for React's error overlays", () => {
    expect(parse(contentSecurityPolicy("n", production))["script-src"]).not.toContain("'unsafe-eval'");
    expect(parse(contentSecurityPolicy("n", { dev: true }))["script-src"]).toContain("'unsafe-eval'");
  });

  it("allows the Vercel toolbar on previews only", () => {
    const preview = parse(contentSecurityPolicy("n", { dev: false, vercelEnv: "preview" }));
    // Host sources are ignored alongside 'strict-dynamic', so previews drop it.
    expect(preview["script-src"]).toEqual(["'self'", "'nonce-n'", "https://vercel.live"]);
    expect(preview["connect-src"]).toContain("https://vercel.live");
    expect(preview["frame-src"]).toContain("https://vercel.live");

    const policy = contentSecurityPolicy("n", production);
    expect(policy).not.toContain("vercel");
  });
});

describe("newNonce", () => {
  it("is different every time", () => {
    const nonces = new Set(Array.from({ length: 100 }, newNonce));
    expect(nonces.size).toBe(100);
    expect(newNonce()).toMatch(/^[A-Za-z0-9+/]{40,}={0,2}$/);
  });
});

describe("securityHeaders", () => {
  const header = (key: string) => securityHeaders.find((h) => h.key === key)?.value;

  it("sets the fixed headers", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Strict-Transport-Security")).toBe("max-age=63072000");
    expect(header("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("keeps invite tokens on this site without breaking its own form posts", () => {
    // no-referrer would send `Origin: null` on server actions, which Next rejects.
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("turns off unused features but leaves clipboard, share and wake lock alone", () => {
    const policy = header("Permissions-Policy")!;
    expect(policy).toContain("camera=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).not.toMatch(/clipboard|web-share|screen-wake-lock/);
  });

  it("are sent on every path", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/:path*", headers: securityHeaders }]);
  });
});
