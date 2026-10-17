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

## 2026-10-12: households and the create-household step (PP-154)

**The invite step (onboarding screen C) is built with invites (PP-156)**, not here: it needs the invites table and link tokens. Until then, creating a household goes straight to the empty library.

**`/welcome`** is the create-household step (screen B), outside the app shell. The `(app)` layout sends signed-in people without a household there; people with one who open it go to `/recipes`.

**One household per user is enforced by the database**: a unique index on `household_members.user_id`. The tables stay many-to-many, so a later migration can drop the index if a household switcher comes. Household and owner are created in one SQL statement (the Neon HTTP driver has no transactions), so a household is never left without its owner.

**Household names** are 1 to 50 characters after trimming. The field starts empty, with the placeholder "e.g. Our kitchen".

## 2026-10-12: one database for every environment

**Production's Neon database is used everywhere for now** (Kris, 2026-10-12; for previews, replaced by per-preview branches the same day, see PP-142 below): production, Vercel previews and local development. No per-preview or dev branches, so there's one database to migrate and no connection strings to copy per PR. This replaces "local development uses a Neon dev branch" (PP-153).

**So migrations must be additive** (new tables, columns or indexes; no renames, drops or new required columns on existing tables while old code uses them). A PR's migration runs on the shared database before the PR is merged, so its preview works, which means production code briefly runs against the new schema. Run `pnpm db:migrate` once per new migration. Testing on previews or locally uses real data.

Revisit (per-preview branches with migrations on deploy, PP-142) when anyone other than Kris's household uses the app, or a migration can't be additive.

## 2026-10-12: data-access layer (PP-155)

**`src/data` is the data-access layer**, replacing `src/households`. Household-scoped functions take a `HouseholdContext` (user id, household id, role), which only `requireHousehold()` makes, from the signed-in user's membership. A branded type stops one being built from an id, and ESLint stops anything outside `src/data`, `src/db` and `src/auth` importing the database, so the rule is checked by CI rather than by convention. Files import `server-only`, so the layer can't end up in browser code. New dependency: `server-only`.

**Isolation tests for later tables come with those tables** (Kris, 2026-10-12): recipes, recipe data, meal plans and invites don't exist yet, so PP-155 tests households and members, and each later ticket adds isolation tests with the shared `twoHouseholds()` fixture. A note is on each of those tickets, and the rule is in AGENTS.md.

## 2026-10-12: invite links (PP-156)

**Links are made on demand** on onboarding screen C: the first Copy or Share makes one, later taps reuse it. Until then the box says "Tap Copy or Share to make a link" (Kris, 2026-10-12). Share only shows where the browser has a share sheet; elsewhere Copy is full width.

**Tokens** are 32 random bytes in the link (`/invite/<token>`); only their SHA-256 hash is stored. Joining is one SQL statement that uses up the link and adds the member, so a link lets in one person, and someone already in a household doesn't use it up. Invites go with their household and with the account that made them.

**The invite page checks, in order:** a link that doesn't exist; already a member of this household; expired, used or cancelled; in another household. Then screen D (signed out) or E (signed in). "Not you?" signs out and opens Google's account chooser for this flow only.

**Managing and cancelling links has no screen yet** (Kris, 2026-10-12): `listInvites` and `revokeInvite` are built and tested, and the UI comes with household settings (PP-152 design, PP-157). Until then screen C leaves out "Manage links in Household settings", and "Go to Household settings" (already in a household) opens the Household placeholder.

## 2026-10-12: recipes table and derived values (PP-160)

**Enum-like recipe columns are text**, not Postgres enums (Kris, 2026-10-12): the schema can add enum values without a new version (handover section 9), and a Postgres enum would need a migration each time. The TypeScript types still restrict them.

**Indexes are per household only** (Kris, 2026-10-12): unique on (household_id, slug), and (household_id, lower(name)) for the A to Z sort. Every query reads one household's recipes, so indexing each filter column only slows writes. This replaces "indexed" for the source columns (PP-147 decision) until there's a reason.

**Members and owners can both save and delete recipes** (handover section 2). Saving is one statement that creates the recipe or updates the household's recipe with the same slug, keeping its row id and creator. Validation against the schema comes with import (PP-161). The warning before deleting a recipe that's in a meal plan comes with meal plans.

**Derived values** live in `src/recipes/derive.ts` (pure, usable on screens). A variation without a `proteins` list keeps the main recipe's, so it doesn't make a veggie option. `browsingCategory` returns `meat | fish | meat-and-fish | vegetarian | vegan`; how "meat & fish" shows on cards and filters is settled with the library (PP-166/167).

