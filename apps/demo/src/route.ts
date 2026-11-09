import { EDGE_ENDS, ALL_EDGES, ALL_NODES, type EdgeId, type EdgeState, type NodeId, type NodeState } from './graph/model';
import type { RunTrace, StageId } from './sim/types';

/**
 * The route a message takes through the architecture graph, derived purely from the simulator's
 * RunTrace (stages, injected fault, action, attempts). The renderer never invents a path: whatever
 * the packet does on screen is a step in this list.
 */

export type Outcome = 'ok' | 'warn' | 'fail' | 'hold' | 'skip';
export type Effect = 'ripple' | 'flash' | 'backoff' | 'countdown' | 'readback';

export interface RouteStep {
  id: string;
  /** 0 is the real message; 1 is a second, duplicate delivery. */
  lane: 0 | 1;
  /** Lane-1 chains begin when this lane-0 step begins. */
  startAfter?: string;
  edge: EdgeId;
  /** True when the packet travels the edge against its forward direction. */
  reverse: boolean;
  /** Node the packet arrives at. */
  node: NodeId;
  travelMs: number;
  dwellMs: number;
  /** State the node settles into once the dwell is over ('skip' = passed through, never active). */
  outcome: Outcome;
  /** Payload chip text while this step runs. */
  label: string;
  effect?: Effect;
  stage?: StageId;
}

const TRAVEL = 190;
const DWELL = 120;
/** The configured delay is shown accelerated: 60 s of waiting plays in about 1.2 s. */
export const SCHEDULE_PLAY_MS = 1200;

export function fmtBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

const POST_PATH: Record<string, string> = {
  messenger_send: 'POST /messages',
  instagram_dm_send: 'POST /messages',
  facebook_comment_reply: 'POST /comments',
  instagram_comment_reply: 'POST /replies'
};

function edgeBetween(a: NodeId, b: NodeId): EdgeId {
  for (const e of ALL_EDGES) {
    if (e === 'retry' || e === 'resend') continue;
    const [f, t] = EDGE_ENDS[e];
    if (f === a && t === b) return e;
  }
  for (const e of ALL_EDGES) {
    if (e === 'retry' || e === 'resend') continue;
    const [f, t] = EDGE_ENDS[e];
    if (f === b && t === a) return e;
  }
  throw new Error(`no edge between ${a} and ${b}`);
}

interface Opts {
  edge?: EdgeId;
  travel?: number;
  dwell?: number;
  effect?: Effect;
  stage?: StageId;
}

