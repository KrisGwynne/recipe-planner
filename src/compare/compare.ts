// Comparing recipes (PP-173, designs/src/compare.html). The chosen recipes
// live in the address as repeated `r` slugs, in the order chosen, so Back and
// shared links work; the last comparison is also remembered on the device.

export const MIN_RECIPES = 2;
export const MAX_RECIPES = 4;

/** The localStorage key for the last comparison on this device. */
export const LAST_KEY = "recipe-planner:compare";

type Params = { getAll(name: string): string[] };

/** The chosen slugs from the address: in order, without repeats, at most four. */
export function parseChosen(params: Params): string[] {
  const slugs = params.getAll("r").filter((s) => s.length > 0 && s.length <= 200);
  return [...new Set(slugs)].slice(0, MAX_RECIPES);
}

/** Reads `searchParams` as a page gets it. */
export function paramsOf(query: Record<string, string | string[] | undefined>): Params {
  return {
    getAll: (name) => {
      const value = query[name];
      return value === undefined ? [] : Array.isArray(value) ? value : [value];
    },
  };
}

function query(slugs: string[]): string {
  const params = new URLSearchParams();
  for (const slug of slugs) params.append("r", slug);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * "/compare?r=a&r=b". With none it's "/compare?r=": an empty comparison the
 * person chose, which plain "/compare" (the tab) would replace with the
 * remembered one.
 */
export function compareHref(slugs: string[]): string {
  return slugs.length > 0 ? `/compare${query(slugs)}` : "/compare?r=";
}

/** Whether the address says what to compare (even nothing), rather than leaving it to the device. */
export function choseInAddress(params: Params): boolean {
  return params.getAll("r").length > 0;
}

/** The picker, starting with these ticked. */
export function chooseHref(slugs: string[]): string {
  return `/compare/choose${query(slugs)}`;
}

/** The slugs of a remembered comparison, or none if it's missing or not what was saved. */
export function readRemembered(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parseChosen({ getAll: () => parsed.filter((s): s is string => typeof s === "string") });
  } catch {
    return [];
  }
}

/**
 * Each bar's length as a percentage of its row, scaled to the largest value
 * in its chart, which reaches 78% so its value fits after it (design C).
 * Every chart starts at zero.
 */
export function barWidths(values: number[]): number[] {
  const top = Math.max(0, ...values);
  return values.map((v) => (top > 0 ? Math.round((Math.max(0, v) / top) * 780) / 10 : 0));
}
