import { useState } from 'react';
import { KNOWLEDGE } from '../sim/knowledge';
import type { Lang, RunTrace } from '../sim/types';
import { fmtMs } from './Pipeline';
import { Icon } from './Icon';

interface Props {
  run: RunTrace | null;
  stage: number;
  lang: Lang;
}

const AREA_LABEL: Record<string, string> = {
  delovno: 'Employment',
  druzinsko: 'Family',
  dedno: 'Inheritance',
  stvarno_nepremicnine: 'Property & tenancy',
  potrosnisko: 'Consumer',
  obligacijsko_pogodbe: 'Contracts',
  drugo: 'Other legal area',
  ni_pravno: 'Not a legal question'
};

const SOURCE_LABEL = { ai_draft: 'AI draft (simulated)', approved_fallback: 'Approved fallback text', approved_text: 'Approved fixed text' } as const;

/** Index of a stage id in the twelve-stage pipeline (used to reveal facts progressively). */
const AT = { intent: 4, retrieval: 6, generate: 7, schedule: 9, confirm: 11 } as const;

export function Inspector({ run, stage, lang }: Props) {
  const [tab, setTab] = useState<'decision' | 'developer'>('decision');
  const seen = (i: number) => !!run && stage > i;

  return (
    <section className="panel inspector" aria-label="Inspector">
      <div className="panel-head tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'decision'} className={tab === 'decision' ? 'on' : ''} onClick={() => setTab('decision')}>
          <Icon name="layers" size={14} /> Decision
        </button>
        <button role="tab" aria-selected={tab === 'developer'} className={tab === 'developer' ? 'on' : ''} onClick={() => setTab('developer')}>
          <Icon name="code" size={14} /> Developer view
        </button>
      </div>
      {tab === 'decision' ? <Decision run={run} seen={seen} lang={lang} /> : <Developer run={run} stage={stage} />}
    </section>
  );
}

function Decision({ run, seen, lang }: { run: RunTrace | null; seen: (i: number) => boolean; lang: Lang }) {
  const cls = run?.classification;
  const retrieved = new Map((run?.retrieved ?? []).map((r) => [r.id, r]));
  const showRetrieval = seen(AT.retrieval);
  return (
    <div className="insp-body">
      <div className="kv-grid">
        <KV label="Intent" value={seen(AT.intent) ? cls?.intent : undefined} mono wide />
        <KV label="Legal area" value={seen(AT.intent) && cls ? AREA_LABEL[cls.legalArea] : undefined} sub={seen(AT.intent) ? cls?.legalArea : undefined} />
        <KV label="Risk" value={seen(AT.intent) ? cls?.risk : undefined} pill={cls?.risk} />
        <KV label="Action" value={seen(AT.generate) ? run?.action : undefined} mono />
        <KV label="Route" value={seen(AT.generate) ? run?.routeCode : undefined} mono wide />
        <KV label="Reply source" value={seen(AT.generate) && run?.replySource ? SOURCE_LABEL[run.replySource] : seen(AT.generate) ? 'none' : undefined} wide />
      </div>
      {seen(AT.intent) && cls && cls.signals.length > 0 && (
        <div className="codes">
          {cls.signals.map((s) => (
            <code key={s}>{s}</code>
          ))}
        </div>
      )}

      <div className="label-row">
        <span className="eyebrow">Knowledge (active release)</span>
        <span className="tag-fict">fictional demo facts</span>
      </div>
      <ul className="kb">
        {[...KNOWLEDGE]
          .sort((a, b) => rank(retrieved.get(b.id), showRetrieval) - rank(retrieved.get(a.id), showRetrieval))
          .map((k) => {
          const r = showRetrieval ? retrieved.get(k.id) : undefined;
          return (
            <li key={k.id} className={`kb-card ${r ? (r.cited ? 'cited' : 'hit') : ''}`}>
              <div className="kb-top">
                <span className="kb-type">{k.type.replace(/_/g, ' ')}</span>
                <code>
                  {k.id}@{k.version}
                </code>
                {r && <span className="kb-badge">{r.cited ? 'cited' : 'retrieved'}</span>}
              </div>
              <strong>{k.title[lang]}</strong>
              <p>{k.body[lang]}</p>
            </li>
          );
        })}
      </ul>

      <div className="label-row">
        <span className="eyebrow">Reply-item states</span>
      </div>
      <ol className="timeline">
        {(run?.transitions ?? [])
          .filter((t) => seen(t.stage))
          .map((t, i) => (
            <li key={i}>
              <span className={`state-pill st-${t.to}`}>{t.to}</span>
              <span className="tl-audit">{t.audit}</span>
              <span className="tl-time">T+{fmtMs(t.simMs) === '—' ? '0' : fmtMs(t.simMs)}</span>
              {t.reason && <code className="tl-reason">{t.reason}</code>}
            </li>
          ))}
        {!run && <li className="muted">No message yet.</li>}
      </ol>
    </div>
  );
}

