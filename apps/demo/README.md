# Message Processing Playground

A browser-only, interactive simulation of the PND Meta messaging pipeline: one inbound message on
Messenger, Instagram DM, a Facebook comment or an Instagram comment, followed through all twelve
stages, from the signed webhook to a confirmed Meta delivery.

> **Interactive architecture simulation — no real AI or Meta API calls.** Replies come from a
> deterministic script and a small, fictional knowledge base for an invented firm ("Demo Legal
> Desk"). Nothing leaves the browser: the production build makes no network requests beyond its own
> static files, and the Vercel config sets `connect-src 'none'`.

<p align="center">
  <img src="../../assets/demo/demo-pipeline.png" alt="Playground: an Instagram DM on the left, the twelve-stage pipeline in the middle with the reply scheduled and counting down, and the decision and cited knowledge on the right" width="100%">
</p>

## What you can do

- Type any message, in English or Slovenian, on any of the four surfaces. Messages in one
  conversation build context: a short follow-up such as "and on weekends?" inherits the previous
  topic.
- Pick one of 20 scenarios: legal topics (employment, unpaid salary, tenancy, consumer, family,
  general), service questions (price, availability, booking), conversation cases (greeting, unclear,
  off-topic, complaint, distress) and reliability cases with an injected fault.
- Watch each stage resolve, with mock timings, then open any finished stage for its details.
- Watch the configurable auto-send delay (0, 60 or 180 s) count down 20× faster than real time, or
  press **Send now**, as in the admin console.
- Open **Developer view** for the normalized event, the raw webhook shape, the classification, the
  decision record (route, reason codes, cited knowledge IDs, validator results) and the dispatch
  record (attempts with idempotency keys and every state transition).

## How it maps to the real system

| Playground | Production system |
|---|---|
| Webhook, signature, normalize | `POST /webhooks/meta`: HMAC-SHA256 over the original bytes, then receipt, deduplicated events and queue job in one PostgreSQL transaction before the 200 |
| Context | Worker re-reads the source from the Graph API, loads the thread or conversation, uses a pseudonymous author and redacts personal data before any model call |
| Intent, legal area | Schema-validated understanding call (14 intents, 17 legal-area labels, risk, flags) plus deterministic signals that can overrule the model in either direction. **In the demo this is a keyword matcher.** |
| Knowledge | Approved, unexpired entries pinned by the active, versioned release. **In the demo these are 9 fictional cards.** |
| Response generated | Grounded draft from the writer model, or an owner-approved fixed text. **In the demo these are scripted texts.** |
| Validation | Deterministic validators (`LEGAL_VERDICT_IN_REPLY`, `FALSE_HANDOFF_CLAIM`, `INFORMAL_ADDRESS`, `EMERGENCY_NUMBER_NOT_NEEDED`, grounding of amounts and links …). The demo runs simplified versions of these checks on its scripted text. A failed draft is replaced by the approved fallback (`AUTONOMY_SAFE_FALLBACK`), never sent |
| Reply scheduled | Code-decided auto-send eligibility, then `scheduled` with the configured delay (production: 60 s) |
| Meta publish | The only module with a publishing token. It rechecks pause, mode, source existence and prior replies right before the write and persists the exact text and attempt first |
| Delivery confirmed | `sent` only on a confirmed write. A timeout after the write becomes `outcome_unknown` and is reconciled by reading Meta back; an automatic reply confirmed absent is resent (at most 3 attempts) |

State names (`new`, `processing`, `scheduled`, `sending`, `outcome_unknown`, `sent`,
`reconciled_sent`, `needs_review`, `skipped`), audit events (`reply_item.created`, `reply_item.send_started`,
`reply_item.resend_scheduled` …), intents and legal-area IDs follow the production vocabulary. Some
route codes are demo labels where the production code has no single equivalent
(`SERVICE_REPLY_GROUNDED`, `CLARIFY_GREETING`, `OTHER_REDIRECT_REPLY`, `THANKS_REPLY`).

Behaviours the scenarios demonstrate:

- **AI provider unavailable**: the writer call times out, the approved fallback text is sent
  (`AI_UNAVAILABLE_FALLBACK`). A hard safety case is still held for a person.
- **Duplicate webhook**: the second delivery has the same dedupe key, increments the observation
  count and creates no new job. One reply.
- **Transient Meta failure**: attempt 1 is rate limited, a retry is scheduled, attempt 2 succeeds.
  Each attempt has its own idempotency key.
- **Lost write response**: the write times out, the item becomes `outcome_unknown`, and the
  read-back either finds the reply (`reconciled_sent`, no second write) or confirms it is absent
  (automatic resend).
- **Distress**: no reply text is generated and nothing is sent automatically (`RISK_HUMAN_ONLY`).
- **Off-topic public remark**: skipped without needing a person
  (`AUTONOMY_OTHER_COMMENT_NO_QUESTION`).

## What it is not

- It does not show model reasoning. The production system records reason codes and source IDs, not
  chain-of-thought, and this demo shows only that kind of structured record.
- The replies are not legal advice and not the production prompts, knowledge or wording. They are
  general, safe placeholders. Slovenian texts use formal address (vikanje), as the production
  release requires.
- Timings are representative mock values, not measurements.

## Run locally

Requires Node.js 20+.

```bash
cd apps/demo
npm ci
npm run dev          # http://localhost:5173
```

Checks:

```bash
npm run typecheck    # strict TypeScript
npm test             # 70 unit tests: matcher (EN + SL), every scenario's terminal state, invariants, no network
npm run build        # static bundle in dist/
npm run check:browser  # optional: local headless Chromium over the built bundle (needs `npx playwright install chromium`)
```

`check:browser` serves `dist/` with `vite preview`, plays several scenarios at 1440×900 and 390×844
(plus a 375 px width check), and fails on console errors, page errors, horizontal page scroll or any
request outside the preview origin. It also regenerates the screenshots in `assets/demo/`.

## Deploy

**Recommended: Vercel.** The app is a static bundle with no backend and no secrets, so any static
host works. Vercel is the better fit here because it builds straight from the repository
subdirectory, gives every pull request a preview URL, and applies the security headers in
[vercel.json](vercel.json) (a strict CSP with `connect-src 'none'`), which GitHub Pages cannot set.

1. In Vercel, choose **Add New… → Project** and import `gabercmatej/Meta-message-answering-bot`.
2. Set **Root Directory** to `apps/demo`. The framework preset (Vite), install command (`npm ci`),
   build command (`npm run build`) and output directory (`dist`) come from `vercel.json`.
3. No environment variables are needed. Deploy.
4. Open the deployment, run a few scenarios, then put the verified URL in the root README.

Or with the CLI, from `apps/demo`: `npx vercel` (preview) and `npx vercel --prod`.

**Alternative: GitHub Pages.** Build with the repository name as base path and publish `dist/`:

```bash
VITE_BASE=/Meta-message-answering-bot/ npm run build
```

For example, use a workflow that runs this build and then `actions/upload-pages-artifact` with
`path: apps/demo/dist` and `actions/deploy-pages`. Pages serves no custom headers, so the CSP in
`vercel.json` does not apply there. The app still makes no network calls.

## Structure

```text
apps/demo
├── src/sim/          pure, deterministic simulator (no I/O)
│   ├── matcher.ts    keyword matcher standing in for the understanding model
│   ├── knowledge.ts  fictional demo knowledge
│   ├── replies.ts    scripted drafts and approved fixed texts
│   ├── scenarios.ts  20 presets with their expected terminal state
│   ├── simulator.ts  message → full trace (stages, decision, transitions, attempts)
│   └── simulator.test.ts
├── src/components/   Chat, Pipeline, Inspector (Decision + Developer view)
├── src/usePlayback.ts  accelerated playback of a trace
├── scripts/check.mjs   headless browser check + screenshots
└── vercel.json
```

The UI only plays back a trace that `simulate()` has already computed in full, so each scenario's
result can be tested without a browser.
