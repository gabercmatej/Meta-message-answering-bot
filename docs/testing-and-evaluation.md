# Testing and evaluation

Two separate things, labelled separately:

- **Engineering tests**: deterministic unit and PostgreSQL integration tests with fake or recorded
  providers and fake Meta transports. They prove correctness of ingestion, policy, publishing and
  recovery logic. They say nothing about the quality of model-written Slovenian replies.
- **Quality evaluation**: replay of evaluation datasets through the same decision pipeline with a
  simulated publisher, scored against labels and gated. Only runs with a real model ("fresh") and
  human ratings say anything about reply quality.

No routine automated test performs a production public write, and no test calls the real Meta API
or a real model. Real-model runs are separate, explicitly cost-capped commands, and their results
are reported below with their run ids.

## Measured test results

### At the production commit (`8e22656`, 3 November 2026)

The gate is `npm run check`: lint, typecheck (server and admin), unit tests, PostgreSQL
integration tests and build. All of it passed at the commit that runs in production. The suite
uses scripted model outputs and a fake Meta transport, with integration tests against real
embedded PostgreSQL.

### Re-run for this showcase

Re-run on **9 November 2026** on the same commit, in the private checkout with `DATABASE_URL`
forced empty (throwaway embedded PostgreSQL), Node.js 22.17.0 on Windows, no credentials, no
network calls to Meta or a model provider:

| Suite | Whole repository | Messaging bot only (Content Bot excluded) |
|---|---|---|
| Unit + contract | **3,985 passed / 0 failed**, 204 files | **2,808 passed**, 116 files |
| Integration (real PostgreSQL) | **886 passed / 0 failed**, 86 files | **593 passed / 0 failed**, 49 files |
| Total | **4,871** | **3,401** |

The repository also contains a separate Content Bot product (social content planning), added on
5 October 2026. Its tests are in the left column, so the right column is the figure that belongs to
the messaging platform described here. The README quotes both.

### Growth

| Date | Commit | Unit | Integration | Note |
|---|---|---:|---:|---|
| 1 Oct 2026 | `80cdc96` | 511 | 222 | messaging bot only (before the Content Bot existed) |
| 26 Oct 2026 | `ff4b49e` | 3,450 | 844 | whole repository |
| 29 Oct 2026 | `56c26d5` | 3,872 | 875 | whole repository |
| 3 Nov 2026 | `8e22656` | 3,985 | 886 | whole repository; messaging bot only: 2,808 unit, 593 integration (3,401) |

## Real-model measurements

These come from the project log. Each is labelled by what it measures. **None of them is an
"accuracy" of the whole system, and none should be combined with another.**

| Date | Run | Setup | Result | What it measures |
|---|---|---|---|---|
| 30 Sep | first real evaluation | fresh Anthropic, synthetic corpus | failed gates → root causes fixed → r2 | engineering feedback |
| 26 Oct | `13bd671a` | fresh, 105 required cases, r3 deployed | 99 pass / 6 fail | per-case pass rate |
| 26 Oct | `be045cb6` | fresh, 105 required cases | 101 pass / 4 fail | per-case pass rate |
| 27 Oct | `ab819627` | fresh, r4 | action accuracy 98 % (pass); auto-reply precision 94.4 % (fail); 1 critical | gates |
| 28 Oct | real-model **dry run** | real models through the real pipeline, LIVE eligibility, dispatcher recheck; nothing published; ≈ 1.91 € | **92/93 legitimate messages auto-sent (98.9 %)** on all four channels; **0/11** human-control cases sent; 0 unsolicited amounts | automatic-handling rate on a curated set |
| 29 Oct | `269a650d` | fresh, dataset `pnd-legal-v3` v4, 107 required | 107/107 completed; action accuracy **98.1 %** (pass); auto-reply appropriateness **90.5 %** (fail, gate ≥ 98 %); 2 reported critical (both scorer false positives on correctly declined statements) | gates; diagnosis → `56c26d5` |
| 3 Nov | r5 run | fresh, dataset v5, 134 required | 134/134 completed; gates **failed** | gates |

