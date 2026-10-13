"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { categoryDotClasses, categoryLabels, categoryOf } from "@/components/ui/badge";
import type { PlanEntry } from "@/data";
import { cx } from "@/lib/cx";
import { SLOTS, formatDay, formatPortions, planDay, slotLabels, type Slot } from "@/plans/plan";
import { browsingCategory } from "@/recipes/derive";
import type { DietaryFlag } from "@/types/recipe";
import { EntrySheet } from "./entry-sheet";

export type BoardPlan = { id: string; name: string; startDate: string; days: number; people: number };

const focus = "focus-visible:outline-2 focus-visible:outline-primary";

/** The recipe picker for a day and meal (design E), filtered to that meal to start with. */
export function addHref(planId: string, dayIndex: number, slot: Slot): string {
  return `/plans/${planId}/add?day=${dayIndex}&slot=${slot}&meal=${slot}`;
}

/**
 * Filling a plan (designs/src/meal-plans.html D, F, G and I). On phones, a
 * card per day under a sticky day strip; from md up, the grid of days across
 * and meals down. Both open the same entry sheet. Totals and leftovers come
 * with PP-172.
 */
export function PlanBoard({ plan, entries, today }: { plan: BoardPlan; entries: PlanEntry[]; today: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = entries.find((e) => e.id === openId);
  const days = Array.from({ length: plan.days }, (_, dayIndex) => ({
    dayIndex,
    date: planDay(plan, dayIndex),
    entries: entries.filter((e) => e.dayIndex === dayIndex),
  }));

  return (
    <>
      <div className="md:hidden">
        <DayStrip plan={plan} days={days} today={today} />
        <ol className="mt-3 px-5 space-y-3">
          {days.map((day) => (
            <DayCard key={day.date} plan={plan} day={day} today={today} onOpen={setOpenId} />
          ))}
        </ol>
      </div>
      <div className="hidden md:block">
        <PlanGridView plan={plan} days={days} today={today} onOpen={setOpenId} />
      </div>
      {open && <EntrySheet plan={plan} entry={open} entries={entries} onClose={() => setOpenId(null)} />}
    </>
  );
}

type Day = { dayIndex: number; date: string; entries: PlanEntry[] };

/**
 * The days to jump between (design D), stuck under the header. The day being
 * read is solid ink; today, when it isn't, has a tomato ring (design I).
 */
function DayStrip({ plan, days, today }: { plan: BoardPlan; days: Day[]; today: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const dayCount = days.length;
  const todayIndex = days.findIndex((day) => day.date === today);

  useEffect(() => {
    function onScroll() {
      const line = (strip.current?.getBoundingClientRect().bottom ?? 0) + 16;
      let index = 0;
      for (let i = 0; i < dayCount; i++) {
        const card = document.getElementById(`day-${i}`);
        if (card && card.getBoundingClientRect().top <= line) index = i;
      }
      setCurrent(index);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dayCount]);

  // Open on today (or the first day, for a plan that hasn't started), unless a day is in the URL.
  useEffect(() => {
    if (!window.location.hash && todayIndex > 0) {
      document.getElementById(`day-${todayIndex}`)?.scrollIntoView({ block: "start" });
    }
  }, [todayIndex]);

  return (
    <div ref={strip} className="sticky top-0 z-20 bg-bg mt-3 px-4 pb-2 border-b border-line">
      <ol
        aria-label={`Days of ${plan.name}`}
        className="grid grid-flow-col auto-cols-[calc((100%-1.5rem)/7)] gap-1 overflow-x-auto pt-1"
      >
        {days.map((day) => {
          const [weekday, date] = formatDay(day.date).split(" ");
          const active = current === day.dayIndex;
          return (
            <li key={day.date}>
              <a
                href={`#day-${day.dayIndex}`}
                aria-current={active ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`day-${day.dayIndex}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  window.history.replaceState(null, "", `#day-${day.dayIndex}`);
                }}
                className={cx(
                  "h-12 rounded-control flex flex-col items-center justify-center",
                  focus,
                  active ? "bg-ink text-bg" : day.entries.length === 0 && "text-ink-subtle",
                  !active && day.date === today && "ring-2 ring-primary ring-inset",
                )}
              >
                <span className={cx("text-[11px] font-medium", !active && day.entries.length > 0 && "text-ink-muted")}>
                  {weekday}
                </span>
                <span className="font-semibold tabular-nums leading-none">{date}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * A day on a phone (design D and I): its meals in order, then a "+" for each
 * meal, so a second recipe (a side) can join a planned meal. An empty day
 * says "Nothing planned" and shows the "+" buttons when tapped.
 */
function DayCard({
  plan,
  day,
  today,
  onOpen,
}: {
  plan: BoardPlan;
  day: Day;
  today: string;
  onOpen: (entryId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const empty = day.entries.length === 0;
  const heading = (
    <>
      <h2 className="font-semibold">{formatDay(day.date)}</h2>
      {day.date === today && (
        <span className="h-5 px-1.5 rounded-full bg-primary-soft text-primary text-xs font-semibold inline-flex items-center">
          Today
        </span>
      )}
    </>
  );

  return (
    <li
      id={`day-${day.dayIndex}`}
      className={cx(
        "scroll-mt-20 rounded-card px-4 pt-3 pb-3",
        empty ? "border border-dashed border-line" : "bg-surface border border-line",
      )}
    >
      {empty && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className={cx("w-full flex items-baseline gap-2 text-left rounded-control", focus)}
        >
          {heading}
          <span className="ml-auto text-sm text-ink-subtle">Nothing planned</span>
        </button>
      ) : (
        <div className="flex items-baseline gap-2">{heading}</div>
      )}
      {SLOTS.map((slot) => {
        const inSlot = day.entries.filter((e) => e.slot === slot);
        if (inSlot.length === 0) return null;
        return (
          <section key={slot} aria-label={slotLabels[slot]}>
            <h3 className="mt-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">{slotLabels[slot]}</h3>
            <ul>
              {inSlot.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(entry.id)}
                    className={cx("mt-1 w-full flex items-center gap-3 min-h-12 text-left rounded-control", focus)}
                  >
                    <CategoryBar entry={entry} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold leading-snug">{entry.recipe.name}</span>
                      <span className="sr-only">{categoryLabels[categoryOfEntry(entry)]}</span>
                      <span className="block text-sm text-ink-muted tabular-nums">
                        {formatPortions(entry.portionsPerPerson)} each
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {(!empty || expanded) && (
        // All four fit one row on a phone; the icon goes on the narrowest.
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {SLOTS.map((slot) => (
            <Link
              key={slot}
              href={addHref(plan.id, day.dayIndex, slot)}
              aria-label={`Add ${slot}, ${formatDay(day.date)}`}
              className={cx(
                "h-11 min-w-0 px-1 rounded-full border border-dashed border-line text-[13px] font-medium text-ink-muted",
                "inline-flex items-center justify-center gap-0.5 hover:border-primary hover:text-primary",
                focus,
              )}
            >
              <Icon name="plus" className="size-3.5 shrink-0 max-[379px]:hidden" />
              {slotLabels[slot]}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

function categoryOfEntry(entry: PlanEntry) {
  return categoryOf(browsingCategory(entry.recipe.proteinType, entry.recipe.dietary as DietaryFlag[]));
}

/** The category colour down a recipe's left edge: one colour, or meat above fish. */
function CategoryBar({ entry }: { entry: PlanEntry }) {
  return (
    <span className="w-1 self-stretch flex flex-col rounded-full overflow-hidden" aria-hidden="true">
      {categoryDotClasses(categoryOfEntry(entry)).map((dot) => (
        <span key={dot} className={cx("flex-1", dot)} />
      ))}
    </span>
  );
}

/**
 * From md up (design, wider screens): days across, meals down. An empty cell
 * is a "+" that turns tomato on hover; a filled one keeps a small "+" for a
 * second recipe. A 14-day plan scrolls sideways a week at a time. The totals
 * row comes with PP-172.
 */
function PlanGridView({
  plan,
  days,
  today,
  onOpen,
}: {
  plan: BoardPlan;
  days: Day[];
  today: string;
  onOpen: (entryId: string) => void;
}) {
  return (
    <div className="mt-5 px-6 pb-6 overflow-x-auto snap-x snap-mandatory">
      <table
        className="w-full table-fixed border-separate border-spacing-1.5 text-sm"
        // Past a week, each day keeps a readable width and the grid scrolls.
        style={days.length > 7 ? { minWidth: `${5.5 + days.length * 8}rem` } : undefined}
      >
        <thead>
          <tr>
            <th className="w-[5.5rem]" />
            {days.map((day) => (
              <th
                key={day.date}
                scope="col"
                className={cx("px-1 pb-1 text-left font-semibold snap-start", day.entries.length === 0 && "text-ink-subtle")}
              >
                {formatDay(day.date).split(" ").slice(0, 2).join(" ")}
                {day.date === today && (
                  <span className="ml-1 h-5 px-1.5 rounded-full bg-primary-soft text-primary text-xs inline-flex items-center">
                    Today
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot) => (
            <tr key={slot}>
              <th
                scope="row"
                className="align-top pt-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
              >
                {slotLabels[slot]}
              </th>
              {days.map((day) => {
                const inCell = day.entries.filter((e) => e.slot === slot);
                const label = `Add ${slot}, ${formatDay(day.date)}`;
                return (
                  <td key={day.date} className="align-top p-0">
                    {inCell.length === 0 ? (
                      <Link
                        href={addHref(plan.id, day.dayIndex, slot)}
                        aria-label={label}
                        className={cx(
                          "group rounded-lg border border-dashed border-line grid place-items-center text-transparent",
                          "hover:border-2 hover:border-primary hover:text-primary focus-visible:text-primary",
                          slot === "snack" ? "h-14" : "h-20",
                          focus,
                        )}
                      >
                        <Icon name="plus" className="size-5" />
                      </Link>
                    ) : (
                      <div className="space-y-1.5">
                        {inCell.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => onOpen(entry.id)}
                            className={cx(
                              "w-full flex gap-2 rounded-lg bg-surface border border-line p-2 text-left hover:bg-surface-2",
                              focus,
                            )}
                          >
                            <CategoryBar entry={entry} />
                            <span className="flex-1 min-w-0">
                              <span className="block font-semibold leading-tight line-clamp-3">{entry.recipe.name}</span>
                              <span className="sr-only">{categoryLabels[categoryOfEntry(entry)]}</span>
                              <span className="block text-xs text-ink-muted mt-1 tabular-nums">
                                {formatPortions(entry.portionsPerPerson)} each
                              </span>
                            </span>
                          </button>
                        ))}
                        <Link
                          href={addHref(plan.id, day.dayIndex, slot)}
                          aria-label={label}
                          className={cx(
                            "h-8 rounded-lg border border-dashed border-line grid place-items-center text-ink-subtle",
                            "hover:border-primary hover:text-primary",
                            focus,
                          )}
                        >
                          <Icon name="plus" className="size-4" />
                        </Link>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
