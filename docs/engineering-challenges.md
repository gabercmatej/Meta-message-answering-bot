# Engineering challenges

Each entry: **problem → decision → implementation → trade-off / result**. File paths refer to
the private repository. Links go to the annotated excerpts in [`src-showcase/`](../src-showcase/).
What is public and what is not: [WHATS_PUBLIC.md](../WHATS_PUBLIC.md).

---

### 1. Four Meta surfaces that only look alike

**Problem.** Facebook comments arrive as `feed` changes with `comment_id`/`post_id`; Instagram
comments as `comments` changes with `media.id`; Messenger and Instagram Direct as `messaging`
entries with different echo and recipient semantics. Ids look numeric but overflow JavaScript numbers.

**Decision.** Separate Facebook and Instagram adapters. One normalized event shape with a
deterministic dedupe key. **All external ids are strings.** Unknown shapes are quarantined, not
guessed at.

**Implementation.** `meta/webhook-payload.ts`
(zod schemas per surface; echo, edit, delete, hide), and fixtures built from real
webhook shapes.

**Result.** One downstream pipeline for four surfaces. Unreadable or ignored deliveries are visible
to an operator instead of disappearing silently.

### 2. Durable ingestion before acknowledgement

**Problem.** Meta retries webhooks that fail or time out. Acknowledging before persisting loses
events; persisting outside a transaction duplicates them.

**Decision.** Verify the signature over the **original bytes**, then commit the receipt, the
normalized events and the queue job in **one PostgreSQL transaction**, and only then return `200`.
Any persistence failure returns `503`, so Meta retries.

**Implementation.** [`webhook-signature.ts`](../src-showcase/webhook-signature.ts)
(timing-safe HMAC-SHA256), `api/ingest.ts`, and pg-boss jobs inserted in the same transaction.

**Trade-off.** pg-boss in the same database instead of a broker. One fewer moving part and
exactly-once handoff by construction; throughput is far beyond what a company page needs.

### 3. Duplicate webhooks must never mean duplicate replies

**Decision.** Three layers: event dedupe keys; a business-level **unique reply intent** per source
message; and at most one open publish attempt per reply item (a partial unique index). Every review
action carries a `row_version`.

**Result.** The integration suite delivers the same webhook repeatedly and asserts exactly one
reply on every surface (`tests/integration/full-autonomy.test.ts`).

### 4. A timeout after a write might be a success

**Problem.** The Graph API can accept a reply and then time out, return a 5xx, or the worker can
crash right after the POST. A naive retry double-posts on a public page.

**Decision.** Write-ahead: persist the exact text and an attempt in `pending`, move the item to
`sending`, and **then** make one POST. Anything ambiguous becomes `outcome_unknown`, which is
**never blindly resent**. A reconciler reads Meta back. Since r5, an **automatic** reply that Meta
verifiably does not show is resent at most 3 times in total, with a fresh read-back and every
pre-send check before each write. A person's reply is never resent automatically.

**Implementation.** `publishing/graph-write.ts`
(`sent | rejected | unknown` contract), `publishing/dispatch.ts`, DB triggers that freeze attempt text.

**Trade-off.** A reply can sit in `outcome_unknown` for a reconcile interval. The design prefers
"late" over "twice".

### 5. Recognizing your own reply when Meta hands it back differently

**Problem (found in production).** After "Edit & Send" on Facebook, reconciliation could not find
the page's own reply: Meta returned it NFD-normalized, with zero-width or non-breaking characters,
or under a `{post}_{comment}` id. The next send then classified the page's own reply as
"answered elsewhere" and reported that nothing was sent.

**Fix.** `publishing/own-reply-match.ts`:
NFC normalization, invisible-character stripping, both comment-id forms, and an attempt-time
window. Reproduced and fixed on all four surfaces.

### 6. Automatic and manual replies racing

**Problem.** The bot schedules a reply for 60 s; a staff member writes manually at second 40.

**Decision.** The dispatcher runs in three phases: lock and local checks, fresh Meta reads, then
**re-lock and require the same `row_version` and state** before the write. Queuing a manual message
cancels untouched pending automatic replies to that person (`SUPERSEDED_BY_MANUAL_MESSAGE`,
audited). A reply already started by the dispatcher is not cancelled, and the UI explains why. A
`BOT_PREPARING` guard prevents a manual message followed seconds later by the bot's own answer to
the same message.

