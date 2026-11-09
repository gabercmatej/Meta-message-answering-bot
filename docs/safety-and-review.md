# Safety model and human review

> **Updated 9 November 2026.** Production runs **LIVE with automatic replies** (release r5, since
> 3 November 2026). This page describes the invariants and the publishing safeguards, which guard
> automatic and human sends alike, and the review actions, which now serve the items that stay with
> a person. Where the October (REVIEW-era, releases r2/r3) rules differ from the current ones
> (autonomy-v1 tiers, approved fallback, delivery recovery), the text says so; the autonomy design
> itself is in [autonomous-live-mode.md](autonomous-live-mode.md).

**History.** On 1 October 2026 production ran **REVIEW**: every outgoing reply was approved by a
human, only on surfaces that passed a controlled write verification, with LIVE autosend built but
disabled. That gate was relaxed in steps through October and November, never by removing a
runtime check.

Diagrams: [../diagrams/mode-flow.md](../diagrams/mode-flow.md), [../diagrams/review-flow.md](../diagrams/review-flow.md).

## Principles

1. **The model proposes; code decides.** Schema-valid model output is still untrusted input. Hard
   invariants live in code, and configuration (behavior releases, publishing settings) can only
   narrow them.
2. **Defence in depth for "never send".** The rule that SHADOW never sends and that a paused or
   low-mode system cannot enter a send state is enforced three times: in application code, in a
   database CHECK constraint, and in database triggers.
3. **Exactly-once intent, honest uncertainty.** Exact outgoing text is persisted before the write; a
   timeout is `outcome_unknown`, reconciled by reading Meta, never blindly resent.
4. **No promotion of non-publishing decisions.** SHADOW items, replay results and previews can never
   become sendable by flipping a flag.

## Modes and the dispatch boundary

| Mode | Decision pipeline | Reply item | Sending |
|---|---|---|---|
| `OFF` | not run | none | impossible |
| `SHADOW` | full pipeline on real traffic | created with the AI draft as evidence | **impossible**: code, DB CHECK `reply_items_shadow_never_sends`, and a `publish_attempts` trigger |
| `REVIEW` | full pipeline | `needs_review` | only after a human Approve & Send / Edit & Send, per verified surface |
| `LIVE` | full pipeline | items that pass `autoSendEligibility()` are `scheduled` with a delay (60 s in production); all others `needs_review` | automatic after the delay and the dispatcher recheck; refused below `BOT_MODE=LIVE`. **Production since 3 Nov 2026** |

- Effective mode = least permissive of `BOT_MODE` (deployment ceiling), global mode and account
  mode (`effectiveMode()` in `src/domain/modes.ts`).
- Configuration refuses `BOT_MODE=REVIEW|LIVE` with `PUBLISHING_TRANSPORT=none`, and refuses
  `LIVE_AUTOSEND_ENABLED=true` unless `BOT_MODE=LIVE`, at startup.
- `PUBLISHING_TRANSPORT=none` means **no transport object exists**. Nothing can be published
  structurally, not merely because a flag says so.
- Items created in SHADOW stay read-only evidence forever, even after the system moves to REVIEW.
- Mode changes into REVIEW go through a **REVIEW readiness gate** (system checks such as database,
  worker heartbeat, `worker_config` drift between API and worker, access health, approved release
  matching configured models, transport, autosend disabled, not paused; plus per-surface checks).
  Downgrades are always allowed. Every change is audited.

## The decision pipeline

`runDecisionPipeline()` (`src/pipeline/decide.ts`, `pipeline-v4`). It returns
`reply | clarify | handoff | review | skip | error`, a concise list of **reason codes**, source refs
and a per-stage trace with latency. It never stores chain-of-thought.

