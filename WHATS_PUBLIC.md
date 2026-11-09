# What is public in this repository

A short, factual map of what you are looking at: what is invented, what is taken from the
production system, and what stays private. For terms of use see [NOTICE.md](NOTICE.md); for how
the repository is checked before publishing see [SECURITY.md](SECURITY.md).

## Synthetic

- **The interactive demo** ([`apps/demo/`](apps/demo/)): a browser-only simulation of the pipeline.
  Fictional firm ("Demo Legal Desk"), fictional knowledge, deterministic matching instead of a
  model, no network access.
- **Everything in [`examples/`](examples/)**: records written for this showcase and shaped after the
  runtime schemas. None is taken from production data.
- **The people, messages, posts and knowledge entries visible in the screenshots.**

## Excerpted from production

- **[`src-showcase/`](src-showcase/)**: five annotated excerpts from the private codebase (webhook
  signature check, durable webhook acceptance, effective-mode resolution, exactly-once dispatch,
  the PostgreSQL publishing guards). They are trimmed, **not runnable**, and taken from the October
  2026 snapshot. Behaviour added since (for example the automatic resend of a delivery that Meta
  verifiably lacks) is described in the documents, not in these excerpts.
- **Numbers and dates in the documents** come from the private project log, the decision records
  and a test run on 9 November 2026. Items the log cannot confirm are labelled "owner-reported".

## Private

- The full application source and its Git history.
- Prompts, the knowledge base, approved reply texts and release manifests.
- Evaluation datasets, real-model run outputs and historical conversations.
- Deployment scripts, hostnames, account and page identifiers, credentials and customer data.

## Where the screenshots come from

- **[`screenshots/`](screenshots/) and the hero image (November 2026)** show the real admin
  console build, run locally against a throwaway PostgreSQL on invented data. The decision pipeline,
  autonomy policy, validators, scheduler and dispatcher are the real code. The model is a scripted
  stand-in (no paid calls) and the Meta transport is a fake, so nothing left the machine. Status
  panels use a production-shaped configuration with dummy credentials.
- **[`screenshots/archive-2026-10-01/`](screenshots/archive-2026-10-01/)** is the set from the first,
  October showcase of the REVIEW-era console, kept as history and labelled as such.

## Licence

**No licence is granted** for any of this material: documentation, diagrams, screenshots, demo or
excerpts. Reading and evaluating the author's work is the intended use. Details in
[NOTICE.md](NOTICE.md).

## What this repository is not

It is not a runnable copy of the production system, and it is not an official channel of the
company the system was built for.
