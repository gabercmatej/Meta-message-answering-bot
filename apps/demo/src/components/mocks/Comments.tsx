import { useEffect, useRef } from 'react';
import { Avatar, FactText } from '../common';
import { Icon } from '../Icon';
import { PostArt, PostThumb } from './PostArt';
import type { ConvItem, MockProps } from './types';

function Status({ t, status }: { t: MockProps['t']; status: MockProps['status'] }) {
  if (!status) return null;
  return <span className={`cstatus ${status}`} data-status={status}>{status === 'sent' ? t.device.sent : status === 'delivered' ? t.device.delivered : t.device.seen}</span>;
}

function SysNote({ item, t }: { item: ConvItem; t: MockProps['t'] }) {
  return (
    <div className={`sys-note ${item.tone ?? ''}`} role="status" data-note={item.tone}>
      <Icon name={item.tone === 'hold' ? 'person' : 'info'} size={14} />
      <span>{item.text}</span>
      <em>{t.device.simulatedNote}</em>
    </div>
  );
}

export function Comments({ variant, t, items, typing, status, busy, draft, setDraft, onSend }: MockProps & { variant: 'ig' | 'fb' }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el && items.length) window.setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 120);
  }, [items.length, typing, status]);
  const ig = variant === 'ig';
  const lastUser = [...items].reverse().find((i) => i.role === 'user')?.id;

  const thread = items.map((m) => {
    if (m.role === 'system') return <SysNote key={m.id} item={m} t={t} />;
    if (m.role === 'user') {
      return ig ? (
        <div key={m.id} className="ig-comment mine" data-msg="user">
          <Avatar kind="visitor" size={30} initial="D" />
          <div className="c-body">
            <p><strong>{t.device.visitorHandle}</strong> {m.text}</p>
            <div className="c-meta"><span>{t.device.justNow}</span><span>{t.device.reply}</span>{m.id === lastUser && <Status t={t} status={status} />}</div>
          </div>
        </div>
      ) : (
        <div key={m.id} className="fb-comment mine" data-msg="user">
          <Avatar kind="visitor" size={32} initial="D" />
          <div className="c-body">
            <div className="c-bubble"><strong>{t.device.visitor}</strong><p>{m.text}</p></div>
            <div className="c-meta"><span>{t.device.like}</span><span>{t.device.reply}</span><span>{t.device.justNow}</span>{m.id === lastUser && <Status t={t} status={status} />}</div>
          </div>
        </div>
      );
    }
    return ig ? (
      <div key={m.id} className={`ig-comment reply ${m.tone ?? ''}`} data-msg="bot">
        <Avatar kind="brand" size={26} ring />
        <div className="c-body">
          <p><strong>{t.brand}</strong><span className="demo-tag">{t.demoTag}</span> <FactText text={m.text} t={t} /></p>
          <div className="c-meta"><span>{t.device.justNow}</span><span>{t.device.reply}</span></div>
        </div>
      </div>
    ) : (
      <div key={m.id} className={`fb-comment reply ${m.tone ?? ''}`} data-msg="bot">
        <Avatar kind="brand" size={26} />
        <div className="c-body">
          <div className="c-bubble"><strong>{t.brand}<span className="demo-tag">{t.demoTag}</span></strong><p><FactText text={m.text} t={t} /></p></div>
          <div className="c-meta"><span>{t.device.like}</span><span>{t.device.reply}</span><span>{t.device.justNow}</span></div>
        </div>
      </div>
    );
  });

  const typingRow = typing && (
    <div className={`${ig ? 'ig' : 'fb'}-comment reply`} data-typing>
      <Avatar kind="brand" size={26} ring={ig} />
      <div className="c-body"><div className="c-bubble typing" aria-label={t.device.typing}><i /><i /><i /></div></div>
    </div>
  );

  const caption = ig ? t.device.postCaption : t.device.postFacebook;
  const collapsed = items.length > 0;

  return (
    <div className={`mock post ${ig ? 'ig' : 'fb'}`} data-mock={ig ? 'instagram_comment' : 'facebook_comment'}>
      <div className={`post-pin ${collapsed ? 'collapsed' : ''}`} data-post data-collapsed={collapsed}>
        <header className="post-head">
          <Avatar kind="brand" size={ig ? 32 : 38} ring={ig} />
          <div className="who">
            <strong>{t.brand}<span className="demo-tag">{t.demoTag}</span></strong>
            {!ig && <small className="when-open">{t.device.time} · <Icon name="globe" size={11} /></small>}
            <small className="when-open">{ig ? t.modeSim.instagram_comment : t.modeSim.facebook_comment}</small>
            <p className="mini-cap">{caption}</p>
            <span className="mini-react"><Icon name={ig ? 'heart' : 'thumb'} size={12} /> 86 <Icon name="comment" size={12} /> 6</span>
          </div>
          <PostThumb />
          <button className="ico more" tabIndex={-1} aria-hidden="true"><Icon name="more" size={20} /></button>
        </header>
        <div className="post-collapsible">
          <div className="post-collapsible-in">
            {!ig && <p className="fb-text">{caption}</p>}
            <PostArt title={t.device.postTitle} square={ig} />
            {ig ? (
              <>
                <div className="ig-actions">
                  <Icon name="heart" size={24} /><Icon name="comment" size={24} /><Icon name="share" size={24} /><span className="grow" /><Icon name="bookmark" size={24} />
                </div>
                <div className="likes">{t.device.likes(86)}</div>
                <p className="caption"><strong>{t.brand}</strong> {caption}</p>
              </>
            ) : (
              <>
                <div className="fb-react">
                  <span className="rx"><i className="r1"><Icon name="thumb" size={11} stroke={2} /></i><i className="r2"><Icon name="heart" size={11} stroke={2} /></i><em>86</em></span>
                  <span className="grow" /><span>{t.device.fbCounts}</span>
                </div>
                <div className="fb-buttons"><span><Icon name="thumb" size={18} /> {t.device.like}</span><span><Icon name="comment" size={18} /> {t.device.commentWord}</span><span><Icon name="share" size={18} /> {t.device.shareWord}</span></div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="thread-scroll" ref={scroller}>
        {ig ? (
          <>
            <div className="view-all">{t.device.viewComments}</div>
            <div className="ig-comment"><Avatar kind="a" size={30} initial="A" /><div className="c-body"><p><strong>{t.device.name1}</strong> {t.device.c1}</p><div className="c-meta"><span>1 h</span><span>{t.device.reply}</span></div></div></div>
            <div className="ig-comment"><Avatar kind="b" size={30} initial="L" /><div className="c-body"><p><strong>{t.device.name2}</strong> {t.device.c2}</p><div className="c-meta"><span>45 min</span><span>{t.device.reply}</span></div></div></div>
          </>
        ) : (
          <>
            <div className="fb-sort">{t.device.mostRelevant} <Icon name="chevron-down" size={14} /></div>
            <div className="fb-comment"><Avatar kind="a" size={32} initial="A" /><div className="c-body"><div className="c-bubble"><strong>{t.device.fb1}</strong><p>{t.device.c1}</p></div><div className="c-meta"><span>{t.device.like}</span><span>{t.device.reply}</span><span>1 h</span></div></div></div>
            <div className="fb-comment"><Avatar kind="b" size={32} initial="L" /><div className="c-body"><div className="c-bubble"><strong>{t.device.fb2}</strong><p>{t.device.c2}</p></div><div className="c-meta"><span>{t.device.like}</span><span>{t.device.reply}</span><span>45 min</span></div></div></div>
          </>
        )}
        <div className="thread">{thread}{typingRow}</div>
      </div>
      <form className="composer comment" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
        <Avatar kind="visitor" size={28} initial="D" />
        <input id="composer" aria-label="Message text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={ig ? t.device.addComment : t.device.writeComment} disabled={busy} autoComplete="off" maxLength={240} />
        {draft.trim() ? <button type="submit" className="send" disabled={busy}>{ig ? t.device.post : t.device.send}</button> : <span className="head-ico dim" aria-hidden="true"><Icon name={ig ? 'smile' : 'image'} size={20} /></span>}
      </form>
    </div>
  );
}
