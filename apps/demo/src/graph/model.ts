/** Topology vocabulary shared by the pure route builder and the SVG renderer (no geometry here). */

export type NodeId =
  | 'device'
  | 'webhook'
  | 'ingest'
  | 'normalize'
  | 'queue'
  | 'context'
  | 'intent'
  | 'model'
  | 'retrieval'
  | 'kstore'
  | 'decision'
  | 'review'
  | 'generate'
  | 'fallback'
  | 'validate'
  | 'schedule'
  | 'publish'
  | 'reconcile'
  | 'graph';

export type EdgeId =
  | 'dev_out'
  | 'webhook_ingest'
  | 'ingest_normalize'
  | 'normalize_queue'
  | 'queue_context'
  | 'context_intent'
  | 'intent_model'
  | 'intent_retrieval'
  | 'retrieval_kstore'
  | 'retrieval_decision'
  | 'decision_review'
  | 'decision_generate'
  | 'generate_model'
  | 'generate_fallback'
  | 'fallback_validate'
  | 'generate_validate'
  | 'validate_schedule'
  | 'schedule_publish'
  | 'publish_graph'
  | 'publish_reconcile'
  | 'reconcile_graph'
  | 'retry'
  | 'resend'
  | 'dev_in';

/** Forward direction of every edge: [from, to]. A route step may traverse it in reverse. */
export const EDGE_ENDS: Record<EdgeId, readonly [NodeId, NodeId]> = {
  dev_out: ['device', 'webhook'],
  webhook_ingest: ['webhook', 'ingest'],
  ingest_normalize: ['ingest', 'normalize'],
  normalize_queue: ['normalize', 'queue'],
  queue_context: ['queue', 'context'],
  context_intent: ['context', 'intent'],
  intent_model: ['intent', 'model'],
  intent_retrieval: ['intent', 'retrieval'],
  retrieval_kstore: ['retrieval', 'kstore'],
  retrieval_decision: ['retrieval', 'decision'],
  decision_review: ['decision', 'review'],
  decision_generate: ['decision', 'generate'],
  generate_model: ['generate', 'model'],
  generate_fallback: ['generate', 'fallback'],
  fallback_validate: ['fallback', 'validate'],
  generate_validate: ['generate', 'validate'],
  validate_schedule: ['validate', 'schedule'],
  schedule_publish: ['schedule', 'publish'],
  publish_graph: ['publish', 'graph'],
  publish_reconcile: ['publish', 'reconcile'],
  reconcile_graph: ['reconcile', 'graph'],
  retry: ['publish', 'publish'],
  resend: ['reconcile', 'publish'],
  dev_in: ['reconcile', 'device']
};

export const ALL_NODES: ReadonlyArray<NodeId> = [
  'webhook', 'ingest', 'normalize', 'queue', 'context', 'intent', 'model', 'retrieval', 'kstore',
  'decision', 'review', 'generate', 'fallback', 'validate', 'schedule', 'publish', 'reconcile', 'graph'
];
export const ALL_EDGES = Object.keys(EDGE_ENDS) as EdgeId[];

export type NodeState = 'standby' | 'active' | 'done' | 'warn' | 'hold' | 'fail' | 'skipped';
export type EdgeState = 'standby' | 'active' | 'traversed' | 'skipped';
