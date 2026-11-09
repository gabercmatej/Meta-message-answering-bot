import type { EdgeId, NodeId } from './model';

/**
 * Geometry of the architecture graph, in two hand-authored layouts that share one topology:
 * `wide` (left-to-right bands, desktop) and `tall` (a single main lane with a side lane, mobile).
 * Everything is plain data plus a tiny orthogonal router, so the diagram stays easy to maintain.
 */

export type LayoutKind = 'wide' | 'tall';
export type Side = 'l' | 'r' | 't' | 'b';
export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

export type Shape = 'card' | 'external' | 'gate' | 'terminal';
export interface NodeMeta {
  id: NodeId;
  /** Title lines (already broken for the card width). */
  title: string[];
  caption?: string;
  icon: string;
  shape: Shape;
  /** Accessible full name. */
  name: string;
}

export const NODE_META: Record<Exclude<NodeId, 'device'>, NodeMeta> = {
  webhook: { id: 'webhook', title: ['Meta webhook'], caption: 'Edge · API', icon: 'webhook', shape: 'card', name: 'Meta webhook' },
  ingest: { id: 'ingest', title: ['Verify & ingest'], caption: 'HMAC · 1 txn', icon: 'shield', shape: 'card', name: 'Ingestion and verification' },
  normalize: { id: 'normalize', title: ['Event normalizer'], caption: 'many → 1 shape', icon: 'layers', shape: 'card', name: 'Event normalizer' },
  queue: { id: 'queue', title: ['Durable queue'], caption: 'PostgreSQL', icon: 'queue', shape: 'card', name: 'Durable inbox and queue' },
  context: { id: 'context', title: ['Context'], caption: 'Conversation', icon: 'context', shape: 'card', name: 'Conversation context' },
  intent: { id: 'intent', title: ['Intent & legal'], caption: 'Classification', icon: 'target', shape: 'card', name: 'Intent and legal classification' },
  model: { id: 'model', title: ['Claude model', '(simulated)'], icon: 'spark', shape: 'external', name: 'Claude model (simulated), external and untrusted' },
  retrieval: { id: 'retrieval', title: ['Retrieval'], caption: 'Approved facts', icon: 'search', shape: 'card', name: 'Knowledge retrieval' },
  kstore: { id: 'kstore', title: ['Knowledge store'], caption: 'Versioned', icon: 'db', shape: 'card', name: 'Knowledge store' },
  decision: { id: 'decision', title: ['Decision', '& policy'], icon: 'gate', shape: 'gate', name: 'Decision and policy' },
  review: { id: 'review', title: ['Human review'], caption: 'Person decides', icon: 'person', shape: 'terminal', name: 'Human review' },
  generate: { id: 'generate', title: ['Generation'], caption: 'Writer (model)', icon: 'pen', shape: 'card', name: 'Response generation' },
  fallback: { id: 'fallback', title: ['Fallback'], caption: 'Approved text', icon: 'lifebuoy', shape: 'card', name: 'Approved fallback' },
  validate: { id: 'validate', title: ['Validation'], caption: 'Deterministic', icon: 'check-circle', shape: 'card', name: 'Response validation' },
  schedule: { id: 'schedule', title: ['Scheduler'], caption: 'Cancellable', icon: 'timer', shape: 'card', name: 'Scheduler' },
  publish: { id: 'publish', title: ['Meta publisher'], caption: 'The only writer', icon: 'send', shape: 'card', name: 'Meta publisher' },
  reconcile: { id: 'reconcile', title: ['Reconciliation'], caption: 'Confirm · read', icon: 'sync', shape: 'card', name: 'Delivery reconciliation' },
  graph: { id: 'graph', title: ['Meta Graph API'], caption: 'external', icon: 'globe', shape: 'external', name: 'Meta Graph API (external)' }
};

export interface LayoutNode { key: string; id: Exclude<NodeId, 'device'>; rect: Rect }
export interface LayoutCluster { id: 'edge' | 'worker' | 'delivery'; label: string; rect: Rect }
export interface Layout { kind: LayoutKind; width: number; height: number; nodes: LayoutNode[]; clusters: LayoutCluster[] }

