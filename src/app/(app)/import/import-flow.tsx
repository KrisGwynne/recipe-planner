"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import {
  PASTED,
  inRequests,
  markDuplicates,
  problemsForClaude,
  shouldRead,
  tooManyFiles,
  type ImportFile,
  type ReviewItem,
} from "@/recipes/review";
import type { Problem } from "@/recipes/validate";
import type { ImportResult } from "./actions";
import { NewRecipe, ProblemList, ReviewRow, UpdateDetail, UnchangedNote } from "./review-parts";

type Actions = {
  review: (files: ImportFile[]) => Promise<ReviewItem[]>;
  save: (files: ImportFile[]) => Promise<ImportResult[]>;
};

/**
 * The import screens: start (A), review (B), a file's details (C, D, E) and
 * done (F). Each step is in the URL (?view=...) so the back gesture steps
 * back; the files themselves stay in memory, so a reload starts again.
 */
export function ImportFlow({ review, save }: Actions) {
  const params = useSearchParams();
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<ImportResult[]>([]);
  const [batchProblem, setBatchProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const view = params.get("view");
  const index = Number(params.get("i"));

  async function check(picked: ImportFile[]) {
    setBatchProblem(tooManyFiles(picked.length));
    if (picked.length === 0 || picked.length > 50) return;
    setBusy(true);
    setFailed(false);
    try {
      const checked: ReviewItem[] = [];
      for (const request of inRequests(picked)) checked.push(...(await review(request)));
      setFiles(picked);
      setItems(markDuplicates(checked));
      setLeft(new Set());
      window.history.pushState(null, "", "?view=review");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function importReady() {
    const ready = items.filter((i) => (i.status === "new" || i.status === "update") && !left.has(i.file));
    const names = new Set(ready.map((i) => i.file));
    setBusy(true);
    setFailed(false);
    try {
      const saved: ImportResult[] = [];
      for (const request of inRequests(files.filter((f) => names.has(f.name)))) saved.push(...(await save(request)));
      setResults(saved);
      window.history.replaceState(null, "", "?view=done");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function startAgain() {
    setFiles([]);
    setItems([]);
    setResults([]);
    window.history.replaceState(null, "", "/import");
  }

  const error = failed ? (
    <p role="alert" className="mt-3 text-sm text-danger">
      Something went wrong and nothing was saved. Check your connection and try again.
    </p>
  ) : null;

  if (view === "done" && results.length > 0) {
    // Files with problems in the review, and any the server refused, weren't imported.
    const notImported = [
      ...items.filter((i) => i.status === "problems").map((i) => ({ file: i.file, name: i.name, problems: i.problems })),
      ...results.flatMap((r) => (r.saved ? [] : [{ file: r.file, name: r.name, problems: r.problems }])),
    ];
    return <Done results={results} notImported={notImported} onMore={startAgain} />;
  }
  if (view === "file" && items[index]) {
    return <FileDetail item={items[index]} />;
  }
  if ((view === "review" || view === "file") && items.length > 0) {
    return (
      <Review
        items={items}
        left={left}
        onToggle={(file) =>
          setLeft((current) => {
            const next = new Set(current);
            if (next.has(file)) next.delete(file);
            else next.add(file);
            return next;
          })
        }
        onImport={importReady}
        busy={busy}
        error={error}
      />
    );
  }
  return <Start onCheck={check} busy={busy} batchProblem={batchProblem} error={error} />;
}

// --- A. Start ---

function Start({
  onCheck,
  busy,
  batchProblem,
  error,
}: {
  onCheck: (files: ImportFile[]) => void;
  busy: boolean;
  batchProblem: Problem | null;
  error: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");

  async function pick(list: FileList | null) {
    const picked = await Promise.all(
      [...(list ?? [])].map(
        async (file): Promise<ImportFile> => ({
          name: file.name,
          size: file.size,
          text: shouldRead(file.name, file.size) ? await file.text() : null,
        }),
      ),
    );
    if (input.current) input.current.value = "";
    onCheck(picked);
  }

  return (
    <main className="mx-auto max-w-xl px-5 pt-5 pb-6 md:p-6">
      <h1 className="font-display text-[28px] font-semibold">Import recipes</h1>
      <p className="mt-1 text-ink-muted">Add recipe files made by your Claude project.</p>

      {batchProblem && (
        <div role="alert" className="mt-4 rounded-card border border-danger/40 bg-danger-soft p-4">
          <p className="font-semibold text-danger flex items-center gap-2">
            <Icon name="alert" className="size-5" />
            {batchProblem.title}
          </p>
          <p className="mt-1 text-sm">{batchProblem.detail}</p>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="mt-5 w-full rounded-card border-2 border-dashed border-line bg-surface py-8 px-5 text-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      >
        <span className="mx-auto size-14 rounded-full bg-primary-soft text-primary grid place-items-center">
          <Icon name="upload" className="size-7" />
        </span>
        <span className="block mt-3 font-semibold text-lg">{busy ? "Checking…" : "Choose recipe files"}</span>
        <span className="block mt-1 text-sm text-ink-muted">.json files, up to 50 at once</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        data-testid="file-input"
        onChange={(e) => pick(e.target.files)}
      />

      <div className="my-5 flex items-center gap-3 text-sm text-ink-subtle">
        <span className="flex-1 h-px bg-line" />
        or
        <span className="flex-1 h-px bg-line" />
      </div>

      <label className="block">
        <span className="font-semibold">Paste a recipe</span>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="Paste the JSON from Claude here, starting with {"
          className="mt-2 w-full h-36 p-3 rounded-control bg-surface border border-line font-mono text-sm placeholder:text-ink-subtle focus:outline-none focus:border-primary"
        />
      </label>
      <button
        type="button"
        disabled={busy || pasted.trim() === ""}
        onClick={() => onCheck([{ name: PASTED, size: pasted.length, text: pasted }])}
        className={buttonClasses("primary", "mt-3 w-full")}
      >
        {busy ? "Checking…" : "Check recipe"}
      </button>
      {error}
    </main>
  );
}

// --- B. Review ---

function Review({
  items,
  left,
  onToggle,
  onImport,
  busy,
  error,
}: {
  items: ReviewItem[];
  left: Set<string>;
  onToggle: (file: string) => void;
  onImport: () => void;
  busy: boolean;
  error: ReactNode;
}) {
  const indexed = items.map((item, index) => ({ item, index }));
  const ready = indexed.filter(({ item }) => item.status === "new" || item.status === "update");
  const problems = indexed.filter(({ item }) => item.status === "problems");
  const unchanged = items.filter((item) => item.status === "unchanged");
  const chosen = ready.filter(({ item }) => !left.has(item.file)).length;

  return (
    <>
      <Header title={items.length === 1 ? "Check 1 file" : `Check ${items.length} files`} />
      <main className="mx-auto max-w-xl px-5 pb-28 md:pb-6">
        <p className="text-ink-muted">
          <b className="text-ink">{ready.length === 0 ? "Nothing to import." : `${ready.length} ready to import.`}</b>
          {summary(unchanged.length, problems.length)}
        </p>

        {ready.length > 0 && (
          <Section title="Ready">
            {ready.map(({ item, index }) => (
              <ReviewRow
                key={item.file}
                item={item}
                onOpen={() => window.history.pushState(null, "", `?view=file&i=${index}`)}
                ticked={!left.has(item.file)}
                onToggle={() => onToggle(item.file)}
              />
            ))}
          </Section>
        )}
        {problems.length > 0 && (
          <Section title="Problems · not imported" danger>
            {problems.map(({ item, index }) => (
              <ReviewRow key={item.file} item={item} onOpen={() => window.history.pushState(null, "", `?view=file&i=${index}`)} />
            ))}
          </Section>
        )}
        {unchanged.length > 0 && (
          <>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink-muted">Already up to date</p>
            <UnchangedNote items={unchanged} />
          </>
        )}
        {error}
      </main>
      <ActionBar>
        <button
          type="button"
          onClick={onImport}
          disabled={busy || chosen === 0}
          className={buttonClasses("primary", "w-full")}
        >
          {busy ? "Importing…" : chosen === 1 ? "Import 1 recipe" : `Import ${chosen} recipes`}
        </button>
      </ActionBar>
    </>
  );
}

function summary(unchanged: number, problems: number): string {
  const parts = [
    unchanged > 0 && `${unchanged} unchanged`,
    problems > 0 && (problems === 1 ? "1 has problems" : `${problems} have problems`),
  ].filter(Boolean);
  return parts.length > 0 ? ` ${parts.join(", ")}.` : "";
}

function Section({ title, danger = false, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <>
      <p className={cx("mt-5 text-xs font-semibold uppercase tracking-wider", danger ? "text-danger" : "text-ink-muted")}>
        {title}
      </p>
      <ul className="mt-2 space-y-2">{children}</ul>
    </>
  );
}

// --- C, D, E. One file ---

function FileDetail({ item }: { item: ReviewItem }) {
  if (item.status === "new") return <NewRecipe recipe={item.recipe} footer={<BackToList />} header={<Header pill="new" />} />;
  if (item.status === "update")
    return <UpdateDetail recipe={item.recipe} changes={item.changes} footer={<BackToList />} header={<Header pill="update" />} />;
  if (item.status === "problems")
    return (
      <>
        <Header pill="problems" />
        <main className="mx-auto max-w-xl px-5 pb-6">
          <h1 className="font-display text-[26px] leading-8 font-semibold">{item.name ?? item.file}</h1>
          {item.name && <p className="mt-1 text-sm text-ink-subtle">{item.file}</p>}
          <p className="mt-3 text-ink-muted">
            Nothing from this file was saved. Ask Claude to fix {item.problems.length === 1 ? "this" : "these"} and give
            you the file again:
          </p>
          <ProblemList problems={item.problems} />
          <CopyForClaude text={problemsForClaude(item.file, item.problems)} label="Copy problems for Claude" primary />
          <p className="mt-2 text-xs text-ink-subtle text-center">
            Copies a message listing {item.problems.length === 1 ? "the problem" : `all ${item.problems.length} problems`},
            ready to paste into your Claude project.
          </p>
        </main>
      </>
    );
  return null;
}

function BackToList() {
  return (
    <ActionBar>
      <button type="button" onClick={() => window.history.back()} className={buttonClasses("secondary", "w-full")}>
        Back to the list
      </button>
    </ActionBar>
  );
}

const pills = {
  new: { text: "New recipe", className: "bg-primary-soft text-primary" },
  update: { text: "Update", className: "bg-surface-2 text-ink border border-line" },
  problems: { text: "Not imported", className: "bg-danger-soft text-danger" },
};

/** Back arrow with a title (review) or a status pill (one file). */
function Header({ title, pill }: { title?: string; pill?: keyof typeof pills }) {
  return (
    <div className="mx-auto max-w-xl px-3 pt-3 pb-2 flex items-center gap-1">
      <button
        type="button"
        onClick={() => window.history.back()}
        aria-label="Back"
        className="size-11 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Icon name="arrow-left" className="size-6" />
      </button>
      {title && <h1 className="font-display text-[22px] font-semibold">{title}</h1>}
      {pill && (
        <span className={cx("inline-flex h-6 px-2 rounded-full text-xs font-semibold items-center", pills[pill].className)}>
          {pills[pill].text}
        </span>
      )}
    </div>
  );
}

/** The bottom actions, in place of the tab bar on phones (as on the recipe page). */
function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:left-20">
      <div className="mx-auto max-w-xl flex gap-3">{children}</div>
    </div>
  );
}

// --- F. Done ---

function Done({
  results,
  notImported,
  onMore,
}: {
  results: ImportResult[];
  notImported: { file: string; name: string | null; problems: Problem[] }[];
  onMore: () => void;
}) {
  const saved = results.filter((r) => r.saved);
  return (
    <>
      <main className="mx-auto max-w-xl px-6 pt-16 pb-32 text-center">
        <span className="mx-auto size-16 rounded-full bg-veg-soft text-veg grid place-items-center">
          <Icon name="check" className="size-8" strokeWidth={2.5} />
        </span>
        <h1 className="font-display text-[26px] font-semibold mt-5">
          {saved.length === 1 ? "1 recipe imported" : `${saved.length} recipes imported`}
        </h1>
        {saved.length > 0 && (
          <ul className="mt-5 text-left rounded-card bg-surface border border-line divide-y divide-line">
            {saved.map((r) => (
              <li key={r.file} className="px-4 py-3 flex items-center gap-3">
                <span
                  className={cx(
                    "inline-flex h-6 px-2 rounded-full text-xs font-semibold items-center",
                    r.created ? "bg-primary-soft text-primary" : "bg-surface-2 text-ink border border-line",
                  )}
                >
                  {r.created ? "New" : "Updated"}
                </span>
                <span className="flex-1 font-medium truncate">{r.name}</span>
              </li>
            ))}
          </ul>
        )}
        {notImported.length > 0 && (
          <>
            <p className="mt-4 text-sm text-danger">
              {notImported.length === 1 ? "1 file wasn't imported: " : `${notImported.length} files weren't imported: `}
              {notImported.map((f) => f.name ?? f.file).join(", ")}.
            </p>
            <CopyForClaude
              text={notImported.map((f) => problemsForClaude(f.file, f.problems)).join("\n\n")}
              label={notImported.length === 1 ? "Copy its problems for Claude" : "Copy their problems for Claude"}
            />
          </>
        )}
      </main>
      <ActionBar>
        <button type="button" onClick={onMore} className={buttonClasses("secondary", "flex-1 px-3")}>
          Import more
        </button>
        <Link href="/recipes" className={buttonClasses("primary", "flex-1 px-3")}>
          Go to recipes
        </Link>
      </ActionBar>
    </>
  );
}

function CopyForClaude({ text, label, primary = false }: { text: string; label: string; primary?: boolean }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={
          primary
            ? buttonClasses("primary", "mt-4 w-full")
            : "mt-1 text-sm font-semibold text-primary rounded-control focus-visible:outline-2 focus-visible:outline-primary"
        }
      >
        {primary && <Icon name={copied ? "check" : "copy"} className="size-5" />}
        {copied ? "Copied" : label}
      </button>
      <p role="status" className="sr-only">
        {copied === true ? "Copied" : copied === false ? "Couldn't copy. Select the problems and copy them by hand." : ""}
      </p>
    </>
  );
}
