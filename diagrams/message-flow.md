# B. Incoming message lifecycle

From the webhook bytes to a reply confirmed by Meta. Every arrow that crosses a process or a
network boundary is durable on one side before it happens.

```mermaid
sequenceDiagram
    autonumber
    participant M as Meta
    participant A as API (webhook)
    participant P as PostgreSQL
    participant W as Worker
    participant C as Claude
    participant D as Dispatcher

    M->>A: POST /webhooks/meta (X-Hub-Signature-256)
    A->>A: verify HMAC over the original bytes (timing-safe)
    A->>P: BEGIN · receipt + normalized events (dedupe key) + queue job · COMMIT
    A-->>M: 200 only after COMMIT (503 on any persistence failure)
    P-->>W: job
    W->>M: GET source (still exists? edited? who wrote it?)
    W->>W: context snapshot: thread / conversation, post caption, pseudonymous author
    W->>W: deterministic inbound signals (risk, injection, minors, deadlines …)
    W->>C: understanding (intent, legal area, risk) — redacted text only
    W->>W: retrieval over knowledge pinned by the active release
    W->>C: writer (approved knowledge + plan) → JSON
    W->>W: validators (grounding, prices, links, formal address, legal verdict …)
    W->>C: model check
    W->>W: autonomy policy → reply · clarify · approved fallback · human
    W->>P: reply_item = scheduled (scheduled_for = now + delay) — or needs_review
    Note over P: 60 s later (or "Send now")
    D->>P: lock item · recheck mode, pause, switch, release, takeover, duplicates
    D->>M: GET source again (deleted? already answered elsewhere?)
    D->>P: persist exact text + attempt = pending, item = sending
    D->>M: POST reply (one write)
    alt Meta returns an id
        D->>P: attempt succeeded · item sent (platform id stored)
    else timeout / 5xx / crash after the write
        D->>P: attempt outcome_unknown
        D->>M: GET read-back (own-reply matching)
        D->>P: reconciled_sent — or reconciled_absent → bounded resend (auto replies only)
    end
```

Key property: **"sent" is a confirmed Meta write, never an assumption.** A reply that was
generated, scheduled or attempted is not reported as sent.
