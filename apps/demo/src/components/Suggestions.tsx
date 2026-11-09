import { useState } from 'react';
import type { Dict } from '../i18n';
import type { Lang } from '../sim/types';
import { EVERYDAY, FAILURE_MODES, SUGGESTIONS, type Example } from '../suggestions';
import { Icon } from './Icon';

/** Six suggested messages in a 3x2 grid, plus an inline disclosure with every other scenario (nothing is dropped). */
export function Suggestions({ t, lang, disabled, onSuggest, onExample }: { t: Dict; lang: Lang; disabled: boolean; onSuggest: (text: string) => void; onExample: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  const item = (e: Example) => (
    <button key={e.id} type="button" className="ex-item" data-example={e.id} disabled={disabled} onClick={() => { setOpen(false); onExample(e.id); }}>
      <span className="ex-ico"><Icon name={e.icon} size={15} /></span>
      <span>{e.label[lang]}</span>
    </button>
  );

  return (
    <div className="suggest">
      <h3 className="sug-title">{t.suggest.label}</h3>
      <div className="chips-row" role="group" aria-label={t.suggest.label}>
        {SUGGESTIONS[lang].map((s) => (
          <button key={s.text} type="button" className="sug" data-suggestion disabled={disabled} onClick={() => onSuggest(s.text)}>{s.text}</button>
        ))}
      </div>
      <button type="button" className={`more-toggle ${open ? 'on' : ''}`} aria-expanded={open} aria-controls="more-examples" onClick={() => setOpen((o) => !o)}>
        {t.suggest.more}<Icon name="chevron-down" size={14} />
      </button>
      {open && (
        <div className="examples" id="more-examples" role="region" aria-label={t.suggest.title}>
          <h4>{t.suggest.everyday}</h4>
          <div className="ex-grid">{EVERYDAY.map(item)}</div>
          <h4 className="fail">{t.suggest.failure}</h4>
          <div className="ex-grid">{FAILURE_MODES.map(item)}</div>
          <p className="ex-hint">{t.suggest.hint}</p>
        </div>
      )}
    </div>
  );
}
