---
name: design-screen
description: Design a recipe-planner screen or flow before it's built. Reads the Jira ticket, builds designs/<area>.html (390px phone screens, Tailwind, the foundations tokens), checks it, hands it to Kris to review in a browser, iterates, and on approval records the decisions and opens a PR. Use for any design ticket, or when pick-up-task finds a UI ticket without an approved design.
argument-hint: "<PP-NN ticket number> [area name]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git switch:*), Bash(git branch:*), Bash(git fetch:*), Bash(pnpm designs:*), Bash(node scripts/screenshot.mjs:*), Bash(wslpath:*), mcp__claude_ai_Atlassian_MCP__*, mcp__github__*
---

You are designing the screens for Jira ticket **$ARGUMENTS** in the recipe planner, through to Kris's approval.

Designs come before code: no UI ticket is built until its design is approved (see `AGENTS.md`). A design is a self-contained HTML page of 390px phone screens that Kris opens in his browser. Where this skill and `AGENTS.md` or `docs/decisions.md` differ, they win.

## Step 1: Pick up the ticket

Jira is project PP at kris-gwynne.atlassian.net; get the cloudId once with `getAccessibleAtlassianResources`.

1. Fetch the ticket with `view: "full"` (other views leave out `components` and the comments), and read the comments too. For a design ticket, also find and read the feature tickets the design will cover (usually in the same epic), so it includes every screen and state they need.
2. If the ticket has no `Recipe Planner` component, set it: `components: [{"name": "Recipe Planner"}]`.
3. Move it to **In Progress**.

## Step 2: Gather context

1. `docs/handover.md`: the spec for this area (screens, fields, rules).
2. `docs/decisions.md`: everything decided so far. It wins over the handover.
3. `designs/src/foundations.html` and `designs/theme.css`: the colours, type, spacing and components every screen is built from. Reuse them; don't invent new ones without saying so.
4. The other `designs/src/*.html` files: how neighbouring screens look, so the new one fits (navigation, headers, cards, sheets, empty states).
5. `schema/recipe.schema.json`, when the screen shows recipe data: use real field names and realistic values, such as the recipes in `examples/`.

## Step 3: Branch

`git fetch origin`, then `git switch -c design/$ARGUMENTS-<area> origin/main`, or branch from the top of the stack if earlier PRs are still open and this design depends on them.

## Step 4: Build the design

Write `designs/src/<area>.html`, or update it if the area already has a design. Copy the skeleton of an existing design, such as `designs/src/onboarding.html`:

- `<title>Recipe planner · <Area></title>`, the `<!-- styles -->` marker in `<head>` and `<!-- include:icons -->` after `<body>`. Shared pieces go in `designs/src/_<name>.html` and are pulled in with `<!-- include:<name> -->`. Add new icons to `_icons.html`.
- A header with "Recipe planner · $ARGUMENTS", the title, a sentence on what the page covers, and the light/dark switch button.
- Sections (`<section>` with an `h2`) holding phone frames: `<figure class="w-[390px] max-w-full">`, an 800px-tall frame with the rounded `border-ink` border, and a `<figcaption>` lettered A, B, C... saying what the screen shows and why. Questions refer to screens by letter.
- Show every state, not just the happy path: empty, loading if it's noticeable, errors, long content, one item against many. Add a wider-screen layout (tablet or desktop) when the screen changes shape there.
- Use only the semantic token classes (`bg-surface`, `text-ink-muted`, `bg-meat-soft`, `rounded-card`...), never raw colours or `dark:` variants: dark mode comes from the tokens.
- Use the bottom navigation and safe-area conventions from foundations.
- End with a **"Questions for review"** section: a numbered list of a handful of short questions, each naming the screen it's about and giving your recommendation. Ask only what Kris needs to decide; settle the rest yourself and say so in the captions.

Then build it with `pnpm designs`, which writes `designs/<area>.html` with the CSS inlined. Edit only the files in `designs/src/`, never the built files.

## Step 5: Check it yourself

Screenshot the built file at desktop and phone widths, in both themes, and look at every image:

```
node scripts/screenshot.mjs designs/<area>.html <scratchpad>/<area> 1300
node scripts/screenshot.mjs designs/<area>.html <scratchpad>/<area>-dark 1300 dark
node scripts/screenshot.mjs designs/<area>.html <scratchpad>/<area>-390 390
```

(First run on a machine: `pnpm exec playwright install --only-shell chromium`.) Fix clipped or overflowing text, contrast problems in dark mode, misaligned frames, and anything that doesn't match foundations or the neighbouring designs. Rebuild and check again.

## Step 6: Send it for review, and stop

1. Commit: `design($ARGUMENTS): <area> design for review`.
2. Give Kris the Windows path to the **built** file, from `wslpath -w designs/<area>.html` (it looks like `\\wsl.localhost\Ubuntu\home\kris\Projects\recipe-planner\designs\<area>.html`). Files can't be shown inline in these sessions.
3. In chat, list what's on the page in a few lines, then repeat the numbered questions with your recommendations.
4. **Stop and wait for his feedback.** Don't start building the feature.

## Step 7: Iterate

Kris usually answers the questions briefly and often adds a new idea. For each round:

- Change `designs/src/<area>.html`, rebuild, re-check the screenshots, commit, and tell him what changed. The path stays the same, so he only needs to refresh.
- Fold each new idea in everywhere it matters in the same turn: the design, `docs/decisions.md`, and comments on any Jira tickets whose scope changes (create a ticket with the `Recipe Planner` component if the idea is new work).

## Step 8: On approval

1. Replace "Questions for review" with a **"Decisions"** section: "Approved by Kris on <date>." and a bullet list of what was decided.
2. Add a dated entry to `docs/decisions.md`: `## <YYYY-MM-DD>: <area> design approved ($ARGUMENTS)`, with each decision in a sentence or two.
3. `pnpm designs`, then commit: `design($ARGUMENTS): approved <area>; <the headline decision>`.
4. Push and open a PR with the GitHub MCP (`create_pull_request`, owner `KrisGwynne`, repo `recipe-planner`, base `main` or the branch below). Title: `design($ARGUMENTS): approved <area> design`. Body: what the design covers, the decisions, and `Jira: $ARGUMENTS`.
5. Comment on the Jira ticket with the decisions and the PR link, and move it to **Done**, since design tickets are done on approval.

## Done

Tell Kris the design is approved and recorded, give him the PR link, and name the feature tickets it unblocks.
