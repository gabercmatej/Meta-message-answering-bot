# Adapting the platform to another organization

What is generic, what is per-organization, and what the public repository does and does not
contain today.

## What changes per organization, and what does not

| Layer | Per organization | Generic engine |
|---|---|---|
| Knowledge | Typed entries: FAQ, service facts, prices, offers, contact routes, links, boundaries, domain guidance; each with scope, validity and approval | Schema, versioning, eligibility (approved, in validity window, in scope), retrieval, grounding validators |
| Release manifest | Style (formality, language), approved handoff/fallback/complaint texts, auto-send intents, domain areas that always go to a person, prompt version, models | Manifest schema, checksum, approval policies, activation, rollback, fingerprint binding |
| Domain taxonomy | Intents and domain areas (here: 14 intents, 17 legal-area labels) | Routing, tiers, `fallbackBlockers` contract |
| Risk signals | Language-specific word lists and their exceptions | Signal → flag → eligibility mechanics, corroboration rules |
| Channels | Page / account ids, tokens, write verification evidence | Four-surface normalization, Graph read and write adapters, messaging-window rules |
| Operations | Delay, daily limit, users and roles | Scheduler, dispatcher, reconciliation, audit, admin console |

In the production codebase the PND-specific parts are concentrated in `knowledge/pnd/*`,
`src/knowledge/pnd-*.ts`, the prompt modules and the signal lists in `src/pipeline/`. Swapping
them is the porting work; the ingestion, publishing and recovery code does not change.

## What is in this public repository

| Available now | Not available here |
|---|---|
| [`src-showcase/`](../src-showcase/): annotated excerpts (signature check, durable acceptance, modes, exactly-once dispatch, publishing guards). The excerpts are trimmed and not runnable | PostgreSQL schema and migrations, ingest transaction, queue, decision pipeline, prompts, validators, autonomy policy, dispatcher, reconciler, admin console |
| [`apps/demo`](../apps/demo/): the full pipeline as a deterministic browser simulation | Any real model or Meta call |
| Architecture, state machines, decisions and trade-offs in [`docs/`](.) and [`diagrams/`](../diagrams/) | Knowledge base, evaluation datasets, deployment scripts |

Calling this a complete, runnable copy of the production system would be inaccurate.
[WHATS_PUBLIC.md](../WHATS_PUBLIC.md) lists what is synthetic, excerpted and private. The modules
that are generic across organizations (persistence, dispatcher, eligibility, inbox lifecycle, admin
console without branding) are the ones a port would keep.

## Real integration: what a deployment needs

These are the environment variables of the production build, with placeholders only. None of them
are used by the public packages.

```bash
APP_ENV=production
BOT_MODE=OFF                     # ceiling: OFF | SHADOW | REVIEW | LIVE
DATABASE_URL=postgres://…        # PostgreSQL 16+
META_ADAPTER=graph
META_GRAPH_VERSION=v26.0         # pinned, no "latest"
META_APP_SECRET=…                # webhook HMAC only
META_WEBHOOK_VERIFY_TOKEN=…
META_GRAPH_ACCESS_TOKEN=…        # Page token, server-side only
PUBLISHING_TRANSPORT=graph       # none | graph | fake (fake only in dev/test)
LIVE_AUTOSEND_ENABLED=false
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=…
ANTHROPIC_CLASSIFIER_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_WRITER_MODEL=claude-opus-5-5
ANTHROPIC_VALIDATOR_MODEL=claude-haiku-4-5-20251001
```

Startup refuses unsafe combinations: REVIEW or LIVE without a write transport, a fake transport
outside dev/test, a fake adapter or AI provider in production, insecure cookies, unpinned Graph
versions.

Meta prerequisites (verified separately, never assumed from one another): a Business-verified app,
Advanced Access for the messaging and comment permissions, Page `feed` + `messages` and Instagram
`comments` + `messages` subscriptions, and one controlled write verification per surface before
that surface may send.
