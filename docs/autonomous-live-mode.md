# Autonomous LIVE mode

How the system went from *every reply approved by a person* to *ordinary messages answered
automatically within a minute*, and which parts of the design made that safe enough to do.

Sources: production ADRs 0004 (autonomy-v1), 0005 (owner-approved releases) and 0006 (full
autonomy), and the project log. Code paths named below are in the private repository; the source is not
published.

## 1. Why it started review-first

On 1 October 2026 the bot ran in **REVIEW**: the pipeline drafted every reply, and a person sent it.
That was deliberate:

- **Legal-adjacent content.** A wrong sentence can read as legal advice.
- **No measured quality yet.** The first real-model evaluation (30 September) had failures with
  identifiable root causes.
- **An unproven Meta integration.** The comment surfaces were not yet write-verified, and the
  Meta app was unpublished.

The architecture already contained LIVE: modes, delayed scheduling, the dispatcher recheck and the
`outcome_unknown` protocol. It was disabled by configuration and by a server-side mode ceiling.

## 2. Modes

| Mode | Pipeline | Sending |
|---|---|---|
| OFF | webhooks verified and stored; worker records `MODE_OFF` | none |
| SHADOW | full pipeline on real traffic, stored as evidence | **never** (code + DB constraints) |
| REVIEW | full pipeline | only after a person acts, on write-verified surfaces |
| LIVE | full pipeline | eligible replies scheduled automatically; everything else waits for a person |

The effective mode is the **least permissive** of the deployment ceiling (`BOT_MODE`), the global
mode and the per-account mode; a pause always wins
(`domain/modes.ts`). On top of that, LIVE needs the owner's
**LIVE switch** (typed confirmation, audited) and `LIVE_AUTOSEND_ENABLED`. Messages received before
the switch time are never auto-sent, and nothing floods out after a recovery.

## 3. How automatic replies became possible

| Step | Date | What changed |
|---|---|---|
| Write verification per surface | 30 Sep → 29 Oct | A surface can send only after one owner-confirmed, audited test write. All four endpoints verified by 29 Oct (first recorded in the 28–29 Oct log entry). |
| One-click LIVE switch, fail-closed eligibility | 22 Oct (r3) | LIVE refused with an explicit blocker list unless readiness passes. |
| **autonomy-v1** tiers | 26–28 Oct (r4) | **A** service answers (product, price, contact, thanks, clarify) · **B** bounded legal orientation: how PND helps, which documents matter, **no merits, deadlines or outcome promises**, must name an approved contact route · **C** person. |
| Response hierarchy | 27 Oct | full answer → orientation → partial answer + clarification → honest contact route (e.g. no approved price → no amount, give the route) → person. |
| Approved fallback (level C) | 28 Oct | A decision that would end in review is answered with the release's **approved handoff text** unless `fallbackBlockers` finds a reason a person must act. The rejected draft is never sent. |
| Configurable delay, Send now, countdown | 27 Oct | One authoritative setting, 0–60 min, default 180 s; production set to 60 s. |
| Manual messages after automatic replies | 28 Oct | Staff can always write; a queued manual message cancels a pending automatic reply to the same person. |
| r5: formal address everywhere | 3 Nov | `vikanje` style pin, `INFORMAL_ADDRESS` final check and normalization, formal approved texts enforced at approval. |
| **owner-approved-v1** | 3 Nov | Release approval without a mandatory paid evaluation (see §5). |
| **Full autonomy** | 3 Nov | Harm words inside a legal-help request are a legal topic, not a threat; AI failure → approved fallback; resend after a confirmed-absent unknown outcome; operator alerts. |

Measured effect, as an engineering estimate rather than a quality figure: on a stored-output
replay of 105 risk-weighted cases, auto-eligible coverage went **30.5 % (r3) → 50.5 % → 66.7 % →
68.6 %** with the default harness, and to 91.4 % with a harness whose stand-in writer cites
what it retrieves. A real-model dry run (28 Oct) then auto-sent **92 of 93 legitimate messages
(98.9 %)** across all four channels and **0 of 11** human-only controls. Nothing was published in
these runs.

## 4. The 60-second delay

- `reply_items.scheduled_for = received + delay(surface)`; the delay setting is authoritative and
  audited, and it applies equally to comments, comment replies and DMs.
- **Why a delay at all:** people often send two or three DMs in a row. Messages that arrive inside
  the window are merged into one decision and one reply (`SUPERSEDED_BY_NEWER_MESSAGE`). It also
  gives staff a window to cancel, and makes the bot feel less mechanical.
