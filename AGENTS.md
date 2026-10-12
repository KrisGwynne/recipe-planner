# recipe-planner

Plan recipes and meals. Registry entry: `../registry.yaml` (`recipe-planner`).

Shared conventions (secrets, git, devices) are in `~/Projects/AGENTS.md`.

## Docs

- `docs/handover.md`: the product spec. `docs/decisions.md`: decisions made since; these win where they differ.
- `schema/recipe.schema.json`: the recipe contract, the single source of truth for recipe data. `examples/` holds valid recipes used as seed data and in tests.
- Jira: project PP, component `Recipe Planner` (set it on every ticket). Epics PP-132 to PP-139.

## Commands

- `npm install`
- `npm run test:run`: run tests once (`npm test` to watch)
- `npm run schema:types`: regenerate `src/types/recipe.ts` from the schema after changing it. Never edit that file by hand; a test fails if it's out of date.

The Next.js app isn't set up yet (PP-141); add its commands here when it is.

## Secrets

Real values go in the gitignored `.env`. List every variable name, with a blank value, in `.env.example`.
