import type { ReactNode } from 'react';
import type { Dict } from '../i18n';
import { AREA_LABEL, INTENT_LABEL, routePhrase, soft } from '../labels';
import { routeSummary } from '../route';
import { entry } from '../sim/knowledge';
import type { Lang, Risk, RunTrace } from '../sim/types';
import { Tip } from './common';
import { Icon } from './Icon';

const RISK_ORDER: Risk[] = ['low', 'medium', 'high', 'critical'];

function Card({ title, icon, i, children, wide, id }: { title: string; icon: string; i: number; children: ReactNode; wide?: boolean; id: string }) {
  return (
    <section className={`rcard ${wide ? 'wide' : ''}`} data-card={id} style={{ ['--d' as string]: `${i * 70}ms` }}>
      <h4><Icon name={icon} size={14} />{title}</h4>
      {children}
    </section>
  );
}

export function Results({ t, lang, runs, selected, onSelect, onReplay }: { t: Dict; lang: Lang; runs: RunTrace[]; selected: number; onSelect: (i: number) => void; onReplay: () => void }) {
  const run = runs[selected];
  if (!run) return null;
  const cls = run.classification;
  const riskIdx = RISK_ORDER.indexOf(cls.risk);
  const sent = run.repliesDelivered === 1;
  const confirmed = run.attempts.find((a) => a.metaMessageId);
  const eligible = run.action === 'reply' || run.action === 'clarify';
  const summary = routeSummary(run);
  const codes = [run.routeCode, ...run.reasonCodes.filter((c) => c !== run.routeCode)].slice(0, 4);
  return (
    <section className="results" aria-label={t.results.title} data-results key={run.id}>
      <div className="results-head">
        <h3>{t.results.title}</h3>
        <div className="turns" role="tablist" aria-label={t.results.turn}>
          {runs.map((r, i) => (
            <button key={r.id} role="tab" aria-selected={i === selected} className={i === selected ? 'on' : ''} onClick={() => onSelect(i)}>
              {t.results.turn} {i + 1}
            </button>
          ))}
        </div>
        <button className="ghost-btn" onClick={onReplay}><Icon name="restart" size={14} />{t.results.replayRoute}</button>
      </div>
      <div className="rgrid">
        <Card id="intent" title={t.results.intent} icon="target" i={0}>
          <div className="big">{INTENT_LABEL[lang][cls.intent]}</div>
          <div className="idline mono">{soft(cls.intent)}</div>
        </Card>
        <Card id="area" title={t.results.area} icon="scroll" i={1}>
          <div className="big">{AREA_LABEL[lang][cls.legalArea]}</div>
          <div className="idline mono">{soft(cls.legalArea)}{cls.needsLawyer ? ` · ${t.results.needsLawyer.toLowerCase()}` : ''}</div>
        </Card>
        <Card id="risk" title={t.results.risk} icon="alert" i={2}>
          <div className={`meter r-${cls.risk}`} role="img" aria-label={`${t.results.risk}: ${t.results.riskSteps[riskIdx]}`}>
            {RISK_ORDER.map((r, i) => <span key={r} className={i <= riskIdx ? 'on' : ''} />)}
          </div>
          <div className="big risk-word">{t.results.riskSteps[riskIdx]}</div>
          {lang === 'sl' && <div className="idline mono">{cls.risk}</div>}
        </Card>
        <Card id="policy" title={t.results.policy} icon="gate" i={3}>
          <div className={`pill-line ${eligible ? 'ok' : run.action === 'skip' ? 'muted' : 'hold'}`}>{eligible ? t.results.eligible : run.action === 'skip' ? t.results.skipped : t.results.notEligible}</div>
          <div className="kv"><span>{t.results.tier}</span><b>{eligible ? t.results.tierAuto : t.results.tierHuman}</b></div>
          <div className="codes">{codes.map((c) => <span key={c} className="rchip mono">{soft(c)}</span>)}</div>
        </Card>
        <Card id="route" title={t.results.route} icon="send" i={4} wide>
          <ol className="route-sum">
            {summary.map((s, i) => <li key={s}>{routePhrase(s, lang)}{i < summary.length - 1 && <Icon name="chevron-right" size={12} />}</li>)}
          </ol>
          {run.replySource && <div className="sub">{t.results.standIn}</div>}
        </Card>
        <Card id="knowledge" title={t.results.knowledge} icon="db" i={5}>
          {run.retrieved.length === 0 ? (
            <div className="sub">{t.results.noKnowledge}</div>
          ) : (
            <div className="kchips">
              {run.retrieved.map((r) => (
                <Tip key={r.id} className={`kchip ${r.cited ? 'cited' : ''}`} text={`${entry(r.id).title[lang]} · ${r.cited ? t.results.cited : t.results.notCited}`}>
                  <span className="mono">{soft(r.id.replace('kb.', ''))}</span><b>v{r.version}</b><em>{r.score}</em>
                </Tip>
              ))}
            </div>
          )}
        </Card>
        <Card id="delivery" title={t.results.delivery} icon="check-circle" i={6}>
          <div className="kv"><span>{t.results.attempts}</span><b>{run.attempts.length || '—'}</b></div>
          <div className="kv"><span>{t.results.finalState}</span><b className={`state-text s-${run.finalState}`}>{run.finalState}</b></div>
          <div className="kv"><span>{t.results.confirmedBy}</span><b className="mono">{sent ? (confirmed ? `${t.results.writeId} ${confirmed.metaMessageId}` : t.results.readBack) : t.results.none}</b></div>
        </Card>
      </div>
    </section>
  );
}
