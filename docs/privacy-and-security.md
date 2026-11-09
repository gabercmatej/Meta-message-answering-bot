# Privacy and security

The assistant reads public comments and private messages that people send to a legal-services
brand, and it can propose replies. People sometimes include phone numbers, personal ID numbers or
details of their legal problem. That shaped the design from the start: protect personal data,
keep credentials out of reach, and make an unsafe or duplicate reply structurally hard to send.

This page covers the controls that are implemented in the production system. Where something is
planned but not finished, it says so.

## Secrets and configuration

- **Secrets stay outside source code.** API keys, the webhook app secret, the webhook verify token,
  the Graph access token and the database connection string come from the deployment environment.
  They are never in the repository, in configuration manifests or in test fixtures. The repository
  contains only an example file with empty placeholders.
- **Configuration is validated at startup.** A runtime schema checks every environment variable.
  Webhook secrets have a minimum length. While the app secret is missing, the webhook endpoint
  refuses all deliveries; it does not accept them unverified.
- **The admin browser never receives a credential.** Integration and readiness screens show plain
  statuses ("configured", "missing", "verified"), never a token or a secret, even to owners.
- **Pinned external contracts.** The Graph API version and the AI model for each pipeline stage are
  pinned explicitly. A behavior release whose pinned model differs from the deployment is refused.
  It is never silently swapped for another model.

## Webhook integrity

- **Signature verification over the original bytes.** Each delivery's `X-Hub-Signature-256` HMAC is
  computed over the raw request body before any parsing, and compared in constant time. Re-serialized
  JSON is never used for verification.
- **Subscription handshake.** The verify token is compared in constant time, and the challenge
  value is checked against a strict format before it is echoed back.
- **Acknowledge only after durable acceptance.** The receipt and its normalized events are committed
  to PostgreSQL in one transaction before the endpoint returns success. If persistence fails, the
  endpoint returns an error so the platform retries; the event is not lost behind an "OK".
- **Rejected deliveries are counted, not stored.** Requests with invalid or missing signatures are
  recorded only as hourly counters, so an attacker cannot use the endpoint to write arbitrary data
  into the database.

## Admin console access

- **Server-side authorization on every route.** Three roles (viewer, editor, owner) are enforced by
  a server-side guard on each API route. Hiding a button in the UI is never treated as access control.
  Changing an account's operating mode, for example, requires the owner role.
- **Passwords** are hashed with scrypt and a per-user salt. Passwords shorter than 12 characters are
  rejected. Login attempts are throttled per username and source, and a dummy hash comparison keeps
  timing similar for unknown usernames.
- **Sessions** are random tokens that the database stores only as SHA-256 hashes. They expire after
  a fixed lifetime and travel in an `HttpOnly`, `SameSite=Strict` cookie.
- **CSRF protection.** Every state-changing request must carry a per-session CSRF token, which is
  compared in constant time.
- **Audit trail.** Logins, failed logins, mode changes, release activations and reviewer actions are
  written to an audit log.

## Logging

- **Structured, redacted logs.** Logs are structured JSON with correlation IDs. A central redaction
  list removes passwords, tokens, secrets, API keys, cookies, authorization headers, webhook
  signatures, comment text, reply text and prompts, at the top level and in nested objects.
- **No secrets via URLs.** The platform's subscription handshake puts the verify token in the query
  string. Request logging therefore keeps only the path and drops every query string.
- Code logs IDs and reason codes instead of message content.

## Data minimization towards the AI provider

- **Redaction before anything leaves the process.** Message text, thread context and post captions
  go through a personal-data redactor first. It replaces emails, phone numbers, IBANs, tax numbers,
  long identifiers such as personal ID numbers, street addresses and secret-like strings with typed
  placeholders. The decision record keeps only which kinds of data were redacted, not the values.
- **Output is redacted again.** The model is instructed not to repeat personal data. Its summaries
  are redacted again before they are stored, in case it does.
- **The AI has no authority.** The AI module has no access to the publishing token, the Graph
  client or any publishing tool. It returns schema-constrained output, which the pipeline validates.
  Only the separate publishing module can send a reply, and only on a verified channel.