The r4 release was later approved and ran LIVE in production (owner-reported). The project log
records that its LIVE authorization was computed from evaluation evidence over the 107 required
cases (it authorized 5 intents), but it does not record the id or the gate results of the approving
run, so this page quotes no number for it. The r5 release was approved differently: by the owner
(`owner-approved-v1`, 3 Nov) after its own run failed the gates, with `evaluatedCases: 0`.

**How to read the 98.9 %.** It is the share of legitimate messages in a curated real-model dry
run that the system would have sent automatically, with real models and the real eligibility and
dispatcher checks. It is a coverage and safety measurement (and 0 of 11 human-only controls were
sent). It is not a judgment of reply quality, and it is not production traffic.

**Production evidence** (owner-reported, not instrumented in this repository): r5 LIVE since
3 November 2026 with automatic replies delivered on Facebook and Instagram; `release-status`
reports automatic coverage as handled versus delivered, plus an ATTENTION line for failed deliveries.
No production conversation content is published here.

### Stored-output coverage estimates (zero model cost)

Replays of stored model outputs through newer policy code, used to measure what a policy change
*would* do before paying for a fresh run. Engineering estimates, **not** quality:

| Code | Default harness | Faithful harness¹ |
|---|---:|---:|
| r3 | 30.5 % | 51.4–52.4 % |
| r4 `ff4b49e` | 50.5 % | — |
| r4 `bce2574` | 66.7 % | 86.7 % |
| r4 `9ccada6` | 68.6 % | 91.4 % |

¹ The stand-in writer cites the retrieved items it quotes, as a real writer does.
Safety in every row: 0 human-only cases auto-sent.

## Snapshot from 1 October 2026

The category breakdown below is the original **733-test** suite from the first showcase, kept for
the project history. The messaging-bot suite has since grown about 4.6-fold (733 → 3,401 tests), and the categories still apply.

| Stage | Result |
|---|---|
| Lint (ESLint) | Pass, no findings |
| Typecheck (`tsc`, server and admin) | Pass |
| Unit + contract tests (Vitest) | **511 passed / 0 failed / 0 skipped**, 30 files, 5.1 s |
| Integration tests (Vitest + real PostgreSQL) | **222 passed / 0 failed / 0 skipped**, 21 files |
| Build (`tsc` + Vite admin build) | Pass |

## Test categories

### Unit and contract (`tests/unit/`, 30 files, 511 tests)

| Category | Files | Tests |
|---|---:|---:|
| Webhook signature, payload normalization and resilience (all four surfaces, echoes, unsends, both Instagram routes, malformed shapes) | 3 | 64 |
| Meta Graph HTTP, read adapter, POST-only write transport, permission inventory | 4 | 57 |
| Decision pipeline, adversarial cases, building blocks (retrieval, validators, manifests), redaction, explanations | 6 | 118 |
| AI routing and providers, recorded-response regressions from the first real-model evaluation, fake-classifier gates | 4 | 96 |
| LIVE autosend eligibility (hard exclusions) | 1 | 32 |
| Sender context and reviewer-facing models | 3 | 41 |
| Evaluation tooling and seed-content validation | 3 | 18 |
| Configuration, environment loading, logging redaction, deployment packaging, traffic diagnostic | 6 | 85 |

### Integration on real PostgreSQL (`tests/integration/`, 21 files, 222 tests)

Each test file creates its own migrated database on a real PostgreSQL server.

| Category | Files | Tests |
|---|---:|---:|
| Webhook ingestion and durability | 2 | 42 |
| Reply items, review actions, publishing and idempotency | 5 | 63 |
| Controlled write verification | 1 | 14 |
| REVIEW readiness gate and Meta app status | 2 | 17 |
| Sender context | 1 | 10 |
| Worker operations (DM path, self-message suppression, drain with advisory lock and time budget, stale-backlog expiry, access health, SHADOW gate) | 1 | 17 |
| Decision outcomes and AI usage ledger (incl. daily cost cap, fresh-evidence approval rule) | 2 | 10 |
| Evaluation, Test Lab and seed CLI | 3 | 27 |
| Admin API, workspace API, roles | 2 | 14 |
| Migrations | 1 | 4 |
| Public traffic diagnostic | 1 | 4 |

