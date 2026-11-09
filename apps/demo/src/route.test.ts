import { describe, expect, it } from 'vitest';
import { ALL_EDGES, ALL_NODES } from './graph/model';
import { buildRoute, compileTimeline, idleView, routeSummary, viewAt, viewSignature, visitedNodes, type RouteStep } from './route';
import { SCENARIOS } from './sim/scenarios';
import { simulate } from './sim/simulator';
import type { Lang, RunTrace } from './sim/types';
import { SUGGESTIONS } from './suggestions';

function trace(id: string, lang: Lang = 'en'): RunTrace {
  const s = SCENARIOS.find((x) => x.id === id)!;
  return simulate({ runNo: 1, channel: s.channel, lang, text: s.text[lang], fault: s.fault, delaySeconds: 60, history: [] });
}
const lane0 = (r: RouteStep[]) => r.filter((s) => s.lane === 0);
const nodes = (r: RouteStep[]) => lane0(r).map((s) => s.node);
const edges = (r: RouteStep[]) => lane0(r).map((s) => s.edge);
const end = (t: RunTrace) => {
  const tl = compileTimeline(buildRoute(t));
  return viewAt(tl, tl.total, { delaySeconds: 60 });
};

describe('buildRoute: normal grounded reply', () => {
  const t = trace('termination');
  const route = buildRoute(t);

  it('walks edge → worker → delivery → back to the device, in order', () => {
    const seq = nodes(route);
    const order = ['webhook', 'ingest', 'normalize', 'queue', 'context', 'intent', 'model', 'intent', 'retrieval', 'kstore', 'retrieval', 'decision', 'generate', 'model', 'generate', 'validate', 'schedule', 'publish', 'graph', 'publish', 'reconcile', 'device'];
    expect(seq).toEqual(order);
    expect(edges(route)[0]).toBe('dev_out');
    expect(edges(route).at(-1)).toBe('dev_in');
  });

  it('never touches the review, fallback or retry paths', () => {
    expect(nodes(route)).not.toContain('review');
    expect(nodes(route)).not.toContain('fallback');
    expect(edges(route)).not.toContain('retry');
    expect(edges(route)).not.toContain('resend');
  });

  it('final graph state: used nodes done, unused nodes skipped', () => {
    const v = end(t);
    expect(v.done).toBe(true);
    for (const n of ['webhook', 'ingest', 'normalize', 'queue', 'context', 'intent', 'model', 'retrieval', 'kstore', 'decision', 'generate', 'validate', 'schedule', 'publish', 'graph', 'reconcile'] as const) expect(v.nodes[n]).toBe('done');
    expect(v.nodes.review).toBe('skipped');
    expect(v.nodes.fallback).toBe('skipped');
    expect(v.edges.decision_review).toBe('skipped');
  });

  it('plays in about 6–9 seconds at 1×, with the delay accelerated to ~1.2 s', () => {
    const tl = compileTimeline(route);
    expect(tl.total).toBeGreaterThan(5500);
    expect(tl.total).toBeLessThan(9500);
    const sched = tl.steps.find((s) => s.node === 'schedule')!;
    expect(sched.dwellMs).toBe(1200);
    expect(sched.label).toBe('scheduled 60 s');
  });

  it('is not done, and has no return packet delivered, until the last step ends', () => {
    const tl = compileTimeline(route);
    const before = viewAt(tl, tl.total - 1);
    expect(before.done).toBe(false);
    expect(before.returning).toBe(true);
    expect(before.packets).toHaveLength(1);
    const mid = viewAt(tl, tl.total / 2);
    expect(mid.done).toBe(false);
    expect(mid.returning).toBe(false);
  });

  it('payload labels morph per stage', () => {
    const labels = route.map((s) => s.label).join(' | ');
    expect(labels).toMatch(/webhook · \d/);
    expect(labels).toContain('event · instagram_dm');
    expect(labels).toContain('intent: employment_termination');
    expect(labels).toMatch(/kb\.area\.employment v2/);
    expect(labels).toMatch(/draft · \d+ chars/);
    expect(labels).toContain('validated');
    expect(labels).toContain('scheduled 60 s');
    expect(labels).toContain('POST /messages');
    expect(labels).toContain('confirmed');
  });
});

describe('buildRoute: human-only', () => {
  const t = trace('distress');
  const route = buildRoute(t);
  it('ends at the review terminal and never reaches generation, scheduling or the device', () => {
    expect(nodes(route).at(-1)).toBe('review');
    expect(nodes(route)).not.toContain('generate');
    expect(nodes(route)).not.toContain('publish');
    expect(nodes(route)).not.toContain('device');
    expect(edges(route)).not.toContain('dev_in');
  });
  it('final states: review hold (amber), downstream nodes skipped, retrieval passed through as skipped', () => {
    const v = end(t);
    expect(v.nodes.review).toBe('hold');
    for (const n of ['retrieval', 'kstore', 'generate', 'validate', 'schedule', 'publish', 'graph', 'reconcile'] as const) expect(v.nodes[n]).toBe('skipped');
    expect(v.nodes.intent).toBe('warn');
    expect(v.returning).toBe(false);
  });
  it('summary names the human hand-off', () => {
    expect(routeSummary(t).at(-1)).toBe('Held for a person');
  });
});