export function buildRoute(trace: RunTrace): RouteStep[] {
  const steps: RouteStep[] = [];
  let at: NodeId = 'device';
  let n = 0;
  const stage = (id: StageId) => trace.stages.find((s) => s.id === id);
  const make = (lane: 0 | 1, from: NodeId, node: NodeId, label: string, outcome: Outcome, o: Opts): RouteStep => {
    const edge = o.edge ?? edgeBetween(from, node);
    const ends = EDGE_ENDS[edge];
    return {
      id: `${lane === 0 ? 's' : 'd'}${n++}-${node}`,
      lane,
      edge,
      reverse: ends[0] !== ends[1] && ends[1] !== node,
      node,
      travelMs: o.travel ?? TRAVEL,
      dwellMs: o.dwell ?? DWELL,
      outcome,
      label,
      ...(o.effect ? { effect: o.effect } : {}),
      ...(o.stage ? { stage: o.stage } : {})
    };
  };
  const go = (node: NodeId, label: string, outcome: Outcome = 'ok', o: Opts = {}): RouteStep => {
    const step = make(0, at, node, label, outcome, o);
    steps.push(step);
    at = node;
    return step;
  };

  const { classification: cls, input } = trace;
  const fault = input.fault;
  const bytes = JSON.stringify(trace.webhookPayload).length;
  const surface = String((trace.normalizedEvent as { surface?: string }).surface ?? input.channel);

  const sl = input.lang === 'sl';
  /** Payload chip text in the run's language (the English strings are what the route tests assert). */
  const T = (en: string, slText: string): string => (sl ? slText : en);

  // ------------------------------------------------------------------ edge / API
  go('webhook', `webhook · ${fmtBytes(bytes)}`, 'ok', { travel: 340, stage: 'webhook' });
  go('ingest', T('HMAC verified · 1 txn', 'HMAC preverjen · 1 transakcija'), 'ok', { stage: 'signature' });
  go('normalize', `${T('event', 'dogodek')} · ${surface}`, 'ok', { stage: 'normalize' });
  const toQueue = go('queue', T('job queued · pg-boss', 'opravilo v vrsti · pg-boss'), 'ok');

  if (fault === 'duplicate_webhook') {
    // A second delivery of the same event enters while the first is already in the queue.
    const first = { ...make(1, 'device', 'webhook', T('webhook · duplicate', 'webhook · dvojnik'), 'ok', { travel: 300 }), startAfter: toQueue.id };
    steps.push(first);
    steps.push(make(1, 'webhook', 'ingest', T('HMAC verified', 'HMAC preverjen'), 'ok', {}));
    steps.push(make(1, 'ingest', 'normalize', T('dedupe key seen', 'ključ že viden'), 'warn', { dwell: 900, effect: 'ripple' }));
  }

  // ------------------------------------------------------------------ worker: understanding
  const turns = input.history.length;
  go('context', sl ? `kontekst · ${turns} prejšnjih obratov` : `context · ${turns} earlier turn${turns === 1 ? '' : 's'}`, 'ok', { stage: 'context', travel: 300 });
  const intentStage = stage('intent');
  go('intent', T('classifying', 'razvrščanje'), 'ok', { stage: 'intent', dwell: 90 });
  go('model', T('redacted text → model', 'redigirano besedilo → model'), 'ok', { dwell: 230, edge: 'intent_model' });
  go('intent', `${T('intent', 'namen')}: ${cls.topic}`, intentStage?.status === 'hold' ? 'warn' : 'ok', { edge: 'intent_model', dwell: 150, stage: 'legal_area' });

  // ------------------------------------------------------------------ retrieval
  const noRetrieval = trace.action === 'review' || trace.action === 'skip';
  if (noRetrieval) {
    go('retrieval', T('retrieval not needed', 'iskanje ni potrebno'), 'skip', { travel: 120, dwell: 0, stage: 'retrieval' });
  } else {
    go('retrieval', `${T('legal area', 'pravno področje')}: ${cls.legalArea}`, 'ok', { stage: 'retrieval' });
    if (trace.retrieved.length > 0) {
      const top = trace.retrieved.find((r) => r.cited) ?? trace.retrieved[0]!;
      const nEntries = trace.retrieved.length;
      go('kstore', `${top.id} v${top.version}`, 'ok', { dwell: 200 });
      go('retrieval', sl ? `${nEntries} zapisov · najboljši rezultat ${top.score}` : `${nEntries} entr${nEntries === 1 ? 'y' : 'ies'} · top score ${top.score}`, 'ok', { edge: 'retrieval_kstore', dwell: 80 });
    }
  }
  go('decision', `${T('route', 'pot')}: ${trace.routeCode}`, 'ok', { edge: 'retrieval_decision', dwell: 220 });

  // ------------------------------------------------------------------ branches
  if (trace.action === 'review') {
    go('review', T('held for a person', 'zadržano za osebo'), 'hold', { dwell: 700, effect: 'flash' });
    return steps;
  }
  if (trace.action === 'skip') {
    // Terminal at the gate: nothing to send, nobody to involve.
    steps[steps.length - 1] = { ...steps[steps.length - 1]!, label: T('no reply needed', 'odgovor ni potreben'), dwellMs: 600 };
    return steps;
  }

  const aiFailed = stage('generate')?.status === 'fail';
  const chars = trace.replyText?.length ?? 0;
  const approvedText = trace.replySource === 'approved_text';
  go('generate', aiFailed ? T('calling model…', 'klic modela…') : approvedText ? T('approved text · no model', 'odobreno besedilo · brez modela') : T('drafting…', 'pisanje osnutka…'), 'ok', { stage: 'generate', dwell: approvedText ? 180 : 90 });
  if (aiFailed) {
    go('model', T('timeout · 8 s', 'časovna omejitev · 8 s'), 'fail', { edge: 'generate_model', dwell: 520, effect: 'flash' });
    go('generate', T('AI unavailable', 'AI ni na voljo'), 'fail', { edge: 'generate_model', dwell: 90 });
    go('fallback', T('approved fallback text', 'odobreno rezervno besedilo'), 'ok', { edge: 'generate_fallback', dwell: 200 });
    go('validate', T('fallback checked', 'rezerva preverjena'), 'warn', { edge: 'fallback_validate', stage: 'validate' });
  } else {
    if (trace.replySource === 'ai_draft') {
      go('model', T('schema-validated draft', 'osnutek, validiran po shemi'), 'ok', { edge: 'generate_model', dwell: 230 });
      go('generate', sl ? `osnutek · ${chars} znakov` : `draft · ${chars} chars`, 'ok', { edge: 'generate_model', dwell: 90 });
    }
    const v = stage('validate');
    go('validate', trace.replySource === 'approved_fallback' ? T('fallback checked', 'rezerva preverjena') : T('validated', 'preverjeno'), v?.status === 'warn' ? 'warn' : 'ok', { edge: 'generate_validate', stage: 'validate' });
  }

  // ------------------------------------------------------------------ delivery
  const delay = input.delaySeconds;
  go('schedule', delay > 0 ? T(`scheduled ${delay} s`, `načrtovano ${delay} s`) : T('send now', 'pošlji zdaj'), 'ok', { stage: 'schedule', dwell: delay > 0 ? SCHEDULE_PLAY_MS : 150, ...(delay > 0 ? { effect: 'countdown' as const } : {}) });
  const post = POST_PATH[trace.attempts[0]?.endpoint ?? ''] ?? 'POST /messages';
  go('publish', post, 'ok', { stage: 'publish', dwell: 160 });

  const write = (label: string, outcome: Outcome, o: Opts = {}) => go('graph', label, outcome, { edge: 'publish_graph', ...o });
  const back = (label: string, outcome: Outcome, o: Opts = {}) => go('publish', label, outcome, { edge: 'publish_graph', dwell: 90, ...o });
  const gotId = T('message id received', 'id sporočila prejet');
  const confirmed = T('confirmed', 'potrjeno');

  if (fault === 'meta_throttled') {
    write(T('429 rate limited', '429 omejitev hitrosti'), 'fail', { dwell: 320, effect: 'flash' });
    back(T('backoff 2 s', 'zakasnitev 2 s'), 'warn', { dwell: 420, effect: 'backoff' });
    go('publish', T('retry · attempt 2', 'ponovni poskus · 2'), 'ok', { edge: 'retry', travel: 380, dwell: 120 });
    write('200 OK', 'ok');
    back(gotId, 'ok');
    go('reconcile', confirmed, 'ok', { stage: 'confirm', dwell: 160 });
  } else if (fault === 'outcome_unknown_found' || fault === 'outcome_unknown_absent') {
    write(T('timeout · write unknown', 'časovna omejitev · zapis neznan'), 'warn', { dwell: 420, effect: 'flash' });
    back('outcome_unknown', 'warn', { dwell: 120 });
    go('reconcile', 'outcome_unknown', 'warn', { stage: 'confirm', dwell: 140 });
    if (fault === 'outcome_unknown_found') {
      go('graph', T('read-back: reply found', 'branje nazaj: odgovor najden'), 'ok', { edge: 'reconcile_graph', dwell: 300, effect: 'readback' });
      go('reconcile', 'reconciled_sent', 'ok', { edge: 'reconcile_graph', dwell: 160 });
    } else {
      go('graph', T('read-back: reply absent', 'branje nazaj: odgovora ni'), 'warn', { edge: 'reconcile_graph', dwell: 300, effect: 'readback' });
      go('reconcile', T('absent → resend', 'ni odgovora → ponovno pošiljanje'), 'warn', { edge: 'reconcile_graph', dwell: 120 });
      go('publish', T('resend · attempt 2', 'ponovno pošiljanje · 2'), 'ok', { edge: 'resend', travel: 420, dwell: 120 });
      write('200 OK', 'ok');
      back(gotId, 'ok');
      go('reconcile', confirmed, 'ok', { edge: 'publish_reconcile', dwell: 160 });
    }
  } else {
    write('200 OK', 'ok');
    back(gotId, 'ok');
    go('reconcile', confirmed, 'ok', { stage: 'confirm', dwell: 160 });
  }
  go('device', confirmed, 'ok', { edge: 'dev_in', travel: 380, dwell: 0 });
  return steps;
}

