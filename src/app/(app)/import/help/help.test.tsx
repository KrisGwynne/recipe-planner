import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import HelpPage from "./page";

const instructions = readFileSync("claude-project/instructions.md", "utf8");

async function renderHelp(query: Record<string, string> = {}) {
  render(<ToastProvider>{await HelpPage({ searchParams: Promise.resolve(query) })}</ToastProvider>);
}

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(writeText) }, configurable: true });
  return navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
}

afterEach(() => vi.useRealTimers());

describe("help: turning a photo into a recipe file (PP-179)", () => {
  it("sets up once, then each recipe (A to C)", async () => {
    await renderHelp();
    expect(screen.getByRole("heading", { level: 1, name: "Turn a photo into a recipe file" })).toBeInTheDocument();

    const setUp = screen.getByRole("region", { name: "Set up once" });
    expect(within(setUp).getByText(/Easiest on a computer/)).toBeInTheDocument();
    expect(within(setUp).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Create a Claude project",
      "Paste in the instructions",
      "Add three files to the project",
      "Try it with one recipe",
    ]);
    const claude = within(setUp).getByRole("link", { name: /Open Claude.ai/ });
    expect(claude).toHaveAttribute("href", "https://claude.ai/projects");
    expect(claude).toHaveAttribute("target", "_blank");

    const each = screen.getByRole("region", { name: "Each recipe" });
    expect(within(each).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Send Claude a photo",
      "Check what it guessed",
      "Bring it into the app",
      "Review and import",
    ]);
    expect(within(each).getByLabelText("An example reply")).toHaveTextContent("Guessed:");

    const off = screen.getByRole("region", { name: "When something's off" });
    expect(within(off).getAllByRole("heading", { level: 3 })).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Import a recipe" })).toHaveAttribute("href", "/import");
  });

  it("downloads the three files from the app (B)", async () => {
    await renderHelp();
    const links = screen.getAllByRole("link", { name: /Download$/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/import/help/recipe.schema.json",
      "/import/help/lemony-tuna-tomato-caper-pasta.json",
      "/import/help/char-siu-tofoo-noodles.json",
    ]);
    expect(links[0]).toHaveAttribute("download", "recipe.schema.json");
    expect(links[0]).toHaveTextContent("The rules every recipe file follows");
  });

  it("goes back to Import (A)", async () => {
    await renderHelp();
    expect(screen.getByRole("link", { name: "Back to Import" })).toHaveAttribute("href", "/import");
  });

  it("goes back to Recipes when opened from the empty library (A)", async () => {
    await renderHelp({ from: "recipes" });
    expect(screen.getByRole("link", { name: "Back to Recipes" })).toHaveAttribute("href", "/recipes");
  });

  it("copies the whole instructions, says so, then the button resets (D)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const writeText = mockClipboard(async () => {});
    await renderHelp();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy instructions" })));
    expect(writeText).toHaveBeenCalledWith(instructions);
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(screen.getByText("Instructions copied")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole("button", { name: "Copy instructions" })).toBeInTheDocument();
  });

  it("shows and hides the instructions (D)", async () => {
    await renderHelp();
    const toggle = screen.getByRole("button", { name: "Show the instructions" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("The instructions")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Hide the instructions");
    expect(screen.getByLabelText("The instructions").textContent).toBe(instructions);

    fireEvent.click(toggle);
    expect(screen.queryByLabelText("The instructions")).not.toBeInTheDocument();
  });

  it("opens the instructions to copy by hand when copying fails", async () => {
    mockClipboard(async () => {
      throw new Error("denied");
    });
    await renderHelp();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy instructions" })));
    expect(screen.getByText(/Couldn't copy/)).toBeInTheDocument();
    expect(screen.getByLabelText("The instructions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy instructions" })).toBeInTheDocument();
  });
});