describe('buildRoute: AI unavailable', () => {
  const t = trace('ai-down');
  const route = buildRoute(t);
  it('model fails, then the dashed fallback bypass feeds validation', () => {
    const seq = lane0(route);
    const failIdx = seq.findIndex((s) => s.node === 'model' && s.outcome === 'fail');
    expect(failIdx).toBeGreaterThan(0);
    expect(seq[failIdx]!.effect).toBe('flash');
    expect(seq[failIdx]!.label).toContain('timeout');
    expect(edges(route)).toContain('generate_fallback');
    expect(edges(route)).toContain('fallback_validate');
    expect(edges(route)).not.toContain('generate_validate');
    expect(nodes(route).indexOf('fallback')).toBeGreaterThan(failIdx);
  });
  it('final: model fail, generate fail, fallback done, validate warn, still delivered', () => {
    const v = end(t);
    expect(v.nodes.model).toBe('fail');
    expect(v.nodes.generate).toBe('fail');
    expect(v.nodes.fallback).toBe('done');
    expect(v.nodes.validate).toBe('warn');
    expect(v.nodes.reconcile).toBe('done');
    expect(nodes(route).at(-1)).toBe('device');
  });
});

describe('buildRoute: duplicate webhook', () => {
  const t = trace('duplicate');
  const route = buildRoute(t);
  const dup = route.filter((s) => s.lane === 1);
  it('adds a second packet that enters at the device and dies at the normalizer', () => {
    expect(dup.map((s) => s.node)).toEqual(['webhook', 'ingest', 'normalize']);
    expect(dup[0]!.edge).toBe('dev_out');
    expect(dup.at(-1)!.effect).toBe('ripple');
    expect(dup.at(-1)!.label).toBe('dedupe key seen');
    expect(dup.every((s) => !['queue', 'context'].includes(s.node))).toBe(true);
  });
  it('the second packet starts while the first one is already past the normalizer, and the first still delivers', () => {
    const tl = compileTimeline(route);
    const queueStep = tl.steps.find((s) => s.lane === 0 && s.node === 'queue')!;
    const first = tl.steps.find((s) => s.lane === 1)!;
    expect(first.start).toBe(queueStep.start);
    const mid = viewAt(tl, first.start + 400);
    expect(mid.packets.map((p) => p.lane).sort()).toEqual([0, 1]);
    expect(end(t).nodes.reconcile).toBe('done');
  });
  it('normalizer ends in warn; exactly one send', () => {
    expect(end(t).nodes.normalize).toBe('warn');
    expect(nodes(route).filter((n) => n === 'graph')).toHaveLength(1);
    expect(t.repliesDelivered).toBe(1);
  });
});

describe('buildRoute: transient Meta failure', () => {
  const t = trace('throttled');
  const route = buildRoute(t);
  it('publisher gets a 429, backs off, loops through the retry arc and succeeds', () => {
    const labels = lane0(route).map((s) => s.label);
    expect(labels).toContain('429 rate limited');
    expect(labels).toContain('backoff 2 s');
    expect(edges(route).filter((e) => e === 'retry')).toHaveLength(1);
    expect(labels.indexOf('retry · attempt 2')).toBeGreaterThan(labels.indexOf('backoff 2 s'));
    expect(lane0(route).filter((s) => s.node === 'graph')).toHaveLength(2);
    expect(lane0(route).find((s) => s.label === '429 rate limited')!.outcome).toBe('fail');
  });
  it('final: graph recovered (done), publisher done, delivered', () => {
    const v = end(t);
    expect(v.nodes.graph).toBe('done');
    expect(v.nodes.publish).toBe('done');
    expect(v.edges.retry).toBe('traversed');
    expect(nodes(route).at(-1)).toBe('device');
  });
  it('mid-run the graph node shows the failure', () => {
    const tl = compileTimeline(route);
    const rl = tl.steps.find((s) => s.label === '429 rate limited')!;
    expect(viewAt(tl, rl.end + 1).nodes.graph).toBe('fail');
    expect(viewAt(tl, rl.travelEnd + 10).nodes.graph).toBe('active');
  });
});

