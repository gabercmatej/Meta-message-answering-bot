# A. System architecture

One TypeScript repository, two processes (API and worker), one PostgreSQL database that is the
system of record **and** the job queue. The model is one subsystem among many; only the publishing
module can write to Meta.

![Architecture](../assets/architecture.svg)

<details>
<summary>Same diagram as editable Mermaid (wide)</summary>

```mermaid
flowchart LR
    subgraph Meta["Meta platform"]
        FB["Facebook Page<br/>comments + Messenger"]
        IG["Instagram professional account<br/>comments + Direct"]
    end

    subgraph API["API process · Fastify"]
        WH["Webhook gateway<br/>HMAC-SHA256 over raw bytes"]
        NORM["Normalizer<br/>4 surfaces → 1 event shape"]
        ADM["Admin API<br/>session · CSRF · roles"]
    end

    subgraph DB["PostgreSQL"]
        INBOX[("receipts · normalized_events<br/>dedupe keys")]
        Q[("pg-boss queue")]
        STATE[("reply_items · publish_attempts<br/>conversations · manual_messages")]
        REL[("behavior_releases · activations<br/>knowledge_versions")]
        AUD[("audit_events")]
    end

    subgraph Worker["Worker process"]
        CTX["Context builder<br/>Graph re-read · thread · post caption"]
        PIPE["Decision pipeline<br/>signals → understanding → retrieval<br/>→ writer → validators → model check"]
        POL["Autonomy policy + eligibility<br/>deterministic, in code"]
        SCHED["Scheduler<br/>configurable delay (60 s)"]
        DISP["Dispatcher<br/>re-lock · recheck · write-ahead"]
        REC["Reconciler<br/>read-back · bounded resend"]
    end

    AI["Anthropic Claude<br/>understanding · writer · checker<br/>(no tools, no token)"]
    UI["React admin console<br/>Messages · Knowledge · Test Lab<br/>Settings · Releases"]

    FB & IG -- "signed webhooks" --> WH --> NORM
    NORM -- "one transaction, then 200" --> INBOX & Q
    Q --> CTX
    CTX -- "GET only" --> Meta
    CTX --> PIPE
    PIPE -- "redacted text, JSON schema out" --> AI
    PIPE --> POL --> SCHED --> STATE
    REL -. "pinned policy, prompts,<br/>knowledge, models" .-> PIPE
    STATE --> DISP
    DISP -- "one POST per attempt" --> Meta
    DISP --> REC
    REC -- "GET read-back" --> Meta
    UI --> ADM --> STATE & REL
    ADM -. "manual messages go through<br/>the same dispatcher" .-> DISP
    DISP & POL & ADM --> AUD
```

</details>

## Boundaries that are enforced, not just drawn

| Boundary | Enforcement |
|---|---|
| AI code cannot publish | AI modules receive no Meta token, no tools and no DB handle; an ESLint import rule forbids publishing imports from AI code |
| Only the dispatcher writes to Meta | The Graph writer is constructed only by the publisher; read adapters are GET-only |
| SHADOW and replay can never send | Mode check in code **and** PostgreSQL CHECK constraints / triggers on `reply_items` and `publish_attempts` |
| One open attempt per reply | Partial unique index `publish_attempts_one_open` on `(reply_item_id) WHERE state IN ('pending','outcome_unknown')` |
| A release is immutable | Checksummed manifest; activation is an audited pointer; edits create a new version |
| Preview = production | Live events, Test Lab, admin preview and historical replay run the same `decide()`; only the sink differs |

See [docs/architecture.md](../docs/architecture.md) for the module map and trade-offs.
