# Claude.ai recipe extraction project

The app never reads photos itself: a Claude.ai project turns a photo of a recipe into a JSON file, and the app imports that file (Import tab). This folder holds what the project needs (PP-175).

## Set it up (once)

1. In Claude.ai, create a project called "Recipe planner".
2. Paste the whole of [`instructions.md`](instructions.md) into the project's instructions.
3. Add these files from this repo to the project's knowledge:
   - [`schema/recipe.schema.json`](../schema/recipe.schema.json): the contract every file must meet.
   - [`examples/lemony-tuna-tomato-caper-pasta.json`](../examples/lemony-tuna-tomato-caper-pasta.json) and [`examples/char-siu-tofoo-noodles.json`](../examples/char-siu-tofoo-noodles.json): what good files look like.
4. Try it: upload a photo of a recipe, then import the file in the app. It should import with no problems.

When the schema or the instructions change, update the project's copies too (the app's import says if a file uses a newer schema version).

## Use it

1. In the project, start a chat and upload a photo of the recipe (both pages if it spans two).
2. Claude replies with `<id>.json` and the file in a code block, plus anything it had to guess. Check the guesses.
3. Get the file into the app, either:
   - **Paste:** copy the code block, then Import → "Paste a recipe" → Check recipe. Easiest on a phone.
   - **File:** download or save it as `<id>.json`, then Import → Choose recipe files. Good for several at once.
4. Review and press Import.

If the app says a file has problems, tap **Copy problems for Claude**, paste the message into the same chat, and import the corrected file Claude gives back.

To update a recipe later, ask Claude for a new version in the same chat (it keeps the same `id`) and import it: the app shows what changes and keeps your notes and rating.
