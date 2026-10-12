---
name: pick-up-task
description: Full task workflow for a recipe-planner Jira ticket. Jira pick-up, a design check for UI work, plan and questions, implementation, tests, PR, CI and Jira update. Use when Kris says "pick up PP-NN", "carry on" or "do the next ticket".
argument-hint: "<PP-NN ticket number>"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git switch:*), Bash(git checkout:*), Bash(git branch:*), Bash(git pull:*), Bash(git fetch:*), Bash(pnpm install:*), Bash(pnpm test:*), Bash(pnpm lint:*), Bash(pnpm typecheck:*), Bash(pnpm build:*), Bash(pnpm designs:*), Bash(pnpm schema:*), mcp__claude_ai_Atlassian_MCP__*, mcp__github__*
---

You are carrying out Jira ticket **$ARGUMENTS** in the recipe planner, from pick-up to a PR with green CI.

Work through the steps in order and don't skip any. Where this skill and `AGENTS.md` or `docs/decisions.md` differ, they win.

No ticket given? The next ticket is the first one in "order of work" in `docs/decisions.md` that isn't Done in Jira. Confirm it with Kris before starting.

## Step 1: Pick up the ticket in Jira

Jira is project PP at kris-gwynne.atlassian.net. Get the cloudId once with `getAccessibleAtlassianResources`.

1. Fetch the ticket with `view: "full"`. Other views leave out `components` and the comments. Read the description, the acceptance criteria and **every comment**: decisions from design reviews and scope changes are often recorded as comments on the tickets they affect.
2. If the ticket has no `Recipe Planner` component, set it with `editJiraIssue`: `components: [{"name": "Recipe Planner"}]`. Every recipe-planner ticket needs it.
3. Move the ticket to **In Progress** and assign it to Kris (`atlassianUserInfo` gives his accountId).

## Step 2: Design check (UI tickets only)

Does the ticket change anything a user sees: a screen, a component, copy, a state, a layout?

- **No** (schema, data access, auth plumbing, CI, scripts): go to Step 3.
- **Yes**: there must be an **approved** design covering it. Approved means a `designs/src/<area>.html` that ends with a "Decisions" section (not "Questions for review") and has a matching entry in `docs/decisions.md`. Check that the screens and states the ticket needs are actually in it. A design for the same area that leaves out this screen doesn't count.
  - If there is one, read it and its decisions. The design is the spec: implement what it shows, using the tokens in `designs/theme.css` (semantic classes such as `bg-surface` and `text-ink-muted`, never raw colours).
  - If there isn't one, **stop**. Tell Kris which screens or states are missing, and offer to run `/design-screen` for the ticket (or for the design ticket that covers it). Don't write UI code until a design is approved.

## Step 3: Investigate and plan

1. Read the relevant parts of `docs/handover.md` (the spec) and all of `docs/decisions.md`. Decisions win where they differ from the handover.
2. Explore the code: find the files involved, the conventions already used and what to reuse. Recipe data follows `schema/recipe.schema.json`, and its types are generated in `src/types/recipe.ts`.
3. Write a short plan: what changes where, new files, how it fits the existing code, and how it will be tested.

## Step 4: Questions

**Stop and ask Kris** before writing code. Present:

1. Your understanding of the ticket, in a sentence or two.
2. The plan from Step 3.
3. A few numbered questions, each with your recommendation, covering ambiguities, choices that could go either way, scope edges and anything the design doesn't settle.

If there are no real questions, say so and ask whether to go ahead. Wait for his answer, and fold it into the plan. Record any decision in `docs/decisions.md` (dated) and any scope change as a comment on the affected Jira tickets.

## Step 5: Branch

1. `git fetch origin`.
2. If earlier PRs are still open and this ticket builds on them, branch from the top of that stack. Otherwise branch from `origin/main`: `git switch -c feat/$ARGUMENTS-short-description origin/main`, with a 2 to 4 word kebab-case description (for example `feat/PP-153-google-sign-in`).
3. Run `pnpm install` if `pnpm-lock.yaml` changed.

## Step 6: Implement

- Follow the approved design and the existing conventions. Keep changes to the ticket's scope.
- Don't add a dependency without a reason; mention any new one in the PR. Use `pnpm add`, never npm. If pnpm stops with `ERR_PNPM_IGNORED_BUILDS`, check whether the package's install script is needed and record it under `allowBuilds` in `pnpm-workspace.yaml`.
- New environment variables: add the name, with a blank value, to `.env.example`. Never write secret values anywhere.
- If something new comes up that changes the plan, pause and ask.

## Step 7: Test and check

1. Write tests next to the code. Use `*.test.ts` for logic (runs in Node) and `*.test.tsx` for components (jsdom with Testing Library). Cover the main behaviour, edge cases and, for anything touching households, that one household can't see another's data.
2. Run them all and fix what fails: `pnpm test:run`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
3. For UI work, run `pnpm dev` and check the page against the design at 390px and desktop width, in light and dark mode.

## Step 8: Commit

Commit in small, reviewable steps, following the style in `git log`: `feat($ARGUMENTS): <what changed>`, with a short bullet body for anything non-obvious. Keep `AGENTS.md` up to date if commands or workflow changed.

## Step 9: Push, PR and CI

1. `git push -u origin <branch>`.
2. Open a PR with the GitHub MCP (`create_pull_request`, owner `KrisGwynne`, repo `recipe-planner`). Check for a PR template first. Base it on `main`, or on the branch below if stacked, and say "Merge after #N" in the body.
   - **Title:** `feat($ARGUMENTS): <brief description>`.
   - **Body:** what and why, the main changes, decisions made, how it was tested, anything left out or for later, and `Jira: $ARGUMENTS`.
3. Wait for CI (`.github/workflows/ci.yml`) to finish. The run can be read without auth at `https://api.github.com/repos/KrisGwynne/recipe-planner/actions/runs?head_sha=<sha>`. If it fails, find the cause, fix it, push again and wait again. Don't hand over a red PR.

## Step 10: Update Jira

Comment on $ARGUMENTS with what was done, the decisions made and the PR link. Leave the ticket **In Progress** until Kris merges the PR; move it to **Done** once it's merged (check next time you start work).

## Done

Tell Kris what was done, any decisions or deviations and why, the tests added, the PR link and CI status, and what the next ticket is.
