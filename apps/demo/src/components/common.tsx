import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Dict } from '../i18n';
import scales from '../assets/brand/pnd-scales-512.png';
import { entry } from '../sim/knowledge';

// ------------------------------------------------------------------------------ tooltip layer

interface TipState {
  text: string;
  x: number;
  y: number;
  below: boolean;
}
interface TipApi {
  show: (el: HTMLElement, text: string) => void;
  hide: () => void;
}
const TipCtx = createContext<TipApi>({ show: () => undefined, hide: () => undefined });
export const useTip = () => useContext(TipCtx);

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = useCallback((el: HTMLElement, text: string) => {
    const r = el.getBoundingClientRect();
    const below = r.top < 64;
    setTip({ text, x: Math.min(Math.max(r.left + r.width / 2, 160), window.innerWidth - 160), y: below ? r.bottom + 8 : r.top - 8, below });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  useEffect(() => {
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [hide]);
  const api = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <TipCtx.Provider value={api}>
      {children}
      {tip && createPortal(<div className={`tip ${tip.below ? 'below' : ''}`} role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>, document.body)}
    </TipCtx.Provider>
  );
}

/** Wraps any inline content with a hover/focus tooltip. */
export function Tip({ text, children, className, as = 'span' }: { text: string; children: ReactNode; className?: string; as?: 'span' | 'div' }) {
  const tip = useTip();
  const Tag = as;
  useEffect(() => tip.hide, [tip.hide]);
  return (
    <Tag
      className={className}
      tabIndex={0}
      onMouseEnter={(e) => tip.show(e.currentTarget as HTMLElement, text)}
      onMouseLeave={tip.hide}
      onFocus={(e) => tip.show(e.currentTarget as HTMLElement, text)}
      onBlur={tip.hide}
    >
      {children}
    </Tag>
  );
}

// ------------------------------------------------------------------------------ fact chips

const FACTS: ReadonlyArray<{ re: RegExp; id: string }> = [
  { re: /(€\s?49|49\s?€)/g, id: 'kb.price.consult' },
  { re: /(8[:.]00 (?:to|in) 16[:.]00)/g, id: 'kb.service.hours' },
  { re: /(https:\/\/example\.com\/book)/g, id: 'kb.route.booking' }
];

export interface Piece {
  text: string;
  fact?: { id: string; version: number };
}

/** Splits reply text into plain and grounded pieces. Pure; tested. */
export function splitFacts(text: string): Piece[] {
  const hits: Array<{ s: number; e: number; id: string }> = [];
  for (const f of FACTS) {
    for (const m of text.matchAll(f.re)) hits.push({ s: m.index!, e: m.index! + m[0].length, id: f.id });
  }
  hits.sort((a, b) => a.s - b.s);
  const out: Piece[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.s < at) continue;
    if (h.s > at) out.push({ text: text.slice(at, h.s) });
    out.push({ text: text.slice(h.s, h.e), fact: { id: h.id, version: entry(h.id).version } });
    at = h.e;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

export function FactText({ text, t }: { text: string; t: Dict }) {
  return (
    <>
      {splitFacts(text).map((p, i) =>
        p.fact ? (
          <Tip key={i} className="fact" text={t.factFrom(p.fact.id, p.fact.version)}>
            {p.text}
          </Tip>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

// ------------------------------------------------------------------------------ avatars

/** Brand avatar: the official PND scales icon, unaltered, centred on a white circle (optionally with a story ring). */
export function Avatar({ kind, size = 32, ring = false, initial }: { kind: 'brand' | 'visitor' | 'a' | 'b'; size?: number; ring?: boolean; initial?: string }) {
  const brand = kind === 'brand';
  return (
    <span className={`avatar ${kind} ${ring ? 'ring' : ''}`} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      <span className="avatar-in">{brand ? <img src={scales} alt="" draggable={false} /> : (initial ?? 'D')}</span>
    </span>
  );
}