const W = 160;
const H = 56;

function wideLayout(): Layout {
  const cx = [36, 232, 428, 624, 820];
  const ry = [46, 176, 272, 368, 498, 592];
  const n = (id: LayoutNode['id'], c: number, r: number): LayoutNode => ({ key: id, id, rect: { x: cx[c]!, y: ry[r]!, w: W, h: H } });
  const nodes: LayoutNode[] = [
    n('webhook', 0, 0), n('ingest', 1, 0), n('normalize', 2, 0), n('queue', 3, 0),
    n('context', 0, 1), n('intent', 1, 1), n('retrieval', 2, 1), n('decision', 3, 1), n('review', 4, 1),
    n('model', 1, 2), n('kstore', 2, 2), n('generate', 3, 2), n('fallback', 4, 2),
    n('validate', 3, 3),
    n('reconcile', 1, 4), n('publish', 2, 4), n('schedule', 3, 4), n('graph', 2, 5)
  ];
  return {
    kind: 'wide',
    width: 1000,
    height: 676,
    nodes,
    clusters: [
      { id: 'edge', label: 'EDGE · API', rect: { x: 16, y: 16, w: 968, h: 102 } },
      { id: 'worker', label: 'WORKER · DECISION', rect: { x: 16, y: 146, w: 968, h: 294 } },
      { id: 'delivery', label: 'DELIVERY', rect: { x: 16, y: 446, w: 968, h: 218 } }
    ]
  };
}

