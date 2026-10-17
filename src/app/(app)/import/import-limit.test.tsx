import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vitest";
import { checkFile } from "@/recipes/check-files";
import type { ImportFile } from "@/recipes/review";
import type { ImportResponse } from "./actions";

// An import big enough to need several requests, where a later one goes over
// the hourly limit (PP-163). Each file is its own request here.
vi.mock("@/recipes/review", async (original) => ({
  ...(await original<typeof import("@/recipes/review")>()),
  inRequests: <T,>(files: T[]) => files.map((f) => [f]),
}));
vi.mock("next/navigation", () => {
  const listeners = new Set<() => void>();
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      original(...args);
      listeners.forEach((l) => l());
    };
  }
  const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)) };
});

const { ImportFlow } = await import("./import-flow");

const text = (slug: string) => readFileSync(`examples/${slug}.json`, "utf8");
const files = [
  { name: "char-siu-tofoo-noodles.json", text: text("char-siu-tofoo-noodles") },
  { name: "lemony-tuna.json", text: text("lemony-tuna-tomato-caper-pasta") },
];

describe("the hourly limit partway through an import", () => {
  it("keeps what was saved and says when to try the rest", async () => {
    const review = vi.fn(async (picked: ImportFile[]) => picked.map((f) => checkFile(f, new Map())));
    const save = vi
      .fn<(picked: ImportFile[]) => Promise<ImportResponse>>()
      .mockResolvedValueOnce({
        results: [{ file: files[0].name, saved: true, id: "id-1", slug: "char-siu-tofoo-noodles", name: "Char siu Tofoo noodles", created: true }],
      })
      .mockResolvedValueOnce({ results: [], limited: { retryMinutes: 25 } });
    window.history.replaceState(null, "", "/import");
    render(<ImportFlow review={review} save={save} />);
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: files.map((f) => new File([f.text], f.name, { type: "application/json" })) },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Import 2 recipes" }));
    expect(await screen.findByRole("heading", { name: "1 recipe imported" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Too many imports for nowYou've imported a lot in the last hour. 1 recipe was saved; try the rest again in about 25 minutes.",
    );
    // A limit isn't a problem with the file, so there's nothing to copy for Claude.
    expect(screen.queryByText(/wasn't imported/)).not.toBeInTheDocument();
  });
});
