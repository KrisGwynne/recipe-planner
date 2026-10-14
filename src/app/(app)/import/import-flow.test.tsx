import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkFile } from "@/recipes/check-files";
import type { ImportFile } from "@/recipes/review";
import type { Recipe } from "@/types/recipe";
import type { ImportResult } from "./actions";

// Next keeps useSearchParams in step with history.pushState; this does the same in jsdom.
vi.mock("next/navigation", () => {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      original(...args);
      notify();
    };
  }
  window.addEventListener("popstate", notify);
  const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
  return {
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)),
  };
});

const { ImportFlow } = await import("./import-flow");

// jsdom changes import.meta.url, so read from the project root.
const text = (slug: string) => readFileSync(`examples/${slug}.json`, "utf8");
const tunaText = text("lemony-tuna-tomato-caper-pasta");
const tofooText = text("char-siu-tofoo-noodles");
const tuna = (): Recipe => JSON.parse(tunaText);

// The real checks, against a pretend saved library holding the tuna pasta.
const saved = new Map<string, Recipe>([[tuna().id, tuna()]]);
const review = vi.fn(async (files: ImportFile[]) => files.map((f) => checkFile(f, saved)));
const save = vi.fn(
  async (files: ImportFile[]): Promise<ImportResult[]> =>
    files.map((f, i) => ({ file: f.name, saved: true, id: `id-${i}`, slug: JSON.parse(f.text!).id, name: JSON.parse(f.text!).name, created: !f.name.includes("tuna") })),
);

const changedTuna = () => {
  const recipe = tuna();
  recipe.times.cook_mins = 25;
  return JSON.stringify(recipe);
};
const broken = JSON.stringify({ ...JSON.parse(tofooText), id: "smoked-mackerel-bake", name: "Smoked mackerel bake", proteins: [{ category: "meat", item: "mackerel" }] });

function pick(files: { name: string; text: string }[]) {
  const input = screen.getByTestId("file-input");
  fireEvent.change(input, { target: { files: files.map((f) => new File([f.text], f.name, { type: "application/json" })) } });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/import");
  review.mockClear();
  save.mockClear();
});

