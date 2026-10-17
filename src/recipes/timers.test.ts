import { describe, expect, it } from "vitest";
import { clock, finishDue, pauseTimer, resumeTimer, spokenClock, startTimer, timeLeft, type StepTimer } from "./timers";

const MIN = 60_000;

describe("step timers", () => {
  it("counts down from when it ends, so a locked phone still shows the right time", () => {
    const timer = startTimer(5, 1_000);
    expect(timeLeft(timer, 1_000)).toBe(5 * MIN);
    // Ten minutes later (the tab was hidden), it's simply done.
    expect(timeLeft(timer, 1_000 + 10 * MIN)).toBe(0);
  });

  it("pauses and resumes with the time that was left", () => {
    const paused = pauseTimer(startTimer(5, 0), 2 * MIN);
    expect(paused).toEqual({ state: "paused", leftMs: 3 * MIN });
    expect(timeLeft(paused, 60 * MIN)).toBe(3 * MIN);
    const resumed = resumeTimer(paused, 60 * MIN);
    expect(timeLeft(resumed, 61 * MIN)).toBe(2 * MIN);
  });

  it("finishes the running timers that are due, and only those", () => {
    const timers = new Map<number, StepTimer>([
      [0, startTimer(1, 0)],
      [1, startTimer(5, 0)],
      [2, pauseTimer(startTimer(1, 0), 0)],
    ]);
    const { timers: next, finished } = finishDue(timers, MIN);
    expect(finished).toEqual([0]);
    expect(next.get(0)).toEqual({ state: "finished" });
    expect(next.get(1)?.state).toBe("running");
    expect(next.get(2)?.state).toBe("paused");
    // Nothing more due: the same map back, so nothing re-renders.
    expect(finishDue(next, MIN).timers).toBe(next);
  });

  it("handles fractional minutes", () => {
    expect(timeLeft(startTimer(0.5, 0), 0)).toBe(30_000);
  });
});

describe("clock", () => {
  it("shows minutes and seconds, rounding up", () => {
    expect(clock(12 * MIN + 41_000)).toBe("12:41");
    expect(clock(400)).toBe("0:01");
    expect(clock(0)).toBe("0:00");
    expect(clock(65 * MIN)).toBe("1:05:00");
  });

  it("has a spoken version", () => {
    expect(spokenClock(12 * MIN + 41_000)).toBe("12 minutes 41 seconds");
    expect(spokenClock(MIN)).toBe("1 minute");
    expect(spokenClock(61 * MIN)).toBe("1 hour 1 minute");
    expect(spokenClock(0)).toBe("0 seconds");
  });
});
