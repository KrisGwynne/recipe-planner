/** Where people go after signing in, unless they were on their way somewhere. */
export const HOME = "/recipes";

/**
 * A callbackUrl from the query string, reduced to a path on this site.
 * Anything else ("https://evil.example", "//evil.example", "/\evil.example")
 * becomes HOME, so sign-in can't be used to send people elsewhere.
 */
export function safeCallbackPath(value: string | string[] | undefined | null): string {
  if (typeof value !== "string") return HOME;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return HOME;
  return value;
}

/** Auth.js redirect callback: same-origin URLs only. */
export function resolveRedirect(url: string, baseUrl: string): string {
  if (url.startsWith("/")) return `${baseUrl}${safeCallbackPath(url)}`;
  try {
    if (new URL(url).origin === baseUrl) return url;
  } catch {}
  return `${baseUrl}${HOME}`;
}
