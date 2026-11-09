import type { Dict } from '../i18n';
import type { Lang } from '../sim/types';
import wordmark from '../assets/brand/pnd-wordmark-color.png';
import scales from '../assets/brand/pnd-scales-512.png';
import { Tip } from './common';
import { Icon } from './Icon';

export function TopBar({ t, lang, onLang, dev, onDev }: { t: Dict; lang: Lang; onLang: (l: Lang) => void; dev: boolean; onDev: (v: boolean) => void }) {
  return (
    <header className="topbar">
      <div className="tb-left">
        <img className="brand-wordmark" src={wordmark} alt={t.brand} width={115} height={26} draggable={false} />
        <img className="brand-mark" src={scales} alt="" aria-hidden="true" width={30} height={30} draggable={false} />
        <h1>{t.wordmark}</h1>
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
