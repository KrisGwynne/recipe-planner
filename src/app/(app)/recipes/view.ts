// The library's card or list view, remembered on the device in a cookie so
// the server renders the chosen view first time (Kris, 2026-10-12, PP-166).

export type LibraryView = "cards" | "list";

export const VIEW_COOKIE = "recipes-view";

/** Cards unless the cookie says list. */
export function parseView(value: string | undefined): LibraryView {
  return value === "list" ? "list" : "cards";
}

/** The Set-Cookie string for document.cookie: a year, on every path. */
export function viewCookie(view: LibraryView): string {
  return `${VIEW_COOKIE}=${view}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