| # | Stage | What happens | Example reason codes |
|---|---|---|---|
| 0 | Release check | Re-validate the manifest against code invariants; check the engine pin | `RELEASE_INVALID`, `RELEASE_ENGINE_MISMATCH` |
| 1 | Precheck (no AI) | Deleted, self-authored, do-not-answer, human takeover, already-handled thread, media-only, empty, reply-to-reply disabled | `COMMENT_DELETED`, `SELF_AUTHORED`, `HUMAN_TAKEOVER`, `ALREADY_HANDLED_THREAD` |
| 2 | Behavior | Scoped overrides (platform < account < campaign < content) can only **tighten** actions | `BEHAVIOR_OVERRIDE_CONFLICT` |
| 3 | Redaction and signals | Personal data replaced by typed placeholders **before retrieval and before any provider call**; deterministic risk and prompt-injection signals | `REDACTED_<KIND>`, `PERSONAL_DATA_IN_COMMENT` |
| 4 | Understanding (model call 1) | Structured output: intent, legal area, risk level and flags, language, needsLawyer, short redacted summary, retrieval query. Code then raises risk where deterministic signals demand it | `RISK_LEVEL_RAISED_BY_CODE`, `RISK_<FLAG>` |
| 5 | Retrieval | Only knowledge the release pins; eligibility and contradiction checks | `KNOWLEDGE_EXCLUDED_EXPIRED`, `CONFLICTING_FACTS` |
| 6 | Routing (code) | Category rules, legal-area handoff routing, risk policy, surface policy | `RISK_HUMAN_ONLY`, `ROUTE_LEGAL_AREA_HANDOFF`, `PROMPT_INJECTION_SUSPECTED`, `CONFLICTING_CAMPAIGN_CONTEXT` |
| 7 | Generation (model call 2) | Only when routing planned an AI reply or clarification. Approved fixed / handoff / clarification texts skip generation | `HARD_POLICY_NO_AI_REPLY`, `MISSING_APPROVED_FACT`, `MISSING_PRICE_OR_OFFER_FACT`, `UNKNOWN_SOURCE_REF` |
| 8a | Deterministic validators | On every publishable text, including approved texts | see below |
| 8b | Model check (call 3, optional) | Fact / safety check; a pass never overrides a deterministic failure | `MODEL_CHECK_FAILED`, `MODEL_CHECK_LEGAL_ADVICE` |

### Hard invariants in code

- **Allowed rule actions per intent** (`ALLOWED_RULE_ACTIONS` in `src/domain/categories.ts`). For
  example `threat_sensitive_distress` can only be `review`, and `spam_abuse` only `skip` or
  `review`. A release can only narrow what a category allows, never widen it.
- **Baseline for releases without autonomy (r2/r3, October).** No AI-written reply for complaint,
  account / payment / refund, individual legal situation, general legal topic, threat / distress,
  spam, self / handled or unsupported media: legal topics could only end as an approved handoff
  text or a human-reviewed draft.
- **Tiers for autonomy-v1 releases (r4/r5, ADR 0004).** A release opts in; the tiers themselves are
  code. **A** service answers (product, price, contact, thanks, grounded "other", clarification),
  **B** bounded legal orientation (how the company helps, which documents matter; no merits,
  deadlines or outcome promises; it must name an approved contact route and is refused when it
  states a legal verdict), **C** the approved handoff or fallback text, **human** for everything
  else. Threat / distress, spam, self / handled and unsupported media are never answered by AI
  text, and a complaint gets at most the approved acknowledgement through the fallback level. Tax
  and foreigners law stay with a person by an owner decision.
- **Grounding**: product, pricing and contact / booking replies must cite at least one approved
  business fact. General legal-area guidance alone can never ground them. A pricing reply needs a
  `price` or `offer` fact, and figures in the question that no cited fact covers force review.
- **Risk flags**: `SELF_HARM`, `THREAT` and `DISTRESS` always mean a human decides. `VIOLENCE`,
  `MINORS` and `CRIMINAL_EXPOSURE` forbid an AI-written answer. A model cannot report a flag with a
  lower risk level than code assigns to it. One narrow, deterministic exception exists in
  autonomy releases: harassment or violence *vocabulary* inside a legal-help request, with no acute
  danger, threat, self-harm, distress or minor (`HARM_TOPIC_LEGAL_REQUEST`, ADR 0006), is treated
  as a legal topic and goes through the ordinary tiers with all their validators.
