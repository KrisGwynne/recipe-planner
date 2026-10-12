// Checks an imported recipe file against schema/recipe.schema.json (PP-161)
// and explains every problem in plain English, in the shape the import
// design shows (designs/src/import.html, screens E and I). The file is never
// fixed up: no coercion, defaults or removing fields.
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../../schema/recipe.schema.json";
import type { Recipe } from "@/types/recipe";

/** One thing to fix. `path` is where it is, for Claude: "ingredients[3].unit" ("" for the whole file). */
export type Problem = { title: string; detail: string; path: string };

export type ValidationResult =
  | { ok: true; recipe: Recipe }
  /** The file is a recipe with things to fix. */
  | { ok: false; problems: Problem[] }
  /** The file isn't a recipe this app can read at all: one message. */
  | { ok: false; fileProblem: Problem };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile<Recipe>(schema);

// The proteins and carbs oneOfs give unreadable errors, so each is checked
// against the option it was meant to be, and explained from there.
type Branch = { properties: { category: { const: string }; item: { enum: string[] } } };
const proteinBranches = schema.properties.proteins.items.oneOf as Branch[];
const proteinValidators = new Map<string, ValidateFunction>(
  proteinBranches.map((branch) => [branch.properties.category.const, ajv.compile(branch)]),
);
const itemsByCategory = new Map(proteinBranches.map((b) => [b.properties.category.const, b.properties.item.enum]));
const carbsValidator = ajv.compile(schema.properties.carbs.oneOf[1]);

/** Reads a file's text as JSON, then validates it. */
export function parseRecipe(text: string): ValidationResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return {
      ok: false,
      fileProblem: {
        title: "This file isn't valid JSON",
        detail: "It may have been cut off or changed by hand. Ask Claude for the whole file again.",
        path: "",
      },
    };
  }
  return validateRecipe(value);
}

export function validateRecipe(value: unknown): ValidationResult {
  if (!isObject(value)) {
    return {
      ok: false,
      fileProblem: {
        title: "This isn't a recipe file",
        detail: 'A recipe file is one JSON object with fields such as "id", "name" and "ingredients".',
        path: "",
      },
    };
  }
  const version = value.schema_version;
  if (typeof version === "number" && version > 1) {
    return {
      ok: false,
      fileProblem: {
        title: "Made for a newer version of the app",
        detail: `This file says schema_version: ${version}; this app reads version 1. Check your Claude project is using the current schema.`,
        path: "schema_version",
      },
    };
  }
  if (validateSchema(value)) return { ok: true, recipe: value };
  return { ok: false, problems: explain(validateSchema.errors ?? [], value) };
}

/** The "Copy problems for Claude" message: every problem, ready to paste into the Claude project. */
export function problemsForClaude(fileName: string, problems: Problem[]): string {
  const lines = problems.map((p, i) => `${i + 1}. ${p.title}${p.path ? ` (${p.path})` : ""}: ${p.detail}`);
  return [
    `The recipe file "${fileName}" didn't import into Recipe planner. Please fix these problems, keeping to the schema, and give me the whole file again:`,
    "",
    ...lines,
  ].join("\n");
}

// --- Explaining Ajv's errors ---

type Segments = (string | number)[];

function explain(errors: ErrorObject[], data: Record<string, unknown>): Problem[] {
  const problems: Problem[] = [];
  for (const error of errors) {
    // Errors from inside a oneOf's options are replaced by the oneOf's own explanation.
    if (error.schemaPath.includes("/oneOf/")) continue;
    const segments = toSegments(error.instancePath);
    if (error.keyword === "oneOf") {
      const value = get(data, segments);
      if (segments[0] === "carbs") problems.push(...carbsProblems(value, data));
      else problems.push(...proteinProblems(value, segments, data));
    } else {
      problems.push(problem(error, segments, data));
    }
  }
  // Ajv can report the same thing twice (a $ref reached two ways); keep one.
  const seen = new Set<string>();
  return problems.filter((p) => {
    const key = `${p.path}|${p.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function proteinProblems(value: unknown, at: Segments, data: Record<string, unknown>): Problem[] {
  const where = describe(at, data);
  if (!isObject(value)) {
    return [
      {
        title: `${where} isn't a protein`,
        detail: `Each protein is an object with a "category" and an "item", e.g. {"category": "fish", "item": "tuna"}.`,
        path: toPath(at),
      },
    ];
  }
  const { category, item } = value;
  const categories = [...itemsByCategory.keys()];
  if (category === undefined) {
    return [{ title: 'Missing "category"', detail: `${where} needs "category": ${list(categories)}.`, path: toPath([...at, "category"]) }];
  }
  if (typeof category !== "string" || !itemsByCategory.has(category)) {
    return [
      {
        title: `Unknown protein category ${show(category)}`,
        detail: `${where} uses a category the app doesn't know. Allowed: ${list(categories)}.`,
        path: toPath([...at, "category"]),
      },
    ];
  }
  if (typeof item === "string" && !itemsByCategory.get(category)!.includes(item)) {
    const actual = categories.find((c) => itemsByCategory.get(c)!.includes(item));
    if (actual) {
      return [
        {
          title: `${capitalise(item)} is listed as ${category}`,
          detail: `"${item}" is a ${actual} item, so its category must be "${actual}".`,
          path: toPath(at),
        },
      ];
    }
  }
  const validate = proteinValidators.get(category)!;
  validate(value);
  return (validate.errors ?? []).map((e) => problem(e, [...at, ...toSegments(e.instancePath)], data));
}

