import { entry, KNOWLEDGE } from './knowledge';
import { matchTopic } from './matcher';
import { APPROVED, DRAFTS } from './replies';
import type {
  Action,
  Channel,
  Classification,
  DispatchAttempt,
  Intent,
  LegalArea,
  ReplyState,
  RetrievedEntry,
  Risk,
  RunTrace,
  SimInput,
  StageResult,
  Topic,
  Transition,
  Validator
} from './types';

/**
 * The simulator: a pure, deterministic function from one inbound message (plus conversation
 * history and an optional injected fault) to a complete trace of what the production pipeline
 * would record. The UI only plays this trace back; nothing here performs I/O.
 */

interface TopicPlan {
  intent: Intent;
  area: LegalArea;
  risk: Risk;
  needsLawyer: boolean;
  action: Action;
  route: string;
  knowledge: string[];
  /** Legal topics get the public-comment privacy sentence on comment surfaces. */
  legal: boolean;
}

const PLANS: Record<Topic, TopicPlan> = {
  greeting: { intent: 'unclear', area: 'ni_pravno', risk: 'low', needsLawyer: false, action: 'clarify', route: 'CLARIFY_GREETING', knowledge: [], legal: false },
  unclear: { intent: 'unclear', area: 'ni_pravno', risk: 'low', needsLawyer: false, action: 'clarify', route: 'CLARIFY_UNCLEAR', knowledge: [], legal: false },
  price: { intent: 'pricing_promotion', area: 'ni_pravno', risk: 'low', needsLawyer: false, action: 'reply', route: 'SERVICE_REPLY_GROUNDED', knowledge: ['kb.price.consult', 'kb.route.booking'], legal: false },
  availability: { intent: 'product_question', area: 'ni_pravno', risk: 'low', needsLawyer: false, action: 'reply', route: 'SERVICE_REPLY_GROUNDED', knowledge: ['kb.service.hours', 'kb.route.booking'], legal: false },
  booking: { intent: 'contact_booking', area: 'ni_pravno', risk: 'low', needsLawyer: false, action: 'reply', route: 'SERVICE_REPLY_GROUNDED', knowledge: ['kb.route.booking', 'kb.service.written-opinion'], legal: false },
  employment_termination: { intent: 'individual_legal_situation', area: 'delovno', risk: 'medium', needsLawyer: true, action: 'reply', route: 'LEGAL_ORIENTATION_REPLY', knowledge: ['kb.area.employment', 'kb.boundary.no-individual-advice', 'kb.route.booking'], legal: true },
  unpaid_salary: { intent: 'individual_legal_situation', area: 'delovno', risk: 'medium', needsLawyer: true, action: 'reply', route: 'LEGAL_ORIENTATION_REPLY', knowledge: ['kb.area.employment', 'kb.boundary.no-individual-advice', 'kb.route.booking'], legal: true },
  tenancy: { intent: 'individual_legal_situation', area: 'stvarno_nepremicnine', risk: 'low', needsLawyer: true, action: 'reply', route: 'LEGAL_ORIENTATION_REPLY', knowledge: ['kb.area.tenancy', 'kb.boundary.no-individual-advice', 'kb.route.booking'], legal: true },
  consumer: { intent: 'individual_legal_situation', area: 'potrosnisko', risk: 'low', needsLawyer: true, action: 'reply', route: 'LEGAL_ORIENTATION_REPLY', knowledge: ['kb.area.consumer', 'kb.boundary.no-individual-advice', 'kb.route.booking'], legal: true },
  family: { intent: 'individual_legal_situation', area: 'druzinsko', risk: 'medium', needsLawyer: true, action: 'reply', route: 'LEGAL_ORIENTATION_REPLY', knowledge: ['kb.area.family', 'kb.boundary.no-individual-advice', 'kb.route.booking'], legal: true },
  inheritance: { intent: 'general_legal_topic', area: 'dedno', risk: 'low', needsLawyer: true, action: 'reply', route: 'LEGAL_ORIENTATION_REPLY', knowledge: ['kb.area.inheritance', 'kb.boundary.no-individual-advice', 'kb.route.booking'], legal: true },
  general_legal: { intent: 'general_legal_topic', area: 'drugo', risk: 'low', needsLawyer: true, action: 'reply', route: 'LEGAL_ORIENTATION_REPLY', knowledge: ['kb.boundary.no-individual-advice', 'kb.route.booking'], legal: true },
  thanks: { intent: 'praise_thanks', area: 'ni_pravno', risk: 'low', needsLawyer: false, action: 'reply', route: 'THANKS_REPLY', knowledge: [], legal: false },
  complaint_about_us: { intent: 'complaint', area: 'ni_pravno', risk: 'medium', needsLawyer: false, action: 'reply', route: 'COMPLAINT_ACKNOWLEDGMENT', knowledge: [], legal: false },
  off_topic: { intent: 'other', area: 'ni_pravno', risk: 'low', needsLawyer: false, action: 'reply', route: 'OTHER_REDIRECT_REPLY', knowledge: [], legal: false },
  distress: { intent: 'threat_sensitive_distress', area: 'ni_pravno', risk: 'critical', needsLawyer: false, action: 'review', route: 'RISK_HUMAN_ONLY', knowledge: [], legal: false }
};

