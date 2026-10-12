"use client";

import { useState, type ReactNode } from "react";
import { dietaryLabels } from "@/components/ui/badge";
import { FilterChip } from "@/components/ui/chip";
import { cx } from "@/lib/cx";
import {
  TIMES,
  carbLabel,
  itemLabel,
  labels,
  sourceLabel,
  timeLabel,
  word,
  type Category,
  type Facets,
  type Filters,
  type Option,
} from "@/recipes/library-filter";
import type { DietaryFlag } from "@/types/recipe";

const toggle = <T extends string>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * Every filter section (library design D and E), for the phone sheet and the
 * desktop panel. Each option shows how many recipes it would find; one that
 * would find none is disabled unless it's ticked.
 */
export function FilterSections({
  filters: f,
  facets,
  onChange,
}: {
  filters: Filters;
  facets: Facets;
  onChange: (filters: Filters) => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch });

  function toggleCategory(c: Category) {
    const category = toggle(f.category, c);
    // Unticking Meat or Fish drops its items too.
    const items = category.includes(c) ? f.items : f.items.filter((i) => !i.startsWith(`${c}:`));
    set({ category, items });
  }

  const chips = (options: Option[], selected: string[], onToggle: (value: string) => void, label: (v: string) => string) =>
    options.map((o) => (
      <FilterChip
        key={o.value}
        selected={selected.includes(o.value)}
        count={o.count}
        disabled={o.count === 0 && !selected.includes(o.value)}
        onClick={() => onToggle(o.value)}
      >
        {label(o.value)}
      </FilterChip>
    ));

  return (
    <div className="space-y-6">
      <Section title="Meat, fish or veg">
        <Chips>
          {chips(facets.category, f.category, (c) => toggleCategory(c as Category), (c) => labels.category[c as Category])}
        </Chips>
        {(["meat", "fish"] as const).map((c) =>
          f.category.includes(c) && (c === "meat" ? facets.meatItems : facets.fishItems).length > 0 ? (
            <div key={c} className="mt-3 rounded-card bg-surface-2 p-3">
              <p className="text-sm font-medium mb-2">Type of {c}</p>
              <Chips>
                {chips(
                  c === "meat" ? facets.meatItems : facets.fishItems,
                  f.items.filter((i) => i.startsWith(`${c}:`)).map((i) => i.slice(c.length + 1)),
                  (i) => set({ items: toggle(f.items, `${c}:${i}`) }),
                  itemLabel,
                )}
              </Chips>
            </div>
          ) : null,
        )}
        <Switch
          label="Has a veggie option"
          count={facets.veggieOption}
          checked={f.veggieOption}
          onChange={(veggieOption) => set({ veggieOption })}
        />
      </Section>

      <Section title="Carbs">
        <Chips>{chips(facets.carbs, f.carbs, (c) => set({ carbs: toggle(f.carbs, c) }), carbLabel)}</Chips>
      </Section>

      <Section
        title="Total time"
        hint={
          f.maxMins === null
            ? "Including marinating and resting."
            : `Up to ${timeLabel(f.maxMins, true).replace("min", "minutes").replace("hr", "hour")}, including marinating and resting.`
        }
      >
        <div role="group" aria-label="Total time" className="grid grid-cols-5 rounded-full bg-surface-2 p-1 text-sm font-medium">
          {[null, ...TIMES].map((t) => (
            <button
              key={t ?? "any"}
              type="button"
              aria-pressed={f.maxMins === t}
              onClick={() => set({ maxMins: t })}
              className={cx(
                "h-9 rounded-full focus-visible:outline-2 focus-visible:outline-primary",
                f.maxMins === t ? "bg-surface shadow-sm font-semibold" : "text-ink-muted",
              )}
            >
              {t === null ? "Any" : timeLabel(t)}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Meal">
        <MoreChips shown={4} options={facets.meal} selected={f.meal} more="More…">
          {(options) => chips(options, f.meal, (m) => set({ meal: toggle(f.meal, m) }), word)}
        </MoreChips>
      </Section>

      {facets.cuisine.length > 0 && (
        <Section title="Cuisine" hint="Only cuisines in your library are listed, most common first.">
          <MoreChips shown={4} options={facets.cuisine} selected={f.cuisine} more={`All ${facets.cuisine.length}…`}>
            {(options) => chips(options, f.cuisine, (c) => set({ cuisine: toggle(f.cuisine, c) }), word)}
          </MoreChips>
        </Section>
      )}

      {facets.source.length > 0 && (
        <Section title="Source" hint="Books, magazines and websites by name; family recipes grouped together.">
          <MoreChips shown={3} options={facets.source} selected={f.source} more={`All ${facets.source.length}…`}>
            {(options) => chips(options, f.source, (s) => set({ source: toggle(f.source, s) }), sourceLabel)}
          </MoreChips>
        </Section>
      )}

      <Section title="Suitable for" hint="Strict: the recipe as written. Ticking two means both.">
        <Chips>
          {chips(facets.dietary, f.dietary, (d) => set({ dietary: toggle(f.dietary, d) }), (d) => dietaryLabels[d as DietaryFlag])}
        </Chips>
      </Section>

      <Section title="Cook with" hint="Recipes that need nothing beyond what's ticked.">
        <MoreChips shown={4} options={facets.equipment} selected={f.equipment} more="More…">
          {(options) => chips(options, f.equipment, (e) => set({ equipment: toggle(f.equipment, e) }), word)}
        </MoreChips>
      </Section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
        <Section title="Difficulty">
          <Chips>{chips(facets.difficulty, f.difficulty, (d) => set({ difficulty: toggle(f.difficulty, d) }), word)}</Chips>
        </Section>
        <Section title="Spice">
          <Chips>{chips(facets.spice, f.spice, (s) => set({ spice: toggle(f.spice, s) }), word)}</Chips>
        </Section>
      </div>

      <div className="rounded-card bg-surface border border-line divide-y divide-line">
        <Switch label="Freezable" count={facets.freezable} checked={f.freezable} onChange={(freezable) => set({ freezable })} boxed />
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold mb-2">{title}</h3>
      {children}
      {hint && <p className="mt-2 text-sm text-ink-subtle">{hint}</p>}
    </section>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

/** The most common few, with "More…" to show the rest. Ticked options always show. */
function MoreChips({
  shown,
  options,
  selected,
  more,
  children,
}: {
  shown: number;
  options: Option[];
  selected: string[];
  more: string;
  children: (options: Option[]) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const visible = open ? options : options.filter((o, i) => i < shown || selected.includes(o.value));
  return (
    <Chips>
      {children(visible)}
      {!open && visible.length < options.length && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 px-4 rounded-full font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          {more}
        </button>
      )}
    </Chips>
  );
}

function Switch({
  label,
  count,
  checked,
  onChange,
  boxed = false,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
  boxed?: boolean;
}) {
  return (
    <label className={cx("flex items-center justify-between gap-3 min-h-12 cursor-pointer", boxed ? "px-4" : "mt-3")}>
      <span className="font-medium">
        {label} <span className="font-normal text-ink-subtle tabular-nums">{count}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={count === 0 && !checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative w-12 h-7 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40",
          checked ? "bg-primary" : "bg-line",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 size-6 rounded-full bg-surface shadow-sm transition-[left]",
            checked ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}
