import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Recipe } from "@/types/recipe";
import { RecipeView } from "./recipe-view";

// jsdom changes import.meta.url, so read from the project root. The tuna
// pasta's steps have timers of 7, 15, 5, none and 5 minutes.
const tuna: Recipe = JSON.parse(readFileSync("examples/lemony-tuna-tomato-caper-pasta.json", "utf8"));

const show = () => render(<RecipeView recipe={tuna} header={<span>header</span>} />);
const method = () => within(screen.getByRole("region", { name: "Method" }));
const step = (n: number) => document.getElementById(`step-${n}`)!;
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T18:00:00Z"));
  Object.defineProperty(navigator, "vibrate", { value: vi.fn(), configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("step timers (recipe design D, PP-178)", () => {
  it("offers a timer on each step that has one", () => {
    show();
    expect(method().getAllByRole("button", { name: /timer$/ }).map((b) => b.textContent)).toEqual([
      "7 min timer",
      "15 min timer",
      "5 min timer",
      "5 min timer",
    ]);
    expect(within(step(4)).queryByRole("button", { name: /timer/ })).not.toBeInTheDocument();
  });

  it("counts down, pauses, resumes and stops", async () => {
    show();
    fireEvent.click(within(step(3)).getByRole("button", { name: "5 min timer" }));
    expect(step(3)).toHaveTextContent("5:00");
    await wait(61_000);
    expect(step(3)).toHaveTextContent("3:59");
    expect(step(3)).toHaveTextContent("3 minutes 59 seconds left");

    fireEvent.click(within(step(3)).getByRole("button", { name: "Pause" }));
    await wait(120_000);
    expect(step(3)).toHaveTextContent("3:59");
    expect(step(3)).toHaveTextContent("left, paused");

    fireEvent.click(within(step(3)).getByRole("button", { name: "Resume" }));
    await wait(59_000);
    expect(step(3)).toHaveTextContent("3:00");

    fireEvent.click(within(step(3)).getByRole("button", { name: "Stop" }));
    expect(within(step(3)).getByRole("button", { name: "5 min timer" })).toBeInTheDocument();
  });

  it("runs several at once, and tapping a timer doesn't tick off its step", async () => {
    show();
    fireEvent.click(within(step(1)).getByRole("button", { name: "7 min timer" }));
    await wait(60_000);
    fireEvent.click(within(step(2)).getByRole("button", { name: "15 min timer" }));
    await wait(1_000);
    expect(step(1)).toHaveTextContent("5:59");
    expect(step(2)).toHaveTextContent("14:59");
    expect(within(step(1)).getByRole("button", { name: /Heat the oil/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("rings, buzzes and says so when time's up; tapping clears it", async () => {
    show();
    fireEvent.click(within(step(5)).getByRole("button", { name: "5 min timer" }));
    await wait(5 * 60_000);
    const done = within(step(5)).getByRole("button", { name: "Time's up, 5 min. Clear" });
    expect(done).toHaveTextContent("Time's up · 5 min");
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Step 5: time's up")).toBeInTheDocument();

    fireEvent.click(done);
    expect(within(step(5)).getByRole("button", { name: "5 min timer" })).toBeInTheDocument();
  });

  it("shows the right time after the phone was locked (acceptance criteria)", async () => {
    show();
    fireEvent.click(within(step(3)).getByRole("button", { name: "5 min timer" }));
    // A hidden page's intervals are throttled or stopped: the clock jumps on without them.
    act(() => vi.setSystemTime(Date.now() + 2 * 60_000));
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(step(3)).toHaveTextContent("3:00");

    act(() => vi.setSystemTime(Date.now() + 10 * 60_000));
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(within(step(3)).getByRole("button", { name: /Time's up/ })).toBeInTheDocument();
  });

  it("puts timers whose step is off screen in a pill that scrolls back to it", async () => {
    let report: IntersectionObserverCallback = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          report = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    show();
    fireEvent.click(within(step(2)).getByRole("button", { name: "15 min timer" }));
    expect(screen.queryByRole("button", { name: /Show$/ })).not.toBeInTheDocument();

    act(() => report([{ target: step(2), isIntersecting: false } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
    const pill = screen.getByRole("button", { name: /^Step 2.*Show$/ });
    expect(pill).toHaveTextContent("15:00");
    const scroll = vi.fn();
    step(2).scrollIntoView = scroll;
    fireEvent.click(pill);
    expect(scroll).toHaveBeenCalled();

    act(() => report([{ target: step(2), isIntersecting: true } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.queryByRole("button", { name: /^Step 2.*Show$/ })).not.toBeInTheDocument();
  });

  it("keeps the screen on once a timer starts, where the browser can (acceptance criteria)", async () => {
    const release = vi.fn(async () => {});
    const request = vi.fn(async () => ({ release }));
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    show();
    const keepOn = screen.getByRole("switch", { name: "Keep screen on" });
    expect(keepOn).toHaveAttribute("aria-checked", "false");

    fireEvent.click(within(step(3)).getByRole("button", { name: "5 min timer" }));
    await act(async () => {});
    expect(keepOn).toHaveAttribute("aria-checked", "true");
    expect(request).toHaveBeenCalledWith("screen");

    fireEvent.click(keepOn);
    await act(async () => {});
    expect(keepOn).toHaveAttribute("aria-checked", "false");
    expect(release).toHaveBeenCalled();
  });

  it("has no Keep screen on switch where the browser can't keep it on", () => {
    show();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
