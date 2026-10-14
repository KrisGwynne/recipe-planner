"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { Step } from "./step";

/** How long Copy instructions says "Copied", in milliseconds. */
const COPIED_MS = 3000;

/**
 * Step 2, paste in the instructions (help design A and D): Copy puts the
 * whole text on the clipboard; "Show the instructions" opens it below the
 * step in its own scrolling box. If copying fails, the text opens so it can
 * be selected by hand.
 */
export function InstructionsStep({ n, instructions }: { n: number; instructions: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);
  const boxId = useId();

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(instructions);
      setCopied(true);
      toast("Instructions copied");
    } catch {
      setShown(true);
      toast("Couldn't copy. Select the instructions below and copy them.");
    }
  }

  return (
    <Step
      n={n}
      title="Paste in the instructions"
      action={
        <button
          type="button"
          onClick={copy}
          className="h-11 px-4 rounded-control border border-line bg-surface hover:bg-surface-2 font-semibold inline-flex items-center gap-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary"
        >
          {copied ? (
            <Icon name="check" className="size-5 text-veg" strokeWidth={2.5} />
          ) : (
            <Icon name="copy" className="size-5" />
          )}
          {copied ? "Copied" : "Copy instructions"}
        </button>
      }
      after={
        shown && (
          <pre
            id={boxId}
            tabIndex={0}
            aria-label="The instructions"
            className="mt-3 max-h-[420px] overflow-auto rounded-control bg-surface-2 p-3 text-xs leading-relaxed text-ink-muted font-sans whitespace-pre-wrap focus-visible:outline-2 focus-visible:outline-primary"
          >
            {instructions}
          </pre>
        )
      }
    >
      <p className="mt-1 text-sm text-ink-muted">
        They tell Claude exactly what file to make. Open the project&apos;s instructions and paste these in.
      </p>
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={shown ? boxId : undefined}
        onClick={() => setShown((s) => !s)}
        className="mt-1 h-11 rounded-control text-primary text-sm font-semibold inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-primary"
      >
        {shown ? "Hide the instructions" : "Show the instructions"}
        <Icon name="chevron-down" className={shown ? "size-4 rotate-180" : "size-4"} />
      </button>
    </Step>
  );
}
