import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchTopic } from './matcher';
import { SCENARIOS } from './scenarios';
import { simulate } from './simulator';
import type { Channel, Fault, Lang, SimInput } from './types';

const base = (text: string, over: Partial<SimInput> = {}): SimInput => ({ runNo: 1, channel: 'messenger', lang: 'en', text, fault: 'none', delaySeconds: 60, history: [], ...over });

describe('matcher (EN + SL)', () => {
  const cases: Array<[string, string]> = [
    ['Can my employer fire me without notice?', 'employment_termination'],
    ['Ali me lahko delodajalec odpusti brez odpovednega roka?', 'employment_termination'],
    ['My employer has not paid my salary for two months.', 'unpaid_salary'],
    ['Delodajalec mi že dva meseca ne izplača plače.', 'unpaid_salary'],
    ['Koliko stane pravni posvet?', 'price'],
    ['How much does a legal consultation cost?', 'price'],
    ['Koliko moram plačati za posvet?', 'price'],
    ['Najemodajalec mi noče vrniti varščine.', 'tenancy'],
    ['The shop refuses a refund for a faulty phone.', 'consumer'],
    ['Kako poteka dogovor o skrbništvu po ločitvi?', 'family'],
    ['Ali delate tudi ob sobotah?', 'availability'],
    ['I would like to book an appointment with a lawyer.', 'booking'],
    ['Do I need a lawyer to write a will?', 'inheritance'],
    ['Ali potrebujem pravnika za sestavo oporoke?', 'inheritance'],
    ['Hi', 'greeting'],
    ['Živjo', 'greeting'],
    ['Najlepša hvala!', 'thanks'],
    ['Great weather for football today', 'off_topic'],
    ['I am in danger and I don’t know what to do', 'distress'],
    ['asdf qwer', 'unclear']
  ];
  it.each(cases)('%s → %s', (text, topic) => {
    expect(matchTopic(text).topic).toBe(topic);
  });

  it('a short follow-up inherits the previous user topic', () => {
    const m = matchTopic('and in the evening?', [{ role: 'user', text: 'Are you available on Saturdays?', topic: 'availability' }]);
    expect(m).toMatchObject({ topic: 'availability', fromContext: true });
  });
});

describe('scenarios reach their expected terminal state', () => {
  for (const s of SCENARIOS) {
    for (const lang of ['en', 'sl'] as const) {
      it(`${s.id} (${lang}) → ${s.expect}`, () => {
        const r = simulate(base(s.text[lang], { channel: s.channel, lang, fault: s.fault }));
        expect(r.finalState).toBe(s.expect);
        expect(r.stages).toHaveLength(12);
        expect(r.repliesDelivered).toBe(s.expect === 'sent' || s.expect === 'reconciled_sent' ? 1 : 0);
        if (r.replyText) expect(r.validators.every((v) => v.passed)).toBe(true);
      });
    }
  }
});