### Representative scenarios (actual test titles, abbreviated)

Ingestion and durability:
- rejects unsigned and wrongly signed payloads without persisting anything
- persists a batched payload atomically with one job per new event, deduplicating redeliveries
- keeps an edit and a delete of the same comment as separate events
- does not acknowledge when the database is unavailable; rolls back the receipt when the job handoff fails
- handles delete-before-create out of order without resurrecting the comment
- keeps two concurrent deliveries of the same event down to one row and one job
- records the Slovenian text hash unchanged through signing, HTTP and persistence
- quarantines unreadable envelopes and unrecognised messaging events instead of acknowledging them silently
- processes queued jobs end-to-end through pg-boss, including after a worker restart

Review and publishing:
- stores a SHADOW item that the API, the dispatcher and the database all refuse to send
- edit & send preserves the AI draft, sends the exact human text once and audits every step
- a duplicate or concurrent approval never sends twice
- requires a verified capability per surface before any send
- an unknown outcome is never resent blindly and is reconciled from Meta
- a crash after recording the attempt becomes outcome_unknown, not a resend
- a pause holds approved items and resuming releases them
- a deleted source cancels the open item; an edited source blocks the send
- a business reply already on Meta marks the item handled instead of double-answering
- Messenger: no send after the 24-hour window
- without `LIVE_AUTOSEND_ENABLED` nothing is scheduled automatically; an auto item is handed back if LIVE is lowered before it is due

Write verification:
- prepare then execute sends ONE reply and marks the endpoint verified exactly once
- two concurrent executes of the same verification send exactly once
- read-back reconciliation confirms a write that reached Meta after a lost response
- a pause refuses prepare and execute; the database refuses `sending` while paused

### Fixtures

- 22 sanitized Meta webhook payload fixtures (`tests/fixtures/meta/`): Facebook comment created /
  edited (both verbs) / deleted / removed / hidden / reply, feed post and field-only changes,
  Instagram comment on both login routes, Messenger and Instagram DMs including attachment-only,
  echo, story reply and unsend, malformed envelope, unsupported field and event.
- Synthetic fixtures for end-to-end demos. Real customer exports and production corpora are kept
  out of Git.

## Tests added since October (selection)

- `full-autonomy.test.ts` (integration, 5) and `full-autonomy.test.ts` (unit, 50): the production DM that was held, off-topic, unclear, complaint, workplace harassment, AI timeouts, duplicate webhooks, throttling retry, unknown outcome found / absent → resent, permanent rejection + alert, emergencies held, on all four surfaces.
- `owner-approval.test.ts`: dry run and refusals; approve + activate with the failed run left unchanged; LIVE with a 60 s delay (one formal reply per message on four channels, threat held); a simulated deploy stops sending until re-authorization.
- `r4-comment-autosend.test.ts`: 8 owner messages × 4 surfaces = 32/32 scheduled and sent; unverified endpoint → `CAPABILITY_NOT_VERIFIED`; write-verify takes effect without a restart.
- `manual-after-auto.test.ts` (14): manual messages after automatic replies, cancellation of pending automatic replies, dispatcher-started items not cancelled, closed DM window.
- `r5-autosend.test.ts`: webhook → worker → eligibility → schedule → dispatcher → fake write, 24 items sent exactly once, all formal.

## Evaluation harness

### Datasets (counts only)

| Dataset | Cases | Notes |
|---|---:|---|
| Synthetic smoke suite | 54 | All synthetic; Facebook and Instagram comments; 19 flagged critical; splits: 25 dev, 16 critical, 13 holdout. Covers FAQ, prices with and without facts, expired offers, campaign conflicts, complaints, legal questions, distress and threats, spam, prompt injection, personal data, invented links, self-threads, takeover, deletion, media-only |
| Synthetic Slovenian legal corpus | 90 | All synthetic; all 17 legal areas; 59 comments and 31 DMs; 56 Facebook and 34 Instagram; 24 flagged critical; splits: 53 dev, 24 holdout, 13 critical |
| Knowledge snapshots | 1 file | Frozen knowledge for chronological replay |
| Historical harvest | local only | Unlabelled public comments, read-only Graph, redacted, authors dropped. Never committed |