describe("import flow", () => {
  it("start: files or paste (A)", () => {
    render(<ImportFlow review={review} save={save} />);
    expect(screen.getByRole("heading", { name: "Import recipes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Choose recipe files/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check recipe" })).toBeDisabled();
    expect(screen.getByRole("link", { name: /New here\?/ })).toHaveAttribute("href", "/import/help");
  });

  it("reviews a mixed batch, then imports the ticked ones (B, F)", async () => {
    render(<ImportFlow review={review} save={save} />);
    pick([
      { name: "char-siu-tofoo-noodles.json", text: tofooText },
      { name: "lemony-tuna.json", text: changedTuna() },
      { name: "smoked-mackerel-bake.json", text: broken },
    ]);
    expect(await screen.findByRole("heading", { name: "Check 3 files" })).toBeInTheDocument();
    expect(screen.getByText("2 ready to import.")).toBeInTheDocument();
    expect(screen.getByText(/1 has problems/)).toBeInTheDocument();
    expect(screen.getByText("Serves 2 · 55 min · ~825 kcal · Veg")).toBeInTheDocument();
    expect(screen.getByText("1 thing changes · your notes and rating are kept")).toBeInTheDocument();
    expect(screen.getByText("1 problem to fix in Claude")).toBeInTheDocument();

    // Leave the update out.
    fireEvent.click(screen.getByRole("checkbox", { name: `Import ${tuna().name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Import 1 recipe" }));

    expect(await screen.findByRole("heading", { name: "1 recipe imported" })).toBeInTheDocument();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].map((f) => f.name)).toEqual(["char-siu-tofoo-noodles.json"]);
    expect(screen.getByText(/1 file wasn't imported: Smoked mackerel bake/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Char siu Tofoo noodles/ })).toHaveAttribute("href", "/recipes/char-siu-tofoo-noodles");
    expect(screen.getByRole("link", { name: "Go to recipes" })).toHaveAttribute("href", "/recipes");
  });

  it("a new recipe's details (C)", async () => {
    render(<ImportFlow review={review} save={save} />);
    pick([{ name: "char-siu-tofoo-noodles.json", text: tofooText }]);
    fireEvent.click(await screen.findByRole("button", { name: "Char siu Tofoo noodles" }));
    expect(await screen.findByText("New recipe")).toBeInTheDocument();
    expect(screen.getByText("15 prep · 10 cook · 30 waiting = 55 min")).toBeInTheDocument();
    expect(screen.getByText("Vegetarian · Dairy-free · Nut-free")).toBeInTheDocument();
    expect(screen.getByText("Greens, Rice")).toBeInTheDocument();
  });

  it("previews the full recipe page before saving (C)", async () => {
    render(<ImportFlow review={review} save={save} />);
    pick([{ name: "char-siu-tofoo-noodles.json", text: tofooText }]);
    fireEvent.click(await screen.findByRole("button", { name: "Char siu Tofoo noodles" }));
    fireEvent.click(await screen.findByRole("button", { name: "See the full recipe" }));
    expect(await screen.findByText("Preview · not saved yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Char siu Tofoo noodles" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Ingredients" })).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it("an update's changes (D)", async () => {
    render(<ImportFlow review={review} save={save} />);
    pick([{ name: "lemony-tuna.json", text: changedTuna() }]);
    fireEvent.click(await screen.findByRole("button", { name: tuna().name }));
    expect(await screen.findByText("1 thing changes:")).toBeInTheDocument();
    const times = screen.getByText("Times").closest("li")!;
    // Cook 30 → 25 min, total 35 → 30 min.
    expect(within(times).getByText("35 min")).toHaveClass("line-through");
    expect(within(times).getByText("25 min").tagName).toBe("B");
    expect(times).toHaveTextContent("Cook: 30 min → 25 min");
    expect(screen.getByText(/Kept: favourite, rating/)).toBeInTheDocument();
  });

  it("a file with problems, and copying them for Claude (E)", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<ImportFlow review={review} save={save} />);
    pick([{ name: "smoked-mackerel-bake.json", text: broken }]);
    fireEvent.click(await screen.findByRole("button", { name: "Smoked mackerel bake" }));
    expect(await screen.findByText("Not imported")).toBeInTheDocument();
    expect(screen.getByText("Mackerel is listed as meat")).toBeInTheDocument();
    expect(screen.getByText("proteins[0]")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy problems for Claude" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('The recipe file "smoked-mackerel-bake.json" didn\'t import');
  });

  it("back from a file's details returns to the list", async () => {
    render(<ImportFlow review={review} save={save} />);
    pick([{ name: "char-siu-tofoo-noodles.json", text: tofooText }]);
    fireEvent.click(await screen.findByRole("button", { name: "Char siu Tofoo noodles" }));
    await screen.findByText("New recipe");
    act(() => window.history.replaceState(null, "", "?view=review"));
    expect(await screen.findByRole("heading", { name: "Check 1 file" })).toBeInTheDocument();
  });

  it("unchanged files are skipped", async () => {
    render(<ImportFlow review={review} save={save} />);
    pick([{ name: "tuna.json", text: tunaText }]);
    expect(await screen.findByText("Nothing to import.")).toBeInTheDocument();
    expect(screen.getByText(`${tuna().name}: identical to the saved recipe, skipped.`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 0 recipes" })).toBeDisabled();
  });

  it("pastes one recipe", async () => {
    render(<ImportFlow review={review} save={save} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Paste a recipe" }), { target: { value: tofooText } });
    fireEvent.click(screen.getByRole("button", { name: "Check recipe" }));
    expect(await screen.findByRole("heading", { name: "Check 1 file" })).toBeInTheDocument();
    expect(review.mock.calls[0][0]).toEqual([{ name: "Pasted recipe", size: tofooText.length, text: tofooText }]);
  });

  it("too many files (I), checking nothing", async () => {
    render(<ImportFlow review={review} save={save} />);
    pick(Array.from({ length: 51 }, (_, i) => ({ name: `${i}.json`, text: "{}" })));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many files");
    expect(review).not.toHaveBeenCalled();
  });

  it("doesn't read files that aren't .json", async () => {
    render(<ImportFlow review={review} save={save} />);
    pick([{ name: "IMG_2041.jpg", text: "binary" }]);
    expect(await screen.findByText("IMG_2041.jpg isn't a recipe file")).toBeInTheDocument();
    expect(review.mock.calls[0][0][0].text).toBeNull();
  });

  it("says so if the server can't be reached", async () => {
    review.mockRejectedValueOnce(new Error("offline"));
    render(<ImportFlow review={review} save={save} />);
    pick([{ name: "char-siu-tofoo-noodles.json", text: tofooText }]);
    expect(await screen.findByRole("alert")).toHaveTextContent("nothing was saved");
  });
});