- **Handoff text** comes only from the approved release, never from the model.
- **Public comments** never get a clarifying question that asks for personal or case details. A
  named identifier or health detail on a public comment forces review, even when no value was
  recognized for redaction.
- **Skip never silently drops manipulation**: a suspected prompt injection, or a "spam" message
  with a legal-situation signal, becomes `review`, not `skip`.

### Deterministic validators (`src/pipeline/validators.ts`)

`TOO_LONG`, `EMPTY_REPLY`, `UNAPPROVED_URL`, `UNGROUNDED_NUMBER`, `UNGROUNDED_CONTACT`,
`UNGROUNDED_OFFER_TERM`, `EMOJI_NOT_ALLOWED`, `AVOID_PHRASE_USED`, `PRIVACY_REQUEST` (public request
for personal data), `LEGAL_BOUNDARY` (legal promises or advice), `INSTRUCTION_LEAK`,
`FORMALITY_MISMATCH`, `REDACTION_PLACEHOLDER`, `CLARIFY_SHAPE`.

### Constrained model output

Each model stage has a Zod schema (the authority) and a matching JSON Schema sent as the provider's
structured-output format (`src/ai/schemas.ts`). Intents, legal areas, risk levels, risk flags,
generation actions and model-check issues are closed enums. Untrusted data (message, thread,
caption, conversation, draft under review) is fenced in a single delimited block in the user turn
and is redacted first. Invalid output gets **at most one repair attempt**; after that the decision
is `review / AI_INVALID_OUTPUT`. Refusals are never retried. Timeouts and unavailability are
technical `error`s. In **r5** a failed understanding, writer or check call is answered with the
release's approved generic text (`AI_UNAVAILABLE_FALLBACK`), unless a deterministic hard signal
(threat, violence outside a legal-help request, distress, self-harm, minor, injection, refund
dispute, privacy request, refused phone route) forbids even that; then a person handles it. There
is **no fallback model**: each stage uses the model the release pins, and a mismatch is an error
(`MODEL_NOT_CONFIGURED`, `AI_MODEL_MISMATCH`), never a substitution. The fallback is approved
text, not another model.

## Human review

Server-side actions (`src/inbox/lifecycle.ts`, `REPLY_ACTIONS`):

| Action id | Console label | Effect |
|---|---|---|
| `approve_send` | Approve & Send | Final text = AI draft; item `approved`; the dispatcher sends after its own full recheck |
| `edit_send` | Edit & Send | Final text = the human's text; `edited_by_human` recorded |
| `hold` | Hold | `held` |
| `reject` | No reply | `skipped`, disposition `rejected` |
| `mark_handled` | Mark handled | `handled` (answered elsewhere) |
| `schedule` / `send_now` / `cancel` | Schedule / Send now / Cancel sending | Human scheduling (at most 7 days ahead, never past the DM window) |

- The server computes `allowedActions` from item state, the mode the item was created in, the
  current effective mode, pause, transport, **verified surface capability**, surface settings,
  source deletion and the 24-hour messaging window. The UI renders only those.
- **The AI draft is immutable.** A database trigger refuses overwriting `draft_text` for the same
  decision. The human's final text, reviewer, review time, schedule, send time and platform send id
  are stored separately, so draft and final text can be diffed.
- Optimistic concurrency: every action carries `rowVersion`; a stale one is a 409, never a silent
  overwrite. A duplicate click therefore cannot double-send.
- Every action is written to `audit_events` with before / after state, and a hash and length of the
  final text (not the text itself).
- If a pause or mode change races a send action, the database trigger refuses the transition and
  the API answers `REFUSED_BY_GUARD`.

## Publishing safeguards