**Tests share one migrated in-memory database per worker.** Each PGlite is about 0.5 GB, so tests run on at most 4 workers and each test gets a clone of a database migrated once per worker.

## 2026-10-12: recipe validation (PP-161)

**Problems follow the import design (screen E):** a short title, a plain-English detail naming the ingredient, step, protein or section (e.g. "Ingredient 4 (olive oil)"), and the path in a form Claude reads (`ingredients[3].unit`). The proteins and carbs `oneOf` errors are explained from the option the file meant ("Tuna is listed as meat"). Nothing is coerced, defaulted or removed.

**`schema_version` above 1** gets the single whole-file message from screen I ("Made for a newer version of the app"), as do broken JSON and files that aren't a JSON object (Kris, 2026-10-12). A missing or other `schema_version` (0, "1") is an ordinary problem in the list.

**"Copy problems for Claude" text** is built with the messages (`problemsForClaude` in `src/recipes/validate.ts`); the button comes with the import screen (PP-162). So do the size limits (256 KB per file, 50 files).

## 2026-10-12: import screen (PP-162)

**Left out until their pages exist** (Kris, 2026-10-12): "See the full recipe" (screen C) and the recipe links on Done (F) come with the recipe page (PP-168); "New here? How to turn a photo into a recipe file" (A) comes with the Claude project setup (PP-175). The rate-limit message (screen I) comes with PP-163.

**Meat & fish** gets a badge in the meat colours for now (Kris, 2026-10-12), so a new recipe with both can be previewed; the library settles it (PP-166).

**Two files in one batch with the same id:** the later one goes under Problems ("Same recipe id as …") rather than replacing the first (Kris, 2026-10-12).

**How it works.** The browser reads the files and sends them to a server action that checks each one (`src/recipes/check-files.ts`) and compares it with the household's recipe of the same id, saving nothing. Import sends the chosen files again and the server checks them again before saving. Files go in requests of up to 3 MB, under Vercel's 4.5 MB request limit, and the server action body limit is 4 MB. Each step is in the URL (`?view=review`, `?view=file&i=…`, `?view=done`) so the phone's back gesture steps back; the files stay in memory, so a reload starts again. On review, detail and done screens the action bar covers the tab bar on phones, as on the recipe page.

## 2026-10-12: recipe list and card views (PP-166)

**Meat & fish** (Kris, 2026-10-12): a recipe with both shows a "Meat & fish" badge on the neutral `bg-surface-2`, with a meat dot then a fish dot; in the list view the left bar is split, meat above fish. In the filters (PP-167) it appears under both Meat and Fish. This replaces PP-162's meat-coloured stopgap.

