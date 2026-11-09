import type { Dict } from '../i18n';
import type { Channel, Lang } from '../sim/types';
import { Tip } from './common';
import { Icon } from './Icon';

const MODES: ReadonlyArray<{ id: Channel; icon: string }> = [
  { id: 'instagram_dm', icon: 'send' },
  { id: 'messenger', icon: 'chat-dots' },
  { id: 'instagram_comment', icon: 'heart' },
  { id: 'facebook_comment', icon: 'thumb' }
];

export function TopBar({ t, channel, onChannel, lang, onLang, dev, onDev, locked }: { t: Dict; channel: Channel; onChannel: (c: Channel) => void; lang: Lang; onLang: (l: Lang) => void; dev: boolean; onDev: (v: boolean) => void; locked: boolean }) {
  return (
    <header className="topbar">
      <div className="tb-left">
        <span className="mark" aria-hidden="true">PnD</span>
        <h1>{t.wordmark}</h1>
      </div>
      <div className="seg modes" role="radiogroup" aria-label={t.modeGroup}>
        {MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={channel === m.id} aria-label={t.modes[m.id]} data-mode={m.id} className={channel === m.id ? 'on' : ''} disabled={locked && channel !== m.id} onClick={() => onChannel(m.id)}>
            <Icon name={m.icon} size={15} />
            <span><span className="lbl-long">{t.modes[m.id]}</span><span className="lbl-short">{t.modesShort[m.id]}</span></span>
          </button>
        ))}
      </div>
      <div className="tb-right">
        <div className="seg lang" role="radiogroup" aria-label={t.langGroup}>
          {(['en', 'sl'] as const).map((l) => (
            <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? 'on' : ''} onClick={() => onLang(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
        <button className={`toggle ${dev ? 'on' : ''}`} role="switch" aria-checked={dev} onClick={() => onDev(!dev)} aria-label={t.dev}>
          <Icon name="code" size={15} /><span>{t.dev}</span><i aria-hidden="true" />
        </button>
        <Tip className="sim-pill" text={t.pillTip}>
          <span className="pulse" aria-hidden="true" />
          <span className="pill-long">{t.disclosure}</span>
          <span className="pill-mid">{t.pillMid}</span>
          <span className="pill-short">{t.pillShort}</span>
        </Tip>
      </div>
    </header>
  );
}
