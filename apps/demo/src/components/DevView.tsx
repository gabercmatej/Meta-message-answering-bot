import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Dict } from '../i18n';
import { entry } from '../sim/knowledge';
import type { Lang, RunTrace, StageId, StageStatus } from '../sim/types';
import { STAGES } from '../stages';
import { Icon } from './Icon';

type Tab = 'timeline' | 'event' | 'classification' | 'knowledge' | 'attempts';
const TABS: Tab[] = ['timeline', 'event', 'classification', 'knowledge', 'attempts'];

type Lane = 'api' | 'worker' | 'delivery';
const LANE_LABEL: Record<Lane, string> = { api: 'API', worker: 'Worker', delivery: 'Delivery' };
const STAGE_LANE: Record<StageId, Lane> = { webhook: 'api', signature: 'api', normalize: 'api', context: 'worker', intent: 'worker', legal_area: 'worker', retrieval: 'worker', generate: 'worker', validate: 'worker', schedule: 'delivery', publish: 'delivery', confirm: 'delivery' };
const STATUS_ICON: Record<StageStatus, string> = { ok: 'check', warn: 'alert', fail: 'x', hold: 'person', skip: 'more' };

/** Minimal JSON syntax highlighter (keys, strings, numbers, literals) without dependencies. */
export function highlight(value: unknown, depth = 0): ReactNode {
  const pad = '  '.repeat(depth);
  if (value === null || value === undefined) return <span className="j-lit">null</span>;
  if (typeof value === 'string') return <span className="j-str">{JSON.stringify(value)}</span>;
  if (typeof value === 'number') return <span className="j-num">{value}</span>;
  if (typeof value === 'boolean') return <span className="j-lit">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return (
      <>
        {'[\n'}
        {value.map((v, i) => (
          <span key={i}>{pad}  {highlight(v, depth + 1)}{i < value.length - 1 ? ',' : ''}{'\n'}</span>
        ))}
        {pad}{']'}
      </>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';
  return (
    <>
      {'{\n'}
      {entries.map(([k, v], i) => (
        <span key={k}>{pad}  <span className="j-key">{JSON.stringify(k)}</span>{': '}{highlight(v, depth + 1)}{i < entries.length - 1 ? ',' : ''}{'\n'}</span>
      ))}
      {pad}{'}'}
    </>
  );
}

function CopyBtn({ text, t }: { text: string; t: Dict }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="copy-btn"
      onClick={() => {
        try {
          void navigator.clipboard?.writeText(text).then(() => setDone(true)).catch(() => setDone(true));
        } catch {
          setDone(true);
        }
        window.setTimeout(() => setDone(false), 1400);
      }}
    >
      <Icon name={done ? 'check' : 'copy'} size={13} />{done ? t.devView.copied : t.devView.copy}
    </button>
  );
}

function CodeBlock({ title, value, t, open = true }: { title: string; value: unknown; t: Dict; open?: boolean }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <details className="coll" open={open}>
      <summary><Icon name="chevron-down" size={14} /><span>{title}</span><em className="when-closed">{t.devView.expand}</em><em className="when-open">{t.devView.collapse}</em></summary>
      <div className="code-wrap"><CopyBtn text={text} t={t} /><pre className="code">{highlight(value)}</pre></div>
    </details>
  );
}

interface Ev {
  id: string;
  kind: 'stage' | 'transition';
  lane: Lane;
  time: number;
  title: string;
  subtitle: string;
  status: StageStatus | 'tr';
  subsystem: string;
  facts: ReadonlyArray<readonly [string, string]>;
  payload: unknown;
  from?: string | null;
  to?: string;
}

function payloadFor(run: RunTrace, id: StageId): unknown {
  switch (id) {
    case 'webhook': return run.webhookPayload;
    case 'normalize': return run.normalizedEvent;
    case 'context': return { history: run.input.history, textForModel: run.normalizedEvent.textForModel };
    case 'intent':
    case 'legal_area': return run.classification;
    case 'retrieval': return run.retrieved;
    case 'generate': return { replySource: run.replySource, route: run.routeCode, replyText: run.replyText };
    case 'validate': return run.validators;
    case 'schedule': return { delaySeconds: run.input.delaySeconds, route: run.routeCode, reasonCodes: run.reasonCodes };
    case 'publish': return run.attempts;
    case 'confirm': return { finalState: run.finalState, repliesDelivered: run.repliesDelivered, transitions: run.transitions.slice(-3) };
    default: return { signature: 'X-Hub-Signature-256 (simulated)', verifiedOver: 'original request bytes' };
  }
}

