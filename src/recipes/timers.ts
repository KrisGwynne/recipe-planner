/**
 * Step timers (PP-178, recipe design D). A running timer stores when it ends,
 * not how long is left, so it shows the right time after the phone has been
 * locked or the tab hidden, however long the browser paused it for.
 */
export type StepTimer =
  | { state: "running"; endsAt: number }
  | { state: "paused"; leftMs: number }
  | { state: "finished" };

export function startTimer(mins: number, now: number): StepTimer {
  return { state: "running", endsAt: now + mins * 60_000 };
}

export function pauseTimer(timer: StepTimer, now: number): StepTimer {
  return timer.state === "running" ? { state: "paused", leftMs: Math.max(0, timer.endsAt - now) } : timer;
}

export function resumeTimer(timer: StepTimer, now: number): StepTimer {
  return timer.state === "paused" ? { state: "running", endsAt: now + timer.leftMs } : timer;
}

/** Milliseconds left: 0 once finished. */
export function timeLeft(timer: StepTimer, now: number): number {
  if (timer.state === "running") return Math.max(0, timer.endsAt - now);
  if (timer.state === "paused") return timer.leftMs;
  return 0;
}

/**
 * Finishes every running timer whose time is up. Returns the same map when
 * nothing changed (so React skips the update), and the steps that just finished.
 */
export function finishDue(timers: Map<number, StepTimer>, now: number): { timers: Map<number, StepTimer>; finished: number[] } {
  const finished = [...timers].filter(([, t]) => t.state === "running" && t.endsAt <= now).map(([step]) => step);
  if (finished.length === 0) return { timers, finished };
  const next = new Map(timers);
  for (const step of finished) next.set(step, { state: "finished" });
  return { timers: next, finished };
}

/** "12:41", or "1:05:00" from an hour up. Rounds up, so it reads 0:01 until it's done. */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** A spoken version for screen readers: "12 minutes 41 seconds". */
export function spokenClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const parts: [number, string][] = [
    [Math.floor(total / 3600), "hour"],
    [Math.floor((total % 3600) / 60), "minute"],
    [total % 60, "second"],
  ];
  const words = parts.filter(([n]) => n > 0).map(([n, unit]) => `${n} ${unit}${n === 1 ? "" : "s"}`);
  return words.length > 0 ? words.join(" ") : "0 seconds";
}