/** Short human summary of the route, e.g. "Grounded reply → validated → scheduled 60 s → delivered". */
export function routeSummary(trace: RunTrace): string[] {
  const out: string[] = [];
  if (trace.action === 'review') return ['Hard safety signal', 'No AI text', 'Held for a person'];
  if (trace.action === 'skip') return ['Public remark, no question', 'No reply needed'];
  if (trace.replySource === 'approved_fallback') out.push(trace.input.fault === 'ai_unavailable' ? 'AI timeout → approved fallback' : 'Safe fallback');
  else if (trace.replySource === 'approved_text') out.push('Approved text');
  else out.push(trace.retrieved.some((r) => r.cited) ? 'Grounded reply' : 'Clarifying reply');
  out.push('validated');
  if (trace.input.delaySeconds > 0) out.push(`scheduled ${trace.input.delaySeconds} s`);
  if (trace.input.fault === 'meta_throttled') out.push('rate limited → retry');
  if (trace.input.fault === 'outcome_unknown_absent') out.push('outcome unknown → absent → resend');
  if (trace.input.fault === 'outcome_unknown_found') out.push('outcome unknown → read-back found');
  out.push(trace.finalState === 'reconciled_sent' ? 'reconciled' : 'delivered');
  return out;
}

// ---------------------------------------------------------------------------- timeline

