import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunTrace } from './sim/types';
import { INITIAL_PLAYBACK, finish, isFinished, nextStage, viewFor, withCountdown, type PlaybackState } from './playbackState';

/**
 * Plays a precomputed trace back on an accelerated clock. Stage durations are display pacing for
 * readability; the simulated timings are shown as labels. The reply delay counts down 20× faster
 * than real time, and "Send now" skips it, as in the admin console.
 */

export const DELAY_ACCELERATION = 20;

export interface Playback {
  /** Index of the stage currently running; stages.length when finished. */
  stage: number;
  /** Simulated seconds remaining in the scheduled delay (only while the schedule stage runs). */
  countdown: number | null;
  done: boolean;
  sendNow: () => void;
  skipAll: () => void;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function stageDisplayMs(simMs: number, skipped: boolean): number {
  if (reducedMotion()) return skipped ? 40 : 160;
  if (skipped) return 120;
  return 380 + Math.min(simMs / 5, 1100);
}

export function usePlayback(run: RunTrace | null, onDone: (run: RunTrace) => void): Playback {
  const [state, setState] = useState<PlaybackState>(INITIAL_PLAYBACK);
  const timer = useRef<number | null>(null);
  const doneFor = useRef<string | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Derived per run: a new run reads as stage 0 even before the state has been replaced.
  const { stage, countdown } = viewFor(state, run?.id ?? null);
  const finished = !!run && isFinished(state, run.id, run.stages.length);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clear, []);

  useEffect(() => {
    if (!run) return;
    if (finished) {
      if (doneFor.current !== run.id) {
        doneFor.current = run.id;
        onDoneRef.current(run);
      }
      return;
    }
    const id = run.id;
    const s = run.stages[stage]!;
    if (s.id === 'schedule' && s.status === 'ok') {
      const total = Math.round(s.simMs / 1000);
      const start = countdown ?? total;
      if (countdown === null) setState((p) => withCountdown(p, id, total));
      if (start <= 0) {
        timer.current = window.setTimeout(() => setState((p) => nextStage(p, id)), 200);
        return clear;
      }
      const tick = reducedMotion() ? 1000 / 60 : 1000 / DELAY_ACCELERATION;
      timer.current = window.setTimeout(() => setState((p) => withCountdown(p, id, start - 1)), tick);
      return clear;
    }
    timer.current = window.setTimeout(() => setState((p) => nextStage(p, id)), stageDisplayMs(s.simMs, s.status === 'skip'));
    return clear;
  }, [run, stage, countdown, finished]);

  const sendNow = useCallback(() => {
    if (run) setState((p) => withCountdown(p, run.id, 0));
  }, [run]);
  const skipAll = useCallback(() => {
    if (!run) return;
    clear();
    setState(finish(run.id, run.stages.length));
  }, [run]);

  return { stage, countdown: finished ? null : countdown, done: finished, sendNow, skipAll };
}
