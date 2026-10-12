import type { ReactNode } from "react";
import type { BrowsingCategory } from "@/recipes/derive";
import type { DietaryFlag } from "@/types/recipe";
import { cx } from "@/lib/cx";
import { Icon } from "@/components/icon";

// Badges are never tappable; filters use chips instead (PP-145).
const pill = "inline-flex items-center h-7 px-2.5 rounded-full text-sm";

/** Plain: carbs and other facts. Muted: "No carbs". Outlined: "+ veggie option". */
export function Badge({
  variant = "plain",
  children,
}: {
  variant?: "plain" | "muted" | "outlined";
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        pill,
        "font-medium bg-surface-2",
        variant === "plain" && "text-ink",
        variant === "muted" && "text-ink-muted",
        variant === "outlined" && "text-ink-muted border border-line",
      )}
    >
      {children}
    </span>
  );
}

/** The browsing category: meat / fish / veg (protein_type) or vegan (dietary). */
export type Category = "meat" | "fish" | "meat-and-fish" | "veg" | "vegan";

/** The badge for a recipe's browsingCategory (src/recipes/derive.ts). */
export function categoryOf(category: BrowsingCategory): Category {
  return category === "vegetarian" ? "veg" : category;
}

export const categoryLabels: Record<Category, string> = {
  meat: "Meat",
  fish: "Fish",
  // Meat colours until the library settles how it shows (PP-166).
  "meat-and-fish": "Meat & fish",
  veg: "Veg",
  vegan: "Vegan",
};

// Written out in full so Tailwind finds the class names.
const categoryClasses: Record<Category, { badge: string; dot: string }> = {
  meat: { badge: "bg-meat-soft text-meat", dot: "bg-meat" },
  fish: { badge: "bg-fish-soft text-fish", dot: "bg-fish" },
  "meat-and-fish": { badge: "bg-meat-soft text-meat", dot: "bg-meat" },
  veg: { badge: "bg-veg-soft text-veg", dot: "bg-veg" },
  vegan: { badge: "bg-vegan-soft text-vegan", dot: "bg-vegan" },
};

/** Category accent for a bar or dot, e.g. the list row's left edge. */
export function categoryDotClass(category: Category): string {
  return categoryClasses[category].dot;
}

/** "Fish", or "Fish · Tuna" with a detail. */
export function CategoryBadge({ category, detail }: { category: Category; detail?: string }) {
  const { badge, dot } = categoryClasses[category];
  return (
    <span className={cx(pill, "gap-1.5 font-semibold", badge)}>
      <span className={cx("size-2 rounded-full", dot)} aria-hidden="true" />
      {categoryLabels[category]}
      {detail && ` · ${detail}`}
    </span>
  );
}

/** Printed nutrition gets a tick; estimated a dashed outline and ~ (never colour alone). */
export function NutritionBadge({ source }: { source: "printed" | "estimated" }) {
  if (source === "printed") {
    return (
      <span className={cx(pill, "gap-1 font-medium bg-surface-2 text-ink")}>
        <Icon name="check" className="size-4" strokeWidth={2.5} />
        Printed
      </span>
    );
  }
  return (
    <span className={cx(pill, "font-medium border border-dashed border-ink-subtle text-ink-muted")}>~ Estimated</span>
  );
}

export const dietaryLabels: Record<DietaryFlag, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  "nut-free": "Nut-free",
};

/** Strict dietary suitability: a tick and an outline, a promise about every ingredient. */
export function DietaryBadge({ flag }: { flag: DietaryFlag }) {
  return (
    <span
      className={cx(
        pill,
        "gap-1 border",
        flag === "vegetarian" ? "border-veg text-veg font-semibold" : "border-line text-ink font-medium",
      )}
    >
      <Icon name="check" className="size-4" strokeWidth={2.5} />
      {dietaryLabels[flag]}
    </span>
  );
}
