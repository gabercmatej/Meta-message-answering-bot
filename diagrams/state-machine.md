# F. Reply state machine (including errors and fallback)

`reply_items.state` and `publish_attempts.state` as defined in the production migrations.

```mermaid
stateDiagram-v2
    [*] --> new: webhook accepted
    new --> processing: worker picks job
    processing --> scheduled: auto-eligible (AI reply,<br/>clarification or approved fallback)
    processing --> needs_review: hard signal / human-only
    processing --> skipped: no reply needed<br/>(remark to another commenter, echo)
    processing --> failed: unrecoverable pipeline error
    processing --> cancelled: superseded by newer message (DM burst)

    scheduled --> sending: due + all rechecks pass
    scheduled --> cancelled: staff cancel / manual message sent first
    scheduled --> needs_review: recheck blocked (hold reason)
    needs_review --> approved: staff Approve / Edit & Send
    needs_review --> held: staff Hold
    needs_review --> handled: answered by a manual message
    approved --> sending

    sending --> sent: Meta returned an id
    sending --> outcome_unknown: timeout / 5xx / crash
    sending --> failed: permanent rejection
    outcome_unknown --> sent: read-back found the reply
    outcome_unknown --> scheduled: confirmed absent,<br/>auto reply, attempt < 3
    outcome_unknown --> needs_review: person's reply or exhausted
    sent --> [*]
```

Attempt states: `pending → succeeded | failed_retryable | failed_permanent | outcome_unknown → reconciled_sent | reconciled_absent`.
At most one attempt per item can be open (`pending` or `outcome_unknown`).
