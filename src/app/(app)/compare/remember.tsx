"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LAST_KEY, compareHref, readRemembered } from "@/compare/compare";

// The last comparison on this device (Kris, 2026-10-17), so leaving the tab
// and coming back keeps it. Browser storage can be missing or refuse, so
// every read and write is allowed to fail: the page works without it.

/** Saves what's being compared. */
export function RememberComparison({ slugs }: { slugs: string[] }) {
  const key = slugs.join("\n");
  useEffect(() => {
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(key ? key.split("\n") : []));
    } catch {
      // Not remembered this time.
    }
  }, [key]);
  return null;
}

/**
 * On the bare tab (/compare), goes back to the remembered comparison if there
 * is one; otherwise shows `children` (the empty page). Shows nothing until
 * it has looked, so the empty page doesn't flash first.
 */
export function RestoreComparison({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [looked, setLooked] = useState(false);
  useEffect(() => {
    let slugs: string[] = [];
    try {
      slugs = readRemembered(localStorage.getItem(LAST_KEY));
    } catch {
      // Nothing remembered.
    }
    if (slugs.length > 0) router.replace(compareHref(slugs));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading storage, which only exists here
    else setLooked(true);
  }, [router]);
  return looked ? children : null;
}