export interface TimedStep extends RouteStep {
  start: number;
  travelEnd: number;
  end: number;
}
export interface Timeline {
  steps: TimedStep[];
  total: number;
}

export function compileTimeline(steps: ReadonlyArray<RouteStep>): Timeline {
  const timed: TimedStep[] = [];
  const startOf = new Map<string, number>();
  const cursor: Record<0 | 1, number> = { 0: 0, 1: 0 };
  for (const s of steps) {
    if (s.lane === 1 && s.startAfter !== undefined && startOf.has(s.startAfter)) cursor[1] = startOf.get(s.startAfter)!;
    const start = cursor[s.lane];
    const travelEnd = start + s.travelMs;
    const end = travelEnd + s.dwellMs;
    timed.push({ ...s, start, travelEnd, end });
    startOf.set(s.id, start);
    cursor[s.lane] = end;
  }
  return { steps: timed, total: timed.reduce((m, s) => Math.max(m, s.end), 0) };
}

export interface PacketView {
  lane: 0 | 1;
  edge: EdgeId;
  reverse: boolean;
  /** Progress along the edge in the direction of travel, 0..1. */
  p: number;
  traveling: boolean;
  label: string;
  node: NodeId;
  stepId: string;
  /** True while a lane-1 packet sits at its final node (it has died there). */
  dying: boolean;
}

export interface GraphView {
  nodes: Record<NodeId, NodeState>;
  edges: Record<EdgeId, EdgeState>;
  packets: PacketView[];
  effects: Partial<Record<NodeId, { effect: NonNullable<RouteStep['effect']>; stepId: string }>>;
  countdown: number | null;
  /** Webhook accepted (ingestion step finished). */
  accepted: boolean;
  /** The return packet to the device is travelling. */
  returning: boolean;
  /** Every step finished. */
  done: boolean;
  /** Number of lane-0 steps completed. */
  stage: number;
}

const OUTCOME_STATE: Record<Outcome, NodeState> = { ok: 'done', warn: 'warn', fail: 'fail', hold: 'hold', skip: 'skipped' };

export function idleView(): GraphView {
  const nodes = {} as Record<NodeId, NodeState>;
  for (const n of ALL_NODES) nodes[n] = 'standby';
  nodes.device = 'standby';
  const edges = {} as Record<EdgeId, EdgeState>;
  for (const e of ALL_EDGES) edges[e] = 'standby';
  return { nodes, edges, packets: [], effects: {}, countdown: null, accepted: false, returning: false, done: false, stage: 0 };
}