- **Only `src/publishing/` can write to Meta** (ESLint-enforced). The Graph write transport is
  POST-only and isolated in one file.
- **Per-surface capability**: an endpoint (`facebook_comment_reply`, `messenger_send`,
  `instagram_comment_reply`, `instagram_dm_send`) counts as verified only with evidence from a
  successful controlled write verification. A hand-set `verified` is refused by the API. See
  [meta-integration.md](meta-integration.md#controlled-write-verification).
- **Pre-send rechecks** immediately before each write (local and fresh Meta reads), listed in
  [message-lifecycle.md](message-lifecycle.md#5-dispatch-publishing-module).
- **Exact text and attempt state persisted before the write.** A recorded attempt's text, target and
  endpoint are immutable (trigger).
- **`outcome_unknown` is never resent blindly**: at most one open attempt per item (unique partial
  index) and reconciliation by read-back first. Since r5 (ADR 0006) an **automatic** reply that
  Meta verifiably does not show after the reconciliation reads (`reconciled_absent`) is sent again,
  at most 3 attempts in total, with a fresh Meta read before each write that treats a late-visible
  earlier attempt as delivered, and every pre-send check repeated. A **person's** reply is never
  resent automatically. An unresolved outcome, a permanent rejection or exhausted throttling
  retries log a structured `DELIVERY_NEEDS_OPERATOR` alert.
- **Kill switch**: a pause blocks new send permits at once (DB trigger plus dispatcher). A request
  already sent cannot be recalled; in-flight state is shown honestly as `sending` or "check needed".
- **Daily send limit** from publishing settings.

## LIVE autosend: eligibility and recheck

`autoSendEligibility()` (`src/publishing/eligibility.ts`) only ever narrows. It requires LIVE mode,
the autosend environment flag, the settings flag, a release allowlist (surface, action, intent)
and a LIVE authorization bound to the release checksum and to the behavior and dispatch code
fingerprints ([autonomous-live-mode.md](autonomous-live-mode.md#5-owner-approved-releases)). It then
excludes, as hard invariants:

- **Risk above the tier's ceiling**: low for service answers, medium for bounded orientation, high
  (never critical) for the approved handoff. Risk flags a tier does not explicitly tolerate also block.
- **Never-automatic intents outside their tier**: complaint, refund / payment, legal intents,
  unclear and the others in the code's never-auto set may be automatic only in the narrow form their
  tier allows (for example a clarifying question or the approved handoff); threat / distress, spam,
  self / handled and unsupported media never are.
- Ungrounded replies, knowledge conflicts, any validator failure, AI text without a passing model
  check, an informal address in a formal release, a claim that "a person reviews this", historical,
  stale or taken-over items, and messages received before the LIVE switch.
- For the **fallback** level, the only content blockers are the hard reasons in `fallbackBlockers`
  (threats, violence, distress, self-harm, minors, injection, privacy requests, refund disputes,
  critical risk, unsupported language, a refused phone route).

Every scheduled automatic send is re-checked by the dispatcher immediately before the write (pause,
mode, scope, release and authorization, source existence, takeover, duplicates, messaging window,
knowledge validity, daily limit). None of these checks reads an evaluation result.

## Privacy

- Personal data (phone numbers, e-mails, IBAN / bank accounts, personal and tax identification
  numbers, street addresses, long numeric ids, tokens and API keys) is replaced by typed
  placeholders before retrieval and before any model call. Author names never reach the model; the
  snapshot schema is strict and carries only a pseudonym.
- Each decision records which kinds were redacted, not the values.
- The AI usage ledger stores stage, provider, model, outcome, tokens, estimated cost and latency.
  It never stores prompts, outputs or message text.
- Stored webhook receipts are minimized. Reviewer avatar and thumbnail URLs are pruned after
  30 days.

## What the system will not do

Cold-DM strangers, mass-DM, mass-comment, post promotional comments under third-party content, give
individualized legal advice, calculate legal deadlines, promise outcomes, or invent prices, links or
contact details.