function carbsProblems(value: unknown, data: Record<string, unknown>): Problem[] {
  const at = ["carbs"];
  if (Array.isArray(value) && value.includes("none") && value.length > 1) {
    return [
      {
        title: '"none" is mixed with other carbs',
        detail: '"carbs" is either ["none"] or a list of carbs, not both. Remove "none" or the others.',
        path: "carbs",
      },
    ];
  }
  if (Array.isArray(value) && value.length === 0) {
    return [{ title: '"carbs" is empty', detail: 'List the main carbs, or ["none"] if there aren\'t any.', path: "carbs" }];
  }
  carbsValidator(value);
  return (carbsValidator.errors ?? []).map((e) => problem(e, [...at, ...toSegments(e.instancePath)], data));
}

/** One Ajv error as a problem. `at` is where the error is (the value with the problem). */
function problem(error: ErrorObject, at: Segments, data: Record<string, unknown>): Problem {
  const value = get(data, at);
  const params = error.params as Record<string, unknown>;
  const field = fieldName(at);
  const owner = describe(ownerOf(at), data);

  switch (error.keyword) {
    case "required": {
      const missing = String(params.missingProperty);
      return { title: `Missing "${missing}"`, detail: `${describe(at, data)} needs "${missing}".`, path: toPath([...at, missing]) };
    }
    case "additionalProperties": {
      const extra = String(params.additionalProperty);
      return {
        title: `Unexpected field "${extra}"`,
        detail: `${describe(at, data)} has "${extra}", which isn't in the schema. Remove it, or check the spelling.`,
        path: toPath([...at, extra]),
      };
    }
    case "enum": {
      const allowed = (params.allowedValues as unknown[]).filter((v) => v !== null).map(String);
      const orNone = (params.allowedValues as unknown[]).includes(null) ? ", or none" : "";
      const noun = nounFor(at, data);
      return {
        title: `Unknown ${noun} ${show(value)}`,
        detail: `${owner} uses a ${noun} the app doesn't know. Allowed: ${allowed.join(", ")}${orNone}.`,
        path: toPath(at),
      };
    }
    case "const":
      return {
        title: `"${field}" must be ${show(params.allowedValue)}`,
        detail: `${owner} has ${show(value)} for "${field}".`,
        path: toPath(at),
      };
    case "type":
      return {
        title: `"${field}" should be ${typeName(params.type)}`,
        detail: `${owner} has ${show(value)} for "${field}".`,
        path: toPath(at),
      };
    case "minimum":
      return {
        title: params.limit === 0 ? `"${field}" can't be negative` : `"${field}" must be at least ${params.limit}`,
        detail: `${owner} has ${show(value)} for "${field}".`,
        path: toPath(at),
      };
    case "exclusiveMinimum":
      return {
        title: `"${field}" must be more than ${params.limit}`,
        detail: `${owner} has ${show(value)} for "${field}". Leave it out if there isn't one.`,
        path: toPath(at),
      };
    case "minLength":
      return { title: `"${field}" is empty`, detail: `${owner} needs some text for "${field}".`, path: toPath(at) };
    case "minItems":
      return {
        title: `"${field}" is empty`,
        detail: `${owner} needs at least ${params.limit === 1 ? "one entry" : `${params.limit} entries`} in "${field}".`,
        path: toPath(at),
      };
    case "uniqueItems": {
      const repeated = Array.isArray(value) ? value[params.j as number] : undefined;
      return {
        title: `${show(repeated)} is listed twice`,
        detail: `Each entry in "${field}" should appear once.`,
        path: toPath(at),
      };
    }
    case "pattern": {
      const what = at[0] === "tags" ? "tag" : "id";
      return {
        title: `${show(value)} isn't a valid ${what}`,
        detail:
          what === "id"
            ? 'The id is lowercase letters and numbers joined by single hyphens, e.g. "lemony-tuna-pasta". The app uses it to match the recipe when it\'s imported again.'
            : 'Tags are lowercase letters and numbers joined by single hyphens, e.g. "one-pot".',
        path: toPath(at),
      };
    }
    case "format":
      return {
        title: `"${field}" isn't a web address`,
        detail: `${owner} has ${show(value)}. Use a full address starting with https://, or leave it out.`,
        path: toPath(at),
      };
    default:
      return { title: `"${field}" isn't valid`, detail: `${owner}: ${error.message ?? "doesn't match the schema"}.`, path: toPath(at) };
  }
}

