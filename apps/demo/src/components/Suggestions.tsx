import { useEffect, useRef, useState } from 'react';
import type { Dict } from '../i18n';
import type { Lang } from '../sim/types';
import { EVERYDAY, FAILURE_MODES, SUGGESTIONS, type Example } from '../suggestions';
import { Icon } from './Icon';

export function Suggestions({ t, lang, disabled, onSuggest, onExample }: { t: Dict; lang: Lang; disabled: boolean; onSuggest: (text: string) => void; onExample: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const click = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('mousedown', click);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('mousedown', click);
    };
  }, [open]);

  const item = (e: Example, i: number, firstItem: boolean) => (
    <button key={e.id} ref={firstItem && i === 0 ? first : undefined} role="menuitem" className="ex-item" data-example={e.id} disabled={disabled} onClick={() => { setOpen(false); onExample(e.id); }}>
      <span className="ex-ico"><Icon name={e.icon} size={15} /></span>
      <span>{e.label[lang]}</span>
    </button>
  );

  return (
    <div className="suggest" ref={wrap}>
      <div className="chips-row" role="group" aria-label={t.suggest.label}>
        {SUGGESTIONS[lang].map((s) => (
          <button key={s.text} className="sug" disabled={disabled} onClick={() => onSuggest(s.text)}>{s.text}</button>
        ))}
        <button className={`sug more ${open ? 'on' : ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {t.suggest.more}<Icon name="chevron-down" size={13} />
        </button>
      </div>
      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="examples" role="menu" aria-label={t.suggest.title}>
            <div className="ex-grab" aria-hidden="true" />
            <h5>{t.suggest.everyday}</h5>
            <div className="ex-grid">{EVERYDAY.map((e, i) => item(e, i, true))}</div>
            <h5 className="fail">{t.suggest.failure}</h5>
            <div className="ex-grid">{FAILURE_MODES.map((e, i) => item(e, i, false))}</div>
            <p className="ex-hint">{t.suggest.hint}</p>
          </div>
        </>
      )}
    </div>
  );
}