**Since October:** the main dataset is `pnd-legal-v3` (version 5 in November), with 134 *required*
cases (synthetic, operator-written and redacted historical cases) that include 27 autonomy cases on
all four channels. Earlier versions had 105 and 107 required cases. Relabels are versioned and
documented, with every forbidden-claim guard kept. A separate real-traffic report replays 191 harvested public
comments through the deterministic gates only, with no model and nothing committed.

Both committed corpora were written alongside the pipeline. Passing them is a smoke and regression
signal, **not** an independent quality measurement.

### Case format and leakage controls

JSONL cases validated by a Zod schema: origin (`historical`, `synthetic`, `operator`), split
(`dev`, `holdout`, `critical`, `regression`), `asOf`, surface, thread / conversation (earlier turns
only), knowledge snapshot id, and expectations (allowed actions, intents, legal areas, required
facts, forbidden claims, required source ids).

- Thread turns after `asOf` and later brand replies are rejected as inputs. Later human replies are
  kept only as labels.
- A `groupKey` (thread or post) may not straddle holdout and other splits.
- Holdout cases are owner-only and must not be used for prompt tuning.
- Imports redact e-mails, phone numbers, IBANs, tax numbers and long digit sequences.

### Replay

- **chronological** mode: each case runs at its `asOf` with the knowledge as it was then (old
  offers are historical, not current truth).
- **current_policy** mode: each case runs now against the release's pinned knowledge.
- Replays run as queued background jobs with progress, cancellation, abandoned-run detection and an
  optional cost cap for real-model runs. They use the same `runDecisionPipeline()` as production
  with a simulated publisher.

### Provider kinds (always labelled)

| Kind | Meaning |
|---|---|
| `fake` | Deterministic keyword stand-in. Tests rules and grounding only |
| `recorded` | Replays captured model outputs by request hash. Engineering regressions |
| `fresh` | A real model. The only kind that counts as evaluation evidence for a release pinning a real model (an owner approval is the other, separately labelled basis) |

### Gates (`gates-v1`)

Mandatory: zero critical violations, zero public-write escapes, action accuracy at least 95 %,
auto-reply precision at least 98 %, and every release-pinned knowledge version approved. These are
**gate thresholds**, not measured results. Informational: human quality (recorded at approval) and
representation (synthetic-only warning). The comparison gate requires no new critical failure versus
a baseline. Commands exit non-zero when a gate fails.

Human ratings (`good` / `acceptable` / `bad`, issue tags, note) are stored per run and case,
aggregated, and exported as CSV.

### How evaluation was used

The first real-model release candidate **failed** its mandatory gates. Every failure was reproduced
locally through the same pipeline and classified (retrieval, validator, policy, classifier output,
dataset, evaluator). The fixes were made in code, prompts and evaluation logic without weakening any
gate or changing labels, and each fixed case became a recorded-response regression test. The failed
candidate stayed immutable with its failed evidence and was never approved. A new release was
created and evaluated on fresh-model evidence (the October releases were approved on it; since 3 Nov
an owner approval is also possible, and r5 uses it). A later production replay surfaced one
false positive in a forbidden-claim pattern (a correct negated statement); the pattern was made
negation-aware with dedicated regression tests, without changing the release.

### Test Lab (admin console)

- **Try a message**: one message through the same pipeline, showing every stage (input,
  understanding, retrieved knowledge, draft, deterministic and model validation, final decision)
  with latency and estimated cost. Stores no decision.
- **Replay runs, comparisons and ratings**: queue a replay of a dataset against a release, drill
  into each case (expected vs actual), compare two runs side by side, rate results.

Nothing in Test Lab can publish.