**Cards link to `/recipes/<slug>`** (the recipe's stable JSON id) (Kris, 2026-10-12). Until the recipe page (PP-168), that's a placeholder with the recipe's name; another household's slug is a 404.

**The chosen view is remembered in a cookie** (`recipes-view`, `cards` or `list`, one year) (Kris, 2026-10-12), so the server renders the right view first time, with no flash of the other.

**Empty library** (screen I) uses the design's title and copy; "How do I make recipe JSON?" is left out until the Claude project setup (PP-175) (Kris, 2026-10-12).

**Gaps the design left** (Kris, 2026-10-12): the category detail names every meat and fish item ("Meat · Chicken, pork"; vegetarian items and "other" aren't named, and Veg/Vegan badges have no detail). The header shows only "N recipes" and the view switch until sort comes (PP-167). While the library loads, three card outlines show. On wide screens the list is capped at `max-w-3xl`; cards flow into 2 then 3 columns. "+ Veggie option" is a green line under the badges (library design A) rather than foundations' outlined badge, and list rows have no chevron (design B).

## 2026-10-12: hosting leftovers (PP-142)

**Migrations run on every deploy** (Kris, 2026-10-12). Vercel's build command (`vercel.json`) runs `node scripts/migrate.mjs` before `pnpm build`. The Vercel–Neon integration still gives each preview deployment its own Neon branch, copied from production when the deployment is made, and sets that deployment's `DATABASE_URL` to it; so a preview migrates its own branch, and production migrates production only when a PR is merged and deployed. Nothing to run by hand for a PR, and test data from previews stays out of production. Applied migrations are skipped and a failed migration fails the deploy. **No GitHub Action** for migrations: this replaces PP-142's "Migrations run from the GitHub Action" criterion, and keeps the database credential out of GitHub. This replaces "one database for every environment" for previews (below the 2026-10-12 entry of that name): production's migrations must still be additive, since the old deployment serves traffic while the new one builds.

**Security headers.** A Content-Security-Policy with a fresh nonce per request, set in `src/proxy.ts`: scripts need the nonce (`'strict-dynamic'`), styles allow `'unsafe-inline'` (React and next/image write style attributes), images, fonts and connections are this site only (avatars come through `/_next/image`), forms may also post to `accounts.google.com` (the sign-in form before JavaScript loads), no framing. Enforced from the start, not report-only. Every page renders per request so it gets the nonce (the root layout calls `connection()`; only three pages were static). On Vercel previews the toolbar (`vercel.live`) is allowed, and `'strict-dynamic'` is dropped there because it makes browsers ignore host sources. The fixed headers, in `next.config.ts`: nosniff, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS for two years without `includeSubDomains` or `preload` (vercel.app isn't ours), `Cross-Origin-Opener-Policy: same-origin`, and a Permissions-Policy turning off camera, microphone, geolocation, payment, USB and topics (clipboard, share and wake lock keep their defaults).

**Not `no-referrer` for invite links.** `strict-origin-when-cross-origin` already keeps `/invite/<token>` from other sites, and `no-referrer` would make browsers send `Origin: null` on the app's own form posts, which Next's server-action check rejects (Join would break).

**Registry entry updated** in `~/Projects/registry.yaml` (a PR in the Projects repo): runs on Vercel at https://recipe-planner-alpha.vercel.app, status active.

## 2026-10-12: library search, filters and sort (PP-167)

**Filtering happens in the browser** (Kris, 2026-10-12), not in the database query as the ticket said. The household's whole library (card fields plus ingredient names, equipment and freezable, read from the file by `listRecipes`) is loaded once, scoped on the server as before, and `src/recipes/library-filter.ts` filters, counts, sorts and searches it. That makes the sheet's "Show N recipes", the count on every option and search-as-you-type instant, and the first server render uses the same code. Revisit if a library reaches a couple of thousand recipes.

**Favourites only, Highest rated, Not cooked for longest and Cooked most recently** are hidden until PP-169 adds that data (Kris, 2026-10-12).

**The phone sheet applies on "Show N recipes"**; the cross throws changes away. On wide screens (`lg`) the filters sit in a panel and apply straight away (Kris, 2026-10-12).

**Type of meat or fish narrows only its own category** (Kris, 2026-10-12): Meat + "Fish: Tuna" finds any meat recipe or a tuna recipe.

**Search** matches every word, case-insensitive, somewhere in the name, an ingredient item or the source title (Kris, 2026-10-12). When only an ingredient matches, the card shows it ("Ingredient: sushi-grade tuna, diced").

**Details the design left open:** the URL keeps the state (`?q=`, `sort=`, `cat=`, `item=fish:tuna`, `carb=`, `time=`, `meal=`, `cuisine=`, `source=`, `diet=`, `cook=`, `difficulty=`, `spice=`, `veggie=1`, `freezable=1`); filters and sort add history entries, typing replaces the current one. "Cook with" is one chip ("Cook with: Hob, Oven") since the ticked set is one rule. Nothing matching with only a search offers "Clear search". When no single filter would bring anything back, only "Clear all filters" is offered.

## 2026-10-12: recipe page (PP-168)

**Household parts come with their tickets** (Kris, 2026-10-12): the favourite heart, the rating and cooking history, "Our notes" and **Cooked today** with PP-169; **Add to plan** with meal plans (PP-171). Until there's an action for the bottom bar, the page keeps the normal tab bar. The ⋯ menu has **Download recipe file (.json)** and **Replace with a new version…** (opens Import, whose review shows what changes); "Compare with…" (PP-173) and "Delete recipe" (PP-165) join it with their tickets.

**Scaled amounts** (Kris, 2026-10-12): g and ml as whole numbers (one decimal below 10), kg and l to two decimals (below 1 shown as g or ml: "500 ml"), everything else the nearest kitchen fraction (½, ⅓, ¼, ¾, ⅔) or one decimal if none is close. Countable units go plural ("2 cans"). Notes with amounts get "(for 4)" when scaled, except next to a gram total, where the note is the pack size and the total scales instead.

**Servings and ticks last for the visit** (Kris, 2026-10-12); every visit starts at the recipe's own servings. The recipe file's own `notes` show as "Tips" under "From the recipe".

**Import links to recipes** (Kris, 2026-10-12): the done screen's recipe names open their pages, and a new file's details have "See the full recipe", the same page from the file, read-only, before anything is saved. The page is a shared component (`src/components/recipe/recipe-view.tsx`) for that reason.

## 2026-10-12: Claude project for recipe photos (PP-175)

**The Claude project's instructions live in `claude-project/instructions.md`** (Kris, 2026-10-12), with setup steps in `claude-project/README.md`; handover Appendix C now points there. The schema and examples are uploaded from `schema/` and `examples/` as they are, not copied. The instructions add what the import checks catch (one code block with the file name, `schema_version: 1`, numbers as numbers, `qty`/`unit` null, `grams` for containers, `group`, protein categories, `"none"` alone) and how to answer a "Copy problems for Claude" message.

**The in-app help page** (and the Import and empty-library links to it) is a new ticket, PP-179, after the meal plan work (Kris, 2026-10-12). It needs a design first.

**Order of work from here** (Kris, 2026-10-12): PP-175, then the meal plans design (PP-150) and PP-170 to PP-172. Favourites, ratings and notes (PP-169) come after.

## 2026-10-13: meal plans design approved (PP-150)

**Phone layout** (Kris, 2026-10-13): a plan is a list of day cards, each with its meals in order (breakfast, lunch, dinner, snack) and empty meals as "+" buttons, under a sticky strip of days to jump between. From tablet width it becomes the full grid (days across, meals down, per-person totals along the bottom). A meal can hold more than one recipe (a curry and a side).

**Averages** (Kris, 2026-10-13): the plan's per-person daily average is over the days with at least one meal planned, and says how many ("6 days planned"), so an empty day doesn't drag it down. Daily totals count only what's planned. Totals that include an estimated recipe get the ~ and dashed outline, and the nutrition page names those recipes.

**Leftovers stay per entry**, as the handover says (Kris, 2026-10-13): planning the same recipe again counts as cooking it again. Planning a later meal as "leftovers from Monday" is an optional future ticket, PP-180 (Low).

**Copy to a new plan** is in (Kris, 2026-10-13): the plan's ⋯ menu copies every recipe and portion into a new plan starting the day after this one ends, through the New plan sheet. Built with PP-170.

**The recipe picker starts filtered to the meal** being added (Kris, 2026-10-13), as a removable chip; search, filters and sort work as in the library. Tapping a recipe adds it with 1 portion each.

**Details settled in the design:** portions each go in halves from ½ to 4 and save as you tap; a new plan starts the day after the latest plan ends (or today) and is named after its start date until renamed; days 1 to 14, people 1 to 12; plan names 1 to 50 characters; fewer days warns before removing meals; changing people changes only the leftovers; anyone in the household can make, change or delete plans; the recipe page's "Add to plan" opens a day-and-meal grid sheet, also used to move a planned recipe; "Compare with another plan" waits for PP-174.

## 2026-10-13: meal plan tables and plan list (PP-170)

**"Today" is UK time** (Europe/London) everywhere for now (Kris, 2026-10-13): pages render on the server in UTC, and "today" decides which plans are this week, coming up or past, and a new plan's start. How to handle other time zones is PP-181. Plan dates are Postgres `date`s ("YYYY-MM-DD"), so stored dates have no time zone.

**Entry functions are in PP-170** (Kris, 2026-10-13): adding a recipe to a plan, changing portions, moving and removing are in `src/data/plans.ts` with their isolation tests; PP-171 builds their screens. A recipe can only go into a plan of the same household, and only on a day inside the plan.

**The plan page in PP-170** (Kris, 2026-10-13) shows the header, the ⋯ menu (Edit, Copy to a new plan, Delete) and each day's recipes read-only, each opening its recipe page until the entry sheet comes (PP-171). The day strip, "+" buttons and totals come with PP-171 and PP-172; so does the plan list's "~820 kcal a day each" (PP-172).

**Single statements, no transactions** (the Neon HTTP driver has none): copying a plan, and shortening a plan (which removes the entries on the days cut off), are each one SQL statement. A copied entry keeps its original `created_at`, so a meal's recipes stay in order; a moved entry goes last in its new meal.

**Limits are also database checks**: days 1 to 14, people 1 to 12, `day_index` 0 to 13, the four meals, and portions in halves from ½ to 4 (`double precision`). Slots are text, as with recipe enums.

**Deleting a recipe deletes its plan entries** (foreign key cascade); the warning before that is PP-165.

**The bottom sheet moved** to `src/components/ui/sheet.tsx` for the plan sheets, and a `Stepper` (`src/components/ui/stepper.tsx`) was added for days, people and, later, portions.

## 2026-10-13: filling a plan (PP-171)

**PP-171 is the screens, PP-172 the numbers** (Kris, 2026-10-13): a planned recipe shows its portions each ("1½ each"), and the entry sheet its servings ("2 people × 1½ = 3 servings"). Everything worked out from nutrition or `serves` comes with PP-172: kcal and protein on recipe rows, the "N left over" badges, the entry sheet's leftovers box and "Each person gets", the Add to plan sheet's leftovers line, day totals, the average card and the wide grid's totals row.

**Every day has a "+" for all four meals** (Kris, 2026-10-13), even a meal already planned, so a side can join a curry (design I) rather than only empty meals (design D). On a phone they sit in one row of four; below 380px the "+" icon is dropped so the labels fit.

**The wide grid is in PP-171** (Kris, 2026-10-13): from `md` the plan is days across and meals down; an empty cell is a "+" that turns tomato on hover, a filled one keeps a small "+" under its recipes. Past 7 days it scrolls sideways.

**"Recipe" from a planned meal opens the recipe page at whole servings, rounded up** (Kris, 2026-10-13): `?servings=N` on the recipe page (1 to 50), so 3 people × 1½ opens at 5.

**"Add to plan" offers the current and coming plans only** (Kris, 2026-10-13), the current one first; past plans aren't listed. With none, the sheet offers "Create a plan", which opens the new plan as usual (the recipe isn't added to it).

**Undo after Remove adds the recipe back last in its meal** (Kris, 2026-10-13), not in its old place among several.

**How it works.** The recipe picker is a page, `/plans/<id>/add?day=2&slot=lunch&meal=lunch` (`meal` is the library's own meal filter, so the chip is an ordinary filter), covering the tab bar on phones. Its search, filters and sort only replace the history entry, so back always returns to the plan; tapping a recipe adds it and goes back. The library's search box, filter and sort sheets and "nothing matches" moved to `src/components/recipe/library-controls.tsx` for both. Toasts come from a provider in the `(app)` layout, so one shown just before going back stays on the plan. The recipe page's action bar has only Add to plan until PP-169 adds Cooked today. The Add to plan sheet loads the chosen plan's grid when it opens (`planGridAction`), so recipe pages don't query plan entries until it's used. Moving shows "Moved to Wed lunch" without Undo.

## 2026-10-14: plan totals and leftovers (PP-172)

**Totals add up the exact numbers and round only for display** (Kris, 2026-10-14): a recipe's nutrition per serving × portions each, summed per day, averaged over the days planned, then rounded to whole kcal and grams. A day's total can differ by 1 from adding up its rounded rows.

**Planning more than a recipe makes isn't flagged** (Kris, 2026-10-14): 3 people × 1½ on a recipe that serves 4 shows no badge or warning. Leftovers are only shown when people × portions each is less than the recipe serves; the entry sheet's Recipe button already opens it scaled up. A warning could be a follow-up ticket if it's missed.

**Half servings left over show as halves** (Kris, 2026-10-14): "½ left over", "1½ left over".

**"kcal a day each" is on the current plans' cards only** (Kris, 2026-10-14), as design A shows; coming-up plans keep "N days empty".

**How it works.** The sums are in `src/plans/nutrition.ts`; the plan page, entry sheet, Add to plan / Move sheet and the nutrition page (`/plans/<id>/nutrition`) all use them. The plan list's average is summed in SQL in `listPlans`, so it doesn't load every entry. The recipe page's energy-split bar moved to `src/components/recipe/energy-split.tsx` for the nutrition page. Past 7 days, the nutrition page's rows say "Mon 12" rather than "Mon", since a plan can then have two Mondays.

## 2026-10-14: help page design approved (PP-179)

**The help page lives at `/import/help`, under the Import tab** (Kris, 2026-10-14). It's opened only from the two existing links, Import's "New here?" and the empty library's "How do I make recipe JSON?"; there's no entry on Household. Design: `designs/src/help.html`.

**Setup says "Easiest on a computer"** up front (Kris, 2026-10-14), since adding files to a Claude project is fiddly on a phone. On wide screens, setup is the left column and each recipe the right.

**The schema and two examples are three separate downloads, not a zip** (Kris, 2026-10-14). They're served from the app's own copies (`schema/`, `examples/`), so they're always the versions Import checks against. Claude won't take a zip until it's unzipped.

**Copy is the main action for the instructions** (Kris, 2026-10-14); the full text of `claude-project/instructions.md` is behind "Show the instructions", so the page stays short.

**A small mock of Claude's reply stays** (Kris, 2026-10-14), so a first-timer knows what "the file" looks like.

## 2026-10-14: favourites, ratings, notes and Cooked today (PP-169)

**Notes are edited in place** (Kris, 2026-10-14): tapping "Our notes" turns the card into a text box with Save and Cancel; with no notes there's an "Add a note" button. Up to 2,000 characters; saving it empty deletes the note. "Edited by Kris · 2 Oct" shows the first name of whoever saved last.

**Cooked today can be taken back the same day** (Kris, 2026-10-14): once today is marked, the button stays green (design F) and tapping it again takes today out, with a "Removed today" toast. Marking it shows "Marked as cooked today" with Undo. Today is the UK date, worked out on the server.

**Tapping the current star clears the rating** (Kris, 2026-10-14). The label is **"Our rating"**, not the design's "Your rating", since ratings are shared by the household like the notes.

**The top card always shows** (Kris, 2026-10-14), with empty stars and "Not cooked yet" before anything is set, so the feature can be found. It links to the Notes section, where you rate; its own stars only show the rating.

**The history names the last three days** (Kris, 2026-10-14), then "and N more": "Cooked 7 times: today, 14 Sep, 21 Aug and 4 more". Past days can't be added or removed (only today); either could be a follow-up.

**Cards and rows don't show rating or last cooked** when sorting by them (Kris, 2026-10-14); the design doesn't, and it can be added later.

**How it works.** Two tables keyed by the recipe's row id, which re-importing keeps: `recipe_household_data` (favourite, rating, notes, one row per recipe) and `recipe_cooks` (one row per day cooked). Deleting a recipe deletes both. The data-access functions are in `src/data/recipe-household.ts`; `listRecipes` adds favourite, rating and last cooked for the library's heart, Favourites only (`?fav=1`) and the sorts (`sort=rating`, `notCooked`, `cooked`; ties A to Z). Every change shows at once (`useOptimistic`) and is saved by a server action in `src/app/(app)/recipes/actions.ts`. The recipe page's parts are in `src/app/(app)/recipes/[slug]/household.tsx` and reach `RecipeView` through its `household` and `notes` slots, so import's preview has none of them.

## 2026-10-14: household settings design approved (PP-152)

**One Household tab for the household and your account** (Kris, 2026-10-14): the name, members and roles, invite links, "Download all recipes" (PP-164), your account (Sign out, Delete my account), and Leave or delete at the bottom. Members see the same page without the owner's controls, with a note naming the owners. Design: `designs/src/household.html`.

**Several owners** (Kris, 2026-10-14): owners can make a member an owner, and an owner can go back to being a member while another owner stays. That replaces a separate "Transfer ownership" step: handing over is making someone an owner, then leaving. The only owner can't leave or delete their account while others are in the household; they're asked to choose another owner first.

**Only owners invite** (Kris, 2026-10-14), as the handover says.

**Typing the name to confirm** (Kris, 2026-10-14) only where the household and its recipes are deleted: Delete household, and Delete my account when you're the only person in it. Leaving, removing someone and deleting an account otherwise use foundations' plain confirmation sheet.

**Emails are shown to everyone in the household** (Kris, 2026-10-14) in the member list, to tell people with the same name apart.

**Invite links can't be copied again** (Kris, 2026-10-14): only a hash of each is stored (PP-156), so the open links list shows when each expires and who made it, with Cancel only. A lost link means making a new one.

**Details settled in the design:** a link is only made on Copy or Share, as in onboarding; making someone an owner happens straight away with Undo; after leaving, being removed or the household being deleted, "Start a household" shows "You're no longer in The Gwynnes" once, the same wording whichever way it happened; after deleting your account you're signed out and the sign-in page says so; from tablet width the page is two columns.

## 2026-10-14: household settings (PP-157)

**"Download all recipes" and "Delete my account" come with their tickets** (Kris, 2026-10-14), PP-164 and PP-158, rather than showing buttons that don't work yet. The same goes for "Download all recipes first" on the Delete household sheet, and the Privacy and Terms links at the bottom of the page (PP-159).

**You can't change your own role** (Kris, 2026-10-14): your row doesn't open, as in the design. To step back, another owner makes you a member, or you leave.

**The "You're no longer in …" note** (Kris, 2026-10-14) comes from a small `household_departures` table: one row per person, holding the household's name, written when you leave, are removed, or the household is deleted, and replaced next time. "Start a household" shows it whenever you have no household, so loading a page never deletes anything.

**Two owners leaving at the same instant could leave none** (Kris, 2026-10-14). Each change is one SQL statement with the "always an owner" rule inside it (the Neon HTTP driver has no transactions), which covers everything but exact races. Households are small enough to accept that rather than add locking.

**How it works.** The functions are in `src/data/households.ts` (`renameHousehold`, `setRole`, `removeMember`, `leaveHousehold`, `deleteHousehold`, `householdCounts`, `getDeparture`); the page is `src/app/(app)/household/`. Deleting a household checks the typed name on the server too, and the database's cascades take its recipes, recipe data, plans and invites. After leaving or deleting, the action goes to `/welcome`. Onboarding screen C links to Household settings again.

## 2026-10-17: delete my account (PP-158)

**"Your account has been deleted" comes from `/sign-in?deleted=1`** (Kris, 2026-10-17). Anyone can type the parameter, but all it does is show the note, so a one-time cookie isn't worth it.

**Only from the Household tab for now** (Kris, 2026-10-17), as in the design. Someone with no household only sees "Start a household" and can't delete their account yet; that's PP-183 (Low).

**"Download all recipes first" waits for PP-164** (Kris, 2026-10-17) on the "delete your account and the household" sheet too, as on Delete household.

**Invite links you made stop working when your account goes** (Kris, 2026-10-17): they're deleted with it (the existing cascade on `household_invites.created_by`). What else you added stays without your name: recipes, notes, plans and cooking history (set null).

**How it works.** `deleteAccount(ctx, confirmName?)` in `src/data/households.ts` is one SQL statement with the rules inside it: a member, or an owner while another owner stays, deletes their `users` row (accounts, sessions, membership and departures go by cascade); the only person in the household also deletes the household, only if the typed name matches; the only owner with others in the household deletes nothing. `deleteAccountAction` then calls Auth.js's `signOut` to clear the cookie (it copes with the session row being gone already) and goes to the sign-in page. Signing in with Google again makes a new user. The typed-name part of the Delete household sheet is shared as `TypeNameToConfirm`.

## 2026-10-17: compare design approved (PP-151)

**One small chart per nutrient** (Kris, 2026-10-17), not one grouped bar chart: kcal is in the hundreds and grams in the tens, so on one axis the macro bars would be slivers. Each chart starts at zero, writes every value on its bar, and keeps the recipes in the order they were chosen. Bars use the energy split's colours (protein `veg`, carbs `primary`, fat `warning`, kcal `ink`), so no new tokens. Design: `designs/src/compare.html`.

**Charts for kcal, protein, carbs and fat only** (Kris, 2026-10-17). Sugars, saturates, fibre and salt are in the table, which also has times, serves, carbs, protein, dietary, cuisine, difficulty, spice and the Printed or ~ Estimated badge.

**Compare remembers the last comparison on this device** (Kris, 2026-10-17), so leaving the tab and coming back keeps it. The chosen recipes are also in the page address, so Back and shared links work.

**Left out for now** (Kris, 2026-10-17): written differences between two recipes ("153 kcal fewer"), and a "Select to compare" mode in the library. Recipes come in through the picker and the recipe page's "Compare with…", which opens the picker with that recipe ticked.

**Details settled in the design:** 2 to 4 recipes; per serving, as printed; estimated nutrition gets the dashed outline and ~ on bars, splits and table cells; the energy split reuses the recipe page's; a deleted recipe drops out of a comparison; with one recipe left the charts and table are hidden; fewer than two recipes in the library shows "Import at least two recipes to compare them"; on a phone the table scrolls sideways with its labels pinned; from tablet width charts are a 2 × 2 grid beside the recipes and energy split.

## 2026-10-17: compare recipes (PP-173)

Made while Kris was away (he said to carry on); each is open to change in review.

**No chart library.** The approved design is horizontal bars with their values written on them, which plain HTML and CSS draw exactly, in both themes and under the CSP, without adding Recharts (which the ticket named before the design changed).

**The address holds slugs**: `/compare?r=<slug>&r=<slug>`, in the order chosen, at most four. They're looked up within the household, so another household's recipe or a deleted one drops out. `/compare?r=` is an empty comparison chosen on purpose (removing the last recipe); plain `/compare`, the tab, goes back to the last comparison remembered on the device (`localStorage`, every read and write allowed to fail).

**The picker is its own page**, `/compare/choose?r=...`, like the plan's recipe picker: ticks are kept on the page until "Compare N recipes", which replaces the picker in history, so Back doesn't return to it. The recipe page's "Compare with…" opens it with that recipe ticked.

**"Carb type" and "Protein type"** label the table's carb and protein rows (the design said "Carbs" and "Protein"), so they aren't confused with the nutrient rows of the same names below.

**How it works.** `src/compare/compare.ts` (address, remembered comparison, bar widths), `src/app/(app)/compare/` (page, `compare-view.tsx`, `remember.tsx`, `choose/`). The energy split is the recipe page's `EnergySplit`, which now takes `estimated` to put the ~ on its percentages.

## 2026-10-17: download all recipes (PP-164)

**fflate for the zip** (Kris, 2026-10-17): small, with no dependencies, and it unzips too, so the tests open the zip they're given.

**An empty library greys the row out** (Kris, 2026-10-17): "No recipes to download yet." The "Download all recipes first" link on the Delete household and "delete your account and the household" sheets only shows when there are recipes, and downloading leaves the sheet open, so you can carry on deleting.

**How it works.** `GET /household/download` (a route handler, so the browser downloads it from a plain link) sends `<household> recipes <date>.zip`, the date in UK time, with one `<id>.json` per recipe: the stored file exactly, as the single download gives it (`src/recipes/file.ts`). Anyone in the household can; `listRecipeFiles(ctx)` reads only that household's recipes. Not `/household/recipes.zip`, since the proxy skips paths that end in a file extension, and with it the security headers. A test exports one household, unzips, validates and imports the files into another, and gets the same recipes.

## 2026-10-17: delete a recipe (PP-165)

Made while Kris was away; open to change in review.

**"Delete recipe…" is last in the recipe page's ⋯ menu, in red** (as PP-168 asked), and opens import design H: the plans and meals it'll disappear from ("This week: Tue dinner"), or, in no plan, the same sheet without the list. Deleting goes to the library. Anyone in the household can delete a recipe, as before.

**How it works.** `recipePlanUses(ctx, recipeId)` in `src/data/plans.ts` lists the household's plans the recipe is in and their meals, in date order. `deleteRecipeAction` uses the existing `deleteRecipe`; the database's cascades remove its plan entries, household data and cooking history (tested: nothing is left behind).

## 2026-10-17: rate-limiting imports (PP-163)

Made while Kris was away; open to change in review.

**200 recipes per person per hour** (`IMPORTS_PER_HOUR` in `src/recipes/review.ts`, beside the other import limits). Counted per person, since the ticket says per user, and in recipes saved rather than requests or files sent. An import is at most 50 files, so moving a big library takes a few goes, not an afternoon.

**The window starts with the first import** and lasts an hour; after that the count starts again. "Try again in about N minutes" is the time left in it.

**Over the limit, a request saves nothing** (screen I's card, on the review). Large imports go in several requests, so if a later one goes over, what was saved stays and the Done screen shows the card saying how many were saved and when to try the rest; those files aren't listed as having problems, since they don't.

**Only saving is limited.** Checking files (the review) reads but saves nothing, so it isn't counted.

**How it works.** `import_counts` (migration 0007, a new table: additive) holds one row per person: when their hour started and how many recipes they've saved in it. `reserveImports(ctx, n)` in `src/data/import-limits.ts` adds `n` only if it fits, in one statement, so two imports at once can't both slip under. It runs before anything is saved. Deleting the account deletes the row.

## 2026-10-17: privacy policy and terms design approved (PP-159)

**No name or email address on the privacy policy or terms** (Kris, 2026-10-17): they say "a personal project run from the UK". Rights requests are covered by what the app already does (download all recipes, change household data, delete my account or household); Google profile details are changed in Google. Design: `designs/src/legal.html`.

**The database is with Neon in London, and there are no backups** (Kris, 2026-10-17). Both pages say so: deleted data is gone for good, so keep a download of anything you'd miss.

**The landing page is onboarding A** (Kris, 2026-10-17), the existing sign-in page, at `/` for signed-out visitors; signed-in visitors go to their recipes. The terms keep the nutrition disclaimer ("a guide, not medical or dietary advice").

## 2026-10-17: landing page, privacy policy and terms (PP-159)

**How it works.** `/` renders the sign-in page (onboarding A) for signed-out visitors and sends signed-in ones to `/recipes`, as `/sign-in` does. `/privacy` and `/terms` are public pages with their own back header (`src/components/legal/`), from `designs/src/legal.html`; their text lives in the pages, so a change to what the app stores means a change there too. The Household tab ends with Privacy · Terms links (household design B). A test checks neither page names anyone or gives an email address.

## 2026-10-17: delete my account without a household, design (PP-183)

**Kris asked Claude to go with its recommendations while he was away** (2026-10-17), so these were decided without a review and are open to change. Design: `designs/src/household.html` N and O.

**"Delete my account…" sits beside Sign out on "Start a household"** (N), on one row in the same grey, not red. The page keeps its height and a first-time user isn't met with a red button. It's shown to everyone on that page, including people who have just signed in for the first time.

**The confirmation is design K's plain sheet without the household wording** (O): "Your sign-in details are deleted. Signing in with Google again starts from scratch." Afterwards the sign-in page shows M's note, as from the Household tab.

## 2026-10-17: delete my account without a household (PP-183)

**How it works.** `deleteAccountWithoutHousehold(userId)` in `src/data/households.ts` is one SQL statement: it deletes the signed-in user's `users` row only if they're in no household (accounts, sessions, departure note and invite links go by cascade). Like `getMembership`, it takes the signed-in user's id, since there's no household context. `/welcome`'s `deleteAccountAction` then signs out to `/sign-in?deleted=1`, as the Household tab's does. There's no toast outside the app shell, so a failure (they joined a household in another tab) shows in the sheet.