function buildEvents(run: RunTrace): Ev[] {
  const out: Ev[] = [];
  let clock = 0;
  run.stages.forEach((s, i) => {
    const meta = STAGES.find((m) => m.id === s.id)!;
    out.push({ id: `s${i}`, kind: 'stage', lane: STAGE_LANE[s.id], time: clock, title: meta.title, subtitle: s.summary, status: s.status, subsystem: meta.subsystem, facts: s.facts, payload: payloadFor(run, s.id) });
    clock += s.simMs;
    run.transitions.filter((tr) => tr.stage === i).forEach((tr, j) => {
      out.push({ id: `t${i}-${j}`, kind: 'transition', lane: STAGE_LANE[s.id], time: tr.simMs, title: tr.audit, subtitle: `${tr.from ?? '∅'} → ${tr.to}${tr.reason ? ` · ${tr.reason}` : ''}`, status: 'tr', subsystem: 'reply_item state machine', facts: [['from', tr.from ?? 'null'], ['to', tr.to], ['reason', tr.reason ?? '—']], payload: tr, from: tr.from, to: tr.to });
    });
  });
  return out;
}

function interesting(evs: Ev[]): string {
  const odd = evs.find((e) => e.kind === 'stage' && (e.status === 'warn' || e.status === 'fail' || e.status === 'hold'));
  if (odd) return odd.id;
  const retr = evs.find((e) => e.kind === 'stage' && e.title === 'Knowledge retrieved' && e.status === 'ok');
  return (retr ?? evs[0]!).id;
}

export function DevView({ t, lang, run }: { t: Dict; lang: Lang; run: RunTrace | null }) {
  const [tab, setTab] = useState<Tab>('timeline');
  return (
    <section className="devview" aria-label={t.devView.title} data-devview>
      <div className="dev-head">
        <h3><Icon name="code" size={16} />{t.devView.title}{run && <span className="run-id mono">{run.id}</span>}</h3>
        <div className="tabs" role="tablist">
          {TABS.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t.devView.tabs[k]}</button>
          ))}
        </div>
      </div>
      <div className="dev-body">{!run ? <p className="empty">{t.devView.noTrace}</p> : <Body tab={tab} t={t} lang={lang} run={run} />}</div>
    </section>
  );
}