describe('pipeline invariants', () => {
  const channels: Channel[] = ['messenger', 'instagram_dm', 'facebook_comment', 'instagram_comment'];
  const faults: Fault[] = ['none', 'ai_unavailable', 'duplicate_webhook', 'meta_throttled', 'outcome_unknown_absent', 'outcome_unknown_found'];

  it('every ordinary message on every channel produces a visible outcome, never more than one reply', () => {
    const texts = ['hello there', 'Can my employer fire me?', 'koliko stane', '???', 'Kje ste?', 'random words about nothing'];
    for (const channel of channels)
      for (const fault of faults)
        for (const text of texts)
          for (const lang of ['en', 'sl'] as Lang[]) {
            const r = simulate(base(text, { channel, fault, lang }));
            expect(['sent', 'reconciled_sent', 'needs_review', 'skipped']).toContain(r.finalState);
            expect(r.repliesDelivered).toBeLessThanOrEqual(1);
            expect(r.attempts.length).toBeLessThanOrEqual(3);
            expect(r.attempts.filter((a) => a.result === 'confirmed').length).toBeLessThanOrEqual(1);
            expect(new Set(r.attempts.map((a) => a.idempotencyKey)).size).toBe(r.attempts.length);
          }
  });

  it('duplicate webhook: same dedupe key, zero new jobs, exactly one reply', () => {
    const r = simulate(base('How much does a consultation cost?', { fault: 'duplicate_webhook' }));
    expect(r.duplicate).toMatchObject({ observationCount: 2, newJobs: 0 });
    expect(r.attempts).toHaveLength(1);
    expect(r.repliesDelivered).toBe(1);
  });

  it('transient throttling: rate limited, then one confirmed retry', () => {
    const r = simulate(base('Are you available on Saturdays?', { fault: 'meta_throttled' }));
    expect(r.attempts.map((a) => a.result)).toEqual(['rate_limited', 'confirmed']);
    expect(r.transitions.map((t) => t.audit)).toContain('reply_item.send_retry_scheduled');
    expect(r.finalState).toBe('sent');
  });

  it('unknown outcome, absent on read-back: resent once; found: reconciled without a second write', () => {
    const absent = simulate(base('book an appointment', { fault: 'outcome_unknown_absent' }));
    expect(absent.attempts.map((a) => a.result)).toEqual(['timeout_unknown', 'confirmed']);
    expect(absent.transitions.map((t) => t.audit)).toContain('reply_item.resend_scheduled');
    const found = simulate(base('book an appointment', { fault: 'outcome_unknown_found' }));
    expect(found.attempts).toHaveLength(1);
    expect(found.finalState).toBe('reconciled_sent');
  });

  it('AI unavailable → approved fallback text, still delivered', () => {
    const r = simulate(base('Can my employer fire me without notice?', { fault: 'ai_unavailable' }));
    expect(r.replySource).toBe('approved_fallback');
    expect(r.routeCode).toBe('AI_UNAVAILABLE_FALLBACK');
    expect(r.stages.find((s) => s.id === 'generate')?.status).toBe('fail');
    expect(r.finalState).toBe('sent');
  });

  it('distress is held for a person even when the AI is down: no reply text, no attempt', () => {
    const r = simulate(base('I am in danger', { fault: 'ai_unavailable' }));
    expect(r.finalState).toBe('needs_review');
    expect(r.replyText).toBeNull();
    expect(r.attempts).toHaveLength(0);
  });

  it('Slovenian replies pass the formal-address check; public legal comments get the privacy sentence', () => {
    const r = simulate(base('Najemodajalec mi noče vrniti varščine.', { lang: 'sl', channel: 'facebook_comment' }));
    expect(r.validators.find((v) => v.code === 'INFORMAL_ADDRESS')?.passed).toBe(true);
    expect(r.replyText).toContain('zasebno sporočilo');
  });

  it('state transitions are ordered in simulated time and follow the auto-send path', () => {
    const r = simulate(base('Koliko stane posvet?', { lang: 'sl' }));
    const times = r.transitions.map((t) => t.simMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(r.transitions.map((t) => t.to)).toEqual(['new', 'processing', 'scheduled', 'sending', 'sent']);
  });

  it('will-making is classified as the inheritance area (dedno) in both languages and retrieves its guidance', () => {
    for (const lang of ['en', 'sl'] as const) {
      const text = SCENARIOS.find((s) => s.id === 'inheritance')!.text[lang];
      const r = simulate(base(text, { lang, channel: 'instagram_comment' }));
      expect(r.classification.legalArea).toBe('dedno');
      expect(r.retrieved.some((e) => e.id === 'kb.area.inheritance')).toBe(true);
    }
  });

  it('reply-item audit names are distinct and ordered: created, scheduled, sending, sent', () => {
    const r = simulate(base('Koliko stane posvet?', { lang: 'sl' }));
    const audits = r.transitions.map((t) => t.audit);
    expect(audits).toContain('reply_item.created');
    expect(audits.filter((a) => a === 'reply_item.created')).toHaveLength(1);
    expect(audits.filter((a) => a.startsWith('reply_item.') && ['created', 'scheduled', 'send_started', 'sent'].includes(a.slice(11)))).toEqual(['reply_item.created', 'reply_item.scheduled', 'reply_item.send_started', 'reply_item.sent']);
  });

  it('personal data is redacted in the text that would reach a model', () => {
    const r = simulate(base('Call me at +386 00 000 000 or ana@example.org about my salary'));
    expect(r.normalizedEvent.textForModel).toBe('Call me at [PHONE] or [EMAIL] about my salary');
    expect(r.classification.signals).toContain('PERSONAL_DATA_REDACTED');
  });

  it('is deterministic', () => {
    expect(simulate(base('Koliko stane?', { lang: 'sl' }))).toEqual(simulate(base('Koliko stane?', { lang: 'sl' })));
  });
});

describe('no network', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', () => {
      throw new Error('network access is not allowed in the demo');
    });
    vi.stubGlobal('XMLHttpRequest', function () {
      throw new Error('network access is not allowed in the demo');
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('runs every scenario with fetch and XMLHttpRequest disabled', () => {
    for (const s of SCENARIOS) for (const lang of ['en', 'sl'] as const) expect(() => simulate(base(s.text[lang], { channel: s.channel, lang, fault: s.fault }))).not.toThrow();
  });
});