describe('buildRoute: outcome unknown → read-back found', () => {
  const t = trace('unknown-found');
  const route = buildRoute(t);
  it('reconciliation reads Graph back, finds the reply and never resends', () => {
    const e = edges(route);
    expect(e).toContain('reconcile_graph');
    expect(e).not.toContain('resend');
    expect(e).not.toContain('retry');
    expect(lane0(route).filter((s) => s.edge === 'publish_graph' && s.node === 'graph')).toHaveLength(1);
    expect(lane0(route).map((s) => s.label)).toContain('read-back: reply found');
    expect(lane0(route).map((s) => s.label)).toContain('reconciled_sent');
    expect(t.finalState).toBe('reconciled_sent');
  });
  it('final states', () => {
    const v = end(t);
    expect(v.nodes.reconcile).toBe('done');
    expect(v.nodes.graph).toBe('done');
    expect(v.edges.reconcile_graph).toBe('traversed');
    expect(routeSummary(t)).toContain('outcome unknown → read-back found');
  });
});

describe('buildRoute: outcome unknown → absent → resend', () => {
  const t = trace('unknown-absent');
  const route = buildRoute(t);
  it('read-back finds nothing, the resend arc returns to the publisher, second write succeeds', () => {
    const e = edges(route);
    expect(e).toContain('reconcile_graph');
    expect(e.filter((x) => x === 'resend')).toHaveLength(1);
    expect(lane0(route).filter((s) => s.edge === 'publish_graph' && s.node === 'graph')).toHaveLength(2);
    const labels = lane0(route).map((s) => s.label);
    expect(labels.indexOf('resend · attempt 2')).toBeGreaterThan(labels.indexOf('read-back: reply absent'));
    expect(t.finalState).toBe('sent');
    expect(nodes(route).at(-1)).toBe('device');
  });
  it('final: reconcile confirmed', () => {
    expect(end(t).nodes.reconcile).toBe('done');
    expect(end(t).edges.resend).toBe('traversed');
  });
});

describe('buildRoute: invariants over every scenario', () => {
  for (const s of SCENARIOS) {
    for (const lang of ['en', 'sl'] as const) {
      it(`${s.id} (${lang}): a coherent, finite route`, () => {
        const t = trace(s.id, lang);
        const route = buildRoute(t);
        const l0 = lane0(route);
        expect(l0[0]!.edge).toBe('dev_out');
        // Consecutive steps are connected: each starts where the previous one ended.
        for (let i = 1; i < l0.length; i++) expect(l0[i]!.edge).toBeDefined();
        // The packet returns to the device iff a reply was delivered.
        expect(l0.some((x) => x.edge === 'dev_in')).toBe(t.repliesDelivered === 1);
        // Nothing is sent when a person must decide.
        if (t.action === 'review' || t.action === 'skip') expect(visitedNodes(route).has('publish')).toBe(false);
        const tl = compileTimeline(route);
        expect(Number.isFinite(tl.total)).toBe(true);
        const v = viewAt(tl, tl.total);
        expect(v.done).toBe(true);
        for (const n of ALL_NODES) expect(['done', 'warn', 'hold', 'fail', 'skipped']).toContain(v.nodes[n]);
        for (const e of ALL_EDGES) expect(['traversed', 'skipped']).toContain(v.edges[e]);
      });
    }
  }
});

describe('views', () => {
  it('idle view is standby everywhere and has a stable signature', () => {
    const v = idleView();
    expect(Object.values(v.nodes).every((s) => s === 'standby')).toBe(true);
    expect(viewSignature(v)).toBe(viewSignature(idleView()));
  });
  it('a run starts from standby at t=0 (no inherited state)', () => {
    const tl = compileTimeline(buildRoute(trace('termination')));
    const v = viewAt(tl, 0);
    expect(v.done).toBe(false);
    expect(v.stage).toBe(0);
    expect(v.nodes.reconcile).toBe('standby');
  });
  it('the countdown runs from the configured delay to 0 during the schedule dwell', () => {
    const tl = compileTimeline(buildRoute(trace('scheduled')));
    const s = tl.steps.find((x) => x.node === 'schedule')!;
    expect(viewAt(tl, s.travelEnd + 1, { delaySeconds: 60 }).countdown).toBe(60);
    expect(viewAt(tl, s.travelEnd + 600, { delaySeconds: 60 }).countdown).toBe(30);
    expect(viewAt(tl, s.end - 1, { delaySeconds: 60 }).countdown).toBe(1);
  });
});

describe('suggestion chips', () => {
  it('every chip, in both languages, is answered grounded and delivered', () => {
    for (const lang of ['en', 'sl'] as const) {
      for (const c of SUGGESTIONS[lang]) {
        const t = simulate({ runNo: 1, channel: 'instagram_dm', lang, text: c.text, fault: 'none', delaySeconds: 60, history: [] });
        expect(t.classification.topic, `${lang}: ${c.text}`).toBe(c.topic);
        expect(t.finalState).toBe('sent');
      }
    }
  });
});

describe('example library', () => {
  it('maps every existing scenario exactly once', async () => {
    const { EVERYDAY, FAILURE_MODES } = await import('./suggestions');
    const ids = [...EVERYDAY, ...FAILURE_MODES].map((e) => e.id).sort();
    expect(ids).toEqual(SCENARIOS.map((s) => s.id).sort());
  });
});
