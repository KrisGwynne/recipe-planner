"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { Icon, type IconName } from "@/components/icon";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/recipes", label: "Recipes", icon: "book" },
  { href: "/plans", label: "Plans", icon: "calendar" },
  { href: "/import", label: "Import", icon: "plus" },
  { href: "/compare", label: "Compare", icon: "chart" },
  { href: "/household", label: "Household", icon: "users" },
];

/** A tab is active on its own page and on any page below it (/recipes/abc). */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded-control";

/**
 * Five tabs (PP-145). On phones: fixed to the bottom, padded for the home
 * indicator, with Import raised in the middle. From md (768px) up: a side rail
 * with Import at the top and Household at the bottom (PP-147 wider screens).
 */
export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface/95 backdrop-blur",
        "px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] text-[11px] font-medium",
        "md:sticky md:top-0 md:bottom-auto md:h-dvh md:w-20 md:shrink-0 md:flex md:flex-col md:items-center md:gap-2",
        "md:border-t-0 md:border-r md:bg-surface md:backdrop-blur-none md:px-0 md:py-4",
      )}
    >
      {tabs.map((tab) => {
        const active = isActive(pathname, tab.href);
        if (tab.href === "/import") {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cx("flex flex-col items-center -mt-5 md:order-first md:mt-0 md:mb-3", focus)}
            >
              <span
                className={cx(
                  "size-14 rounded-full bg-primary text-on-primary grid place-items-center shadow-lg ring-4 ring-bg",
                  "md:size-12 md:shadow-none md:ring-0",
                )}
              >
                <Icon name="plus" className="size-7 md:size-6" strokeWidth={2.5} />
              </span>
              <span className={cx("mt-0.5 md:sr-only", active ? "text-primary" : "text-ink-muted")}>{tab.label}</span>
            </Link>
          );
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex flex-col items-center gap-0.5 py-1 md:py-2 md:w-full",
              tab.href === "/household" && "md:mt-auto",
              active ? "text-primary" : "text-ink-muted hover:text-ink",
              focus,
            )}
          >
            <Icon name={tab.icon} className="size-6" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
