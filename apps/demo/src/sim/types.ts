/**
 * Types of the demo simulator. Names mirror the production system's vocabulary (reply states,
 * intents, legal areas, reason codes) so the demo teaches the real architecture, but every value
 * the simulator produces is synthetic and deterministic.
 */

export type Channel = 'messenger' | 'instagram_dm' | 'facebook_comment' | 'instagram_comment';
export type Lang = 'en' | 'sl';

/** Injected fault for a run (the "what if" scenarios). */
export type Fault =
  | 'none'
  | 'ai_unavailable'
  | 'duplicate_webhook'
  | 'meta_throttled'
  | 'outcome_unknown_absent'
  | 'outcome_unknown_found';

/** Intents as named in the production classifier. */
export type Intent =
  | 'product_question'
  | 'pricing_promotion'
  | 'praise_thanks'
  | 'complaint'
  | 'individual_legal_situation'
  | 'general_legal_topic'
  | 'threat_sensitive_distress'
  | 'unclear'
  | 'other'
  | 'contact_booking';

/** Legal-area ids as stored in production decisions (Slovenian ids). */
export type LegalArea =
  | 'delovno'
  | 'druzinsko'
  | 'dedno'
  | 'stvarno_nepremicnine'
  | 'potrosnisko'
  | 'obligacijsko_pogodbe'
  | 'drugo'
  | 'ni_pravno';

export type Risk = 'low' | 'medium' | 'high' | 'critical';

/** Demo-level topic the deterministic matcher recognises. */
export type Topic =
  | 'greeting'
  | 'price'
  | 'availability'
  | 'booking'
  | 'employment_termination'
  | 'unpaid_salary'
  | 'tenancy'
  | 'consumer'
  | 'family'
  | 'inheritance'
  | 'general_legal'
  | 'thanks'
  | 'complaint_about_us'
  | 'off_topic'
  | 'distress'
  | 'unclear';

/** Production action vocabulary: what code decided to do with the message. */
export type Action = 'reply' | 'clarify' | 'skip' | 'review';

/** Reply-item states (subset of the production state machine that the demo exercises). */
export type ReplyState =
  | 'new'
  | 'processing'
  | 'scheduled'
  | 'sending'
  | 'outcome_unknown'
  | 'sent'
  | 'reconciled_sent'
  | 'needs_review'
  | 'skipped';

export type StageId =
  | 'webhook'
  | 'signature'
  | 'normalize'
  | 'context'
  | 'intent'
  | 'legal_area'
  | 'retrieval'
  | 'generate'
  | 'validate'
  | 'schedule'
  | 'publish'
  | 'confirm';

export type StageStatus = 'ok' | 'warn' | 'fail' | 'hold' | 'skip';

export interface StageResult {
  id: StageId;
  status: StageStatus;
  /** Simulated duration in milliseconds (representative mock timing, not a measurement). */
  simMs: number;
  /** One-line, human-readable outcome. */
  summary: string;
  /** Optional key/value facts shown when the stage is expanded. */
  facts: ReadonlyArray<readonly [string, string]>;
}

export interface KnowledgeEntry {
  id: string;
  version: number;
  type: 'price' | 'service_fact' | 'contact_route' | 'faq' | 'policy_boundary' | 'legal_area_guidance';
  areas: ReadonlyArray<LegalArea>;
  title: Record<Lang, string>;
  body: Record<Lang, string>;
  keywords: ReadonlyArray<string>;
}

export interface RetrievedEntry {
  id: string;
  version: number;
  score: number;
  cited: boolean;
}

export interface Classification {
  topic: Topic;
  intent: Intent;
  legalArea: LegalArea;
  risk: Risk;
  needsLawyer: boolean;
  language: Lang;
  signals: string[];
  matchedTerms: string[];
  /** True when the topic was inherited from an earlier turn of the same conversation. */
  fromContext: boolean;
}

export interface Transition {
  simMs: number;
  /** Index of the pipeline stage during which the transition happened. */
  stage: number;
  from: ReplyState | null;
  to: ReplyState;
  audit: string;
  reason?: string;
}

export interface DispatchAttempt {
  attemptNo: number;
  idempotencyKey: string;
  endpoint: 'messenger_send' | 'instagram_dm_send' | 'facebook_comment_reply' | 'instagram_comment_reply';
  simMs: number;
  result: 'confirmed' | 'rate_limited' | 'timeout_unknown';
  metaMessageId: string | null;
}

export interface Validator {
  code: string;
  label: string;
  passed: boolean;
}

export interface HistoryTurn {
  role: 'user' | 'bot';
  text: string;
  topic?: Topic;
}

export interface SimInput {
  runNo: number;
  channel: Channel;
  lang: Lang;
  text: string;
  fault: Fault;
  /** Configured automatic reply delay in seconds (production default here: 60). */
  delaySeconds: number;
  history: ReadonlyArray<HistoryTurn>;
}

export interface RunTrace {
  id: string;
  input: SimInput;
  webhookPayload: unknown;
  normalizedEvent: Record<string, unknown>;
  classification: Classification;
  retrieved: RetrievedEntry[];
  action: Action;
  routeCode: string;
  reasonCodes: string[];
  replySource: 'ai_draft' | 'approved_fallback' | 'approved_text' | null;
  replyText: string | null;
  validators: Validator[];
  stages: StageResult[];
  transitions: Transition[];
  attempts: DispatchAttempt[];
  finalState: ReplyState;
  duplicate: { dedupeKey: string; observationCount: number; newJobs: number } | null;
  /** Number of messages sent to the person by this run (must be 0 or 1). */
  repliesDelivered: number;
}
