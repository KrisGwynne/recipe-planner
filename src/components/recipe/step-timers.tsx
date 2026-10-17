"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icon";
import { cx } from "@/lib/cx";
import { formatMinutes } from "@/lib/format";
import {
  clock,
  finishDue,
  pauseTimer,
  resumeTimer,
  spokenClock,
  startTimer,
  timeLeft,
  type StepTimer,
} from "@/recipes/timers";

// Step timers and Keep screen on (PP-178, recipe design D, foundations' timer
// states). Timers last for the visit, like the step ticks. A running timer
// keeps its end time, and the page catches up whenever it's shown again, so a
// locked phone or a hidden tab still shows the right time.

const TICK_MS = 250;

export type StepTimers = ReturnType<typeof useStepTimers>;

export function useStepTimers() {
  const [timers, setTimersState] = useState<Map<number, StepTimer>>(() => new Map());
  const current = useRef(timers);
  const [now, setNow] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  // null until you touch the switch: the first timer then turns it on.
  const [keepOn, setKeepOn] = useState<boolean | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const setTimers = useCallback((next: Map<number, StepTimer>) => {
    current.current = next;
    setTimersState(next);
  }, []);

  const change = (step: number, timer: StepTimer | null) => {
    const next = new Map(current.current);
    if (timer) next.set(step, timer);
    else next.delete(step);
    setTimers(next);
  };

  // Catch up: finish what's due, ring for it, and redraw the clocks.
  const tick = useCallback(() => {
    const t = Date.now();
    setNow(t);
    const { timers: next, finished } = finishDue(current.current, t);
    if (finished.length === 0) return;
    setTimers(next);
    ring(audio.current);
    setAnnouncement(finished.map((step) => `Step ${step + 1}: time's up`).join(". "));
  }, [setTimers]);

  const running = [...timers.values()].some((t) => t.state === "running");
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(tick, TICK_MS);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [running, tick]);

  return {
    timers,
    now,
    announcement,
    keepOn: keepOn === true,
    setKeepOn: (on: boolean) => setKeepOn(on),
    start(step: number, mins: number) {
      // A tap is the only time a browser lets the page get ready to make a sound.
      audio.current = primeAudio(audio.current);
      const t = Date.now();
      setNow(t);
      change(step, startTimer(mins, t));
      setKeepOn((on) => on ?? true);
    },
    pause: (step: number) => withTimer(step, (timer, t) => change(step, pauseTimer(timer, t))),
    resume: (step: number) => withTimer(step, (timer, t) => change(step, resumeTimer(timer, t))),
    /** Stop a timer, or clear its "Time's up". */
    clear: (step: number) => change(step, null),
  };

  function withTimer(step: number, act: (timer: StepTimer, now: number) => void) {
    const timer = current.current.get(step);
    if (!timer) return;
    const t = Date.now();
    setNow(t);
    act(timer, t);
  }
}

