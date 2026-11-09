# E. Release management and deployment lifecycle

A **behavior release** is an immutable, checksummed manifest that pins the policy, prompt
version, examples, knowledge versions, retrieval settings, models and auto-send policy. What the
bot may do automatically is bound to both the release checksum **and** the fingerprint of the
running code.

```mermaid
flowchart LR
    D["draft release<br/>manifest + knowledge pins"] --> T["tested<br/>(optional paid evaluation,<br/>or free technical checks)"]
    T --> AP{"approval policy"}
    AP -- "evaluation evidence for the exact checksum<br/>(review-evidence-v1/v2, owner-fast-v1)" --> OK["approved"]
    AP -- "owner-approved-v1 (since 3 Nov 2026)<br/>owner role · first 12 hex of checksum · note ≥ 20 chars<br/>free checks recomputed in the transaction" --> OK
    OK --> ACT["activate<br/>audited scope pointer"]
    ACT --> LA["LIVE authorization<br/>bound to checksum + behavior/dispatch fingerprints"]
    LA --> LIVE["automatic sending"]
    DEP["deploy new code"] -- "fingerprints change" --> STOP["automatic sending stops<br/>(fail closed: LIVE_NOT_AUTHORIZED)"]
    STOP --> RE["owner re-authorization<br/>release.live_reauthorize · free · history kept"]
    RE --> LA
    ACT -. "one click" .-> RB["roll back to previous approved release"]
```

Evaluation-evidence policies (October): `review-evidence-v1` and `v2` require a completed fresh-model run on the
exact release checksum with the gates passing; `owner-fast-v1` (26 Oct) is `v2` with the per-case human-rating
requirement removed and the safety checks recomputed from one run. None of them is needed for owner approval.

Owner approval is recorded as `basis: owner_approval`, `evaluatedCases: 0`, `livePrecision: null`:
it is explicitly **not** evidence of measured quality, and the UI and CLI never present it as such.
