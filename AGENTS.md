# recipe-planner

Plan recipes and meals. Registry entry: `../registry.yaml` (`recipe-planner`).

Shared conventions (secrets, git, devices) are in `~/Projects/AGENTS.md`.

## Docs

- `docs/handover.md`: the product spec. `docs/decisions.md`: decisions made since; these win where they differ.
- `schema/recipe.schema.json`: the recipe contract, the single source of truth for recipe data. `examples/` holds valid recipes used as seed data and in tests.
- Jira: project PP, component `Recipe Planner` (set it on every ticket). Epics PP-132 to PP-139.

## Workflow

- **Design before code.** Any ticket that changes UI needs an approved design in `designs/` first. Designs are written in `designs/src/*.html` with Tailwind, built with `pnpm designs`, checked with `scripts/screenshot.mjs`, then Kris reviews the built file by opening it in a browser (give him the `\\wsl.localhost\Ubuntu\...` path from `wslpath -w`; files can't be shown inline in chat). Each design ends with "Questions for review"; on approval, replace them with a "Decisions" section, add the decisions to `docs/decisions.md`, comment on the Jira ticket and move it to Done.
- **Decisions** go in `docs/decisions.md` (dated). Scope changes also go as comments on the affected Jira tickets.
- **Jira:** move a ticket to In Progress when starting and Done when finished, with a comment saying what was done.
- **Git:** GitHub repo `KrisGwynne/recipe-planner`. One branch per ticket (`feat/PP-NN-...`, `design/PP-NN-...`), stacked on the previous one while earlier PRs are unmerged, and one PR per branch based on the branch below it. CI (`.github/workflows/ci.yml`) runs lint, type check, tests and build on every PR. Vercel and Neon are still on hold.

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
- `pnpm schema:types`: regenerate `src/types/recipe.ts` from the schema after changing it. Never edit that file by hand; a test fails if it's out of date.

**TypeScript 7, with the 6.0 API for typescript-eslint.** `typescript` is TypeScript 7 (`tsc`, and `next build`'s type check). typescript-eslint needs the TypeScript API, which 7.0 doesn't have, so `.pnpmfile.cjs` gives it `@typescript/typescript6` instead. Delete that file once typescript-eslint supports 7.x.

**Dependency install scripts** are blocked unless listed under `allowBuilds` in `pnpm-workspace.yaml`; pnpm stops with `ERR_PNPM_IGNORED_BUILDS` when a new one appears. Check whether the package needs it (most ship prebuilt binaries) and add it as `true` or `false`.

**Brand-new releases** aren't installed: pnpm waits a minimum release age before using a version. Don't add `minimumReleaseAgeExclude` entries to get round it; use the previous version.

The app lives in `src/app` (Next.js 16 App Router). `src/app/globals.css` imports the design tokens from `designs/theme.css`.

## Secrets

Real values go in the gitignored `.env`. List every variable name, with a blank value, in `.env.example`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