**Result.** 14 dedicated integration tests (`manual-after-auto.test.ts`) cover double clicks,
closed DM windows, Instagram DMs and comments.

### 7. Message bursts and per-item review

**Problem.** "Živjo" → "imam vprašanje" → the actual question, within ten seconds.

**Decision.** Unanswered items from the same person that are still inside their dispatch delay are
merged into the newest decision, so there is one reply. Items already in review or held by a person
keep their own card. Review is **per item, never a conversation lock**; only a clearly dependent
follow-up of a held sensitive turn stays a reviewed draft.

**Trade-off.** A safe and a sensitive question in the same burst become one decision, which a
person then handles. This is accepted and documented.

### 8. Stale authorization after a deploy

**Problem.** A release approved on old code says nothing about new code.

**Decision.** The LIVE authorization is bound to the release checksum **and** to behavior and
dispatch code fingerprints. A deploy that changes either stops automatic sending
(`LIVE_NOT_AUTHORIZED`) until the owner re-authorizes. Re-authorization is free and audited, and it
appends history instead of overwriting.

**Trade-off.** A short, explicit pause after each behavior deploy, in exchange for a guarantee
that automatic sending always runs on approved code.

### 9. Models that over- or under-read risk

**Problem.** "Ali mi lahko pomagate s pravnim problemom glede delodajalca in **nasilja**?" was held
as a threat. "Grozno mi je" (it's awful) matched a threat pattern; "krivično" (unjust) matched
criminal matter; adult ages ("stara sem 58 let") matched the minors signal.

**Decision.** Keep deterministic signals but make them precise, and **require textual
corroboration** for model-only readings. `HARM_TOPIC_LEGAL_REQUEST` applies only when harm words
appear with a legal-help request and none of the acute-danger, self-harm, distress, minor or threat
markers are present. Ages count as minors only under 18.

**Result.** Real workplace-harassment questions get an answer; "sosed mi grozi" (my neighbour is
threatening me) and present-tense violence still go to a person. Each narrowing has regression tests
on both sides.

### 10. Model failure is a normal case

**Decision.** Every model call returns a typed outcome (`ok | refusal | truncated | timeout |
unavailable`), validated against a JSON schema. Failure leads to the release's approved fallback text,
unless a hard signal forbids it. The model never gets a second, unvalidated chance.

**Visible in the showcase.** Screenshots 07 and 10 show the stand-in model returning labels the
schema rejects; the pipeline records `AI_INVALID_OUTPUT → AI_UNAVAILABLE_FALLBACK` and sends the
approved text.

### 11. Grounding business facts

**Problem.** Models invent prices, links, phone numbers and "we'll call you back tomorrow".

**Decision.** Business facts are structured knowledge entries. Validators reject any amount, URL,
contact or offer term that is not present in a **cited, approved, in-scope, unexpired** entry
(`PRICE_SERVICE_MISMATCH`, `FALSE_HANDOFF_CLAIM`, `ACCOUNT_DETAIL_CLAIM`). Unsolicited prices are
removed, using a price-question detector that keeps a price question open across PND's own
clarifying question. A legal verdict in the reply fails `LEGAL_VERDICT_IN_REPLY`.

**Trade-off.** A specific question without an approved fact gets an honest contact route rather
than an answer.

### 12. Formal Slovenian, every time

**Decision.** The style is pinned in the release (`vikanje`). A final `INFORMAL_ADDRESS` check and
normalization runs on every reply. Owner approval refuses a release whose approved texts use informal
address. **Result:** integration tests assert every automatically sent text on all four surfaces is formal.

### 13. Meta platform rules

The 24 h messaging window is enforced before dispatch and classified on rejection (window closed,
recipient unavailable). Self-echoes and the page's own comments never trigger a reply. Organic
access is not assumed to prove app permission, and messaging and comment capabilities are verified
separately per surface.

### 14. Observability without leaking people

Structured logs carry correlation ids and are redacted with pino redaction paths; tokens never
reach logs or the browser. Every state change writes an `audit_events` row with actor and
before/after. `release-status` reports coverage, held replies by reason, and failed deliveries as an
ATTENTION line.

### 15. Business knowledge separate from the engine

Everything company-specific (knowledge, approved texts, auto-send intents, style, risk areas that
always go to a person) lives in a versioned release manifest and knowledge entries. The engine
modules contain none of it, which is why the boundary modules could be
extracted without the knowledge base.
