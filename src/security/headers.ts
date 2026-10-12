// Security headers (PP-142). The Content-Security-Policy carries a fresh nonce
// per request, so src/proxy.ts sets it; the fixed headers are set for every
// path in next.config.ts.

/** Where the app is running: `next dev`, a Vercel preview, or anything else. */
export type SecurityEnv = { dev: boolean; vercelEnv?: string };

export function currentSecurityEnv(): SecurityEnv {
  return { dev: process.env.NODE_ENV === "development", vercelEnv: process.env.VERCEL_ENV };
}

/** A random, unguessable nonce for one request's CSP. */
export function newNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * The Content-Security-Policy for one request.
 *
 * - Scripts need the nonce; Next adds it to its own scripts during rendering,
 *   reading it from this header on the request. `'strict-dynamic'` lets those
 *   scripts load the app's chunks.
 * - Styles allow `'unsafe-inline'`: React and next/image write `style=""`
 *   attributes, which a nonce can't cover.
 * - Images: avatars come through next/image (`/_next/image`), so `'self'`.
 * - Forms may post to Google: before the page's JavaScript loads, the sign-in
 *   form is a plain POST that redirects to accounts.google.com, and Chrome
 *   checks form-action on that redirect.
 * - Development: React needs `eval` for its error overlays, and
 *   `upgrade-insecure-requests` would break http://localhost.
 * - Vercel previews: the Vercel toolbar (https://vercel.live) is allowed. Host
 *   sources are ignored alongside `'strict-dynamic'`, so previews leave it out
 *   and rely on `'self'` plus the nonce instead.
 */
export function contentSecurityPolicy(nonce: string, env: SecurityEnv = currentSecurityEnv()): string {
  const preview = env.vercelEnv === "preview";
  const toolbar = (...sources: string[]) => (preview ? sources : []);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      ...(preview ? ["https://vercel.live"] : ["'strict-dynamic'"]),
      ...(env.dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'", ...toolbar("https://vercel.live")],
    "img-src": ["'self'", "data:", "blob:", ...toolbar("https://vercel.live", "https://vercel.com")],
    "font-src": ["'self'", ...toolbar("https://vercel.live", "https://assets.vercel.com")],
    "connect-src": ["'self'", ...toolbar("https://vercel.live", "wss://ws-us3.pusher.com")],
    "frame-src": ["'self'", ...toolbar("https://vercel.live")],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", "https://accounts.google.com"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(" ")}`);
  if (!env.dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/**
 * Headers for every response, set in next.config.ts.
 *
 * - Referrer-Policy: invite links carry a secret token in the path
 *   (`/invite/<token>`), so other sites get the origin only. Not
 *   `no-referrer`: that makes browsers send `Origin: null` on the app's own
 *   form posts, which Next's server-action check rejects.
 * - HSTS without includeSubDomains or preload: vercel.app isn't ours.
 * - Permissions-Policy turns off what the app never uses. Clipboard, share and
 *   screen wake lock (step timers) keep their defaults, allowed for this site.
 */
export const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
