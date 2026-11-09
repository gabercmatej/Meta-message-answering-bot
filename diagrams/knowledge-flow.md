# C. AI reasoning and knowledge retrieval

Three model calls, each with a JSON schema, surrounded by deterministic code. The model never
chooses what is allowed to be sent; it proposes, and code verifies against approved knowledge.

```mermaid
flowchart TD
    IN["Inbound text + context snapshot<br/>(untrusted, redacted)"] --> SIG["Deterministic inbound signals<br/>risk words, injection, minors, deadlines,<br/>personal data, harm-as-legal-topic"]
    SIG --> U["① Understanding call<br/>intent (14) · legal area (17 labels, incl. 'not legal')<br/>risk level + flags · needs lawyer · language"]
    U --> CORR{"Model reading<br/>corroborated by text?"}
    CORR -- "e.g. urgency not in text" --> FIX["drop / downgrade<br/>MODEL_URGENCY_NOT_IN_TEXT"]
    CORR --> PLAN
    FIX --> PLAN["Route request (code)<br/>tier A service · B orientation · C human<br/>plan: reply / clarify / handoff"]
    PLAN --> RET["Retrieval over release-pinned knowledge<br/>approved · in validity window · in scope<br/>query expansion + concepts (e.g. price_objection)"]
    RET --> GEN["② Writer call<br/>approved knowledge + plan + style (vikanje)<br/>→ text + cited knowledge ids"]
    GEN --> VAL["Deterministic validators<br/>numbers / prices / URLs / phones must exist in cited entries<br/>LEGAL_VERDICT_IN_REPLY · FALSE_HANDOFF_CLAIM<br/>INFORMAL_ADDRESS · EMERGENCY_NUMBER_NOT_NEEDED"]
    VAL -- "wording finding" --> REP["One bounded repair<br/>re-validated"]
    REP --> VAL
    VAL --> CHK["③ Model check<br/>(independent validator model)"]
    CHK --> DEC{"Autonomy policy<br/>+ fallbackBlockers"}
    DEC -- "valid, grounded, safe" --> AUTO["Automatic reply"]
    DEC -- "draft unusable,<br/>no hard signal" --> FB["Approved fallback text<br/>AUTONOMY_SAFE_FALLBACK"]
    DEC -- "threat · self-harm · distress<br/>minor writer · injection · privacy<br/>refund dispute · critical risk" --> HUM["Person (needs_review)"]
    U -. "timeout / provider error /<br/>invalid JSON" .-> AIF["AI_UNAVAILABLE_FALLBACK<br/>(unless a hard signal)"]
    GEN -. "invalid output" .-> AIF
```

What is **not** happening: no fine-tuning, no custom-trained model, no hidden chain-of-thought
stored. The system records concise reason codes and knowledge ids for every decision.
