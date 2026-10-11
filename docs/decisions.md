# Decisions

Decisions made after the [handover](handover.md). Where they differ from the handover, these win. Add new decisions at the bottom with a date.

## 2026-10-11: initial plan

**Stack.** Match the holiday planner: Next.js 16 (App Router), TypeScript, Tailwind v4, Neon Postgres with Drizzle, Auth.js v5 (next-auth) with the Google provider, Drizzle adapter and database sessions, Vitest, Zod. Plus Ajv (draft 2020-12, with ajv-formats) for imports and Recharts for charts. No Storybook for now.

**Household isolation.** Enforced in one data-access layer that resolves the signed-in user's membership and scopes every household query to it. Not Postgres row-level security, because per-request RLS settings are awkward with the Neon HTTP driver. Tested against PGlite with two households.

**No `users.google_sub` column.** Auth.js stores the Google `sub` in `accounts.providerAccountId` (unique per provider); that is the stable identity. The handover's `users` columns map to Auth.js's `users` table (`image` is the avatar).

**Rate limiting.** A Postgres counter table, not an extra service.

**Google OAuth.** A new OAuth client and consent screen for this app, not the holiday planner's.

**Open questions (handover section 11).**
- Favourites, ratings, notes and cooked history are shared across the household.
- One household per user in v1, no switcher. The data model stays many-to-many.
- Session length is the Auth.js default (30 days), as in the holiday planner.

**Design before code.** Every UI ticket needs an approved design in `designs/` first. Designs are self-contained HTML files showing 390px phone screens, written with Tailwind in `designs/src/` and built with `npm run designs` (CSS inlined, works offline). Kris reviews them by opening the file in a browser; this session type can't show files inline in chat.

**Jira.** Tickets live in project PP with the `Recipe Planner` component; epics PP-132 to PP-139.

## 2026-10-11: foundations design approved (PP-145)

**Vegan category.** The Meat / Fish / Veg browsing filter gets a fourth option, Vegan. It's derived with a fixed rule, no inference: a recipe is Vegan when `protein_type` is `vegetarian` and `dietary` contains `vegan`. Vegan recipes are also found by the Veg filter. On cards the Vegan badge replaces the Veg badge. No new column: it filters on the existing `dietary` array.

**Dark mode** follows the phone's setting. Tokens use CSS `light-dark()`, so components never need `dark:` variants; a `light`/`dark` class on `<html>` can override the setting later if a toggle is wanted.

**Bottom navigation on the web.** Five tabs (Recipes, Plans, raised Import, Compare, Household), fixed to the bottom with `env(safe-area-inset-bottom)` padding (needs `viewport-fit=cover`) and `dvh` heights so Safari's toolbar doesn't cover it. From tablet width up it becomes a side rail.

**Method steps** stay on the recipe page: every recipe has them (the schema requires at least one), and timers make them useful while cooking.

## 2026-10-11: library design approved (PP-147)

**Default sort** is Name, A to Z.

**"Cook with" (equipment filter)** shows recipes whose `equipment` needs nothing beyond what's ticked (subset), so you can rule out the oven, say. Every other multi-select section matches any ticked option, except "Suitable for" (dietary), where every ticked flag must apply.

**Source.** Already required by the schema (`source.kind`, `source.title`, optional `details` and `url`). Add extracted columns `source_kind` and `source_title` so the library can filter by source (books, magazines and websites by title; all `family` recipes grouped as "Family") and search matches source titles as well as names and ingredients.

**Filter counts** are shown on every option (faceted: what each option would find given the other filters).

**Consistent source titles.** Appendix C of the handover (the Claude extraction instructions) now asks for the publication's exact name as printed, the same every time, because the Source filter groups by exact title.

## 2026-10-11: recipe page design approved (PP-148)

One long page with sticky section links; Cooked today and Add to plan replace the bottom navigation; ingredients and steps can be ticked off; no in-app editing of recipe facts (notes and rating only; can revisit).

**Step timers are deprioritised** to an optional extra done last (PP-178, Low). The recipe page (PP-168) ships without them. When built, the screen stays on automatically while a timer runs.