export const ENDPOINT: Record<Channel, DispatchAttempt['endpoint']> = {
  messenger: 'messenger_send',
  instagram_dm: 'instagram_dm_send',
  facebook_comment: 'facebook_comment_reply',
  instagram_comment: 'instagram_comment_reply'
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  messenger: 'Messenger',
  instagram_dm: 'Instagram DM',
  facebook_comment: 'Facebook comment',
  instagram_comment: 'Instagram comment'
};

export function isComment(channel: Channel): boolean {
  return channel === 'facebook_comment' || channel === 'instagram_comment';
}

/** FNV-1a, for stable synthetic identifiers. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Redaction applied before any text would reach a model provider. */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[EMAIL]')
    .replace(/(\+?\d[\d\s/-]{6,}\d)/g, '[PHONE]');
}

const BASE_EPOCH = Date.parse('2026-11-09T09:00:00.000Z');

function webhookPayload(input: SimInput, ids: { account: string; author: string; externalId: string; post: string }, at: number): unknown {
  const { channel, text } = input;
  if (channel === 'messenger' || channel === 'instagram_dm') {
    return {
      object: channel === 'messenger' ? 'page' : 'instagram',
      entry: [{ id: ids.account, time: at, messaging: [{ sender: { id: ids.author }, recipient: { id: ids.account }, timestamp: at, message: { mid: ids.externalId, text } }] }]
    };
  }
  if (channel === 'facebook_comment') {
    return {
      object: 'page',
      entry: [{ id: ids.account, time: Math.floor(at / 1000), changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', comment_id: ids.externalId, post_id: ids.post, message: text, from: { id: ids.author, name: 'Demo Visitor' } } }] }]
    };
  }
  return {
    object: 'instagram',
    entry: [{ id: ids.account, time: Math.floor(at / 1000), changes: [{ field: 'comments', value: { id: ids.externalId, text, from: { id: ids.author, username: 'demo.visitor' }, media: { id: ids.post } } }] }]
  };
}

function retrieve(plan: TopicPlan, text: string, lang: 'en' | 'sl'): RetrievedEntry[] {
  const folded = text.toLowerCase();
  const scored = KNOWLEDGE.map((k) => {
    const pinned = plan.knowledge.includes(k.id);
    const keywordHits = k.keywords.filter((w) => folded.includes(w)).length;
    const areaHit = plan.area !== 'ni_pravno' && k.areas.includes(plan.area) ? 2 : 0;
    return { k, score: (pinned ? 4 : 0) + keywordHits + areaHit, pinned };
  })
    .filter((s) => s.score >= 4)
    .sort((a, b) => b.score - a.score || a.k.id.localeCompare(b.k.id))
    .slice(0, 4);
  void lang;
  return scored.map((s) => ({ id: s.k.id, version: s.k.version, score: s.score, cited: s.pinned }));
}

const INFORMAL_SL = /\b(ti|tebi|tvoj[aeiu]?|lahko pišeš|pokliči|piši|naroči)\b/i;
const VERDICT = /\b(is (definitely )?(illegal|unlawful)|you will win|je nezakonit[oa]?|boste zmagali|imate dobre možnosti)\b/i;
const DEADLINE = /\b(\d+\s*(days?|dni|dan)|within \d+|v roku \d+)\b/i;
const FALSE_HANDOFF = /\b(will call you|we'll call you|vas pokličemo|v \d+ urah)\b/i;
const EMERGENCY = /\b(112|113|911)\b/;

function validate(text: string, input: SimInput, retrieved: RetrievedEntry[], requireRoute: boolean): Validator[] {
  const citedIds = new Set(retrieved.filter((r) => r.cited).map((r) => r.id));
  const hasAmount = /€|\beur\b/i.test(text);
  const out: Validator[] = [
    { code: 'GROUNDED_FACTS', label: 'Every amount and link is backed by a cited entry', passed: (!hasAmount || citedIds.has('kb.price.consult')) && (!text.includes('https://') || citedIds.has('kb.route.booking') || text.includes('example.com/book')) },
    { code: 'LEGAL_VERDICT_IN_REPLY', label: 'No legal verdict on the person’s case', passed: !VERDICT.test(text) },
    { code: 'DEADLINE_OR_OUTCOME', label: 'No deadline calculation or promised outcome', passed: !DEADLINE.test(text) },
    { code: 'FALSE_HANDOFF_CLAIM', label: 'No invented callback or response time', passed: !FALSE_HANDOFF.test(text) },
    { code: 'EMERGENCY_NUMBER_NOT_NEEDED', label: 'No emergency number without an emergency', passed: !EMERGENCY.test(text) }
  ];
  if (input.lang === 'sl') out.push({ code: 'INFORMAL_ADDRESS', label: 'Formal address (vikanje) throughout', passed: !INFORMAL_SL.test(text) });
  if (requireRoute) out.push({ code: 'APPROVED_ROUTE_PRESENT', label: 'Names an approved contact route', passed: text.includes('example.com/book') });
  if (isComment(input.channel)) out.push({ code: 'PUBLIC_PERSONAL_DATA', label: 'Asks for no personal details in public', passed: !/(phone number|address|telefonsko številko|naslov)\?/i.test(text) });
  return out;
}

export function classify(input: SimInput): Classification {
  const m = matchTopic(input.text, input.history);
  const plan = PLANS[m.topic];
  const signals: string[] = [];
  if (m.topic === 'distress') signals.push('SIGNAL_DISTRESS_OR_DANGER');
  if (plan.legal) signals.push('LEGAL_SITUATION_SIGNAL');
  if (redact(input.text) !== input.text) signals.push('PERSONAL_DATA_REDACTED');
  if (m.fromContext) signals.push('TOPIC_FROM_PREVIOUS_TURN');
  return { topic: m.topic, intent: plan.intent, legalArea: plan.area, risk: plan.risk, needsLawyer: plan.needsLawyer, language: input.lang, signals, matchedTerms: m.matchedTerms, fromContext: m.fromContext };
}

export function simulate(input: SimInput): RunTrace {
  const id = `run_${hash(`${input.runNo}|${input.channel}|${input.text}`)}`;
  const h = hash(`${input.runNo}|${input.text}`);
  const comment = isComment(input.channel);
  const ids = {
    account: input.channel.startsWith('instagram') ? 'demo-ig-account-1' : 'demo-page-1',
    author: `demo-user-${hash(input.channel).slice(0, 6)}`,
    externalId: comment ? `demo-comment-${h}` : `demo-mid.${h}`,
    post: 'demo-post-42'
  };
  const at = BASE_EPOCH + input.runNo * 97_000;
  const payload = webhookPayload(input, ids, at);
  const dedupeKey = `${input.channel.startsWith('instagram') ? 'instagram' : 'facebook'}:${comment ? 'comment' : 'message'}:${ids.externalId}`;

  const cls = classify(input);
  const plan = PLANS[cls.topic];
  let action: Action = plan.action;
  let route = plan.route;
  const reasonCodes: string[] = [];

  // Public chatter that asks nothing is not answered (production: AUTONOMY_OTHER_COMMENT_NO_QUESTION).
  if (cls.topic === 'off_topic' && comment && !input.text.includes('?')) {
    action = 'skip';
    route = 'AUTONOMY_OTHER_COMMENT_NO_QUESTION';
  }

  const retrieved = action === 'skip' || action === 'review' ? [] : retrieve(plan, input.text, input.lang);
  const aiFailed = input.fault === 'ai_unavailable' && action !== 'skip' && action !== 'review';

  let replySource: RunTrace['replySource'] = null;
  let replyText: string | null = null;
  if (action === 'reply' || action === 'clarify') {
    if (aiFailed) {
      replySource = 'approved_fallback';
      replyText = APPROVED.fallback[input.lang];
      route = 'AI_UNAVAILABLE_FALLBACK';
      reasonCodes.push('AI_PROVIDER_TIMEOUT', 'AI_UNAVAILABLE_FALLBACK');
    } else if (cls.topic === 'complaint_about_us') {
      replySource = 'approved_text';
      replyText = APPROVED.complaint[input.lang];
      reasonCodes.push('COMPLAINT_ACKNOWLEDGMENT', 'FOLLOW_UP_RECOMMENDED');
    } else {
      replySource = 'ai_draft';
      replyText = DRAFTS[cls.topic]?.[input.lang] ?? APPROVED.fallback[input.lang];
      if (comment && plan.legal) replyText += APPROVED.publicSuffix[input.lang];
    }
  }
  if (route === 'LEGAL_ORIENTATION_REPLY') reasonCodes.unshift('LEGAL_ORIENTATION_REPLY');
  if (action === 'review') reasonCodes.push('RISK_HUMAN_ONLY', 'NO_AI_REPLY_TEXT');
  if (action === 'skip') reasonCodes.push(route);
  if (cls.fromContext) reasonCodes.push('CONTEXT_FOLLOW_UP');

  const validators = replyText ? validate(replyText, input, retrieved, plan.legal || plan.knowledge.includes('kb.route.booking') || replySource === 'approved_fallback') : [];
  const validationOk = validators.every((v) => v.passed);
  if (replyText && !validationOk) {
    // Never send a draft that fails a deterministic check: fall back to the approved text.
    reasonCodes.push(...validators.filter((v) => !v.passed).map((v) => v.code), 'AUTONOMY_SAFE_FALLBACK');
    replySource = 'approved_fallback';
    replyText = APPROVED.fallback[input.lang];
    route = 'AUTONOMY_SAFE_FALLBACK';
  }
  if (replyText) reasonCodes.push(comment ? 'PUBLIC_REPLY' : 'PRIVATE_REPLY');

  // ------------------------------------------------------------------ stages and timing
  const stages: StageResult[] = [];
  const transitions: Transition[] = [];
  const attempts: DispatchAttempt[] = [];
  let t = 0;
  const push = (s: StageResult) => {
    stages.push(s);
    t += s.simMs;
  };
  const move = (from: ReplyState | null, to: ReplyState, audit: string, reason?: string) => transitions.push({ simMs: t, stage: stages.length - 1, from, to, audit, ...(reason ? { reason } : {}) });

  push({ id: 'webhook', status: 'ok', simMs: 4, summary: `POST /webhooks/meta · ${JSON.stringify(payload).length} bytes`, facts: [['Object', String((payload as { object: string }).object)], ['Surface', CHANNEL_LABEL[input.channel]], ['Body', 'raw bytes kept for the signature check']] });
  push({ id: 'signature', status: 'ok', simMs: 1, summary: 'X-Hub-Signature-256 matches (simulated HMAC-SHA256)', facts: [['Algorithm', 'HMAC-SHA256 over original bytes'], ['Compare', 'timing-safe'], ['Durability', 'receipt + events + job in one transaction, then 200']] });
  push({
    id: 'normalize',
    status: input.fault === 'duplicate_webhook' ? 'warn' : 'ok',
    simMs: 3,
    summary: input.fault === 'duplicate_webhook' ? 'Duplicate delivery recognised: same dedupe key, no second job' : `Normalized to ${comment ? 'comment' : 'message'} event · IDs stored as strings`,
    facts: [['Dedupe key', dedupeKey], ['Adapter', input.channel.startsWith('instagram') ? 'instagram' : 'facebook'], ...(input.fault === 'duplicate_webhook' ? ([['Second delivery', 'observation_count 1 → 2, 0 new jobs']] as const) : [])]
  });
  move(null, 'new', 'reply_item.created');
  move('new', 'processing', 'worker.claimed');
  const previousTurns = input.history.length;
  push({ id: 'context', status: 'ok', simMs: 140, summary: previousTurns ? `${previousTurns} earlier turn${previousTurns === 1 ? '' : 's'} loaded${cls.fromContext ? ' · topic carried over' : ''}` : 'New conversation · source re-read from Meta (simulated)', facts: [['Author', `pseudonym author-${hash(ids.author).slice(0, 4)}`], ['History', `${previousTurns} turn(s)`], ['Text for model', redact(input.text)]] });
  push({ id: 'intent', status: cls.risk === 'critical' ? 'hold' : 'ok', simMs: 860, summary: `${cls.intent}${cls.matchedTerms.length ? ` · matched “${cls.matchedTerms.slice(0, 2).join('”, “')}”` : cls.fromContext ? ' · from context' : ' · no keyword, safe default'}`, facts: [['Intent', cls.intent], ['Risk', cls.risk], ['Signals', cls.signals.join(', ') || 'none']] });
  push({ id: 'legal_area', status: 'ok', simMs: 0, summary: cls.legalArea === 'ni_pravno' ? 'ni_pravno · not a legal question' : `${cls.legalArea}${cls.needsLawyer ? ' · needs a lawyer' : ''}`, facts: [['Legal area', cls.legalArea], ['Needs lawyer', cls.needsLawyer ? 'yes' : 'no']] });
  push({
    id: 'retrieval',
    status: action === 'review' || action === 'skip' ? 'skip' : 'ok',
    simMs: action === 'review' || action === 'skip' ? 0 : 18,
    summary: retrieved.length ? `${retrieved.length} approved entr${retrieved.length === 1 ? 'y' : 'ies'} from the active release` : action === 'review' || action === 'skip' ? 'Not needed for this route' : 'No entry needed for this reply',
    facts: retrieved.map((r) => [`${r.id}@${r.version}`, `score ${r.score}${r.cited ? ' · cited' : ''}`] as const)
  });

  if (action === 'review') {
    push({ id: 'generate', status: 'skip', simMs: 0, summary: 'No reply text is written for a human-only case', facts: [['Route', 'RISK_HUMAN_ONLY']] });
    push({ id: 'validate', status: 'hold', simMs: 0, summary: 'Held for a person: hard safety signal', facts: [['Fallback blockers', 'distress / danger']] });
    move('processing', 'needs_review', 'reply_item.decided', 'RISK_HUMAN_ONLY');
    for (const sid of ['schedule', 'publish', 'confirm'] as const) push({ id: sid, status: 'skip', simMs: 0, summary: 'Nothing is sent automatically', facts: [] });
  } else if (action === 'skip') {
    for (const sid of ['generate', 'validate', 'schedule', 'publish', 'confirm'] as const) push({ id: sid, status: 'skip', simMs: 0, summary: sid === 'generate' ? 'Public remark without a question: no reply' : 'Not applicable', facts: [] });
    move('processing', 'skipped', 'reply_item.decided', route);
  } else {
    push({
      id: 'generate',
      status: aiFailed ? 'fail' : 'ok',
      simMs: aiFailed ? 8000 : replySource === 'approved_text' ? 2 : 2300,
      summary: aiFailed ? 'Provider timeout after 8 s → approved fallback text' : replySource === 'approved_text' ? 'Approved fixed text (owner-approved, no model)' : `Structured draft · ${action} · cites ${retrieved.filter((r) => r.cited).length} entr${retrieved.filter((r) => r.cited).length === 1 ? 'y' : 'ies'}`,
      facts: [['Source', replySource ?? '—'], ['Output', 'JSON schema-validated (simulated)'], ['Language', input.lang === 'sl' ? 'Slovenian · vikanje' : 'English']]
    });
    push({
      id: 'validate',
      status: validationOk ? (replySource === 'approved_fallback' ? 'warn' : 'ok') : 'warn',
      simMs: replySource === 'ai_draft' ? 620 : 4,
      summary: replySource === 'approved_fallback' ? 'Fallback text checked, no fallback blocker' : `${validators.filter((v) => v.passed).length}/${validators.length} deterministic checks passed${replySource === 'ai_draft' ? ' + model check' : ''}`,
      facts: validators.map((v) => [v.code, v.passed ? 'pass' : 'fail'] as const)
    });
    move('processing', 'scheduled', 'reply_item.scheduled', route);
    push({
      id: 'schedule',
      status: 'ok',
      simMs: input.delaySeconds * 1000,
      summary: `Auto-send scheduled in ${input.delaySeconds} s (configurable delay)`,
      facts: [['Eligibility', 'mode LIVE · auto-send on · surface write-verified · release owner-approved'], ['Delay', `${input.delaySeconds} s, cancellable by a person`], ['Window', comment ? 'public comment' : '24 h messaging window open']]
    });

    // ------------------------------------------------------------------ dispatch
    const endpoint = ENDPOINT[input.channel];
    const baseKey = `ri_${h}`;
    move('scheduled', 'sending', 'reply_item.send_started', 'PRE_SEND_RECHECK_PASSED');
    let publishMs = 0;
    const attempt = (no: number, result: DispatchAttempt['result'], extra = 0) => {
      publishMs += 380 + extra;
      attempts.push({ attemptNo: no, idempotencyKey: `${baseKey}#${no}`, endpoint, simMs: t + publishMs, result, metaMessageId: result === 'confirmed' ? `demo-out-${hash(baseKey + no)}` : null });
    };
    let publishSummary = `One write to ${endpoint} · exact text persisted first`;
    let confirmSummary = 'Meta returned a message id → sent';
    let finalTo: ReplyState = 'sent';
    if (input.fault === 'meta_throttled') {
      attempt(1, 'rate_limited');
      transitions.push({ stage: stages.length, simMs: t + publishMs, from: 'sending', to: 'scheduled', audit: 'reply_item.send_retry_scheduled', reason: 'RATE_LIMITED' });
      attempt(2, 'confirmed', 2000);
      transitions.push({ stage: stages.length, simMs: t + publishMs - 380, from: 'scheduled', to: 'sending', audit: 'reply_item.send_started', reason: 'RETRY_AFTER_BACKOFF' });
      publishSummary = 'Attempt 1: rate limited (transient) → backoff → attempt 2 accepted';
      reasonCodes.push('RATE_LIMITED', 'SEND_RETRY_SCHEDULED');
    } else if (input.fault === 'outcome_unknown_absent' || input.fault === 'outcome_unknown_found') {
      attempt(1, 'timeout_unknown', 10_000);
      transitions.push({ stage: stages.length, simMs: t + publishMs, from: 'sending', to: 'outcome_unknown', audit: 'reply_item.outcome_unknown', reason: 'OUTCOME_UNKNOWN' });
      if (input.fault === 'outcome_unknown_found') {
        publishMs += 300;
        publishSummary = 'Attempt 1 timed out after the write → outcome_unknown, never blindly resent';
        confirmSummary = 'Read-back found our reply on Meta → reconciled_sent, no second write';
        finalTo = 'reconciled_sent';
        reasonCodes.push('OUTCOME_UNKNOWN', 'RECONCILED_FROM_READ_BACK');
      } else {
        publishMs += 300;
        transitions.push({ stage: stages.length, simMs: t + publishMs, from: 'outcome_unknown', to: 'scheduled', audit: 'reply_item.resend_scheduled', reason: 'OUTCOME_UNKNOWN_NOT_FOUND' });
        attempt(2, 'confirmed', 300);
        transitions.push({ stage: stages.length, simMs: t + publishMs - 380, from: 'scheduled', to: 'sending', audit: 'reply_item.send_started', reason: 'META_RE_READ_BEFORE_RESEND' });
        publishSummary = 'Attempt 1 outcome unknown → read-back: absent → automatic resend (max 3)';
        reasonCodes.push('OUTCOME_UNKNOWN', 'OUTCOME_UNKNOWN_NOT_FOUND', 'RESEND_SCHEDULED');
      }
    } else {
      attempt(1, 'confirmed');
    }
    push({ id: 'publish', status: input.fault === 'none' || input.fault === 'duplicate_webhook' || input.fault === 'ai_unavailable' ? 'ok' : 'warn', simMs: publishMs, summary: publishSummary, facts: attempts.map((a) => [`#${a.attemptNo} ${a.idempotencyKey}`, a.result] as const) });
    push({ id: 'confirm', status: 'ok', simMs: 240, summary: confirmSummary, facts: [['Meta id', attempts.find((a) => a.metaMessageId)?.metaMessageId ?? 'found by read-back'], ['Delivered replies', '1']] });
    move(finalTo === 'reconciled_sent' ? 'outcome_unknown' : 'sending', finalTo, finalTo === 'reconciled_sent' ? 'reply_item.reconciled_sent' : 'reply_item.sent');
  }

  const normalizedEvent: Record<string, unknown> = {
    platform: input.channel.startsWith('instagram') ? 'instagram' : 'facebook',
    surface: input.channel,
    kind: comment ? 'comment' : 'message',
    externalId: ids.externalId,
    accountExternalId: ids.account,
    authorRef: `pseudonym:author-${hash(ids.author).slice(0, 4)}`,
    ...(comment ? { contentExternalId: ids.post } : { conversationRef: `conv-${hash(ids.author).slice(0, 6)}` }),
    text: input.text,
    textForModel: redact(input.text),
    receivedAt: new Date(at).toISOString(),
    dedupeKey,
    observationCount: input.fault === 'duplicate_webhook' ? 2 : 1
  };

  const finalState = transitions[transitions.length - 1]?.to ?? 'new';
  return {
    id,
    input,
    webhookPayload: payload,
    normalizedEvent,
    classification: cls,
    retrieved,
    action,
    routeCode: route,
    reasonCodes: [...new Set(reasonCodes)],
    replySource,
    replyText,
    validators,
    stages,
    transitions,
    attempts,
    finalState,
    duplicate: input.fault === 'duplicate_webhook' ? { dedupeKey, observationCount: 2, newJobs: 0 } : null,
    repliesDelivered: finalState === 'sent' || finalState === 'reconciled_sent' ? 1 : 0
  };
}

export function knowledgeTitle(id: string, lang: 'en' | 'sl'): string {
  return entry(id).title[lang];
}
