import { describe, expect, it } from 'vitest';
import { INITIAL_PLAYBACK, finish, isFinished, nextStage, viewFor, withCountdown } from './playbackState';

describe('playback state', () => {
  it('a new run does not inherit the previous run finished stage', () => {
    const done = finish('run-1', 12);
    expect(isFinished(done, 'run-1', 12)).toBe(true);
    expect(isFinished(done, 'run-2', 12)).toBe(false);
    expect(viewFor(done, 'run-2')).toEqual({ stage: 0, countdown: null });
  });

  it('a delayed update for the new run starts from stage 0, not the old stage', () => {
    const s = nextStage(finish('run-1', 12), 'run-2');
    expect(s).toEqual({ runId: 'run-2', stage: 1, countdown: null });
    expect(isFinished(s, 'run-2', 12)).toBe(false);
  });

  it('stale countdown from another run is ignored', () => {
    const s = withCountdown(INITIAL_PLAYBACK, 'run-1', 30);
    expect(viewFor(s, 'run-1').countdown).toBe(30);
    expect(viewFor(s, 'run-2').countdown).toBeNull();
    expect(withCountdown(s, 'run-2', 5)).toEqual({ runId: 'run-2', stage: 0, countdown: 5 });
  });

  it('finishes only at the final stage of the same run', () => {
    let s = INITIAL_PLAYBACK;
    for (let i = 0; i < 12; i++) {
      expect(isFinished(s, 'r', 12)).toBe(false);
      s = nextStage(s, 'r');
    }
    expect(isFinished(s, 'r', 12)).toBe(true);
    expect(isFinished(INITIAL_PLAYBACK, 'r', 0)).toBe(false);
  });
});
