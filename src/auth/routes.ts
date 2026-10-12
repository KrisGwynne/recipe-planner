// Which pages need a signed-in user. Used by src/proxy.ts.

/**
 * Pages anyone can see: the landing page (PP-159), sign-in and its error
 * page, privacy and terms (PP-159), invite links (the invite page shows who
 * invited you before asking you to sign in, PP-146 design D), and Auth.js's
 * own routes.
 */
const publicPaths = ["/", "/sign-in", "/privacy", "/terms"];
const publicPrefixes = ["/sign-in/", "/invite/", "/api/auth/"];

export function isPublicPath(pathname: string): boolean {
  return publicPaths.includes(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

// Auth.js's session cookie: __Secure- prefixed over HTTPS.
const sessionCookies = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * Whether the request carries a session cookie. Only a quick check, with no
 * database call: the (app) layout checks the session itself.
 */
export function hasSessionCookie(cookies: { has(name: string): boolean }): boolean {
  return sessionCookies.some((name) => cookies.has(name));
}