/** Pure state of the whole graph at simulation time t (ms). */
export function viewAt(tl: Timeline, t: number, opts: { delaySeconds?: number } = {}): GraphView {
  const v = idleView();
  const ordered = [...tl.steps].sort((a, b) => a.start - b.start);
  const done = t >= tl.total;
  for (const s of ordered) {
    if (t < s.start) continue;
    const real = s.node !== 'device';
    if (t >= s.end) {
      if (real) v.nodes[s.node] = OUTCOME_STATE[s.outcome];
      v.edges[s.edge] = 'traversed';
      if (s.lane === 0) v.stage += 1;
      if (s.lane === 0 && s.id.endsWith('-ingest')) v.accepted = true;
    } else if (t >= s.travelEnd) {
      if (real && s.outcome !== 'skip') v.nodes[s.node] = 'active';
      v.edges[s.edge] = 'traversed';
      if (s.effect) v.effects[s.node] = { effect: s.effect, stepId: s.id };
      if (s.effect === 'countdown' && s.dwellMs > 0) {
        const total = opts.delaySeconds ?? 60;
        v.countdown = Math.max(0, Math.ceil(total * (1 - (t - s.travelEnd) / s.dwellMs)));
      }
    } else {
      v.edges[s.edge] = 'active';
    }
    if (s.edge === 'dev_in') v.returning = true;
    if (!done && t < s.end) {
      const traveling = t < s.travelEnd;
      v.packets.push({ lane: s.lane, edge: s.edge, reverse: s.reverse, p: traveling ? (t - s.start) / s.travelMs : 1, traveling, label: s.label, node: s.node, stepId: s.id, dying: s.lane === 1 && !traveling });
    }
  }
  if (done) {
    v.done = true;
    for (const n of ALL_NODES) if (v.nodes[n] === 'standby') v.nodes[n] = 'skipped';
    for (const e of ALL_EDGES) if (v.edges[e] === 'standby') v.edges[e] = 'skipped';
  }
  return v;
}

/** Cheap signature of everything except packet progress, used to avoid re-rendering every frame. */
export function viewSignature(v: GraphView): string {
  return [
    ALL_NODES.map((n) => v.nodes[n][0]).join(''),
    ALL_EDGES.map((e) => v.edges[e][0]).join(''),
    v.packets.map((p) => `${p.stepId}:${p.traveling ? 't' : 'd'}`).join(','),
    Object.entries(v.effects).map(([n, e]) => `${n}${e.stepId}`).join(','),
    v.countdown ?? '-',
    v.accepted ? 1 : 0,
    v.returning ? 1 : 0,
    v.done ? 1 : 0
  ].join('|');
}

/** Nodes the route visits (excluding pass-through). */
export function visitedNodes(steps: ReadonlyArray<RouteStep>): Set<NodeId> {
  return new Set(steps.filter((s) => s.outcome !== 'skip' && s.node !== 'device').map((s) => s.node));
}

type Fact = readonly [string, string];

/** Facts for a node's popover, from this run's trace. */
export function nodeFacts(trace: RunTrace, node: NodeId, lang: 'en' | 'sl' = 'en'): Fact[] {
  return localizeFacts(rawFacts(trace, node), lang);
}