- **Spending is bounded.** A daily cost cap applies to model usage.

## Untrusted content

- **Third-party text is data, not instructions.** Comments, usernames, captions and imported content
  reach the model inside one clearly delimited untrusted-data block. Any delimiter look-alikes in
  the text are neutralized. Deterministic checks also flag prompt-injection phrasing before the model
  is called.
- **No fetching of user-supplied URLs.** The server never fetches links from comments or messages.
- **Server-side URL allow-lists.** Avatar, thumbnail and permalink URLs shown to reviewers must be
  HTTPS on the platform's own hosts. URLs with embedded credentials, explicit ports, non-HTTPS schemes
  or look-alike domains are replaced with nothing.
- **Strict Content Security Policy** in the admin console: scripts and styles only from the
  console itself, images only from the console and the platform's CDNs, no framing.
- Generated HTML reports escape all content.

## Retention and deletion

- **Reviewer context is short-lived.** Sender display names carried on webhook events are cleared
  once the event reaches a final state. Sender profiles that no longer link to any comment or message
  are deleted. Signed avatar and thumbnail URLs are cleared after they expire. This cleanup runs with
  each worker cycle.
- **Deleted source content is respected.** When a comment or message is deleted or unsent, it is
  not answered, and stale backlog is expired instead of being answered late in a burst.
- **Failed jobs** move to a dead-letter queue with bounded retention and are surfaced to operators
  as failed events.
- **Honest status (9 Nov 2026, the system is LIVE):** not complete. Reviewer-context data (sender
  names, avatars, thumbnails) is pruned automatically, as above. The code has no general retention
  job for stored message text, decision records, evaluation snapshots or audit history, and the
  private owner-inputs list records the retention decision for stored message text and a public
  data-deletion route as open. Both are known gaps, not finished controls.

## Production safety around publishing

- **Automatic replies with a delay, human takeover and hard holds.** In production (LIVE since
  3 Nov 2026) replies that pass the eligibility checks are sent automatically after a delay
  (60 s), during which staff can send, cancel or write a message of their own. Threats, self-harm,
  distress, minors, injection, privacy requests and refund disputes always go to a person. The
  system defaults to OFF, and the replay and shadow modes have no way to publish. See
  [autonomous-live-mode.md](autonomous-live-mode.md).
- **Write-ahead state.** The exact outgoing text and the attempt state are saved before the request
  to the platform.
- **Unknown outcomes are never resent blindly.** A timeout or crash after a write can mean the reply
  was posted. Such attempts are marked `outcome_unknown` and reconciled by read-back first; only an
  automatic reply that Meta verifiably lacks is resent (at most 3 attempts), never a person's.
- **Last-moment re-checks.** Just before sending, the system re-checks pause state, mode, scope,
  whether the source still exists, human takeover, prior replies and release validity.
- **No replies to itself.** Echoes of the brand's own messages are recognized and ignored.

## How this showcase repository was curated

This public repository is not a copy of the production repository. It was assembled from a
blank directory using an allow-list approach:

- **Fresh, independent history.** The repository was initialized empty. No commits, branches or
  objects from the private repository were copied, so private history cannot leak through Git.
- **Allow-list, not deny-list.** Each file was written specifically for the showcase. Nothing was
  bulk-copied. Production source code (apart from the five trimmed excerpts in `src-showcase/`),
  deployment material, certificates, logs, environment files and database dumps are absent.
- **No private knowledge or evaluation data.** The legal knowledge base, prompts, evaluation cases
  and harvested historical conversations stay private. Examples here are synthetic and
  written for illustration.
- **Synthetic screenshots.** Product screenshots come from the real admin build run locally on
  invented conversations, names and identifiers, with a scripted model and a fake Meta transport.
  No real user, message or account identifier appears.
- **Automated leak scanning before publishing.** Before publishing, the tree was scanned for
  credentials, platform identifiers, personal data patterns, internal hostnames and paths, image
  metadata, and verbatim overlap with the private corpus. Every finding was reviewed by hand.
- **Infrastructure stays generic.** Hosting providers, server names, account identifiers and internal
  endpoints are described only in general terms.
