import { useEffect, useRef, useState } from 'react';
import { FIRM } from '../sim/knowledge';
import { SCENARIOS } from '../sim/scenarios';
import { CHANNEL_LABEL, isComment } from '../sim/simulator';
import type { Channel, Lang } from '../sim/types';
import { Icon } from './Icon';

export interface Turn {
  id: string;
  role: 'user' | 'bot' | 'system';
  text: string;
  meta?: string;
  tone?: 'auto' | 'fallback' | 'hold' | 'skip';
}

interface Props {
  channel: Channel;
  lang: Lang;
  turns: Turn[];
  busy: boolean;
  pending: { countdown: number | null; text: string; phase: 'scheduled' | 'sending' } | null;
  onChannel: (c: Channel) => void;
  onLang: (l: Lang) => void;
  onSend: (text: string) => void;
  onScenario: (id: string) => void;
  onSendNow: () => void;
  onReset: () => void;
  activeScenario: string | null;
}

const CHANNELS: Channel[] = ['messenger', 'instagram_dm', 'facebook_comment', 'instagram_comment'];
const SUGGEST: Record<Lang, string[]> = {
  en: ['Can my employer fire me without notice?', 'How much does a consultation cost?', 'Hi'],
  sl: ['Koliko stane pravni posvet?', 'Najemodajalec mi noče vrniti varščine.', 'Živjo']
};

export function Chat(p: Props) {
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const comment = isComment(p.channel);
  const ig = p.channel.startsWith('instagram');

  useEffect(() => {
    // Scroll the thread container only (never the window). Keep the latest question in view when
    // question + answer fit; otherwise start at the top of the newest message so it reads from its beginning.
    const el = scroller.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>('.msg, .sys');
    const last = items[items.length - 1];
    const lastUser = [...el.querySelectorAll<HTMLElement>('.msg.user')].pop();
    const bottom = el.scrollHeight - el.clientHeight;
    let top = bottom;
    if (last && lastUser && el.scrollHeight - lastUser.offsetTop + 8 > el.clientHeight) top = Math.min(bottom, Math.max(0, last.offsetTop - 8));
    else if (lastUser) top = Math.min(bottom, Math.max(0, lastUser.offsetTop - 8));
    el.scrollTo({ top, behavior: 'smooth' });
  }, [p.turns.length, p.pending?.phase]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || p.busy) return;
    p.onSend(t.slice(0, 400));
    setDraft('');
  };

  return (
    <section className="panel chat" aria-label="Conversation simulator">
      <div className="panel-head">
        <div className="seg seg-ch" role="radiogroup" aria-label="Channel">
          {CHANNELS.map((c) => (
            <button key={c} role="radio" aria-checked={p.channel === c} className={p.channel === c ? 'on' : ''} onClick={() => p.onChannel(c)} title={CHANNEL_LABEL[c]}>
              <Icon name={c.startsWith('instagram') ? 'instagram' : c === 'messenger' ? 'messenger' : 'comment'} size={14} />
              <span>{CHANNEL_LABEL[c].replace('Facebook ', 'FB ').replace('Instagram ', 'IG ')}</span>
            </button>
          ))}
        </div>
        <span className="lang-label">Reply language</span>
        <div className="seg seg-sm" role="radiogroup" aria-label="Language">
          {(['en', 'sl'] as const).map((l) => (
            <button key={l} role="radio" aria-checked={p.lang === l} className={p.lang === l ? 'on' : ''} onClick={() => p.onLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="scenarios">
        <div className="label-row">
          <span className="eyebrow">Start here: pick a scenario</span>
          <span className="hint">or type your own message below</span>
        </div>
        {(['Legal topics', 'Service', 'Conversation', 'Reliability'] as const).map((g) => (
          <div key={g} className="sc-group">
            <span className="sc-title">{g}</span>
            <div className="sc-list">
              {SCENARIOS.filter((s) => s.group === g).map((s) => (
                <button key={s.id} className={`sc ${p.activeScenario === s.id ? 'on' : ''} ${g === 'Reliability' ? 'rel' : ''}`} disabled={p.busy} onClick={() => p.onScenario(s.id)} title={s.note}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={`phone ${ig ? 'ig' : 'fb'} ${comment ? 'is-comment' : 'is-dm'}`}>
        <div className="phone-bar">
          <span className="avatar firm">{ig ? 'dl' : 'DL'}</span>
          <div>
            <strong>{ig ? 'demolegaldesk' : FIRM[p.lang]}</strong>
            <small>{comment ? `${CHANNEL_LABEL[p.channel]} thread · public` : `${CHANNEL_LABEL[p.channel]} · private`}</small>
          </div>
          <button className="ghost icon-btn" onClick={p.onReset} title="Restart conversation" aria-label="Restart conversation">
            <Icon name="restart" />
          </button>
        </div>

        {comment && (
            <div className="post-card">
              <div className="post-media" aria-hidden="true" />
              <p>
                <strong>{ig ? 'demolegaldesk' : FIRM[p.lang]}</strong> {p.lang === 'sl' ? 'Poznate svoje pravice na delovnem mestu? Vprašajte nas v komentarjih.' : 'Know your rights at work? Ask us in the comments.'}
              </p>
              <small>Demo post · synthetic</small>
            </div>
          )}
        <div className="thread" ref={scroller} role="log" aria-label="Conversation">
          {p.turns.length === 0 && !p.pending && <p className="empty">Type a message or pick a scenario. Every message runs the full simulated pipeline.</p>}
          {p.turns.map((t) =>
            t.role === 'system' ? (
              <div key={t.id} className={`sys sys-${t.tone ?? 'skip'}`}>
                <Icon name={t.tone === 'hold' ? 'pause' : 'skip'} size={13} /> {t.text}
              </div>
            ) : (
              <div key={t.id} className={`msg ${t.role}`}>
                {comment && <span className="avatar sm">{t.role === 'user' ? 'DV' : 'DL'}</span>}
                <div className="bubble-wrap">
                  {comment && <span className="who">{t.role === 'user' ? (ig ? 'demo.visitor' : 'Demo Visitor') : ig ? 'demolegaldesk' : FIRM[p.lang]}</span>}
                  <div className="bubble">{t.text}</div>
                  {t.meta && (
                    <span className={`meta tone-${t.tone ?? 'auto'}`}>
                      {t.tone === 'auto' && <Icon name="check" size={12} />}
                      {t.meta}
                    </span>
                  )}
                </div>
              </div>
            )
          )}
          {p.pending && (
            <div className="msg bot pending">
              {comment && <span className="avatar sm">DL</span>}
              <div className="bubble-wrap">
                <div className="bubble ghosted">{p.pending.text}</div>
                <span className="meta tone-sched">
                  <Icon name="clock" size={12} />
                  {p.pending.phase === 'sending' ? 'Publishing…' : `Auto-send in ${p.pending.countdown ?? 0} s`}
                  {p.pending.phase === 'scheduled' && (
                    <button className="link" onClick={p.onSendNow}>
                      Send now
                    </button>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={comment ? (p.lang === 'sl' ? 'Napišite komentar…' : 'Write a comment…') : p.lang === 'sl' ? 'Napišite sporočilo…' : 'Write a message…'}
            aria-label="Message text"
            maxLength={400}
            disabled={p.busy}
          />
          <button type="submit" className="send" disabled={p.busy || !draft.trim()} aria-label="Send">
            <Icon name="send" />
          </button>
        </form>
        <div className="suggest">
          {SUGGEST[p.lang].map((s) => (
            <button key={s} className="chip" disabled={p.busy} onClick={() => submit(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

    </section>
  );
}
