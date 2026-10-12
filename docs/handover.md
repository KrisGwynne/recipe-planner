# Recipe & Meal Planner — Handover for Claude Code

> The original handover, kept as the product spec. Appendix A and B are in `schema/` and `examples/` rather than repeated here. Decisions made since (answers to the open questions, stack choices) are in [`decisions.md`](decisions.md) and take precedence where they differ.

## 1. Purpose

A web app where households keep their recipe collection, plan meals, and look at nutrition. It starts with Kris and his wife but is publicly available: anyone can sign in with Google, create a household and invite others to it. Recipes, meal plans and everything else belong to a household.

It's a standalone app, not part of any other project.

Today Kris's recipes live as files inside a Claude.ai project. This app replaces that as the place recipes are browsed and used. Claude.ai stays as the tool that turns a photo of a printed recipe into structured data. Photos are never uploaded to the app; only the JSON is.

### How recipes get into the app

1. Take a photo of a recipe (magazine, cookbook, etc.).
2. Upload it to a Claude.ai project, which produces a JSON file that follows `recipe.schema.json` (Appendix A).
3. Upload or paste that JSON into this app.
4. The app validates it and creates or updates a recipe record.

### The core rule: the app does nothing smart

All interpretation happens in Claude before import: reading the photo, classifying carbs and proteins, estimating nutrition, choosing enums. The app must:

- **Never guess or infer** recipe data. If a file is invalid, reject it with clear errors. Don't fix it up.
- **Only compute deterministic things**: totals, sums, scaling, derived categories with fixed rules (section 5).
- Treat the JSON as the source of truth for recipe facts.

## 2. Users, accounts and households

### Sign-in
- **Google sign-in via OIDC** is the only login method. Follow the same auth model as Kris's existing holiday planner app (also on Vercel); if that repo is available, reuse its approach and conventions.
- First sign-in creates a user account (Google `sub` as the stable identity, plus email, name, avatar).

### Households
- Every recipe, meal plan and piece of household data belongs to exactly one **household**.
- After first sign-in, a user with no household is asked to create one (just a name). They become its **owner**.
- Owners invite others with a **shareable invite link** (random token, expires after 7 days, single use, revocable). Sending invite emails isn't needed in v1.
- Accepting an invite requires signing in with Google, then joins the user as a **member**.
- Roles: `owner` (manage members and invites, rename or delete the household) and `member` (everything else: import, edit, plan). There must always be at least one owner.
- Members can leave; owners can remove members. The last owner can't leave without handing over ownership or deleting the household.
- Model membership as many-to-many so a user *could* belong to several households later, but v1 only needs one active household per user (see Open questions).

### Usage
- Used a lot on phones (in the kitchen, at the supermarket), so **mobile-first**. Desktop is a nice-to-have, not the target.
- Expect tens to low hundreds of recipes per household.

## 3. Suggested stack

Kris is a developer who works with Next.js and Vercel. Suggested, but confirm before building:

- Next.js (App Router) + TypeScript, deployed on Vercel
- Postgres (e.g. Neon / Vercel Postgres) with a typed query layer (Drizzle or Prisma)
- Ajv (draft 2020-12) for validating imports against `recipe.schema.json`
- A charting library for comparisons and stats (e.g. Recharts)
- Google OIDC sign-in, matching the holiday planner app (e.g. Auth.js with the Google provider and a database session/adapter)

## 4. Data model

### Accounts and households

- `users`: id, google_sub (unique), email, name, avatar_url, created_at
- `households`: id, name, created_at
- `household_members`: household_id, user_id, role (`owner | member`), joined_at. Unique on (household_id, user_id).
- `household_invites`: id, household_id, token (store a hash), created_by, expires_at, used_at, used_by, revoked_at
- Plus whatever session/account tables the auth library needs.

### Recipes

Each recipe row has its own surrogate primary key and a `household_id`. The JSON `id` (slug) is unique **within a household** (unique on household_id + slug), so two households can each import the same file.

Store **both** the raw JSON and extracted columns:

- `data jsonb`: the full imported document, untouched.
- Extracted, indexed columns for filtering and sorting: `slug`, `schema_version`, `name`, `cuisine`, `difficulty`, `serves`, `total_mins`, `carbs text[]`, `protein_type`, `protein_items text[]`, `meal_type text[]`, `dietary text[]`, `spice_level`, `has_veggie_option`, the eight nutrition numbers, `nutrition_source`, `created_by`, `created_at`, `updated_by`, `updated_at`.

