# D. Automatic publishing, scheduling and delivery recovery

```mermaid
flowchart TD
    S["reply_item scheduled<br/>scheduled_for = received + delay"] --> DUE{"due?"}
    DUE -- "no" --> WAIT["countdown in admin<br/>'Send now' / 'Cancel'"]
    WAIT --> DUE
    DUE -- "yes" --> L1["Phase 1: lock row (row_version)"]
    L1 --> CHK["Local rechecks<br/>pause · mode ceiling · LIVE switch time<br/>release + LIVE authorization bound to code fingerprints<br/>surface write-verified · daily limit · DM 24 h window<br/>human takeover · manual message queued · duplicates"]
    CHK -- "blocked" --> HOLD["needs_review with a<br/>categorized hold reason"]
    CHK --> R2["Phase 2: fresh Meta reads<br/>source exists · not edited · not already answered"]
    R2 --> L3["Phase 3: re-lock, same row_version?<br/>persist exact text + attempt pending<br/>item → sending"]
    L3 --> POST["POST to Graph API (one write)"]
    POST -- "id returned" --> SENT["sent ✓<br/>platform id stored"]
    POST -- "4xx permanent" --> FAIL["failed · DELIVERY_NEEDS_OPERATOR alert"]
    POST -- "throttled / retryable" --> RETRY["failed_retryable<br/>backoff, bounded"]
    RETRY --> L1
    POST -- "timeout · 5xx · crash" --> UNK["outcome_unknown<br/>never blind resend"]
    UNK --> RB["Read-back reconciliation<br/>own-reply match: NFC, invisible chars,<br/>both comment id forms, time window"]
    RB -- "found" --> RS["reconciled_sent ✓"]
    RB -- "confirmed absent" --> AB{"automatic reply<br/>and < 3 attempts?"}
    AB -- "yes" --> L1
    AB -- "no (person's reply<br/>or exhausted)" --> OP["operator alert<br/>never resent automatically"]
```

The same dispatcher sends **manual** staff messages composed in the admin; a pending automatic
reply to the same person is cancelled (`SUPERSEDED_BY_MANUAL_MESSAGE`) when staff write first.