function tallLayout(): Layout {
  const mainX = 40;
  const mw = 170;
  const mh = 52;
  const rowY = (i: number) => 36 + 78 * i + (i >= 4 ? 22 : 0) + (i >= 10 ? 22 : 0);
  const m = (id: LayoutNode['id'], row: number): LayoutNode => ({ key: id, id, rect: { x: mainX, y: rowY(row), w: mw, h: mh } });
  const laneX = 238;
  const lw = 122;
  const lane = (id: LayoutNode['id'], row: number, key: string = id, dy = 0): LayoutNode => ({ key, id, rect: { x: laneX, y: rowY(row) + dy, w: lw, h: mh } });
  const nodes: LayoutNode[] = [
    m('webhook', 0), m('ingest', 1), m('normalize', 2), m('queue', 3), m('context', 4), m('intent', 5), m('retrieval', 6), m('decision', 7), m('generate', 8), m('validate', 9), m('schedule', 10), m('publish', 11), m('reconcile', 12),
    lane('model', 5), lane('kstore', 6), lane('review', 7), lane('model', 8, 'model#2'), lane('fallback', 9), lane('graph', 11, 'graph', 39)
  ];
  const bounds = (keys: string[], pad: { l: number; r: number; t: number; b: number }): Rect => {
    const rs = nodes.filter((nd) => keys.includes(nd.key)).map((nd) => nd.rect);
    const x0 = Math.min(...rs.map((r) => r.x)) - pad.l;
    const y0 = Math.min(...rs.map((r) => r.y)) - pad.t;
    const x1 = Math.max(...rs.map((r) => r.x + r.w)) + pad.r;
    const y1 = Math.max(...rs.map((r) => r.y + r.h)) + pad.b;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  const pad = { l: 14, r: 8, t: 26, b: 12 };
  return {
    kind: 'tall',
    width: 372,
    height: 1096,
    nodes,
    clusters: [
      { id: 'edge', label: 'EDGE · API', rect: bounds(['webhook', 'ingest', 'normalize', 'queue'], pad) },
      { id: 'worker', label: 'WORKER · DECISION', rect: bounds(['context', 'intent', 'retrieval', 'decision', 'generate', 'validate', 'model', 'kstore', 'review', 'model#2', 'fallback'], pad) },
      { id: 'delivery', label: 'DELIVERY', rect: bounds(['schedule', 'publish', 'reconcile', 'graph'], pad) }
    ]
  };
}

export const LAYOUTS: Record<LayoutKind, Layout> = { wide: wideLayout(), tall: tallLayout() };

// ---------------------------------------------------------------------------------- edges

interface Spec {
  from: string;
  to: string;
  fs: Side;
  ts: Side;
  fo?: number;
  to_?: number;
  /** Override the horizontal/vertical mid coordinate of a Z route. */
  mid?: number;
  /** Fully custom path builder (loops and arcs). */
  curve?: (from: Rect, to: Rect) => string;
  dashed?: boolean;
  bidir?: boolean;
  /** `ext` edges cross the system boundary (model, Graph). */
  ext?: boolean;
  label?: string;
  labelAt?: Pt;
  labelPos?: (from: Rect, to: Rect) => Pt;
}

type SpecMap = Partial<Record<EdgeId, Spec>>;

function port(r: Rect, side: Side, off = 0): Pt {
  switch (side) {
    case 'l': return { x: r.x, y: r.y + r.h / 2 + off };
    case 'r': return { x: r.x + r.w, y: r.y + r.h / 2 + off };
    case 't': return { x: r.x + r.w / 2 + off, y: r.y };
    case 'b': return { x: r.x + r.w / 2 + off, y: r.y + r.h };
  }
}

const horiz = (s: Side) => s === 'l' || s === 'r';

const WIDE: SpecMap = {
  webhook_ingest: { from: 'webhook', to: 'ingest', fs: 'r', ts: 'l' },
  ingest_normalize: { from: 'ingest', to: 'normalize', fs: 'r', ts: 'l' },
  normalize_queue: { from: 'normalize', to: 'queue', fs: 'r', ts: 'l' },
  queue_context: { from: 'queue', to: 'context', fs: 'b', ts: 't', to_: 66, mid: 132 },
  context_intent: { from: 'context', to: 'intent', fs: 'r', ts: 'l' },
  intent_model: { from: 'intent', to: 'model', fs: 'b', ts: 't', bidir: true, ext: true },
  intent_retrieval: { from: 'intent', to: 'retrieval', fs: 'r', ts: 'l' },
  retrieval_kstore: { from: 'retrieval', to: 'kstore', fs: 'b', ts: 't', bidir: true },
  retrieval_decision: { from: 'retrieval', to: 'decision', fs: 'r', ts: 'l' },
  decision_review: { from: 'decision', to: 'review', fs: 'r', ts: 'l', label: 'human-only', labelPos: (a, b) => ({ x: (a.x + a.w + b.x) / 2, y: a.y - 7 }) },
  decision_generate: { from: 'decision', to: 'generate', fs: 'b', ts: 't' },
  generate_model: { from: 'generate', to: 'model', fs: 'b', ts: 'b', fo: -36, bidir: true, ext: true },
  generate_fallback: { from: 'generate', to: 'fallback', fs: 'r', ts: 'l', dashed: true, label: 'model unavailable', labelPos: (a, b) => ({ x: (a.x + a.w + b.x) / 2, y: a.y - 7 }) },
  fallback_validate: { from: 'fallback', to: 'validate', fs: 'b', ts: 'r', dashed: true },
  generate_validate: { from: 'generate', to: 'validate', fs: 'b', ts: 't', fo: 30, to_: 30 },
  validate_schedule: { from: 'validate', to: 'schedule', fs: 'b', ts: 't' },
  schedule_publish: { from: 'schedule', to: 'publish', fs: 'l', ts: 'r' },
  publish_graph: { from: 'publish', to: 'graph', fs: 'b', ts: 't', ext: true, label: 'write', labelPos: (a) => ({ x: a.x + a.w / 2 + 24, y: a.y + a.h + 24 }) },
  publish_reconcile: { from: 'publish', to: 'reconcile', fs: 'l', ts: 'r' },
  reconcile_graph: { from: 'reconcile', to: 'graph', fs: 'b', ts: 'l', bidir: true, ext: true, label: 'read-back', labelPos: (a) => ({ x: a.x + a.w / 2 - 34, y: a.y + a.h + 46 }) },
  retry: { from: 'publish', to: 'publish', fs: 't', ts: 't', dashed: true, label: 'retry · backoff', curve: (r) => `M ${r.x + r.w / 2 + 22} ${r.y} C ${r.x + r.w / 2 + 10} ${r.y - 62}, ${r.x + r.w / 2 + 78} ${r.y - 62}, ${r.x + r.w / 2 + 62} ${r.y}` },
  resend: { from: 'reconcile', to: 'publish', fs: 't', ts: 't', dashed: true, label: 'resend', curve: (a, b) => `M ${a.x + a.w / 2} ${a.y} C ${a.x + a.w / 2} ${a.y - 70}, ${b.x + b.w / 2 - 34} ${b.y - 70}, ${b.x + b.w / 2 - 34} ${b.y}` }
};

const TALL: SpecMap = {
  webhook_ingest: { from: 'webhook', to: 'ingest', fs: 'b', ts: 't' },
  ingest_normalize: { from: 'ingest', to: 'normalize', fs: 'b', ts: 't' },
  normalize_queue: { from: 'normalize', to: 'queue', fs: 'b', ts: 't' },
  queue_context: { from: 'queue', to: 'context', fs: 'b', ts: 't' },
  context_intent: { from: 'context', to: 'intent', fs: 'b', ts: 't' },
  intent_model: { from: 'intent', to: 'model', fs: 'r', ts: 'l', bidir: true, ext: true },
  intent_retrieval: { from: 'intent', to: 'retrieval', fs: 'b', ts: 't' },
  retrieval_kstore: { from: 'retrieval', to: 'kstore', fs: 'r', ts: 'l', bidir: true },
  retrieval_decision: { from: 'retrieval', to: 'decision', fs: 'b', ts: 't' },
  decision_review: { from: 'decision', to: 'review', fs: 'r', ts: 'l' },
  decision_generate: { from: 'decision', to: 'generate', fs: 'b', ts: 't' },
  generate_model: { from: 'generate', to: 'model#2', fs: 'r', ts: 'l', fo: -12, to_: -12, bidir: true, ext: true },
  generate_fallback: { from: 'generate', to: 'fallback', fs: 'r', ts: 'l', fo: 16, to_: -12, dashed: true },
  fallback_validate: { from: 'fallback', to: 'validate', fs: 'l', ts: 'r', fo: 12, to_: 12, dashed: true },
  generate_validate: { from: 'generate', to: 'validate', fs: 'b', ts: 't' },
  validate_schedule: { from: 'validate', to: 'schedule', fs: 'b', ts: 't' },
  schedule_publish: { from: 'schedule', to: 'publish', fs: 'b', ts: 't' },
  publish_graph: { from: 'publish', to: 'graph', fs: 'r', ts: 'l', to_: -12, ext: true },
  publish_reconcile: { from: 'publish', to: 'reconcile', fs: 'b', ts: 't' },
  reconcile_graph: { from: 'reconcile', to: 'graph', fs: 'r', ts: 'l', to_: 12, bidir: true, ext: true },
  retry: { from: 'publish', to: 'publish', fs: 'l', ts: 'l', dashed: true, label: 'retry', curve: (r) => `M ${r.x} ${r.y + r.h / 2 - 12} C ${r.x - 30} ${r.y + r.h / 2 - 12}, ${r.x - 30} ${r.y + r.h / 2 + 12}, ${r.x} ${r.y + r.h / 2 + 12}` },
  resend: { from: 'reconcile', to: 'publish', fs: 'l', ts: 'l', dashed: true, label: 'resend', curve: (a, b) => `M ${a.x} ${a.y + 12} C ${a.x - 44} ${a.y + 12}, ${b.x - 44} ${b.y + b.h - 14}, ${b.x} ${b.y + b.h - 14}` }
};

export interface BuiltEdge {
  id: EdgeId;
  d: string;
  /** Tip positions with direction, for arrowheads. */
  end: { p: Pt; dir: Pt };
  start?: { p: Pt; dir: Pt };
  dashed: boolean;
  ext: boolean;
  label?: string;
  labelAt: Pt;
}

function rounded(pts: Pt[], r = 12): string {
  const clean = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) > 0.01);
  if (clean.length < 2) return '';
  let d = `M ${clean[0]!.x} ${clean[0]!.y}`;
  for (let i = 1; i < clean.length - 1; i++) {
    const a = clean[i - 1]!;
    const b = clean[i]!;
    const c = clean[i + 1]!;
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const p1 = { x: b.x - ((b.x - a.x) / l1) * rr, y: b.y - ((b.y - a.y) / l1) * rr };
    const p2 = { x: b.x + ((c.x - b.x) / l2) * rr, y: b.y + ((c.y - b.y) / l2) * rr };
    d += ` L ${p1.x} ${p1.y} Q ${b.x} ${b.y} ${p2.x} ${p2.y}`;
  }
  const last = clean[clean.length - 1]!;
  return `${d} L ${last.x} ${last.y}`;
}