/** Cited entries first, then retrieved ones, then the rest (stable). */
function rank(r: { cited: boolean } | undefined, shown: boolean): number {
  if (!shown || !r) return 0;
  return r.cited ? 2 : 1;
}

function KV({ label, value, sub, mono, wide, pill }: { label: string; value: string | undefined; sub?: string | undefined; mono?: boolean; wide?: boolean; pill?: string | undefined }) {
  return (
    <div className={`kv ${wide ? 'wide' : ''}`}>
      <span className="k">{label}</span>
      {value === undefined ? (
        <span className="v placeholder" />
      ) : pill ? (
        <span className={`risk r-${pill}`}>{value}</span>
      ) : (
        <span className={`v ${mono ? 'mono' : ''}`}>
          {value}
          {sub && <small>{sub}</small>}
        </span>
      )}
    </div>
  );
}

type DevTab = 'event' | 'classification' | 'decision' | 'dispatch' | 'webhook';

function Developer({ run, stage }: { run: RunTrace | null; stage: number }) {
  const [tab, setTab] = useState<DevTab>('event');
  if (!run) return <div className="insp-body muted pad">Send a message to inspect its normalized event, classification, decision and dispatch records.</div>;
  const done = stage >= run.stages.length;
  const data: Record<DevTab, unknown> = {
    webhook: run.webhookPayload,
    event: run.normalizedEvent,
    classification: { ...run.classification, note: 'Deterministic demo matcher, standing in for a schema-validated model call.' },
    decision: {
      action: run.action,
      routeCode: run.routeCode,
      reasonCodes: run.reasonCodes,
      replySource: run.replySource,
      retrievedKnowledge: run.retrieved.map((r) => `${r.id}@${r.version}${r.cited ? ' (cited)' : ''}`),
      validators: Object.fromEntries(run.validators.map((v) => [v.code, v.passed ? 'pass' : 'fail'])),
      replyText: run.replyText
    },
    dispatch: {
      attempts: run.attempts,
      transitions: run.transitions,
      duplicate: run.duplicate,
      repliesDelivered: done ? run.repliesDelivered : 'pending',
      invariant: 'One reply intent per inbound item; each attempt has its own idempotency key; at most one open attempt.'
    }
  };
  return (
    <div className="insp-body dev">
      <div className="dev-tabs" role="tablist">
        {(['event', 'classification', 'decision', 'dispatch', 'webhook'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'webhook' ? 'raw webhook' : t}
          </button>
        ))}
      </div>
      <pre className="json" tabIndex={0}>
        <JsonView value={data[tab]} />
      </pre>
      <p className="foot-note">Synthetic records shaped like the production tables. No hidden reasoning is shown because none exists here: the system records reason codes and source IDs, not chain-of-thought.</p>
    </div>
  );
}

function JsonView({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2) ?? 'null';
  const parts = text.split(/("(?:\\.|[^"\\])*"(?:\s*:)?|\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        const cls = p.endsWith(':') ? 'j-key' : p.startsWith('"') ? 'j-str' : p === 'null' || p === 'true' || p === 'false' ? 'j-lit' : 'j-num';
        return (
          <span key={i} className={cls}>
            {p}
          </span>
        );
      })}
    </>
  );
}
