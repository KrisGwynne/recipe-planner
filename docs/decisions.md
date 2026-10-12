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

## 2026-10-11: import and export design approved (PP-149)

The review step is always shown, even for one file. "Copy problems for Claude" copies a ready-made message listing each problem and its path. **Import accepts .json files only** for now; export is a .zip, so moving a library means unzipping and importing the files (up to 50 at a time). Export lives on the Household tab.

## 2026-10-11: onboarding design approved (PP-146)

The app is called "Recipe planner" for now (landing page, Google consent screen, invites). After creating a household, a skippable invite step follows; its link is only created on Copy or Share. Joining needs an explicit Join button. Until someone joins, an invite shows only the inviter's name and photo and the household name. One household at a time: joining another means leaving yours first.

## 2026-10-11: order of work and current state

**First milestone:** PP-140 to PP-144 (setup), then the first designs (PP-145 foundations, PP-146 onboarding, PP-147 library, PP-148 recipe page, PP-149 import), then code: PP-153 to PP-156 (sign-in, households, data-access layer, invite links), PP-160 to PP-162 (recipes table, validation, import screen) and PP-166 (list view). Goal: a new Google user can sign in, create a household and import a recipe. Then library and recipe page (PP-167 to PP-169), meal plans, invites and household settings, compare, export/delete/rate limiting, launch. Remaining designs are done just before their epics. Step timers (PP-178) last.

**State at end of 2026-10-11:** PP-140 is done locally (In Progress in Jira until pushed). All five first-milestone designs are approved (PP-145 to PP-149 Done). Next: PP-141 (scaffold the Next.js app locally; skip the GitHub repo and CI until Kris sets them up).

**Invites brought forward** (Kris, 2026-10-11): PP-156 is part of the first milestone, after PP-154, so the invite step after creating a household works from the start.

**Hosting on hold.** Kris will set up GitHub, Vercel and Neon later. Until then, work stays on local stacked branches and branch-by-branch review is skipped.

**Registry entry is stale, deliberately.** `~/Projects/registry.yaml` still describes `recipe-planner` as "scaffold only, stack not chosen". Kris chose to update it later, with PP-142 (hosting); it's also noted in `~/Projects/TODO.md`.

## 2026-10-12: app scaffold (PP-141)

**GitHub is set up** (`KrisGwynne/recipe-planner`). The local stack was pushed as one PR per ticket (#1 to #6), each based on the one below. CI runs lint, type check, tests and build on every PR. Vercel and Neon remain on hold (PP-142).

**pnpm, not npm** (Kris, 2026-10-12). Version pinned with `packageManager`, so local and CI match (the first CI run failed because CI's newer npm disagreed with the lockfile local npm wrote). Install scripts are allow-listed (`allowBuilds`), and pnpm's minimum release age is kept, with no exemptions.

**TypeScript 7, with the 6.0 API only for typescript-eslint.** TypeScript 7 has no programmatic API yet and typescript-eslint refuses to run on it. `typescript` is 7, used by `tsc` and by `next build`'s type check (checked: both catch type errors), and a pnpm `readPackage` hook (`.pnpmfile.cjs`) swaps typescript-eslint's `typescript` peer for `@typescript/typescript6`. pnpm overrides and `packageExtensions` were tried first; they can't do it, because the project's own `typescript` always satisfies the peer. Delete the hook when typescript-eslint supports 7.x.

**React Compiler on**, as in the holiday planner. No Storybook (as decided), and no service worker yet.

**ESLint 10.** eslint-config-next's plugins (import, jsx-a11y, react) declare ESLint up to 9 but work with 10: checked by linting a file that broke one rule from each, and all fired. Their peer warnings are silenced in `pnpm-workspace.yaml` for those three only. If a later plugin update breaks on 10, drop back to ESLint 9.

## 2026-10-12: app shell (PP-144)

**Tab URLs** are `/recipes`, `/plans`, `/import`, `/compare` and `/household`, in an `(app)` route group whose layout holds the navigation. `/` redirects to `/recipes` until sign-in (PP-153) brings a landing page.

**Side rail from `md` (768px) up**, so a portrait iPad gets the rail. It follows the library design's wider-screens mockup: Import at the top, Household at the bottom.

**Components built now** are only the ones the ticket lists (buttons, badges, cards and list rows, filter chips) plus the empty state the placeholder pages use. Inputs, the stepper, toggle, rating, bottom sheets, toast and cooking pieces are built with the first screen that needs them. Icons are inline SVGs with the designs' Lucide paths; no icon library.

**Vercel is connected** (Kris, 2026-10-12), so PRs get preview deployments. Kris checks the bottom navigation on a real iPhone in Safari (toolbar expanded and collapsed); automated checks run in Chromium only. Neon is still on hold.

## 2026-10-12: Google sign-in (PP-153)

**The code half of PP-142 is done here** (Kris, 2026-10-12): Drizzle schema and migrations in `drizzle/`, a Neon HTTP client (`DATABASE_URL`), PGlite for tests, and `pnpm db:generate` / `pnpm db:migrate`. Left for PP-142: creating Neon (through Vercel's Neon integration), applying migrations on deploy, and the security headers the holiday planner sets (X-Frame-Options, nosniff, Referrer-Policy) in `next.config.ts`.

**Local development uses a Neon dev branch**, not a local database, so it matches production.

**Auth.js v5 (`next-auth@5.0.0-beta.32`)**, as in the holiday planner; v5 has no stable release. Env names are Auth.js's defaults: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. Tables are `users` (with `created_at`), `accounts` and `sessions`, with snake_case columns; no verification-token table, since there's no email sign-in.

**Protecting pages.** `src/proxy.ts` (Next 16's name for middleware) only checks for a session cookie and sends visitors without one to `/sign-in?callbackUrl=...`. The `(app)` layout checks the session itself, so an expired cookie also ends at sign-in. Public: `/`, `/sign-in`, `/sign-in/error`, `/privacy`, `/terms`, `/invite/*` and `/api/auth/*`. Callback URLs are limited to paths on this site.

**Invite links are public**, following the approved onboarding design (D) rather than PP-153's description: the invite page says who invited you before asking you to sign in (PP-156).

**Sign out** sits on the Household placeholder page, styled as on the create-household screen, until household settings are designed (PP-152). The terms and privacy links 404 until PP-159.
