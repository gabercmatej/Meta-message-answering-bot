import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INITIAL_PLAYBACK, isFinished, type PlaybackState } from './playbackState';
import { idleView, viewAt, viewSignature, type GraphView, type Timeline } from './route';

/**
 * Plays a compiled route timeline on one requestAnimationFrame clock. The clock only ever advances
 * a simulated time `t`; the whole graph state is a pure function of it (`viewAt`), so pause, speed
 * and replay are trivial and cannot desynchronise the graph from the chat. React state changes only
 * when the discrete view changes; packet motion is pushed to subscribers every frame.
 *
 * Run scoping: every snapshot is tagged with the play key it belongs to, so a freshly started run
 * can never inherit the previous run's finished state (see playbackState.ts).
 */

export interface Playback {
  view: GraphView;
  finished: boolean;
  paused: boolean;
  speed: 1 | 0.5;
  setSpeed: (s: 1 | 0.5) => void;
  togglePause: () => void;
  skip: () => void;
  /** Per-frame subscription for the packet renderer. Returns an unsubscribe function. */
  subscribe: (cb: (view: GraphView) => void) => () => void;
}

interface Snap {
  key: string;
  view: GraphView;
  sig: string;
}

export function usePlayback(playKey: string | null, tl: Timeline | null, opts: { delaySeconds: number; autoplay: boolean; onDone: (key: string) => void }): Playback {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeedState] = useState<1 | 0.5>(1);
  const pausedRef = useRef(false);
  const speedRef = useRef<1 | 0.5>(1);
  const tRef = useRef(0);
  const viewRef = useRef<GraphView>(idleView());
  const listeners = useRef(new Set<(v: GraphView) => void>());
  const onDoneRef = useRef(opts.onDone);
  onDoneRef.current = opts.onDone;
  const skipFlag = useRef(false);

  const { delaySeconds, autoplay } = opts;

  useEffect(() => {
    if (!playKey || !tl) {
      setSnap(null);
      return;
    }
    let raf = 0;
    let last = performance.now();
    let sig = '';
    let finishedKey = false;
    tRef.current = autoplay ? 0 : tl.total;
    skipFlag.current = false;
    pausedRef.current = false;
    setPaused(false);

    const emit = (view: GraphView) => {
      viewRef.current = view;
      for (const cb of listeners.current) cb(view);
      const s = viewSignature(view);
      if (s !== sig) {
        sig = s;
        setSnap({ key: playKey, view, sig: s });
      }
    };
    const frame = (now: number) => {
      const dt = Math.min(now - last, 80);
      last = now;
      if (skipFlag.current) {
        tRef.current = tl.total;
        skipFlag.current = false;
      } else if (!pausedRef.current) tRef.current += dt * speedRef.current;
      const view = viewAt(tl, tRef.current, { delaySeconds });
      emit(view);
      if (view.done) {
        if (!finishedKey) {
          finishedKey = true;
          if (autoplay) onDoneRef.current(playKey);
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    if (!autoplay) {
      emit(viewAt(tl, tl.total, { delaySeconds }));
      return;
    }
    emit(viewAt(tl, 0, { delaySeconds }));
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playKey, tl, autoplay, delaySeconds]);

  const setSpeed = useCallback((s: 1 | 0.5) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);
  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);
  const skip = useCallback(() => {
    skipFlag.current = true;
    pausedRef.current = false;
    setPaused(false);
  }, []);
  const subscribe = useCallback((cb: (v: GraphView) => void) => {
    listeners.current.add(cb);
    cb(viewRef.current);
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  const current = snap && snap.key === playKey ? snap.view : null;
  const view = current ?? idleView();
  const laneCount = tl ? tl.steps.filter((s) => s.lane === 0).length : 0;
  const pb: PlaybackState = useMemo(() => (snap ? { runId: snap.key, stage: snap.view.done ? laneCount : snap.view.stage, countdown: snap.view.countdown } : INITIAL_PLAYBACK), [snap, laneCount]);
  const finished = !!playKey && !!tl && isFinished(pb, playKey, laneCount);

  return { view, finished, paused, speed, setSpeed, togglePause, skip, subscribe };
}
