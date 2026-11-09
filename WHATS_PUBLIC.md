# What is public in this repository

A short, factual map of what you are looking at: what is invented, what is taken from the
production system, and what stays private. For terms of use see [NOTICE.md](NOTICE.md); for how
the repository is checked before publishing see [SECURITY.md](SECURITY.md).

## Synthetic

- **The interactive demo** ([`apps/demo/`](apps/demo/)): a browser-only simulation of the pipeline.
  The account is shown as Pravnik na dlani with the company's own logo (bundled, not hotlinked; the
  branded post is a demo layout, not a real post), but all business
  facts are fictional demo values and marked as such; people are invented; deterministic matching
  replaces the model; no network access. Live at https://meta-message-answering-bot.vercel.app/.
- **Everything in [`examples/`](examples/)**: records written for this showcase and shaped after the
  runtime schemas. None is taken from production data.
- **The people, messages, posts and knowledge entries visible in the screenshots.**

## Production source code

- **Nothing in the current tree.** This repository contains no production source code. The
  October 2026 version included five annotated excerpts in `src-showcase/` (webhook signature
  check, durable acceptance, mode resolution, exactly-once dispatch, publishing guards). They were
  removed from the current tree because the company's authorization to publish them is not
  documented. They remain in the repository's Git history (commits `4071c10` and `71702cb`),
  which is not rewritten.
- **Numbers and dates in the documents** come from the private project log, the decision records
  and a test run on 9 November 2026. Items the log cannot confirm are labelled "owner-reported".

## Private

- The full application source and its Git history.
- Prompts, the knowledge base, approved reply texts and release manifests (one exception: the r5
  approved fallback text is visible in screenshots 07 and 10, because every customer receives it).
- Evaluation datasets, real-model run outputs and historical conversations.
- Deployment scripts, hostnames, account and page identifiers, credentials and customer data.

## Where the screenshots come from

- **[`screenshots/`](screenshots/) and the hero image (November 2026)** show the real admin
  console build, run locally against a throwaway PostgreSQL on invented data. The decision pipeline,
  autonomy policy, validators, scheduler and dispatcher are the real code. The model is a scripted
  stand-in (no paid calls) and the Meta transport is a fake, so nothing left the machine. Status
  panels use a production-shaped configuration with dummy credentials.
  Bot replies show the company's public phone number and opening hours; all other people,
  messages and posts are invented.
- **[`screenshots/archive-2026-10-01/`](screenshots/archive-2026-10-01/)** is the set from the first,
  October showcase of the REVIEW-era console, kept as history and labelled as such.

## Licence

**No licence is granted** for any of this material: documentation, diagrams, screenshots or the
demo. Reading and evaluating the author's work is the intended use. Details in
[NOTICE.md](NOTICE.md).

## What this repository is not

It is not a runnable copy of the production system, and it is not an official channel of the
company the system was built for.
