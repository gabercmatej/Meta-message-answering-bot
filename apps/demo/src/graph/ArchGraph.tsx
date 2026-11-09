import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Icon, IconPaths } from '../components/Icon';
import { useMedia } from '../hooks';
import type { Dict } from '../i18n';
import { nodeFacts, type GraphView, type RouteStep } from '../route';
import type { Playback } from '../usePlayback';
import type { Lang, RunTrace, StageId } from '../sim/types';
import { STAGES } from '../stages';
import type { EdgeId, NodeId, NodeState } from './model';
import { LAYOUTS, NODE_META, buildDeviceEdges, buildEdges, type BuiltEdge, type DevicePorts, type Layout, type LayoutKind, type LayoutNode, type Pt } from './topology';

/** Wide topology needs this much container width: less when side by side (text may shrink a little), more when stacked. */
const WIDE_MIN_SIDE = 700;
const WIDE_MIN_STACKED = 880;
const TALL_MAX = 470;

const NODE_STAGE: Partial<Record<NodeId, StageId>> = {
  webhook: 'webhook', ingest: 'signature', normalize: 'normalize', context: 'context', intent: 'intent', retrieval: 'retrieval',
  generate: 'generate', validate: 'validate', schedule: 'schedule', publish: 'publish', reconcile: 'confirm'
};

const EXTRA_EXPLAIN: Partial<Record<NodeId, string>> = {
  queue: 'The accepted event is stored in PostgreSQL and handed to a pg-boss job in the same transaction. If the worker crashes, the job is still there.',
  model: 'External and untrusted. This demo shows a deterministic stand-in, never real model output. The model sees redacted text only and has no publishing token, tools or authority.',
  kstore: 'Versioned, approved records. Every fact in a reply is grounded in one of these, and the reply cites the record id and version.',
  decision: 'Code, not the model, decides what happens next: reply, clarify, skip, or hand to a person. Safety signals can only make the outcome stricter.',
  review: 'Terminal state for hard safety signals. No reply text is written and nothing is sent automatically; a person decides from the admin inbox.',
  fallback: 'Owner-approved fixed text used when the model is unavailable or a draft fails validation. It still passes through validation.',
  graph: 'The external Meta Graph API: the write target for the publisher and the read-back source for reconciliation. Simulated here.'
};

export interface ArchGraphProps {
  t: Dict;
  lang: Lang;
  trace: RunTrace | null;
  steps: RouteStep[];
  playback: Playback;
  reduced: boolean;
  deviceRef: RefObject<HTMLElement | null>;
  /** Called when the user asks to replay the shown run. */
  onReplay: () => void;
}

const NARROW_TITLE: Partial<Record<string, string[]>> = { kstore: ['Knowledge', 'store'], graph: ['Meta Graph', 'API'], review: ['Human', 'review'], fallback: ['Fallback'], model: ['Claude model', '(simulated)'] };

const STATE_LABEL: Record<NodeState, keyof Dict['nodeState']> = { standby: 'standby', active: 'active', done: 'done', warn: 'warn', hold: 'hold', fail: 'fail', skipped: 'skipped' };

function shapePath(shape: 'card' | 'external' | 'gate' | 'terminal', w: number, h: number): { tag: 'rect' | 'polygon'; props: Record<string, string | number> } {
  if (shape === 'gate') return { tag: 'polygon', props: { points: `16,0 ${w - 16},0 ${w},16 ${w},${h - 16} ${w - 16},${h} 16,${h} 0,${h - 16} 0,16` } };
  if (shape === 'external') return { tag: 'polygon', props: { points: `20,0 ${w - 20},0 ${w},${h / 2} ${w - 20},${h} 20,${h} 0,${h / 2}` } };
  return { tag: 'rect', props: { width: w, height: h, rx: shape === 'terminal' ? h / 2 : 12 } };
}