function Timeline({ run, t }: { run: RunTrace; t: Dict }) {
  const evs = useMemo(() => buildEvents(run), [run]);
  const [sel, setSel] = useState(() => interesting(evs));
  useEffect(() => setSel(interesting(evs)), [evs]);
  const cur = evs.find((e) => e.id === sel) ?? evs[0]!;
  return (
    <div className="split">
      <div className="pane-l">
        <p className="dev-note">{t.devView.simTime}: representative mock timing, not a measurement.</p>
        <ol className="timeline" role="listbox" aria-label="Timeline">
          {evs.map((e) => (
            <li key={e.id} role="option" aria-selected={e.id === sel}>
              <button className={`tl-row ${e.kind === 'transition' ? 'tr' : `st-${e.status}`} ${e.id === sel ? 'sel' : ''}`} data-lane={e.lane} onClick={() => setSel(e.id)}>
                <span className="tl-time mono">{(e.time / 1000).toFixed(2)}s</span>
                <span className={`lane-badge lane-${e.lane}`}>{LANE_LABEL[e.lane]}</span>
                {e.kind === 'stage' ? <span className="tl-ico"><Icon name={STATUS_ICON[e.status as StageStatus]} size={12} /></span> : <span className="tl-ico tr"><Icon name="chevron-right" size={12} /></span>}
                <span className="tl-main">
                  {e.kind === 'stage' ? <><strong>{e.title}</strong><span>{e.subtitle}</span></> : <span className="mono tr-line"><span className="audit">{e.title}</span> <span className={`state-text s-${e.from ?? 'new'}`}>{e.from ?? '∅'}</span> → <span className={`state-text s-${e.to}`}>{e.to}</span></span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <aside className="pane-r" aria-label={t.devView.inspector}>
        <div className="insp-head">
          <span className={`lane-badge lane-${cur.lane}`}>{LANE_LABEL[cur.lane]}</span>
          <strong>{cur.kind === 'stage' ? cur.title : cur.title}</strong>
          {cur.status !== 'tr' && <span className={`chip st-chip-${cur.status}`}>{cur.status}</span>}
          <span className="mono insp-time">{(cur.time / 1000).toFixed(2)}s</span>
        </div>
        <p className="insp-sub">{cur.subsystem} · {cur.subtitle}</p>
        {cur.facts.length > 0 && (
          <>
            <h5>{t.devView.facts}</h5>
            <dl className="insp-facts">{cur.facts.map(([k, v], i) => <div key={`${k}${i}`}><dt>{k}</dt><dd className="mono">{v}</dd></div>)}</dl>
          </>
        )}
        <h5>{t.devView.payload}</h5>
        <div className="code-wrap"><CopyBtn text={JSON.stringify(cur.payload, null, 2)} t={t} /><pre className="code">{highlight(cur.payload)}</pre></div>
      </aside>
    </div>
  );
}

function Body({ tab, t, lang, run }: { tab: Tab; t: Dict; lang: Lang; run: RunTrace }) {
  if (tab === 'timeline') return <Timeline run={run} t={t} />;
  if (tab === 'event') {
    return (
      <div className="panel-stack">
        <CodeBlock title={t.devView.normalized} value={run.normalizedEvent} t={t} />
        <CodeBlock title={t.devView.webhook} value={run.webhookPayload} t={t} open={false} />
      </div>
    );
  }
  if (tab === 'classification') {
    const c = run.classification;
    return (
      <div className="cls">
        <dl className="kvlist">
          {([['topic', c.topic], ['intent', c.intent], ['legalArea', c.legalArea], ['risk', c.risk], ['needsLawyer', String(c.needsLawyer)], ['language', c.language], ['fromContext', String(c.fromContext)], ['route', run.routeCode], ['action', run.action]] as const).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd className="mono">{v}</dd></div>
          ))}
        </dl>
        <div className="chips-block"><h5>{t.devView.signals}</h5><div className="chips">{c.signals.length ? c.signals.map((s) => <span key={s} className="chip mono">{s}</span>) : <span className="chip dim">none</span>}</div></div>
        <div className="chips-block"><h5>{t.devView.matched}</h5><div className="chips">{c.matchedTerms.length ? c.matchedTerms.map((s) => <span key={s} className="chip mono">{s}</span>) : <span className="chip dim">none</span>}</div></div>
        <div className="chips-block"><h5>Reason codes</h5><div className="chips">{run.reasonCodes.map((s) => <span key={s} className="chip mono">{s}</span>)}</div></div>
      </div>
    );
  }
  if (tab === 'knowledge') {
    return (
      <div className="kn">
        {run.retrieved.length === 0 && <p className="empty">{t.results.noKnowledge}</p>}
        {run.retrieved.map((r) => {
          const e = entry(r.id);
          return (
            <article key={r.id} className={`kn-card ${r.cited ? 'cited' : ''}`}>
              <header><span className="mono">{r.id}</span><b>v{r.version}</b><span className="chip mono">score {r.score}</span><span className={`chip ${r.cited ? 'ok' : 'dim'}`}>{r.cited ? t.results.cited : t.results.notCited}</span></header>
              <p>{e.body[lang]}</p>
            </article>
          );
        })}
        {run.validators.length > 0 && (
          <div className="chips-block">
            <h5>{t.devView.validators}</h5>
            <ul className="validators">{run.validators.map((v) => <li key={v.code} className={v.passed ? 'ok' : 'bad'}><Icon name={v.passed ? 'check' : 'x'} size={13} /><span className="mono">{v.code}</span><em>{v.passed ? t.devView.pass : t.devView.failw}</em></li>)}</ul>
          </div>
        )}
      </div>
    );
  }
  return run.attempts.length === 0 ? (
    <p className="empty">{t.devView.noAttempts}</p>
  ) : (
    <div className="attempts">
      {run.attempts.map((a) => (
        <article key={a.attemptNo} className={`attempt res-${a.result}`}>
          <header><strong>#{a.attemptNo}</strong><span className={`chip mono res-${a.result}`}>{a.result}</span><span className="mono">{a.endpoint}</span><span className="mono dim">{(a.simMs / 1000).toFixed(2)}s</span></header>
          <dl><div><dt>{t.devView.idem}</dt><dd className="mono">{a.idempotencyKey}</dd></div><div><dt>Meta id</dt><dd className="mono">{a.metaMessageId ?? '—'}</dd></div></dl>
        </article>
      ))}
      {run.finalState === 'reconciled_sent' && <p className="dev-note">outcome_unknown → read-back found the reply → reconciled_sent (no second write).</p>}
      {run.attempts.some((a) => a.result === 'timeout_unknown') && run.finalState === 'sent' && <p className="dev-note">outcome_unknown → read-back: absent → resend scheduled → attempt 2 confirmed.</p>}
      {run.attempts.some((a) => a.result === 'rate_limited') && <p className="dev-note">429 → exponential backoff → retry with a new idempotency key.</p>}
    </div>
  );
}