Extracted columns must always be rebuilt from `data` on import, so a backfill or schema change is just "re-derive from jsonb".

No photos or other files are stored.

### Household recipe data (NOT in the JSON)

Kept in separate tables keyed by recipe row id, so re-importing a recipe never wipes it:

- favourite, rating, notes, times cooked / last cooked

### Meal plans

- `meal_plans`: id, household_id, name, start_date, number of days (default 7), `people` (default 2)
- `meal_plan_entries`: plan_id, day index, slot (`breakfast | lunch | dinner | snack`), recipe_id, `portions_per_person` (default 1)

### Data isolation

Every query for recipes, plans and household data must be scoped to a household the signed-in user is a member of. Enforce this in one place (a data-access layer or Postgres row-level security), not ad hoc per route. Never trust a household id or recipe id from the client without checking membership.

## 5. Derived values (fixed rules, no inference)

| Value | Rule |
|---|---|
| `total_mins` | `prep_mins + cook_mins + wait_mins` |
| `protein_type` | Any protein with category `meat` and any with `fish` → `meat-and-fish`. Only `meat` → `meat`. Only `fish` → `fish`. Otherwise (including no proteins) → `vegetarian`, shown as "Veg". |
| `protein_items` | All `proteins[].item` values (e.g. `tuna`, `chicken`) for "type of meat/fish" filtering. |
| `has_veggie_option` | `protein_type == vegetarian`, OR any variation has a `proteins` array containing no `meat`/`fish` entries. |
| Scaled quantity | `qty × (target_servings / serves)`. Leave `null` qty untouched. |
| Entry nutrition | `nutrition_per_serving × portions_per_person` (per person). |
| Macro energy split | protein × 4, carbs × 4, fat × 9 kcal, shown as % of their sum. |

`protein_type` is a **browsing** category. Strict suitability (e.g. a dish with no meat protein but chicken stock) is only ever shown from the `dietary` array. Never label a recipe "vegetarian" in a dietary sense unless `dietary` contains it.

## 6. Import

- Accept **file upload (one or many)** and a **paste-JSON text box** (important on mobile).
- Validate against the schema with Ajv. On failure, show every error with its JSON path and save nothing for that file.
- Reject `schema_version` values the app doesn't know.
- Limit request size (e.g. 256 KB per file, 50 files per upload) and rate-limit imports per user, since the app is public.
- Upsert by `id` within the current household:
  - New id → preview, then create.
  - Existing id → show which top-level fields changed, then update. Household recipe data is kept.
- Deleting a recipe that is in a meal plan should warn first.
- **Export**: a household can download all its recipes as a zip of schema-valid JSON files. This is the backup and the way to move recipes to another household.

## 7. Features (v1)

### Recipe library
- List and card views with name, total time, kcal and protein per serving, carb and protein badges, and a printed/estimated badge.
- **Filters**, all multi-select and combinable:
  - Carb type: pasta, noodles, rice, potato, bread, grains, pastry, none
  - Meat / Fish / Veg (`protein_type`), plus "has veggie option"
  - Type of meat or fish (`protein_items`), shown when Meat or Fish is selected
  - Meal type, cuisine, dietary, equipment, max total time, difficulty, spice level, freezable, favourites
- **Sort** by name, total time, kcal, protein, recently added, rating, last cooked.
- Text search on name and ingredient items.

### Recipe page
- Ingredients grouped by `group`, with a servings control that scales quantities.
- Method steps with optional step timers (`timer_mins`).
- Variations, source, storage notes, nutrition with printed/estimated badge.
- Household data: favourite, rating, notes, "cooked today".

### Meal plans
- Create a plan, then add recipes to day/slot cells, set portions per person.
- Per-person **daily totals** and **plan averages** for kcal and each macro.
- Show when total portions planned (`people × portions_per_person`) is less than the recipe's `serves`, i.e. there will be leftovers.

### Compare
- Pick 2–4 recipes and see them side by side:
  - Grouped bar chart of kcal and each macro per serving
  - Macro energy split per recipe
  - A table with times, carbs, proteins, dietary flags, and printed/estimated badges
- The same comparison for two meal plans (daily averages) is a nice-to-have.

### Account and household
- Sign in / sign out with Google.
- Household settings: rename, list members and roles, create/copy/revoke invite links, remove members, transfer ownership, leave, delete household.
- Account: delete my account (removes membership; deletes the household too if the user is its only member, after confirmation).
- A simple landing page for signed-out visitors, plus privacy policy and terms pages (needed for Google OAuth verification on a public app).