const KEY_SL: Record<string, string> = { Outcome: 'Izid', Object: 'Objekt', Surface: 'Površina', Body: 'Telo', Algorithm: 'Algoritem', Compare: 'Primerjava', Durability: 'Trajnost', 'Dedupe key': 'Ključ deduplikacije', Adapter: 'Adapter', 'Second delivery': 'Druga dostava', Author: 'Avtor', History: 'Zgodovina', 'Text for model': 'Besedilo za model', Intent: 'Namen', Risk: 'Tveganje', Signals: 'Signali', 'Legal area': 'Pravno področje', 'Needs lawyer': 'Potreben pravnik', Source: 'Vir', Output: 'Izhod', Language: 'Jezik', Route: 'Pot', Eligibility: 'Upravičenost', Delay: 'Zakasnitev', Window: 'Okno', 'Delivered replies': 'Dostavljeni odgovori', Observations: 'Opažanja', 'Jobs created': 'Ustvarjena opravila', Kind: 'Vrsta', Input: 'Vhod', Authority: 'Pooblastilo', 'This run': 'Ta tek', Entries: 'Zapisi', Action: 'Dejanje', 'Route code': 'Koda poti', 'Reason codes': 'Kode razlogov', 'Final state': 'Končno stanje', 'Reply text': 'Besedilo odgovora', 'Reply source': 'Vir odgovora', Why: 'Zakaj', Writes: 'Zapisi' };
const VAL_SL: Record<string, string> = { 'simulated · deterministic stand-in': 'simulirano · deterministični nadomestek', 'redacted text only': 'samo redigirano besedilo', 'none: no publishing token or tools': 'nobenih: brez žetona za objavo in orodij', 'timeout → fallback': 'časovna omejitev → rezerva', answered: 'odgovoril', 'none needed': 'ni potrebnih', 'none by design': 'namenoma brez', 'not used on this run': 'ni uporabljeno v tem teku', 'AI provider timeout': 'časovna omejitev ponudnika AI', yes: 'da', no: 'ne', pass: 'uspešno', fail: 'neuspešno', 'raw bytes kept for the signature check': 'surovi bajti za preverjanje podpisa', 'timing-safe': 'brez časovnega uhajanja', 'HMAC-SHA256 over original bytes': 'HMAC-SHA256 nad izvirnimi bajti', 'receipt + events + job in one transaction, then 200': 'potrdilo + dogodki + opravilo v eni transakciji, nato 200', 'JSON schema-validated (simulated)': 'validiran po JSON shemi (simulirano)', 'Slovenian · vikanje': 'slovenščina · vikanje', English: 'angleščina' };
function localizeFacts(facts: Fact[], lang: 'en' | 'sl'): Fact[] {
  if (lang !== 'sl') return facts;
  return facts.map(([k, v]) => [KEY_SL[k] ?? k, VAL_SL[v] ?? v] as Fact);
}

function rawFacts(trace: RunTrace, node: NodeId): Fact[] {
  const fromStages = (...ids: StageId[]): Fact[] =>
    ids.flatMap((id) => {
      const s = trace.stages.find((x) => x.id === id);
      return s ? ([['Outcome', s.summary], ...s.facts] as Fact[]) : [];
    });
  switch (node) {
    case 'webhook': return fromStages('webhook');
    case 'ingest': return fromStages('signature');
    case 'normalize': return fromStages('normalize');
    case 'context': return fromStages('context');
    case 'intent': return fromStages('intent', 'legal_area');
    case 'retrieval': return fromStages('retrieval');
    case 'generate': return fromStages('generate');
    case 'validate': return fromStages('validate');
    case 'schedule': return fromStages('schedule');
    case 'publish': return fromStages('publish');
    case 'reconcile': return fromStages('confirm');
    case 'queue': return [['Dedupe key', String(trace.normalizedEvent.dedupeKey)], ['Observations', String(trace.normalizedEvent.observationCount)], ['Jobs created', '1']];
    case 'model': return [['Kind', 'simulated · deterministic stand-in'], ['Input', 'redacted text only'], ['Authority', 'none: no publishing token or tools'], ['This run', trace.input.fault === 'ai_unavailable' ? 'timeout → fallback' : 'answered']];
    case 'kstore': return trace.retrieved.length ? trace.retrieved.map((r) => [`${r.id} v${r.version}`, `score ${r.score}${r.cited ? ' · cited' : ''}`] as Fact) : [['Entries', 'none needed']];
    case 'decision': return [['Action', trace.action], ['Route code', trace.routeCode], ['Reason codes', trace.reasonCodes.join(', ') || '—']];
    case 'review': return [['Final state', trace.finalState], ['Reply text', trace.action === 'review' ? 'none by design' : 'not used on this run']];
    case 'fallback': return [['Reply source', trace.replySource ?? '—'], ['Why', trace.input.fault === 'ai_unavailable' ? 'AI provider timeout' : 'not used on this run']];
    case 'graph': return trace.attempts.length ? trace.attempts.map((a) => [`attempt ${a.attemptNo}`, `${a.result}${a.metaMessageId ? ` · ${a.metaMessageId}` : ''}`] as Fact) : [['Writes', 'none']];
    default: return [];
  }
}