function auto(a: Pt, fs: Side, b: Pt, ts: Side, mid?: number): Pt[] {
  if (fs === ts && !horiz(fs)) {
    const y = (fs === 'b' ? Math.max(a.y, b.y) + 18 : Math.min(a.y, b.y) - 18);
    return [a, { x: a.x, y }, { x: b.x, y }, b];
  }
  if (!horiz(fs) && !horiz(ts)) {
    if (Math.abs(a.x - b.x) < 0.5) return [a, b];
    const y = mid ?? (a.y + b.y) / 2;
    return [a, { x: a.x, y }, { x: b.x, y }, b];
  }
  if (horiz(fs) && horiz(ts)) {
    if (Math.abs(a.y - b.y) < 0.5) return [a, b];
    const x = mid ?? (a.x + b.x) / 2;
    return [a, { x, y: a.y }, { x, y: b.y }, b];
  }
  return horiz(fs) ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b];
}

const dirOf = (a: Pt, b: Pt): Pt => {
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
};

/** Pure edges for a layout. Device wires are built separately from measured ports. */
export function buildEdges(layout: Layout): Partial<Record<EdgeId, BuiltEdge>> {
  const specs = layout.kind === 'wide' ? WIDE : TALL;
  const rect = (key: string): Rect => {
    const found = layout.nodes.find((n) => n.key === key);
    if (!found) throw new Error(`missing node ${key} in ${layout.kind}`);
    return found.rect;
  };
  const out: Partial<Record<EdgeId, BuiltEdge>> = {};
  for (const [id, s] of Object.entries(specs) as Array<[EdgeId, Spec]>) {
    const a = rect(s.from);
    const b = rect(s.to);
    if (s.curve) {
      const d = s.curve(a, b);
      const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const end = { x: nums[nums.length - 2]!, y: nums[nums.length - 1]! };
      const ctrl = { x: nums[nums.length - 4]!, y: nums[nums.length - 3]! };
      const mid = { x: nums[0]! + (end.x - nums[0]!) / 2, y: Math.min(nums[1]!, end.y) - (layout.kind === 'wide' ? 40 : 0) };
      out[id] = { id, d, end: { p: end, dir: dirOf(ctrl, end) }, dashed: true, ext: false, ...(s.label ? { label: s.label } : {}), labelAt: layout.kind === 'wide' ? { x: mid.x, y: mid.y - 6 } : { x: Math.min(nums[0]!, end.x) - 34, y: (nums[1]! + end.y) / 2 + 4 } };
      continue;
    }
    const p1 = port(a, s.fs, s.fo ?? 0);
    const p2 = port(b, s.ts, s.to_ ?? 0);
    const pts = auto(p1, s.fs, p2, s.ts, s.mid);
    const mid = pts[Math.floor(pts.length / 2)]!;
    out[id] = {
      id,
      d: rounded(pts),
      end: { p: p2, dir: dirOf(pts[pts.length - 2]!, p2) },
      ...(s.bidir ? { start: { p: p1, dir: dirOf(pts[1]!, p1) } } : {}),
      dashed: !!s.dashed,
      ext: !!s.ext,
      ...(s.label ? { label: s.label } : {}),
      labelAt: s.labelPos ? s.labelPos(a, b) : s.labelAt ?? { x: (pts[0]!.x + mid.x) / 2 + (horiz(s.fs) ? 0 : 8), y: (pts[0]!.y + mid.y) / 2 - (horiz(s.fs) ? 8 : 0) }
    };
  }
  return out;
}

