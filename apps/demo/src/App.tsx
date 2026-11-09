import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TipProvider } from './components/common';
import { DevView } from './components/DevView';
import { Icon } from './components/Icon';
import { Comments } from './components/mocks/Comments';
import { Dm } from './components/mocks/Dm';
import type { ConvItem, DeliveryStatus } from './components/mocks/types';
import { Results } from './components/Results';
import { Suggestions } from './components/Suggestions';
import { TopBar } from './components/TopBar';
import { ArchGraph, describeWhere } from './graph/ArchGraph';
import { useReducedMotion } from './hooks';
import { DICT } from './i18n';
import { buildRoute, compileTimeline } from './route';
import { SCENARIOS } from './sim/scenarios';
import { simulate } from './sim/simulator';
import type { Channel, Fault, HistoryTurn, Lang, RunTrace } from './sim/types';
import { usePlayback } from './usePlayback';

const REPO_URL = 'https://github.com/gabercmatej/Meta-message-answering-bot';
const DELAY_SECONDS = 60;
/** How long a chosen example stays visible in the composer before it is sent. */
const TYPE_MS = 420;

export function App() {
  const [channel, setChannel] = useState<Channel>('instagram_dm');
  const [lang, setLang] = useState<Lang>('en');
  const [dev, setDev] = useState(false);
  const [draft, setDraft] = useState('');
  const [runs, setRuns] = useState<RunTrace[]>([]);
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(new Set());
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [pendingSend, setPendingSend] = useState(false);
  const runNo = useRef(0);
  const timer = useRef<number | null>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const t = DICT[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const last = runs[runs.length - 1] ?? null;
  const busy = !!last && !doneIds.has(last.id);
  const shownIdx = viewIdx ?? runs.length - 1;
  const shown = runs[shownIdx] ?? null;

  const { steps, timeline } = useMemo(() => {
    if (!shown) return { steps: [], timeline: null };
    const s = buildRoute(shown);
    return { steps: s, timeline: compileTimeline(s) };
  }, [shown]);

  const playKey = shown ? `${shown.id}#${nonce}` : null;
  const onDone = useCallback((key: string) => {
    const id = key.split('#')[0]!;
    setDoneIds((s) => (s.has(id) ? s : new Set(s).add(id)));
  }, []);
  const playback = usePlayback(playKey, timeline, { delaySeconds: DELAY_SECONDS, autoplay, onDone });

  const send = useCallback(
    (text: string, opts?: { channel?: Channel; fault?: Fault; fresh?: boolean }) => {
      const clean = text.trim();
      if (!clean) return;
      const ch = opts?.channel ?? channel;
      const fresh = !!opts?.fresh;
      const prev = fresh ? [] : runs;
      const history: HistoryTurn[] = [];
      for (const r of prev) {
        history.push({ role: 'user', text: r.input.text, topic: r.classification.topic });
        if (doneIds.has(r.id) && r.replyText && r.repliesDelivered) history.push({ role: 'bot', text: r.replyText });
      }
      runNo.current += 1;
      const trace = simulate({ runNo: runNo.current, channel: ch, lang, text: clean, fault: opts?.fault ?? 'none', delaySeconds: DELAY_SECONDS, history });
      setRuns([...prev, trace]);
      setViewIdx(null);
      setAutoplay(true);
      setNonce((n) => n + 1);
      setDraft('');
    },
    [channel, lang, runs, doneIds]
  );

  const typeThenSend = useCallback(
    (text: string, opts?: { channel?: Channel; fault?: Fault; fresh?: boolean }) => {
      if (busy || pendingSend) return;
      setDraft(text);
      setPendingSend(true);
      timer.current = window.setTimeout(() => {
        setPendingSend(false);
        send(text, opts);
      }, reduced ? 60 : TYPE_MS);
    },
    [busy, pendingSend, send, reduced]
  );

  const onExample = useCallback(
    (id: string) => {
      const s = SCENARIOS.find((x) => x.id === id);
      if (!s) return;
      if (s.channel !== channel) {
        setChannel(s.channel);
        setRuns([]);
        setDoneIds(new Set());
        setViewIdx(null);
      }
      typeThenSend(s.text[lang], { channel: s.channel, fault: s.fault, fresh: true });
    },
    [channel, lang, typeThenSend]
  );

  const changeChannel = (c: Channel) => {
    if (busy || pendingSend || c === channel) return;
    setChannel(c);
    setRuns([]);
    setDoneIds(new Set());
    setViewIdx(null);
    setDraft('');
  };

  // Conversation shown on the device: replies exist only for runs whose playback has finished.
  const items = useMemo<ConvItem[]>(() => {
    const out: ConvItem[] = [];
    for (const r of runs) {
      out.push({ id: `${r.id}-u`, role: 'user', text: r.input.text });
      if (!doneIds.has(r.id)) continue;
      if (r.replyText && r.repliesDelivered === 1) out.push({ id: `${r.id}-b`, role: 'bot', text: r.replyText, tone: r.replySource === 'approved_fallback' ? 'fallback' : 'auto' });
      else if (r.finalState === 'needs_review') out.push({ id: `${r.id}-s`, role: 'system', tone: 'hold', text: t.device.heldNote });
      else if (r.finalState === 'skipped') out.push({ id: `${r.id}-s`, role: 'system', tone: 'skip', text: t.device.skippedNote });
    }
    return out;
  }, [runs, doneIds, t]);

  const shownIsLast = shown !== null && last !== null && shown.id === last.id;
  const lastDone = !!last && doneIds.has(last.id);
  let status: DeliveryStatus = null;
  if (last) {
    if (lastDone) status = last.repliesDelivered === 1 ? 'seen' : 'delivered';
    else status = shownIsLast && playback.view.accepted ? 'delivered' : 'sent';
  }
  const typing = busy && shownIsLast && playback.view.returning && !playback.view.done;

  const mockProps = { t, lang, items, typing, status, busy: busy || pendingSend, draft, setDraft, onSend: () => send(draft) };
  const showResults = !!shown && doneIds.has(shown.id);
  const idle = runs.length === 0;
  const where = describeWhere(t, playback.view, idle);

  const replay = useCallback(() => {
    setAutoplay(true);
    setNonce((n) => n + 1);
  }, []);
  const select = useCallback((i: number) => {
    setViewIdx(i);
    setAutoplay(false);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!dev) return;
    const id = window.setTimeout(() => document.querySelector('[data-devview]')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }), 80);
    return () => window.clearTimeout(id);
  }, [dev, reduced]);

  const jumpToGraph = () => document.getElementById('graph-anchor')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

  return (
    <TipProvider>
      <div className="app" data-channel={channel}>
        <TopBar t={t} channel={channel} onChannel={changeChannel} lang={lang} onLang={(l) => !busy && setLang(l)} dev={dev} onDev={setDev} locked={busy || pendingSend} />

        <section className="hero">
          <h2>{t.heroTitle}</h2>
          <p>{t.heroSub}</p>
        </section>

        {busy && (
          <button className="mprog" onClick={jumpToGraph} aria-label={where}>
            <span className="dot live" aria-hidden="true" />
            <span className="mprog-text">{where}</span>
            <Icon name="chevron-down" size={14} />
          </button>
        )}

        <main className="stage">
          <div className="stage-device">
            <div className="device" ref={deviceRef} data-device>
              <div className="bezel">
                <div className="statusbar" aria-hidden="true">
                  <span>9:41</span>
                  <span className="sb-right"><i className="sig" /><i className="wifi" /><i className="batt" /></span>
                </div>
                <div className="screen">
                  {channel === 'instagram_dm' && <Dm variant="ig" {...mockProps} />}
                  {channel === 'messenger' && <Dm variant="messenger" {...mockProps} />}
                  {channel === 'instagram_comment' && <Comments variant="ig" {...mockProps} />}
                  {channel === 'facebook_comment' && <Comments variant="fb" {...mockProps} />}
                </div>
                <div className="home-bar" aria-hidden="true" />
              </div>
            </div>
            <Suggestions t={t} lang={lang} disabled={busy || pendingSend} onSuggest={(text) => typeThenSend(text)} onExample={onExample} />
          </div>
          <div className="stage-graph" id="graph-anchor">
            <ArchGraph t={t} lang={lang} trace={shown} steps={steps} playback={playback} reduced={reduced} deviceRef={deviceRef} onReplay={replay} />
          </div>
        </main>

        {showResults && <Results t={t} lang={lang} runs={runs.filter((r) => doneIds.has(r.id))} selected={Math.min(shownIdx, runs.filter((r) => doneIds.has(r.id)).length - 1)} onSelect={select} onReplay={replay} />}
        {dev && <DevView t={t} lang={lang} run={shown && doneIds.has(shown.id) ? shown : last && lastDone ? last : null} />}

        <footer className="foot">
          <span>{t.footer}</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">{t.footerCredit}</a>
        </footer>
      </div>
    </TipProvider>
  );
}
