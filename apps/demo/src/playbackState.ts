/**
 * Pure playback state. Stage and countdown are always tagged with the run they belong to, so a
 * freshly started run can never inherit the previous run's finished stage index.
 */
export interface PlaybackState {
  runId: string | null;
  stage: number;
  countdown: number | null;
}

export const INITIAL_PLAYBACK: PlaybackState = { runId: null, stage: 0, countdown: null };

/** The state as seen by `runId`: stale state from another run reads as the start of this run. */
export function viewFor(s: PlaybackState, runId: string | null): { stage: number; countdown: number | null } {
  return runId !== null && s.runId === runId ? { stage: s.stage, countdown: s.countdown } : { stage: 0, countdown: null };
}

function own(s: PlaybackState, runId: string): PlaybackState {
  return s.runId === runId ? s : { runId, stage: 0, countdown: null };
}

export const nextStage = (s: PlaybackState, runId: string): PlaybackState => {
  const o = own(s, runId);
  return { runId, stage: o.stage + 1, countdown: null };
};

export const withCountdown = (s: PlaybackState, runId: string, countdown: number | null): PlaybackState => ({ ...own(s, runId), countdown });

export const finish = (runId: string, stages: number): PlaybackState => ({ runId, stage: stages, countdown: null });

/** True only when the state belongs to this run and has reached the final stage. */
export function isFinished(s: PlaybackState, runId: string, stages: number): boolean {
  return s.runId === runId && s.stage >= stages;
}
