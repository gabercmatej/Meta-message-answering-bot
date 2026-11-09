import type { StageId } from './sim/types';

export interface StageMeta {
  id: StageId;
  title: string;
  subsystem: string;
  explain: string;
}

/** The twelve pipeline stages, with the production subsystem each one stands for. */
export const STAGES: ReadonlyArray<StageMeta> = [
  { id: 'webhook', title: 'Webhook received', subsystem: 'API · ingest', explain: 'Meta POSTs a signed webhook. The original request bytes are kept so the signature can be checked over exactly what was sent.' },
  { id: 'signature', title: 'Signature verified', subsystem: 'API · ingest', explain: 'HMAC-SHA256 with the app secret, timing-safe compare. The receipt, normalized events and the queue job commit in one PostgreSQL transaction before Meta gets a 200.' },
  { id: 'normalize', title: 'Event normalized', subsystem: 'Meta adapters', explain: 'Separate Facebook and Instagram adapters map four surfaces to one event shape. External IDs stay strings; a dedupe key makes redelivery harmless.' },
  { id: 'context', title: 'Context loaded', subsystem: 'Context builder', explain: 'The worker re-reads the source from the Graph API, loads the conversation or comment thread and replaces the author with a pseudonym. Personal data is redacted before any model call.' },
  { id: 'intent', title: 'Intent identified', subsystem: 'Understanding (model)', explain: 'A constrained, schema-validated call returns intent, risk and flags. Deterministic signals run alongside it and can only make the outcome stricter.' },
  { id: 'legal_area', title: 'Legal area detected', subsystem: 'Understanding (model)', explain: 'One of 17 Slovenian legal areas, or ni_pravno. The area shapes retrieval and routing.' },
  { id: 'retrieval', title: 'Knowledge retrieved', subsystem: 'Knowledge', explain: 'Only approved, unexpired entries pinned by the active release are searchable. The model sees the top matches, nothing else.' },
  { id: 'generate', title: 'Response generated', subsystem: 'Writer (model) or approved text', explain: 'A grounded draft with citations, or an owner-approved fixed text. Human-only cases get no reply text at all.' },
  { id: 'validate', title: 'Validation', subsystem: 'Validators + model check', explain: 'Deterministic validators reject ungrounded amounts or links, legal verdicts, deadlines, invented callbacks and informal address. A failed draft is replaced by the approved fallback, never sent.' },
  { id: 'schedule', title: 'Reply scheduled', subsystem: 'Auto-send policy', explain: 'Eligibility is decided in code: mode, switch, verified surface, owner-approved release, safety tiers. The reply waits for the configurable delay, during which a person can step in.' },
  { id: 'publish', title: 'Meta publish', subsystem: 'Publisher (only writer)', explain: 'Right before the write the dispatcher rechecks pause, mode, source existence, takeover and prior replies, then persists the exact text and attempt. Only this module holds a publishing token.' },
  { id: 'confirm', title: 'Delivery confirmed', subsystem: 'Publisher · reconciliation', explain: '“Sent” only on a confirmed Meta write. A timeout after the write becomes outcome_unknown and is reconciled by reading Meta back, never blindly resent.' }
];
