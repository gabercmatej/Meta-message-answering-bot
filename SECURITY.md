# Security

## Reporting

If you find something in this repository that looks like a secret, a real identifier or personal
data, or a vulnerability in the published code, please **do not open a public issue**. Use GitHub's
private vulnerability reporting ("Security" tab → "Report a vulnerability") or contact the
maintainer through the GitHub profile [@gabercmatej](https://github.com/gabercmatej).

## What this repository contains

- No credentials, tokens, account or page identifiers, production hostnames beyond the company's
  public website, prompts or knowledge content.
- `apps/demo` makes **no network requests** beyond its own static assets. The Vercel
  configuration sets `Content-Security-Policy: connect-src 'none'`, and a unit test runs every
  scenario with `fetch` and `XMLHttpRequest` disabled.

## Pre-publication checks

```bash
node scripts/privacy-scan.mjs                # working tree
node scripts/privacy-scan.mjs --git-history  # every commit that would be pushed
```

CI runs the working-tree scan on every change. **The working-tree scan must exit 0.**

Two commits published before this branch contain the author's university e-mail as commit author
and the production hostname in an old README; both were already public and are accepted, and history
is not rewritten. Any other history finding blocks a push. Credentials are never accepted as
historical: if a real secret ever reaches history, it is rotated first and then removed. Exceptions
require a justified entry in `scripts/privacy-allowlist.json`. Screenshots are reviewed by eye, and the
DOM text of each captured screen was scanned at capture time. What is synthetic, excerpted or private
is listed in [WHATS_PUBLIC.md](WHATS_PUBLIC.md).

## Production security (summary)

Signature verification over raw webhook bytes with timing-safe comparison; secrets only in the
server environment, never logged and never sent to the browser; scrypt passwords, DB-backed
sessions, HTTP-only `SameSite=Strict` cookies, a CSRF header and login throttling; roles enforced on
the server; parameterized SQL; redaction before any text reaches the AI provider; retention jobs
for reviewer-only identity data. Details: [docs/privacy-and-security.md](docs/privacy-and-security.md).