## 8. Out of scope for v1 (but the data supports it)

- Shopping list from a meal plan (ingredients have `aisle`, `unit` and optional `grams` for this)
- Calling Claude from inside the app
- Sharing individual recipes between households (export/import covers this for now)
- Login methods other than Google
- Barcode scanning, pantry stock

## 9. Schema evolution

- Every file carries `schema_version` (currently `1`).
- Adding enum values or optional fields is non-breaking: bump the schema file, keep version `1`.
- Renaming or removing fields means version `2`, plus a migration that rewrites stored `data` and re-derives the columns.
- The app never has the original photos, so new required fields can't be backfilled automatically. Prefer adding new fields as optional; anything required later must be re-extracted in Claude from the original photo or book, or given an explicit default in the migration.

## 10. Acceptance criteria

- Both example files in `examples/` import cleanly; a file with an unknown unit, or tuna under `meat`, is rejected with readable errors.
- Re-importing a changed file updates the recipe and keeps its favourite, rating and notes.
- Filtering by "Pasta" + "Fish" + "Tuna" finds the tuna pasta; "Veg" finds the Tofoo noodles; "has veggie option" finds both.
- A 7-day plan with 2 people shows correct per-person daily totals.
- Comparing the two examples shows both charts with a clear printed vs estimated distinction.
- Usable one-handed on a phone.
- A new Google user can sign in, create a household and import a recipe.
- An invite link lets a second Google user join; both then see the same recipes and plans. Expired, used or revoked links are refused.
- A user in household A gets no access to household B's recipes, plans or members, including by guessing ids in URLs or API calls.
- Exporting a household and importing the zip into another household reproduces the same recipes.

## 11. Open questions for Kris

Answered in [`decisions.md`](decisions.md).

- Should favourites, ratings and notes be shared across the household, or per person within it? (Assume shared for v1 unless told otherwise.)
- Can a user belong to more than one household at once, with a switcher? (The data model allows it; v1 assumes one.)
- Anything else from the holiday planner's auth setup that should be copied, such as session length or account deletion behaviour?

## 12. Suggested repo layout for the contract

```
schema/recipe.schema.json      # Appendix A, single source of truth
examples/*.json                # Appendix B and the Tofoo example, used as seed data and tests
```

Generate TypeScript types from the schema (e.g. `json-schema-to-typescript`) rather than hand-writing them.

## Appendix A — `recipe.schema.json`

See [`schema/recipe.schema.json`](../schema/recipe.schema.json).

## Appendix B — Examples

- [`examples/lemony-tuna-tomato-caper-pasta.json`](../examples/lemony-tuna-tomato-caper-pasta.json): Lemony tuna, tomato & caper one-pot pasta. Converted from the BBC Good Food recipe (September 2021, p63). Fish, printed nutrition, a veggie variation.
- [`examples/char-siu-tofoo-noodles.json`](../examples/char-siu-tofoo-noodles.json): Char siu Tofoo noodles. Vegetarian, estimated nutrition, ingredient groups.

## Appendix C — Instructions for the Claude.ai extraction project

Paste this into the new Claude.ai project's instructions, and add `recipe.schema.json` and the example files to the project's knowledge.

> When I upload a photo of a recipe, produce one JSON file that validates against `recipe.schema.json`, named `<id>.json`.
>
> - `id`: lowercase, hyphenated slug of the recipe name.
> - `source.title`: the publication's exact name as printed on the cover (e.g. "BBC Good Food", not "Good Food"), the same every time, so recipes from one source group together.
> - Copy quantities and steps faithfully. Rewrite the description and notes in your own words.
> - Use only the enum values in the schema. If nothing fits, use `other` and explain in the matching `detail` or `notes` field.
> - `proteins`: only the main protein(s) the dish is built around. Empty array if none.
> - `carbs`: the main carbohydrate base(s), or `["none"]`.
> - `dietary`: only flags the recipe as written fully meets. Don't count variations.
> - `wait_mins`: hands-off time not already in the printed cook time.
> - `storage`: use `null` when unsure.
> - If nutrition isn't printed, estimate it per serving and set `source` to `estimated`.
> - Give each variation its own `proteins` and `dietary` when they differ from the main recipe.
> - Check the file against the schema before giving it to me, and list anything you had to guess.
