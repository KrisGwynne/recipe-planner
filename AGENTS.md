# recipe-planner

Plan recipes and meals. Registry entry: `../registry.yaml` (`recipe-planner`).

Shared conventions (secrets, git, devices) are in `~/Projects/AGENTS.md`.

## Docs

- `docs/handover.md`: the product spec. `docs/decisions.md`: decisions made since; these win where they differ.
- `schema/recipe.schema.json`: the recipe contract, the single source of truth for recipe data. `examples/` holds valid recipes used as seed data and in tests.
- Jira: project PP, component `Recipe Planner` (set it on every ticket). Epics PP-132 to PP-139.

## Workflow

- **Design before code.** Any ticket that changes what a user sees needs an approved design in `designs/` before implementation. Approved means the design ends with a "Decisions" section and has an entry in `docs/decisions.md`. If there isn't one, stop and make one first: don't write UI code against an unapproved or missing design.
- **Skills.** `/pick-up-task PP-NN` runs a ticket end to end (Jira, design check, plan and questions, code, tests, PR, CI, Jira). `/design-screen PP-NN` makes a design and takes it through review to approval. Both are in `.claude/skills/`.
- **Design reviews.** Designs are written in `designs/src/*.html` with Tailwind, built with `pnpm designs`, and checked with `scripts/screenshot.mjs`. Kris then reviews the built file by opening it in a browser (give him the `\\wsl.localhost\Ubuntu\...` path from `wslpath -w`; files can't be shown inline in chat). Each design ends with "Questions for review"; on approval, replace them with a "Decisions" section, add the decisions to `docs/decisions.md`, comment on the Jira ticket and move it to Done.
- **Decisions** go in `docs/decisions.md` (dated). Scope changes also go as comments on the affected Jira tickets.
- **Jira:** every ticket has the `Recipe Planner` component. Move a ticket to In Progress when starting. Comment with what was done when the PR is up, and move it to Done once the PR is merged (design tickets: on approval).
- **Git:** GitHub repo `KrisGwynne/recipe-planner`. One branch per ticket (`feat/PP-NN-...`, `design/PP-NN-...`), stacked on the previous one while earlier PRs are unmerged, and one PR per branch based on the branch below it. CI (`.github/workflows/ci.yml`) runs lint, type check, tests and build on every PR. Vercel is connected (PR previews). Neon: one production database shared by every environment for now.

## Commands

Node 24 (`.nvmrc`; CI's version is set in `.github/workflows/ci.yml`). Package manager: **pnpm**, version pinned by `packageManager` in `package.json` (CI uses the same). Don't use npm or commit a `package-lock.json`. pnpm settings are in `pnpm-workspace.yaml`.

- `pnpm install`
- `pnpm dev`: start the app at http://localhost:3000
- `pnpm build`: production build (`pnpm start` to serve it)
- `pnpm lint`: ESLint 10 (Next.js core web vitals and TypeScript rules)
- `pnpm typecheck`: type check with TypeScript 7 (`tsc`)
- `pnpm test:run`: run tests once (`pnpm test` to watch). `*.test.ts` runs in Node, `*.test.tsx` (components) in jsdom with Testing Library.
- `pnpm designs`: build `designs/src/*.html` into self-contained `designs/*.html` (Tailwind compiled and inlined). Edit the sources, never the built files. Tokens live in `designs/theme.css`, shared with the app.
- `node scripts/screenshot.mjs <html> <out-prefix> [width] [dark]`: screenshot a design to check it (first run `pnpm exec playwright install --only-shell chromium`).
- `pnpm db:generate`: after changing `src/db/schema/`, write a migration to `drizzle/` (Drizzle Kit). Commit it; never edit applied migrations.
- `pnpm db:migrate`: apply the migrations to `DATABASE_URL`. For now every environment shares the production Neon database, so migrations must be additive (see `docs/decisions.md`). Tests apply them to an in-memory PGlite (`src/db/test-db.ts`).
- `pnpm schema:types`: regenerate `src/types/recipe.ts` from the schema after changing it. Never edit that file by hand; a test fails if it's out of date.

**TypeScript 7, with the 6.0 API for typescript-eslint.** `typescript` is TypeScript 7 (`tsc`, and `next build`'s type check). typescript-eslint needs the TypeScript API, which 7.0 doesn't have, so `.pnpmfile.cjs` gives it `@typescript/typescript6` instead. Delete that file once typescript-eslint supports 7.x.

**Dependency install scripts** are blocked unless listed under `allowBuilds` in `pnpm-workspace.yaml`; pnpm stops with `ERR_PNPM_IGNORED_BUILDS` when a new one appears. Check whether the package needs it (most ship prebuilt binaries) and add it as `true` or `false`.

**Brand-new releases** aren't installed: pnpm waits a minimum release age before using a version. Don't add `minimumReleaseAgeExclude` entries to get round it; use the previous version.

The app lives in `src/app` (Next.js 16 App Router). Auth (Auth.js v5, Google only, database sessions) is in `src/auth`; `src/proxy.ts` sends signed-out visitors to `/sign-in` (a cookie check only) and the `(app)` layout checks the session. The database schema is in `src/db/schema`; household data is only queried through `src/data` (see Data access). `src/app/globals.css` imports the design tokens from `designs/theme.css`.

## Data access

All household data goes through the data-access layer in `src/data` (PP-155). It is how one household is kept out of another's data (handover section 4, "Data isolation").

- Pages, layouts and server actions import from `@/data` only. ESLint fails any import of `@/db`, `@/db/schema` or `drizzle-orm` outside `src/data`, `src/db` and `src/auth` (tests excepted).
- Get the signed-in user's household with `requireHousehold()`, which returns `{ user, household, ctx }`. Every household-scoped function takes that `ctx` (a `HouseholdContext`) and filters on `ctx.householdId`. Never take a household id from the client. Ids the client sends (a recipe or plan id) are looked up within `ctx.householdId`, so another household's id finds nothing.
- Owner-only actions call `requireOwner(ctx)`.
- **Every new household table** (recipes, recipe data, meal plans, invites...) gets its functions in `src/data/<area>.ts`, and **isolation tests** using `twoHouseholds()` from `src/data/test-fixtures.ts`: acting as household A, try to read, change and delete B's rows by id, and check that nothing is returned or changed.

## Secrets

Real values go in the gitignored `.env`. List every variable name, with a blank value, in `.env.example`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
