import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { PROJECT_FILES, readInstructions } from "@/help/claude-project";
import { InstructionsStep } from "./instructions-step";
import { SectionLabel, Step } from "./step";

export const metadata: Metadata = { title: "Turn a photo into a recipe file" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Help: turning a photo into a recipe file (designs/src/help.html; PP-179).
 * Opened from Import's "New here?" and the empty library's "How do I make
 * recipe JSON?" (?from=recipes), and back goes to whichever it was. Setting
 * up the Claude project is the left column on wide screens, each recipe the
 * right.
 */
export default async function HelpPage({ searchParams }: Props) {
  const [{ from }, instructions] = await Promise.all([searchParams, readInstructions()]);
  const back = from === "recipes" ? { href: "/recipes", label: "Recipes" } : { href: "/import", label: "Import" };

  return (
    <main className="mx-auto max-w-xl lg:max-w-5xl px-5 pt-3 pb-6 md:p-6">
      <Link
        href={back.href}
        className="-ml-3 h-11 pl-2.5 pr-3 inline-flex items-center gap-1.5 rounded-control text-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Icon name="arrow-left" className="size-6 lg:size-4" />
        <span className="sr-only">Back to</span> {back.label}
      </Link>
      <h1 className="font-display text-[26px] leading-8 lg:text-[28px] font-semibold">Turn a photo into a recipe file</h1>
      <p className="mt-2 text-ink-muted max-w-2xl">
        The app doesn&apos;t read photos. A Claude.ai project does: set it up once, then send it a photo of any recipe
        and it gives you a file to import.
      </p>

      <div className="mt-6 grid gap-7 lg:grid-cols-2 lg:gap-8 lg:items-start">
        <section aria-labelledby="set-up">
          <div className="flex items-baseline justify-between">
            <SectionLabel>
              <span id="set-up">Set up once</span>
            </SectionLabel>
            <p className="text-xs text-ink-muted">About 5 minutes</p>
          </div>
          <p className="mt-2 rounded-control bg-surface-2 px-3 py-2 text-sm text-ink-muted">
            Easiest on a computer, since you&apos;ll add files to the project. After that, a phone is all you need.
          </p>
          <ol className="mt-3 space-y-3">
            <Step
              n={1}
              title="Create a Claude project"
              action={
                <a
                  href="https://claude.ai/projects"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-4 rounded-control border border-line bg-surface hover:bg-surface-2 font-semibold inline-flex items-center gap-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Open Claude.ai
                  <Icon name="external" className="size-4" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              }
            >
              <Muted>In Claude.ai, open Projects and create one called &ldquo;Recipe planner&rdquo;.</Muted>
            </Step>
            <InstructionsStep n={2} instructions={instructions} />
            <Step n={3} title="Add three files to the project">
              <Muted>Download them, then add them to the project&apos;s knowledge (its files).</Muted>
              <ul className="mt-3 divide-y divide-line rounded-control border border-line">
                {PROJECT_FILES.map((file) => (
                  <li key={file.name}>
                    <a
                      href={`/import/help/${file.name}`}
                      download={file.name}
                      className="flex items-center gap-3 px-3 min-h-12 py-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold font-mono truncate">{file.name}</span>
                        <span className="block text-xs text-ink-muted">{file.about}</span>
                      </span>
                      <Icon name="download" className="size-5 shrink-0 text-primary" />
                      <span className="sr-only">Download</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Step>
            <Step n={4} title="Try it with one recipe">
              <Muted>Follow &ldquo;Each recipe&rdquo;. If it imports with no problems, you&apos;re set.</Muted>
            </Step>
          </ol>
        </section>

        <div className="space-y-7">
          <section aria-labelledby="each-recipe">
            <SectionLabel>
              <span id="each-recipe">Each recipe</span>
            </SectionLabel>
            <ol className="mt-3 space-y-3">
              <Step n={1} title="Send Claude a photo">
                <Muted>
                  Start a chat in the Recipe planner project and upload a photo of the recipe: both pages if it spans
                  two.
                </Muted>
              </Step>
              <Step n={2} title="Check what it guessed">
                <Muted>Claude replies with the file, then lists anything it had to guess or couldn&apos;t read.</Muted>
                <div className="mt-3 rounded-control bg-surface-2 p-3 text-xs" aria-label="An example reply">
                  <p className="font-mono font-semibold">lemony-tuna-tomato-caper-pasta.json</p>
                  <p className="mt-1.5 font-mono text-ink-muted rounded bg-bg px-2 py-1.5 truncate">
                    {'{ "schema_version": 1, "id": "lemony-tuna…'}
                  </p>
                  <p className="mt-2 text-ink-muted">
                    <b className="text-ink">Guessed:</b> the cook time wasn&apos;t printed, so 20 minutes.
                  </p>
                </div>
              </Step>
              <Step n={3} title="Bring it into the app">
                <dl className="mt-2 space-y-2 text-sm">
                  <div>
                    <dt className="font-semibold">
                      Paste <span className="font-normal text-ink-muted">· easiest on a phone</span>
                    </dt>
                    <dd className="text-ink-muted">Copy Claude&apos;s code block, then Import → Paste a recipe → Check recipe.</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">
                      File <span className="font-normal text-ink-muted">· several at once</span>
                    </dt>
                    <dd className="text-ink-muted">Save it as a .json file, then Import → Choose recipe files.</dd>
                  </div>
                </dl>
              </Step>
              <Step n={4} title="Review and import">
                <Muted>The app shows the recipe before saving it. Press Import.</Muted>
              </Step>
            </ol>
          </section>

          <section aria-labelledby="off">
            <SectionLabel>
              <span id="off">When something&apos;s off</span>
            </SectionLabel>
            <div className="mt-3 space-y-3 text-sm">
              <Problem title="The app says a file has problems">
                Tap <b className="text-ink">Copy problems for Claude</b>, paste it into the same chat, and import the
                corrected file Claude gives back.
              </Problem>
              <Problem title="You want to change a recipe">
                Ask Claude for a new version in the same chat and import it. The app shows what changed and keeps your
                favourite, rating and notes.
              </Problem>
              <Problem title="Import says a file is for a newer version">
                The app&apos;s recipe format has moved on. Copy the instructions and download the files above again,
                and replace the project&apos;s copies.
              </Problem>
            </div>
          </section>

          <Link href="/import" className={buttonClasses("primary", "w-full")}>
            <Icon name="upload" className="size-5" />
            Import a recipe
          </Link>
        </div>
      </div>
    </main>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-ink-muted">{children}</p>;
}

function Problem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-line p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-ink-muted">{children}</p>
    </div>
  );
}