function primeAudio(existing: AudioContext | null): AudioContext | null {
  if (existing) {
    void existing.resume();
    return existing;
  }
  if (typeof AudioContext === "undefined") return null;
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

/** Three short beeps and a buzz, where the phone allows. No sound file, so nothing for the CSP to allow. */
function ring(audio: AudioContext | null) {
  navigator.vibrate?.([300, 150, 300, 150, 300]);
  if (!audio) return;
  void audio.resume();
  const start = audio.currentTime;
  for (let i = 0; i < 3; i++) {
    const at = start + i * 0.35;
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.frequency.value = 880;
    volume.gain.setValueAtTime(0.0001, at);
    volume.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    tone.connect(volume).connect(audio.destination);
    tone.start(at);
    tone.stop(at + 0.25);
  }
}

/**
 * While `on`, asks the browser to keep the screen awake. The browser lets go
 * whenever the page is hidden, so it asks again each time the page is shown.
 * Returns whether the browser can do it at all (the switch hides if not).
 */
export function useWakeLock(on: boolean): boolean {
  // False on the server and in the first render, so hydration matches.
  const supported = useSyncExternalStore(
    noSubscribe,
    () => "wakeLock" in navigator,
    () => false,
  );

  useEffect(() => {
    if (!on || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // Refused (low battery, or not allowed): the screen just sleeps as usual.
      }
    };
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [on, supported]);

  return supported;
}

const noSubscribe = () => () => {};

/** "Keep screen on" (design D), beside the Method heading. */
export function KeepScreenOn({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 min-h-11 text-sm text-ink-muted rounded-control focus-visible:outline-2 focus-visible:outline-primary"
    >
      Keep screen on
      <span className={cx("w-10 h-6 rounded-full relative transition-colors", on ? "bg-primary" : "bg-line")} aria-hidden="true">
        <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]", on ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

/** One step's timer, in foundations' three states: ready (outline), running (solid), finished (amber). */
export function StepTimerControl({ step, mins, timers }: { step: number; mins: number; timers: StepTimers }) {
  const timer = timers.timers.get(step);
  const label = `${formatMinutes(mins)} timer`;

  if (!timer) {
    return (
      <button
        type="button"
        onClick={() => timers.start(step, mins)}
        className="mt-2 h-11 px-4 rounded-full border border-primary text-primary font-semibold inline-flex items-center gap-2 hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name="timer" className="size-5" />
        {label}
      </button>
    );
  }

  if (timer.state === "finished") {
    return (
      <button
        type="button"
        onClick={() => timers.clear(step)}
        aria-label={`Time's up, ${formatMinutes(mins)}. Clear`}
        className="mt-2 h-11 px-4 rounded-full bg-warning-soft text-warning font-semibold inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
      >
        <Icon name="timer" className="size-5" />
        Time&apos;s up · {formatMinutes(mins)}
      </button>
    );
  }

  const left = timeLeft(timer, timers.now);
  const paused = timer.state === "paused";
  return (
    <div className={cx("mt-2 inline-flex items-center gap-1 h-11 pl-4 pr-1 rounded-full", paused ? "bg-surface-2 text-ink" : "bg-primary text-on-primary")}>
      <span className="text-lg font-semibold tabular-nums mr-2" aria-hidden="true">
        {clock(left)}
      </span>
      <span className="sr-only">
        {spokenClock(left)} left{paused ? ", paused" : ""}
      </span>
      <button
        type="button"
        onClick={() => (paused ? timers.resume(step) : timers.pause(step))}
        aria-label={paused ? "Resume" : "Pause"}
        className={cx("size-9 rounded-full grid place-items-center focus-visible:outline-2 focus-visible:outline-current", paused ? "bg-line" : "bg-white/20")}
      >
        <Icon name={paused ? "play" : "pause"} className="size-5" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={() => timers.clear(step)}
        aria-label="Stop"
        className={cx("size-9 rounded-full grid place-items-center focus-visible:outline-2 focus-visible:outline-current", paused ? "bg-line" : "bg-white/20")}
      >
        <Icon name="x" className="size-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/**
 * Timers whose step is off screen, in pills above the action bar (design D).
 * Tapping one scrolls back to its step. Soonest first; finished ones on top.
 */
export function TimerPills({ steps, timers, onShow }: { steps: number[]; timers: StepTimers; onShow: (step: number) => void }) {
  if (steps.length === 0) return null;
  const order = (step: number) => {
    const timer = timers.timers.get(step);
    return !timer || timer.state === "finished" ? -1 : timeLeft(timer, timers.now);
  };
  const sorted = [...steps].sort((a, b) => order(a) - order(b));
  return (
    <div className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-stretch gap-2 md:left-24 md:right-auto md:w-80">
      {sorted.map((step) => {
        const timer = timers.timers.get(step);
        if (!timer) return null;
        const finished = timer.state === "finished";
        const left = timeLeft(timer, timers.now);
        return (
          <button
            key={step}
            type="button"
            onClick={() => onShow(step)}
            className={cx(
              "h-12 px-4 rounded-full flex items-center gap-3 shadow-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              finished ? "bg-warning-soft text-warning font-semibold" : "bg-ink text-bg",
            )}
          >
            <Icon name="timer" className="size-5 shrink-0" />
            <span className="text-sm">Step {step + 1}</span>
            {finished ? (
              <span>Time&apos;s up</span>
            ) : (
              <span className="font-semibold tabular-nums">
                <span aria-hidden="true">{clock(left)}</span>
                <span className="sr-only">{spokenClock(left)} left</span>
                {timer.state === "paused" && <span className="ml-1 text-sm font-normal opacity-70">paused</span>}
              </span>
            )}
            <span className="ml-auto text-sm opacity-70">Show</span>
          </button>
        );
      })}
    </div>
  );
}