export interface DevicePorts {
  /** Where the outbound wire leaves the device (design coordinates of the graph svg). */
  out: Pt;
  /** Where the return wire enters the device. */
  in: Pt;
  /** `side`: the wire meets the device's right edge (side by side) or bottom edge (stacked). */
  mode: 'side' | 'below';
  /** Free space between device and graph, in design units. */
  gap: number;
  /** Stacked mode: wires run beside the suggestion chips; these are design-unit coordinates. */
  off?: number;
  dropOut?: number;
  dropIn?: number;
}

/** The two wires that connect the social device to the graph. */
export function buildDeviceEdges(layout: Layout, dev: DevicePorts): Pick<Record<EdgeId, BuiltEdge>, 'dev_out' | 'dev_in'> {
  const rect = (id: string) => layout.nodes.find((n) => n.key === id)!.rect;
  const wh = rect('webhook');
  const rc = rect('reconcile');
  let outPts: Pt[];
  let inPts: Pt[];
  if (dev.mode === 'side') {
    const gx1 = dev.out.x + dev.gap * 0.62;
    const gx2 = dev.out.x + dev.gap * 0.3;
    const wy = wh.y + wh.h / 2;
    outPts = [dev.out, { x: gx1, y: dev.out.y }, { x: gx1, y: wy }, { x: wh.x, y: wy }];
    const ry = rc.y + rc.h / 2;
    inPts = [{ x: rc.x, y: ry }, { x: gx2, y: ry }, { x: gx2, y: dev.in.y }, dev.in];
  } else {
    // Stacked: out leaves the device's right edge, drops beside the chips and enters the webhook from above;
    // the return wire climbs the left side into the device's left edge. The two never cross.
    const off = dev.off ?? 18;
    const dropOut = dev.dropOut ?? dev.out.y + 60;
    const dropIn = dev.dropIn ?? dev.in.y + 50;
    const wx = wh.x + wh.w / 2 + 30;
    const ox = dev.out.x + off;
    outPts = [dev.out, { x: ox, y: dev.out.y }, { x: ox, y: dropOut }, { x: wx, y: dropOut }, { x: wx, y: wh.y }];
    const lx = dev.in.x - off;
    if (layout.kind === 'wide') {
      const ry = rc.y + rc.h / 2;
      inPts = [{ x: rc.x, y: ry }, { x: -14, y: ry }, { x: -14, y: dropIn }, { x: lx, y: dropIn }, { x: lx, y: dev.in.y }, dev.in];
    } else {
      const bx = rc.x + rc.w / 2;
      const by = rc.y + rc.h;
      const lx0 = Math.min(2, lx);
      inPts = [{ x: bx, y: by }, { x: bx, y: by + 16 }, { x: lx0, y: by + 16 }, { x: lx0, y: dropIn }];
      if (lx > lx0 + 1) inPts.push({ x: lx, y: dropIn });
      inPts.push({ x: lx, y: dev.in.y }, dev.in);
    }
  }
  const mk = (id: EdgeId, pts: Pt[], label: string): BuiltEdge => ({
    id,
    d: rounded(pts, 14),
    end: { p: pts[pts.length - 1]!, dir: dirOf(pts[pts.length - 2]!, pts[pts.length - 1]!) },
    dashed: false,
    ext: false,
    label,
    labelAt: { x: pts[1]!.x, y: pts[1]!.y - 8 }
  });
  return { dev_out: mk('dev_out', outPts, ''), dev_in: mk('dev_in', inPts, '') };
}