function NodeShape({ shape, w, h, className }: { shape: 'card' | 'external' | 'gate' | 'terminal'; w: number; h: number; className: string }) {
  const s = shapePath(shape, w, h);
  return s.tag === 'rect' ? <rect className={className} {...(s.props as { width: number; height: number; rx: number })} /> : <polygon className={className} points={s.props.points as string} />;
}

function chipWidth(label: string): number {
  return Math.round(label.length * 6.6 + 22);
}

export function ArchGraph({ t, lang, trace, steps, playback, reduced, deviceRef, onReplay }: ArchGraphProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [cw, setCw] = useState(0);
  const [ports, setPorts] = useState<DevicePorts | null>(null);
  const [hover, setHover] = useState<NodeId | null>(null);
  const [pinned, setPinned] = useState<NodeId | null>(null);
  const view: GraphView = playback.view;

  const sideBySide = useMedia('(min-width: 1180px)');
  const kind: LayoutKind = cw >= (sideBySide ? WIDE_MIN_SIDE : WIDE_MIN_STACKED) ? 'wide' : 'tall';
  const layout: Layout = LAYOUTS[kind];
  const svgW = kind === 'tall' ? Math.min(cw, TALL_MAX) : cw;
  const scale = svgW > 0 ? svgW / layout.width : 1;

  // Measure container width.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    setCw(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  // Measure where the device sits relative to the graph, to connect the two with real wires.
  const measure = useCallback(() => {
    const dev = deviceRef.current;
    const svg = svgRef.current;
    if (!dev || !svg || svgW <= 0) return;
    const d = dev.getBoundingClientRect();
    const s = svg.getBoundingClientRect();
    const sc = s.width / layout.width;
    if (sc <= 0) return;
    const side = d.right <= s.left + 6;
    let next: DevicePorts;
    if (side) {
      const x = (d.right - s.left) / sc;
      next = { mode: 'side', gap: -x, out: { x, y: (d.top + d.height * 0.3 - s.top) / sc }, in: { x, y: (d.top + d.height * 0.84 - s.top) / sc } };
    } else {
      // Stacked: wires run in the margins beside the suggestion chips, so they visibly touch the device.
      const block = dev.parentElement?.getBoundingClientRect() ?? d;
      // The phone can be narrower than its column (platform buttons and suggestions): clear the column edge too.
      const pad = Math.max(0, Math.min(block.right - d.right, d.left - block.left));
      const offPx = Math.max(6, Math.min(Math.min(22, d.left / 2, (window.innerWidth - d.right) / 2) + pad, d.left - 4, window.innerWidth - d.right - 4));
      next = {
        mode: 'below',
        gap: 0,
        off: offPx / sc,
        out: { x: (d.right - s.left) / sc, y: (d.top + d.height * 0.55 - s.top) / sc },
        in: { x: (d.left - s.left) / sc, y: (d.top + d.height * 0.8 - s.top) / sc },
        dropOut: (block.bottom + 26 - s.top) / sc,
        dropIn: (block.bottom + 10 - s.top) / sc
      };
    }
    setPorts((p) => (p && p.mode === next.mode && Math.abs(p.out.x - next.out.x) < 0.5 && Math.abs(p.out.y - next.out.y) < 0.5 && Math.abs(p.in.y - next.in.y) < 0.5 && Math.abs(p.in.x - next.in.x) < 0.5 && Math.abs((p.dropOut ?? 0) - (next.dropOut ?? 0)) < 0.5 ? p : next));
  }, [deviceRef, layout, svgW, kind]);

  useLayoutEffect(() => {
    measure();
  }, [measure, cw]);
  useEffect(() => {
    const dev = deviceRef.current;
    const ro = new ResizeObserver(measure);
    if (dev) ro.observe(dev);
    window.addEventListener('resize', measure);
    const id = window.setTimeout(measure, 200);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.clearTimeout(id);
    };
  }, [measure, deviceRef]);

  const edges = useMemo(() => {
    const base = buildEdges(layout);
    return ports ? { ...base, ...buildDeviceEdges(layout, ports) } : base;
  }, [layout, ports]);
  const edgeList = Object.values(edges) as BuiltEdge[];

  // ----- packet rendering: positions are pushed per frame, outside React
  const pathEls = useRef<Partial<Record<EdgeId, SVGPathElement | null>>>({});
  const lengths = useRef<Record<string, number>>({});
  const gEls = useRef<Array<SVGGElement | null>>([null, null]);
  const trailEls = useRef<Array<Array<SVGCircleElement | null>>>([[], []]);
  const chipEls = useRef<Array<SVGGElement | null>>([null, null]);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const layoutW = layout.width;

  useEffect(() => {
    return playback.subscribe((v) => {
      for (const lane of [0, 1] as const) {
        const g = gEls.current[lane];
        if (!g) continue;
        const pk = v.packets.find((p) => p.lane === lane);
        const path = pk ? pathEls.current[pk.edge] : null;
        if (!pk || !path || !path.isConnected) {
          g.style.opacity = '0';
          continue;
        }
        const key = `${pk.edge}`;
        let len = lengths.current[`${key}:${path.getAttribute('d')}`];
        if (len === undefined) {
          len = path.getTotalLength();
          lengths.current[`${key}:${path.getAttribute('d')}`] = len;
        }
        const fwd = reducedRef.current ? (pk.reverse ? 0 : 1) : pk.reverse ? 1 - pk.p : pk.p;
        const at = (f: number): Pt => path.getPointAtLength(Math.min(len!, Math.max(0, f * len!)));
        const pt = at(fwd);
        g.style.opacity = '1';
        g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        const dir = pk.reverse ? 1 : -1;
        trailEls.current[lane]!.forEach((c, i) => {
          if (!c) return;
          if (reducedRef.current || !pk.traveling) {
            c.setAttribute('opacity', '0');
            return;
          }
          const q = at(fwd + (dir * (i + 1) * 6) / len!);
          c.setAttribute('cx', (q.x - pt.x).toFixed(1));
          c.setAttribute('cy', (q.y - pt.y).toFixed(1));
          c.setAttribute('opacity', String(0.6 - i * 0.082));
        });
        const chip = chipEls.current[lane];
        if (chip) {
          const w = Number(chip.dataset.w ?? 100);
          const left = pt.x > layoutW * 0.66;
          const below = pt.y < 54;
          chip.setAttribute('transform', `translate(${left ? -w - 14 : 14} ${below ? 12 : -34})`);
        }
      }
    });
  }, [playback]);

  const packets = [0, 1].map((lane) => view.packets.find((p) => p.lane === lane) ?? null);

  const shownNode = hover ?? pinned;
  const shownRect = shownNode ? layout.nodes.find((n) => n.id === shownNode)?.rect : undefined;
  const svgLeft = kind === 'tall' ? Math.max(0, (cw - svgW) / 2) : 0;

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinned]);

  const state = (id: NodeId): NodeState => view.nodes[id];
  const idle = !trace;
  const where = describeWhere(t, view, idle);
  const schedNode = layout.nodes.find((n) => n.key === 'schedule')!;
  const caption = (n: LayoutNode): string | undefined => {
    if (n.id === 'kstore' && trace && trace.retrieved.length && (state('kstore') === 'done' || state('kstore') === 'active')) return (trace.retrieved.find((r) => r.cited) ?? trace.retrieved[0]!).id.replace('kb.', '');
    return NODE_META[n.id].caption;
  };

  return (
    <div className={`graph graph-${kind}`} ref={wrapRef} data-layout={kind} data-idle={idle ? '' : undefined} data-running={!idle && !view.done ? '' : undefined}>
      <div className="graph-head">
        <div className="graph-status" role="status" aria-live="polite">
          <span className={`dot ${!idle && !view.done ? 'live' : ''}`} aria-hidden="true" />
          <span className="packet-at">{where}</span>
        </div>
      <div className="graph-controls" role="group" aria-label={t.graph.controls}>
        <button className="gc" onClick={onReplay} disabled={!trace} aria-label={t.graph.replay} title={t.graph.replay}><Icon name="restart" size={15} /><span>{t.graph.replay}</span></button>
        <button className="gc" onClick={playback.togglePause} disabled={!trace || view.done} aria-label={playback.paused ? t.graph.play : t.graph.pause} title={playback.paused ? t.graph.play : t.graph.pause}><Icon name={playback.paused ? 'play' : 'pause'} size={15} /></button>
        <button className="gc" onClick={playback.skip} disabled={!trace || view.done} aria-label={t.graph.skip} title={t.graph.skip}><Icon name="skip" size={15} /></button>
        <div className="seg mini" role="radiogroup" aria-label={t.graph.speed}>
          {([1, 0.5] as const).map((s) => (
            <button key={s} role="radio" aria-checked={playback.speed === s} className={playback.speed === s ? 'on' : ''} onClick={() => playback.setSpeed(s)}>{s === 1 ? '1×' : '0.5×'}</button>
          ))}
        </div>
      </div>
      </div>

      <svg
        ref={svgRef}
        className="graph-svg"
        style={{ width: svgW || '100%', marginLeft: svgLeft }}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label={t.graph.aria}
      >
        <defs>
          <linearGradient id="g-flow" gradientUnits="userSpaceOnUse" x1={-120} y1="0" x2={layout.width} y2="0">
            <stop offset="0" stopColor="#4f9dff" />
            <stop offset="0.5" stopColor="#7c83ff" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="g-node" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f9dff" />
            <stop offset="0.55" stopColor="#7c83ff" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <filter id="blur-glow" x="-40%" y="-80%" width="180%" height="260%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <radialGradient id="g-packet">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.35" stopColor="#b9c2ff" />
            <stop offset="1" stopColor="#7c83ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* clusters */}
        {layout.clusters.map((c) => (
          <g key={c.id} className="cluster" data-cluster={c.id}>
            <rect x={c.rect.x} y={c.rect.y} width={c.rect.w} height={c.rect.h} rx={18} />
            <text x={c.rect.x + 16} y={c.rect.y + 17} className="cluster-label">{c.label}</text>
          </g>
        ))}

        {/* edges */}
        <g className="edges">
          {edgeList.map((e, i) => (
            <g key={e.id} className={`edge ${e.dashed ? 'dash' : ''} ${e.ext ? 'ext' : ''}`} data-edge={e.id} data-state={view.edges[e.id]} style={{ ['--i' as string]: i }}>
              <path className="halo" d={e.d} />
              <path className="base" d={e.d} ref={(el) => { pathEls.current[e.id] = el; }} />
              <path className="flow" d={e.d} />
              <path className="arrow" d={arrow(e.end.p, e.end.dir)} />
              {e.start && <path className="arrow" d={arrow(e.start.p, e.start.dir)} />}
              {e.label && kind === 'wide' && e.id !== 'dev_out' && e.id !== 'dev_in' && (
                <text className="edge-label" x={e.labelAt.x} y={e.labelAt.y} textAnchor="middle">{e.label}</text>
              )}
            </g>
          ))}
        </g>

        {/* nodes */}
        <g className="nodes">
          {layout.nodes.map((n) => {
            const meta = NODE_META[n.id];
            const st = state(n.id);
            const w = n.rect.w;
            const h = n.rect.h;
            const narrow = w < 130;
            const cap = caption(n);
            const lines = narrow ? NARROW_TITLE[n.id] ?? meta.title : meta.title;
            const eff = view.effects[n.id];
            return (
              <g
                key={n.key}
                className={`node shape-${meta.shape} ${narrow ? 'narrow' : ''}`}
                data-node={n.id}
                data-key={n.key}
                data-state={st}
                transform={`translate(${n.rect.x} ${n.rect.y})`}
                tabIndex={0}
                role="button"
                aria-label={`${meta.name}: ${t.nodeState[STATE_LABEL[st]]}`}
                aria-expanded={shownNode === n.id}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover((h0) => (h0 === n.id ? null : h0))}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover((h0) => (h0 === n.id ? null : h0))}
                onClick={() => setPinned((p) => (p === n.id ? null : n.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPinned((p) => (p === n.id ? null : n.id));
                  }
                }}
              >
                <NodeShape shape={meta.shape} w={w} h={h} className="glow" />
                <NodeShape shape={meta.shape} w={w} h={h} className="body" />
                <NodeShape shape={meta.shape} w={w} h={h} className="ring" />
                <g className="icon" transform={narrow ? `translate(9 ${h / 2 - 7.5}) scale(${15 / 24})` : `translate(13 ${h / 2 - 8}) scale(${16 / 24})`}><IconPaths name={meta.icon} /></g>
                {narrow ? (
                  <text className="title" x={31} y={lines.length > 1 ? h / 2 - 3 : h / 2 + 4}>
                    {lines.map((l, i) => <tspan key={l} x={31} dy={i === 0 ? 0 : 14}>{l}</tspan>)}
                  </text>
                ) : (
                  <text className="title" x={38} y={lines.length > 1 ? h / 2 - 3 : cap ? 24 : h / 2 + 5}>
                    {lines.map((l, i) => <tspan key={l} x={38} dy={i === 0 ? 0 : 15}>{l}</tspan>)}
                  </text>
                )}
                {!narrow && cap && lines.length === 1 && <text className="caption" x={38} y={42}>{cap}</text>}
                {(st === 'done' || st === 'fail' || st === 'warn' || st === 'hold') && (
                  <g className={`badge b-${st}`} transform={`translate(${w - 4} 4)`}>
                    <circle r="8" className="b-bg" />
                    {st === 'done' && <path d="m-3.6 0.2 2.4 2.4 4.4-5" />}
                    {st === 'fail' && <path d="m-3 -3 6 6M3 -3-6 6" />}
                    {st === 'warn' && <path d="M0 -4v4.5M0 3v.4" />}
                    {st === 'hold' && <path d="M-2 -3.5v7M2 -3.5v7" />}
                  </g>
                )}
                {n.id === 'schedule' && view.countdown !== null && (
                  <g className="ring-timer" transform={`translate(${w - 26} ${h / 2})`}>
                    <circle r="12" className="track" />
                    <circle r="12" className="prog" strokeDasharray={`${(view.countdown / (trace?.input.delaySeconds || 60)) * 75.4} 75.4`} transform="rotate(-90)" />
                    <text className="count" textAnchor="middle" y="4">{view.countdown}</text>
                  </g>
                )}
                {eff?.effect === 'ripple' && (
                  <g className="ripple" key={eff.stepId}>
                    <circle cx={w / 2} cy={h / 2} r="20" className="r1" />
                    <circle cx={w / 2} cy={h / 2} r="20" className="r2" />
                    <g transform={`translate(${w / 2} -14)`}>
                      <rect x="-56" y="-12" width="112" height="22" rx="11" className="pill" />
                      <text textAnchor="middle" y="3" className="pill-text">{t.graph.dedupe}</text>
                    </g>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* schedule note */}
        {view.countdown !== null && (
          kind === 'wide' ? (
            <text className="sched-note" x={schedNode.rect.x} y={schedNode.rect.y + schedNode.rect.h + 20}>{t.graph.scheduled}</text>
          ) : (
            <text className="sched-note" x={schedNode.rect.x + schedNode.rect.w + 8} y={schedNode.rect.y + 14}>
              {t.graph.scheduledShort.map((l, i) => <tspan key={l} x={schedNode.rect.x + schedNode.rect.w + 8} dy={i === 0 ? 0 : 14}>{l}</tspan>)}
            </text>
          )
        )}

        {/* packets */}
        {[0, 1].map((lane) => {
          const pk = packets[lane];
          const label = pk?.label ?? '';
          const w = chipWidth(label);
          return (
            <g key={lane} className={`packet lane-${lane} ${pk?.dying ? 'dying' : ''}`} style={{ opacity: 0 }} ref={(el) => { gEls.current[lane] = el; }}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <circle key={i} className="trail" r={5.4 - i * 0.55} ref={(el) => { trailEls.current[lane]![i] = el; }} opacity="0" />
              ))}
              {pk && !pk.traveling && <circle key={pk.stepId} className="pulse" r="9" />}
              <circle className="halo" r="19" fill="url(#g-packet)" />
              <circle className="core" r="6.2" />
              <g className="chip" data-w={w} ref={(el) => { chipEls.current[lane] = el; }}>
                <rect width={w} height="24" rx="12" />
                <text x={w / 2} y="16" textAnchor="middle">{label}</text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* node popover */}
      {shownNode && shownRect && (
        <Popover t={t} lang={lang} node={shownNode} trace={trace} state={state(shownNode)} pinned={pinned === shownNode} onClose={() => setPinned(null)} rect={shownRect} scale={scale} left={svgLeft} cw={cw} />
      )}

    </div>
  );
}

export function describeWhere(t: Dict, view: GraphView, idle: boolean): string {
  if (idle) return t.graph.idle;
  if (view.done) return t.graph.done;
  const node = view.packets.find((p) => p.lane === 0)?.node;
  if (!node) return t.graph.running;
  return `${t.graph.packetAt}: ${node === 'device' ? t.graph.device : NODE_META[node].name.replace(/ \(.*$/, '')}`;
}

function arrow(p: Pt, d: Pt): string {
  const s = 5.5;
  const nx = -d.y;
  const ny = d.x;
  const bx = p.x - d.x * s;
  const by = p.y - d.y * s;
  return `M ${bx + nx * 3.6} ${by + ny * 3.6} L ${p.x} ${p.y} L ${bx - nx * 3.6} ${by - ny * 3.6}`;
}

function Popover({ t, lang, node, trace, state, pinned, onClose, rect, scale, left, cw }: { t: Dict; lang: Lang; node: NodeId; trace: RunTrace | null; state: NodeState; pinned: boolean; onClose: () => void; rect: { x: number; y: number; w: number; h: number }; scale: number; left: number; cw: number }) {
  const meta = NODE_META[node as Exclude<NodeId, 'device'>];
  const stageId = NODE_STAGE[node];
  const stage = stageId ? STAGES.find((s) => s.id === stageId) : undefined;
  const text = (lang === 'sl' ? t.nodeExplain[node] : undefined) ?? stage?.explain ?? EXTRA_EXPLAIN[node] ?? '';
  const facts = trace ? nodeFacts(trace, node, lang).slice(0, 7) : [];
  const W = 320;
  const cx = left + (rect.x + rect.w / 2) * scale;
  const x = Math.max(8, Math.min(cw - W - 8, cx - W / 2));
  const below = rect.y * scale < 300;
  const y = below ? (rect.y + rect.h) * scale + 12 : rect.y * scale - 12;
  return (
    <div className={`popover ${below ? 'below' : 'above'}`} style={{ left: x, top: y, width: W, transform: below ? undefined : 'translateY(-100%)' }} role="dialog" aria-label={meta.name} data-node-popover={node}>
      <div className="pop-head">
        <div>
          <strong>{meta.name}</strong>
          <span className="pop-sub">{stage?.subsystem ?? (node === 'model' || node === 'graph' ? t.graph.external : '')}</span>
        </div>
        <span className={`state-chip s-${state}`}>{t.nodeState[STATE_LABEL[state]]}</span>
        {pinned && <button className="pop-x" onClick={onClose} aria-label={t.close}><Icon name="x" size={14} /></button>}
      </div>
      <p>{text}</p>
      {facts.length > 0 && (
        <dl className="pop-facts">
          <dt className="pop-run">{t.graph.thisRun}</dt>
          <dd />
          {facts.map(([k, v], i) => (
            <div key={`${k}-${i}`} className="pop-row"><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}
