import { useState } from 'react';
import type { RunTrace } from '../sim/types';
import { STAGES } from '../stages';
import { Icon } from './Icon';

interface Props {
  run: RunTrace | null;
  stage: number;
  countdown: number | null;
  onSendNow: () => void;
  onSkip: () => void;
}

export function fmtMs(ms: number): string {
  if (ms === 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
}

const STATUS_ICON = { ok: 'check', warn: 'alert', fail: 'x', hold: 'pause', skip: 'skip' } as const;

export function Pipeline({ run, stage, countdown, onSendNow, onSkip }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const done = !!run && stage >= run.stages.length;
  let clock = 0;

  return (
    <section className="panel pipeline" id="pipeline" tabIndex={-1} aria-label="Decision pipeline">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Decision pipeline</span>
          <h2>{run ? (done ? 'Run complete' : 'Processing…') : 'Waiting for a message'}</h2>
        </div>
        {run && !done && (
          <button className="ghost small" onClick={onSkip}>
            Skip animation
          </button>
        )}
        {run && done && <span className={`state-pill st-${run.finalState}`}>{run.finalState}</span>}
      </div>

      <ol className="stages">
        {STAGES.map((meta, i) => {
          const res = run?.stages[i];
          const state = !run || !res ? 'idle' : i < stage ? res.status : i === stage ? 'running' : 'queued';
          const startAt = clock;
          if (res) clock += res.simMs;
          const isSched = meta.id === 'schedule' && state === 'running' && countdown !== null;
          const total = res ? Math.round(res.simMs / 1000) : 0;
          const expanded = open === meta.id && (state !== 'idle' && state !== 'queued');
          return (
            <li key={meta.id} className={`stage s-${state}`}>
              <div className="rail" aria-hidden="true">
                <span className="dot">
                  {state === 'running' ? <span className="spin" /> : state in STATUS_ICON ? <Icon name={STATUS_ICON[state as keyof typeof STATUS_ICON]} size={12} /> : <span className="n">{i + 1}</span>}
                </span>
              </div>
              <button className="stage-body" onClick={() => setOpen(open === meta.id ? null : meta.id)} aria-expanded={expanded} disabled={state === 'idle' || state === 'queued'}>
                <div className="stage-top">
                  <span className="stage-title">{meta.title}</span>
                  <span className="sub">{meta.subsystem}</span>
                  <span className="time">{res && state !== 'idle' && state !== 'queued' && state !== 'running' ? <>T+{fmtMs(startAt) === '—' ? '0' : fmtMs(startAt)} · {fmtMs(res.simMs)}</> : state === 'running' ? 'running' : ''}</span>
                </div>
                {res && state !== 'idle' && state !== 'queued' && state !== 'running' && <p className="summary">{res.summary}</p>}
                {state === 'idle' && <p className="summary muted">{meta.explain.split('. ')[0]}.</p>}
                {isSched && (
                  <div className="countdown" onClick={(e) => e.stopPropagation()}>
                    <div className="cd-top">
                      <span>
                        <Icon name="clock" size={13} /> Sends in <strong>{countdown}</strong> s <span className="muted">(simulated, ×20)</span>
                      </span>
                      <span role="button" tabIndex={0} className="link" onClick={onSendNow} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSendNow()}>
                        Send now
                      </span>
                    </div>
                    <div className="bar">
                      <span style={{ width: `${total ? ((total - (countdown ?? 0)) / total) * 100 : 100}%` }} />
                    </div>
                  </div>
                )}
                {expanded && res && (
                  <div className="facts">
                    <p className="explain">{meta.explain}</p>
                    {res.facts.length > 0 && (
                      <dl>
                        {res.facts.map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="foot-note">Timings are representative mock values. Click a finished stage for details.</p>
    </section>
  );
}