// --- Describing where a problem is ---

const sectionNames: Record<string, string> = {
  nutrition_per_serving: "Nutrition",
  times: "Times",
  source: "Source",
  storage: "Storage",
};

/** "The recipe", "Ingredient 4 (olive oil)", "Variation 1 (Veggie), protein 1", "Nutrition"... */
function describe(at: Segments, data: Record<string, unknown>): string {
  if (at.length === 0) return "The recipe";
  const parts: string[] = [];
  for (let i = 0; i < at.length; i++) {
    const key = at[i];
    const next = at[i + 1];
    if (typeof next === "number") {
      const item = get(data, at.slice(0, i + 2));
      parts.push(listEntry(String(key), next, item, parts.length > 0));
      i++;
    } else if (typeof key === "string" && sectionNames[key] && parts.length === 0) {
      parts.push(sectionNames[key]);
    } else if (typeof key === "string") {
      parts.push(`"${key}"`);
    }
  }
  return parts.join(", ");
}

function listEntry(list: string, index: number, item: unknown, nested: boolean): string {
  const labels: Record<string, [string, string | null]> = {
    ingredients: ["Ingredient", "item"],
    method: ["Step", null],
    proteins: ["Protein", "item"],
    variations: ["Variation", "name"],
  };
  const [label, nameKey] = labels[list] ?? [`"${list}" entry`, null];
  const name = nameKey && isObject(item) && typeof item[nameKey] === "string" && item[nameKey] ? ` (${item[nameKey]})` : "";
  const text = `${label} ${index + 1}${name}`;
  return nested ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** The object a field belongs to: drop the field, and the index if it's a list entry. */
function ownerOf(at: Segments): Segments {
  const owner = at.slice(0, -1);
  return typeof at[at.length - 1] === "number" ? owner.slice(0, -1) : owner;
}

/** The field's name: for a list entry (meal_type[0]), the list's. */
function fieldName(at: Segments): string {
  for (let i = at.length - 1; i >= 0; i--) if (typeof at[i] === "string") return at[i] as string;
  return "recipe";
}

function nounFor(at: Segments, data: Record<string, unknown>): string {
  const field = fieldName(at);
  if (field === "item" && at.includes("proteins")) {
    const protein = get(data, at.slice(0, -1));
    return isObject(protein) ? `${protein.category} item` : "protein item";
  }
  if (field === "kind") return "source kind";
  if (field === "source") return "nutrition source";
  if (field === "carbs") return "carb";
  if (field === "dietary") return "dietary flag";
  if (field === "meal_type") return "meal type";
  return field.replaceAll("_", " ");
}

function typeName(type: unknown): string {
  const names: Record<string, string> = {
    integer: "a whole number",
    number: "a number",
    string: "text",
    array: "a list",
    object: "an object",
    boolean: "true or false",
    null: "null",
  };
  const types = String(type).split(",");
  if (types.length === 2 && types.includes("boolean") && types.includes("null")) return "true, false or null";
  return types.map((t) => names[t] ?? t).join(" or ");
}

// --- Small helpers ---

function toSegments(pointer: string): Segments {
  if (!pointer) return [];
  return pointer
    .slice(1)
    .split("/")
    .map((s) => s.replaceAll("~1", "/").replaceAll("~0", "~"))
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

/** ["ingredients", 3, "unit"] -> "ingredients[3].unit". */
function toPath(at: Segments): string {
  return at.reduce<string>((path, s) => (typeof s === "number" ? `${path}[${s}]` : path ? `${path}.${s}` : s), "");
}

function get(data: unknown, at: Segments): unknown {
  let value = data;
  for (const s of at) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string | number, unknown>)[s];
  }
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function show(value: unknown): string {
  if (value === undefined) return "nothing";
  const text = JSON.stringify(value);
  return text.length > 40 ? `${text.slice(0, 37)}…` : text;
}

function list(values: string[]): string {
  return values.map((v) => `"${v}"`).join(", ");
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
