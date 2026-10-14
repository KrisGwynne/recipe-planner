import { categoryOf, type Category } from "@/components/ui/badge";
import type { PlanEntry } from "@/data";
import { browsingCategory } from "@/recipes/derive";
import type { DietaryFlag } from "@/types/recipe";
import type { Slot } from "./plan";

/**
 * What the day-and-meal grid (meal plans design G) needs of a plan: its days
 * and a category dot for each recipe already planned.
 */
export type PlanGrid = {
  id: string;
  name: string;
  startDate: string;
  days: number;
  people: number;
  cells: { entryId: string; dayIndex: number; slot: Slot; category: Category }[];
};

type PlanWithEntries = Omit<PlanGrid, "cells"> & {
  entries: Pick<PlanEntry, "id" | "dayIndex" | "slot" | "recipe">[];
};

export function toPlanGrid(plan: PlanWithEntries): PlanGrid {
  return {
    id: plan.id,
    name: plan.name,
    startDate: plan.startDate,
    days: plan.days,
    people: plan.people,
    cells: plan.entries.map((entry) => ({
      entryId: entry.id,
      dayIndex: entry.dayIndex,
      slot: entry.slot,
      category: categoryOf(browsingCategory(entry.recipe.proteinType, entry.recipe.dietary as DietaryFlag[])),
    })),
  };
}
