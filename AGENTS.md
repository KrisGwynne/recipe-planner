# recipe-planner

Plan recipes and meals. Registry entry: `../registry.yaml` (`recipe-planner`).

Shared conventions (secrets, git, devices) are in `~/Projects/AGENTS.md`.

## Docs

- `docs/handover.md`: the product spec. `docs/decisions.md`: decisions made since; these win where they differ.
- `schema/recipe.schema.json`: the recipe contract, the single source of truth for recipe data. `examples/` holds valid recipes used as seed data and in tests.
- Jira: project PP, component `Recipe Planner` (set it on every ticket). Epics PP-132 to PP-139.

## Workflow

- **Design before code.** Any ticket that changes UI needs an approved design in `designs/` first. Designs are written in `designs/src/*.html` with Tailwind, built with `npm run designs`, checked with `scripts/screenshot.mjs`, then Kris reviews the built file by opening it in a browser (give him the `\\wsl.localhost\Ubuntu\...` path from `wslpath -w`; files can't be shown inline in chat). Each design ends with "Questions for review"; on approval, replace them with a "Decisions" section, add the decisions to `docs/decisions.md`, comment on the Jira ticket and move it to Done.
- **Decisions** go in `docs/decisions.md` (dated). Scope changes also go as comments on the affected Jira tickets.
- **Jira:** move a ticket to In Progress when starting and Done when finished, with a comment saying what was done.
- **Git:** no GitHub remote yet; Kris is holding off on GitHub, Vercel and Neon. Work on a branch per ticket (`feat/PP-NN-...`, `design/PP-NN-...`), stacked on the previous one, until the repo exists.

## Commands

- `npm install`
- `npm run test:run`: run tests once (`npm test` to watch)
- `npm run designs`: build `designs/src/*.html` into self-contained `designs/*.html` (Tailwind compiled and inlined). Edit the sources, never the built files. Tokens live in `designs/theme.css`, shared with the app.
- `node scripts/screenshot.mjs <html> <out-prefix> [width] [dark]`: screenshot a design to check it (first run `npx playwright install --only-shell chromium`).
- `npm run schema:types`: regenerate `src/types/recipe.ts` from the schema after changing it. Never edit that file by hand; a test fails if it's out of date.

The Next.js app isn't set up yet (PP-141); add its commands here when it is.

## Secrets

Real values go in the gitignored `.env`. List every variable name, with a blank value, in `.env.example`.
