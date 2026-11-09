import { useEffect, useRef } from 'react';
import { Avatar, FactText } from '../common';
import { Icon } from '../Icon';
import type { ConvItem, MockProps } from './types';

function Note({ item, t }: { item: ConvItem; t: MockProps['t'] }) {
  return (
    <div className={`sys-note ${item.tone ?? ''}`} role="status" data-note={item.tone}>
      <Icon name={item.tone === 'hold' ? 'person' : 'info'} size={14} />
      <span>{item.text}</span>
      <em>{t.device.simulatedNote}</em>
    </div>
  );
}

export function Dm({ variant, t, items, typing, status, busy, draft, setDraft, onSend }: MockProps & { variant: 'ig' | 'messenger' }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items.length, typing, status]);
  const lastUser = [...items].reverse().find((i) => i.role === 'user')?.id;
  const ig = variant === 'ig';
  return (
    <div className={`mock dm ${variant}`} data-mock={ig ? 'instagram_dm' : 'messenger'}>
      <header className="dm-head">
        <button className="ico" tabIndex={-1} aria-hidden="true"><Icon name="chevron-left" size={22} /></button>
        <Avatar kind="brand" size={ig ? 34 : 36} ring={ig} />
        <div className="who">
          <strong>{t.brand}<span className="demo-tag">{t.demoTag}</span></strong>
          <small>{t.device.activeNow}</small>
        </div>
        <div className="head-ico" aria-hidden="true">
          {ig ? (<><Icon name="phone" size={19} /><Icon name="video" size={20} /></>) : (<><Icon name="phone" size={20} /><Icon name="video" size={21} /><Icon name="info" size={20} /></>)}
        </div>
      </header>
      <div className="dm-scroll" ref={scroller} aria-live="off">
        <div className="day">{t.device.today}</div>
        {items.length === 0 && (
          <div className="dm-intro">
            <Avatar kind="brand" size={64} ring />
            <strong>{t.brand}</strong>
            <small>{t.modeSim[ig ? 'instagram_dm' : 'messenger']}</small>
          </div>
        )}
        {items.map((m) =>
          m.role === 'system' ? (
            <Note key={m.id} item={m} t={t} />
          ) : (
            <div key={m.id} className={`row ${m.role}`}>
              {m.role === 'bot' && <Avatar kind="brand" size={26} />}
              <div className={`msg ${m.role} ${m.tone ?? ''}`} data-msg={m.role}>
                <div className="bubble">{m.role === 'bot' ? <FactText text={m.text} t={t} /> : m.text}</div>
              </div>
            </div>
          )
        )}
        {status && lastUser && <div className={`status ${status}`} data-status={status}>{status === 'sent' ? t.device.sent : status === 'delivered' ? t.device.delivered : t.device.seen}</div>}
        {typing && (
          <div className="row bot typing-row" data-typing>
            <Avatar kind="brand" size={26} />
            <div className="bubble typing" aria-label={t.device.typing}><i /><i /><i /></div>
          </div>
        )}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
        <button type="button" className="ico" tabIndex={-1} aria-hidden="true"><Icon name={ig ? 'smile' : 'plus'} size={22} /></button>
        <input id="composer" aria-label="Message text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.device.message} disabled={busy} autoComplete="off" maxLength={240} />
        {draft.trim() ? (
          <button type="submit" className="send" disabled={busy}>{t.device.send}</button>
        ) : (
          <span className="head-ico dim" aria-hidden="true">{ig ? <><Icon name="mic" size={19} /><Icon name="image" size={19} /></> : <Icon name="smile" size={21} />}</span>
        )}
      </form>
    </div>
  );
}
