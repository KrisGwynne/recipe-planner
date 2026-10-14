"use client";

import { createContext, startTransition, useContext, useOptimistic, useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { firstName } from "@/lib/format";
import { formatShortDate, today as todayIn } from "@/plans/plan";
import { MAX_NOTES, cookedHistory, cookedSummary } from "@/recipes/household";
import {
  markCookedAction,
  setFavouriteAction,
  setNotesAction,
  setRatingAction,
  unmarkCookedAction,
} from "../actions";

// The household's parts of the recipe page (PP-169, recipe design A and F):
// the heart, the rating and cooking history card, "Our notes" and Cooked
// today. Shared by the whole household. Every change shows at once and is
// saved in the background; the saved values replace it when the page refreshes.

export type HouseholdData = {
  favourite: boolean;
  rating: number | null;
  notes: { text: string; editedBy: string | null; editedAt: Date } | null;
  /** YYYY-MM-DD, most recent first. */
  cooked: string[];
};

type Change =
  | { favourite: boolean }
  | { rating: number | null }
  | { notes: HouseholdData["notes"] }
  | { cooked: string[] };

type Household = {
  data: HouseholdData;
  today: string;
  toggleFavourite: () => void;
  rate: (rating: number | null) => void;
  saveNotes: (text: string) => Promise<boolean>;
  toggleCookedToday: () => void;
};

const HouseholdContext = createContext<Household | null>(null);

function useHousehold(): Household {
  const household = useContext(HouseholdContext);
  if (!household) throw new Error("useHousehold needs a RecipeHousehold");
  return household;
}

export function RecipeHousehold({
  recipeId,
  initial,
  today,
  me,
  children,
}: {
  recipeId: string;
  initial: HouseholdData;
  /** Today in the UK (YYYY-MM-DD), from the server. */
  today: string;
  /** The signed-in user's name, for "Edited by" before the page refreshes. */
  me: string | null;
  children: ReactNode;
}) {
  const toast = useToast();
  const [data, change] = useOptimistic(initial, (current, next: Change) => ({ ...current, ...next }));

  /** Shows the change at once, then saves it; a failed save puts it back with a message. */
  function save(next: Change, action: () => Promise<boolean>, saved?: () => void) {
    startTransition(async () => {
      change(next);
      if (await action()) saved?.();
      else toast("Couldn't save that. Try again.");
    });
  }

  const withoutToday = (cooked: string[]) => cooked.filter((day) => day !== today);

  const household: Household = {
    data,
    today,
    toggleFavourite: () => {
      const favourite = !data.favourite;
      save({ favourite }, () => setFavouriteAction(recipeId, favourite));
    },
    rate: (rating) => save({ rating }, () => setRatingAction(recipeId, rating)),
    saveNotes: (text) =>
      new Promise((resolve) => {
        const trimmed = text.trim();
        const notes = trimmed ? { text: trimmed, editedBy: me, editedAt: new Date() } : null;
        startTransition(async () => {
          change({ notes });
          const done = await setNotesAction(recipeId, trimmed);
          if (!done) toast("Couldn't save the notes. Try again.");
          resolve(done);
        });
      }),
    toggleCookedToday: () => {
      if (data.cooked.includes(today)) {
        save({ cooked: withoutToday(data.cooked) }, () => unmarkCookedAction(recipeId, today), () => toast("Removed today"));
        return;
      }
      save(
        { cooked: [today, ...data.cooked] },
        async () => (await markCookedAction(recipeId)) !== null,
        () =>
          toast("Marked as cooked today", {
            undo: () => save({ cooked: withoutToday(data.cooked) }, () => unmarkCookedAction(recipeId, today)),
          }),
      );
    },
  };

  return <HouseholdContext value={household}>{children}</HouseholdContext>;
}

const iconButton =
  "size-11 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary";

/** The top bar's heart (design A). */
export function FavouriteButton() {
  const { data, toggleFavourite } = useHousehold();
  return (
    <button
      type="button"
      onClick={toggleFavourite}
      aria-pressed={data.favourite}
      aria-label="Favourite"
      className={cx(iconButton, data.favourite && "text-primary")}
    >
      <Icon name="heart" className="size-6" filled={data.favourite} />
    </button>
  );
}

/** Stars to look at: filled up to the rating. */
function Stars({ rating, className }: { rating: number | null; className: string }) {
  return (
    <span className="flex text-primary">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          filled={rating !== null && n <= rating}
          strokeWidth={rating !== null && n <= rating ? 2 : 1.5}
          className={cx(className, (rating === null || n > rating) && "text-ink-subtle")}
        />
      ))}
    </span>
  );
}

function ratingText(rating: number | null): string {
  return rating === null ? "Not rated" : `Rated ${rating} out of 5`;
}

