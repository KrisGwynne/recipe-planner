"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import type { Recipe } from "@/types/recipe";
import { Sheet } from "@/components/ui/sheet";

const iconButton =
  "size-11 rounded-full grid place-items-center hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary";

/**
 * The recipe page's top bar: back, and ⋯ (design G). Compare (PP-173), delete
 * (PP-165) and the favourite heart (PP-169) join it with their tickets.
 */
export function RecipeHeader({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);

  function back() {
    // Back to the filtered library if that's where we came from.
    if (document.referrer.startsWith(window.location.origin)) router.back();
    else router.push("/recipes");
  }

  function download() {
    const blob = new Blob([`${JSON.stringify(recipe, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recipe.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenu(false);
  }

  return (
    <>
      <button type="button" onClick={back} aria-label="Back" className={iconButton}>
        <Icon name="arrow-left" className="size-6" />
      </button>
      <span className="flex-1" />
      <button type="button" onClick={() => setMenu(true)} aria-label="More" className={iconButton}>
        <svg viewBox="0 0 24 24" className="size-6 fill-current" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {menu && (
        <Sheet title={recipe.name} onClose={() => setMenu(false)}>
          <ul className="divide-y divide-line">
            <li>
              <button type="button" onClick={download} className="w-full min-h-13 py-3 flex items-center gap-3 text-left font-medium">
                <Icon name="download" className="size-5 text-ink-muted" />
                Download recipe file (.json)
              </button>
            </li>
            <li>
              <Link href="/import" className="w-full min-h-13 py-3 flex items-center gap-3 font-medium">
                <Icon name="upload" className="size-5 text-ink-muted" />
                <span>
                  Replace with a new version…
                  <span className="block text-sm font-normal text-ink-muted">
                    Import the updated file; the review shows what changes.
                  </span>
                </span>
              </Link>
            </li>
          </ul>
          <button type="button" onClick={() => setMenu(false)} className="mt-3 w-full h-12 rounded-control font-semibold hover:bg-surface-2">
            Cancel
          </button>
        </Sheet>
      )}
    </>
  );
}