- **Send now** skips the wait, not the checks: the dispatcher recheck runs either way.
- With "Takoj" (0 s), bursts effectively stop merging; the UI says so.

## 5. Owner-approved releases

Every behavior or dispatch code change voids the stored LIVE authorization, because it is bound to
code fingerprints. Earlier, the only way back was a fresh paid evaluation that also passed its
gates. After the r5 run completed 134/134 but failed the gates, the owner decided that paid
evaluation is **optional** (ADR 0005):

- Only an active **owner** can approve. They type the first 12 hex characters of the release checksum
  and a note of at least 20 characters. Available as a CLI (dry run by default) and as an admin button.
- **Free technical checks are recomputed inside the approval transaction**: manifest validates and
  matches its checksum, pinned knowledge is approved, the code identity comes from a clean build,
  auto-send policy is enabled, approved texts are formal and never claim "a person reviews this",
  and a rollback release exists.
- The LIVE authorization covers the release's own auto-send intents, never
  `threat_sensitive_distress`, `spam_abuse`, `self_or_handled` or `unsupported_media`.
- It records `basis: owner_approval`, `evaluatedCases: 0`, `livePrecision: null`. **It does not
  claim measured quality**, and earlier evaluation runs stay attached as information.
- After a deploy that changes fingerprints, automatic sending **stops** until the owner runs the same
  command again (`release.live_reauthorize`). This is free and takes seconds; the previous
  authorization goes into `liveAuthorizationHistory`.

## 6. When the AI response cannot be used

| Situation | Outcome |
|---|---|
| Draft fails a wording validator | one bounded repair, re-validated; if it still fails → approved fallback |
| Draft ungrounded (price/URL/phone not in cited approved knowledge) | approved fallback or honest contact route |
| Provider timeout, error, refusal, invalid JSON | `AI_UNAVAILABLE_FALLBACK`: approved generic text, category `other` |
| Model over-reads risk without textual support | deterministic corroboration drops it (`MODEL_URGENCY_NOT_IN_TEXT`, `HARM_TOPIC_LEGAL_REQUEST`) |
| Reply names 112/113 without acute danger | `EMERGENCY_NUMBER_NOT_NEEDED` → repair → fallback |

Each fallback is itself subject to `fallbackBlockers`. If any blocker is present, a person handles the message.

## 7. What still goes to a person

Threats, acute danger, self-harm, distress, violence outside a legal-help request, a minor as the
writer, prompt injection without a legitimate question, privacy or data-deletion requests, refund
disputes with the company, a refused phone route, a follow-up that depends on a turn a person is
holding, critical risk, and unsupported languages. The UI states the decisive reason ("Samodejno ni
poslano, ker …"), and `release-status` lists held replies by reason category.

Public comments that are remarks to another commenter, with no question to the page, are
**skipped** rather than queued for a person (`AUTONOMY_OTHER_COMMENT_*`). On the 191 real harvested
public comments, that moved the chatter share of the review queue from 94 % (r3) to 63 % skipped (r4).

## 8. Generated ≠ scheduled ≠ attempted ≠ delivered

| Stage | Recorded as | Shown in UI |
|---|---|---|
| Generated | decision + draft text, reason codes | "Predlog pripravljen" |
| Scheduled | `reply_items.state = scheduled`, `scheduled_for`, `scheduled_by = auto` | countdown, Send now / Cancel |
| Attempted | `publish_attempts` row **with the exact text**, item `sending` | sending |
| Delivered | Meta id stored (`sent`) or read-back match (`reconciled_sent`) | "AI predlog · samodejno poslano · 10:51" |

A permanent rejection, exhausted throttling retries or an unresolved unknown outcome log a structured
`DELIVERY_NEEDS_OPERATOR` alert. `release-status` reports automatic coverage as *handled* versus
*delivered*, so the gap is visible.

## 9. Manual intervention

- **Novo ročno sporočilo** (new manual message) is always available in a conversation, including after an automatic reply.
- A manual message goes through the same dispatcher, with the same rechecks and the DM 24 h window.
- Pending automatic replies to the same person are cancelled when a manual message is queued
  (`SUPERSEDED_BY_MANUAL_MESSAGE`). A reply the dispatcher has already started is not cancelled; the UI explains why.
- Staff tick which open items a manual message answers; on confirmed delivery they close as
  `handled` (`ANSWERED_BY_MANUAL_MESSAGE`), and counters update.
- A **pause** stops new sends immediately. It cannot recall a write already handed to Meta, and the UI says so.