/** The rating and cooking history at the top of the page (design A). Opens the Notes section. */
export function HouseholdSummary() {
  const { data, today } = useHousehold();
  return (
    <a
      href="#notes"
      className="mt-4 rounded-card bg-surface border border-line p-4 flex items-center gap-3 hover:bg-surface-2"
    >
      <Stars rating={data.rating} className="size-5" />
      <span className="sr-only">{ratingText(data.rating)}.</span>
      <span className="text-sm text-ink-muted">{cookedSummary(data.cooked, today)}</span>
    </a>
  );
}

/** "Our notes", "Our rating" and the cooking history, at the top of the Notes section (design F). */
export function OurNotes() {
  const { data, today, rate } = useHousehold();
  const [editing, setEditing] = useState(false);
  return (
    <section aria-labelledby="our-notes-title" className="mb-6">
      <h2 id="our-notes-title" className="text-[17px] font-semibold">
        Our notes
      </h2>
      {editing ? (
        <NotesEditor onDone={() => setEditing(false)} />
      ) : data.notes ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit our notes"
          className="mt-2 w-full text-left rounded-control bg-surface border border-line p-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="flex gap-3">
            <span className="flex-1 text-[17px] leading-[26px] whitespace-pre-line">{data.notes.text}</span>
            <Icon name="pencil" className="size-4 shrink-0 mt-1.5 text-ink-subtle" />
          </span>
          <span className="mt-2 block text-xs text-ink-subtle">
            {editedLine(data.notes, today)}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 w-full min-h-12 rounded-control border border-dashed border-line px-3 flex items-center gap-2 font-medium text-ink-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Icon name="plus" className="size-5" />
          Add a note
        </button>
      )}
      <div className="mt-3 flex items-center justify-between">
        <span id="our-rating" className="text-sm text-ink-muted">
          Our rating
        </span>
        <div role="group" aria-labelledby="our-rating" className="flex -mr-1.5 text-primary">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = data.rating !== null && n <= data.rating;
            return (
              <button
                key={n}
                type="button"
                // Tapping the current rating clears it (Kris, 2026-10-14).
                onClick={() => rate(data.rating === n ? null : n)}
                aria-pressed={data.rating === n}
                aria-label={n === 1 ? "1 star" : `${n} stars`}
                className="size-11 grid place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Icon name="star" filled={on} strokeWidth={on ? 2 : 1.5} className={cx("size-8", !on && "text-ink-subtle")} />
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{cookedHistory(data.cooked, today)}</p>
    </section>
  );
}

/** "Edited by Kris · 2 Oct". */
function editedLine(notes: NonNullable<HouseholdData["notes"]>, today: string): string {
  const when = formatShortDate(todayIn(new Date(notes.editedAt)), today);
  const who = firstName(notes.editedBy);
  return who ? `Edited by ${who} · ${when}` : `Edited ${when}`;
}

function NotesEditor({ onDone }: { onDone: () => void }) {
  const { data, saveNotes } = useHousehold();
  const [text, setText] = useState(data.notes?.text ?? "");
  const [saving, setSaving] = useState(false);
  const unchanged = text.trim() === (data.notes?.text ?? "");

  async function save() {
    setSaving(true);
    const done = await saveNotes(text);
    setSaving(false);
    if (done) onDone();
  }

  return (
    <div className="mt-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_NOTES}
        rows={4}
        autoFocus
        aria-label="Our notes"
        placeholder="Swaps, timings, what to do differently next time…"
        className="w-full p-3 rounded-control bg-surface border border-line text-[17px] leading-[26px] placeholder:text-ink-subtle focus:outline-none focus:border-primary"
      />
      <div className="mt-2 flex items-center gap-3">
        {text.length > MAX_NOTES - 200 && (
          <span className="text-xs text-ink-subtle tabular-nums" aria-live="polite">
            {text.length} / {MAX_NOTES}
          </span>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onDone} className={buttonClasses("ghost", "h-11 px-4")}>
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving || unchanged} className={buttonClasses("primary", "h-11 px-5")}>
          Save
        </button>
      </div>
    </div>
  );
}

/** The action bar's Cooked today (design A and F): once a day, tapped again to take today out. */
export function CookedTodayButton() {
  const { data, today, toggleCookedToday } = useHousehold();
  const cooked = data.cooked.includes(today);
  return (
    <button
      type="button"
      onClick={toggleCookedToday}
      aria-pressed={cooked}
      className={
        cooked
          ? "flex-1 h-12 px-3 rounded-control font-semibold inline-flex items-center justify-center gap-2 bg-veg-soft text-veg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          : buttonClasses("secondary", "flex-1 px-3")
      }
    >
      <Icon name="check" className="size-5" strokeWidth={cooked ? 2.5 : 2} />
      Cooked today
    </button>
  );
}
