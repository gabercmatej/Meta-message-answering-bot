import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chat, type Turn } from './components/Chat';
import { Icon } from './components/Icon';
import { Inspector } from './components/Inspector';
import { Pipeline } from './components/Pipeline';
import { DEFAULT_SCENARIO_ID, SCENARIOS } from './sim/scenarios';
import { simulate } from './sim/simulator';
import type { Channel, Fault, HistoryTurn, Lang, RunTrace } from './sim/types';
import { STAGES } from './stages';
import { usePlayback } from './usePlayback';

const REPO_URL = 'https://github.com/gabercmatej/Meta-message-answering-bot';
const DELAYS = [0, 60, 180] as const;

type Theme = 'light' | 'dark' | 'system';

function readTheme(): Theme {
  try {
    const t = window.localStorage.getItem('pnd-demo-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Compact sticky run indicator for narrow screens, where the pipeline sits far below the chat. */
function MobileProgress({ run, stage, countdown, done }: { run: RunTrace | null; stage: number; countdown: number | null; done: boolean }) {
  const total = STAGES.length;
  const jump = () => {
    const el = document.getElementById('pipeline');
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  };
  let text = 'Pipeline idle · send a message';
  let pct = 0;
  if (run) {
    if (done) {
      text = `Run complete · ${run.finalState}`;
      pct = 100;
    } else {
      const s = STAGES[Math.min(stage, total - 1)]!;
      text = `Stage ${stage + 1}/${total} · ${s.title}${countdown !== null ? ` · ${countdown} s` : ''}`;
      pct = (stage / total) * 100;
    }
  }
  return (
    <div className={`mprog ${run && !done ? 'running' : ''}`}>
      <div className="mprog-row">
        <span className="mprog-text" role="status" aria-live="polite">
          {text}
        </span>
        <button className="link" onClick={jump}>
          Show pipeline
        </button>
      </div>
      <div className="mprog-bar" role="progressbar" aria-label="Pipeline progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function App() {
  const [channel, setChannel] = useState<Channel>('instagram_dm');
  const [lang, setLang] = useState<Lang>('en');
  const [delay, setDelay] = useState<number>(60);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [history, setHistory] = useState<HistoryTurn[]>([]);
  const [run, setRun] = useState<RunTrace | null>(null);
  const [scenario, setScenario] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const runNo = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('pnd-demo-theme', theme);
    } catch {
      /* storage unavailable: theme stays per page view */
    }
  }, [theme]);

  const onDone = useCallback((r: RunTrace) => {
    const { input } = r;
    setTurns((ts) => {
      const next = [...ts];
      if (r.replyText && r.repliesDelivered === 1) {
        const tone = r.replySource === 'approved_fallback' ? 'fallback' : 'auto';
        const meta =
          r.finalState === 'reconciled_sent'
            ? 'Sent automatically · confirmed by read-back'
            : r.replySource === 'approved_fallback'
              ? 'Sent automatically · approved fallback'
              : r.replySource === 'approved_text'
                ? 'Sent automatically · approved text'
                : 'Sent automatically · delivery confirmed';
        next.push({ id: `${r.id}-bot`, role: 'bot', text: r.replyText, meta, tone });
      } else if (r.finalState === 'needs_review') {
        next.push({ id: `${r.id}-sys`, role: 'system', tone: 'hold', text: 'Held for a person: hard safety signal, no automatic reply. In production a staff member answers from the admin inbox.' });
      } else if (r.finalState === 'skipped') {
        next.push({ id: `${r.id}-sys`, role: 'system', tone: 'skip', text: 'No reply: a public remark without a question is skipped (no person needed).' });
      }
      return next;
    });
    setHistory((h) => (r.replyText && r.repliesDelivered ? [...h, { role: 'bot', text: r.replyText }] : h));
    void input;
  }, []);

  const pb = usePlayback(run, onDone);
  const busy = !!run && !pb.done;

  const send = useCallback(
    (text: string, opts?: { channel?: Channel; lang?: Lang; fault?: Fault; fresh?: boolean }) => {
      const ch = opts?.channel ?? channel;
      const lg = opts?.lang ?? lang;
      const hist = opts?.fresh ? [] : history;
      runNo.current += 1;
      const trace = simulate({ runNo: runNo.current, channel: ch, lang: lg, text, fault: opts?.fault ?? 'none', delaySeconds: delay, history: hist });
      setTurns((ts) => [...(opts?.fresh ? [] : ts), { id: `${trace.id}-user`, role: 'user', text }]);
      setHistory([...hist, { role: 'user', text, topic: trace.classification.topic }]);
      setRun(trace);
    },
    [channel, lang, history, delay]
  );

  const reset = useCallback(() => {
    setTurns([]);
    setHistory([]);
    setRun(null);
    setScenario(null);
  }, []);

  const playScenario = useCallback(
    (id: string, lg: Lang = lang) => {
      const s = SCENARIOS.find((x) => x.id === id);
      if (!s) return;
      setScenario(id);
      setChannel(s.channel);
      send(s.text[lg], { channel: s.channel, lang: lg, fault: s.fault, fresh: true });
    },
    [lang, send]
  );

  // Default first experience: one successful automated reply, so the whole pipeline is visible.
  useEffect(() => {
    if (started.current) return;
    const t = window.setTimeout(() => {
      started.current = true;
      playScenario(DEFAULT_SCENARIO_ID, 'en');
    }, 450);
    return () => window.clearTimeout(t);
  }, [playScenario]);

  const changeChannel = (c: Channel) => {
    if (busy) return;
    if (c !== channel) reset();
    setChannel(c);
  };

  const schedStage = run?.stages.findIndex((s) => s.id === 'schedule') ?? -1;
  const pending = useMemo(() => {
    if (!run || !run.replyText || pb.done || schedStage < 0) return null;
    const sched = run.stages[schedStage];
    if (!sched || sched.status !== 'ok') return null;
    if (pb.stage === schedStage) return { countdown: pb.countdown, text: run.replyText, phase: 'scheduled' as const };
    if (pb.stage > schedStage) return { countdown: null, text: run.replyText, phase: 'sending' as const };
    return null;
  }, [run, pb.stage, pb.countdown, pb.done, schedStage]);

  const fault = SCENARIOS.find((s) => s.id === scenario)?.fault ?? 'none';

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <Icon name="bolt" size={16} />
          </span>
          <div>
            <h1>Message Processing Playground</h1>
            <p>The PND Meta messaging pipeline, step by step</p>
          </div>
        </div>
        <div className="top-actions">
          <label className="delay">
            <span>Reply delay</span>
            <select value={delay} onChange={(e) => setDelay(Number(e.target.value))} disabled={busy} aria-label="Automatic reply delay">
              {DELAYS.map((d) => (
                <option key={d} value={d}>
                  {d} s
                </option>
              ))}
            </select>
          </label>
          <button className="ghost icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')} aria-label={`Theme: ${theme}`} title={`Theme: ${theme}`}>
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} />
          </button>
          <a className="ghost repo" href={REPO_URL} target="_blank" rel="noreferrer">
            <Icon name="github" /> <span>Source &amp; case study</span>
          </a>
        </div>
      </header>

      <div className="honesty" role="note">
        <Icon name="shield" size={15} />
        <span>
          <strong>Interactive architecture simulation — no real AI or Meta API calls.</strong> Replies come from a deterministic script and fictional demo knowledge, so the routing, retrieval, scheduling and delivery mechanics are visible. Nothing leaves your browser.
        </span>
      </div>

      {fault !== 'none' && run && (
        <div className="fault-banner">
          <Icon name="alert" size={14} /> Injected fault: <code>{fault}</code> · {SCENARIOS.find((s) => s.id === scenario)?.note}
        </div>
      )}

      <MobileProgress run={run} stage={pb.stage} countdown={pb.countdown} done={pb.done} />

      <main className="grid">
        <Chat
          channel={channel}
          lang={lang}
          turns={turns}
          busy={busy}
          pending={pending}
          onChannel={changeChannel}
          onLang={(l) => !busy && setLang(l)}
          onSend={(t) => {
            setScenario(null);
            send(t);
          }}
          onScenario={(id) => playScenario(id)}
          onSendNow={pb.sendNow}
          onReset={() => !busy && reset()}
          activeScenario={scenario}
        />
        <Pipeline run={run} stage={pb.stage} countdown={pb.countdown} onSendNow={pb.sendNow} onSkip={pb.skipAll} />
        <Inspector run={run} stage={pb.stage} lang={lang} />
      </main>

      <footer className="foot">
        <span>Synthetic data only · deterministic simulator · no network calls</span>
        <span>
          Built by Matej Gaberc ·{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            architecture &amp; source
          </a>
        </span>
      </footer>
    </div>
  );
}
