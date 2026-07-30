# Documentation index

Published GitBook sources of truth:

| Path | Audience | GitBook space |
|------|----------|---------------|
| [user-guide/](user-guide/) | School staff, parents, students | [User docs](https://ntg-1.gitbook.io/ntg-sms-user-docs/) |
| [developer-guide/](developer-guide/) | Developers / DevOps (**private**) | [Dev docs](https://ntg-1.gitbook.io/ntg-alma-dev-docs/) |
| [internal/](internal/) | Team-only notes, audits, plans, archive | Not synced |

## How to update docs when you ship a feature

1. Edit the matching page under `docs/user-guide/features/` (user steps).
2. If technical, edit `docs/developer-guide/` (env, schema, pitfalls).
3. New page → add a row to the correct `SUMMARY.md`.
4. Never put secrets into synced Markdown.

Setup for Git Sync: [GITBOOK_SYNC_SETUP.md](GITBOOK_SYNC_SETUP.md)

## Internal (not published)

Legacy folders now live under `docs/internal/` (`features/`, `user-guides/`, `performance/`, `implementation/`, etc.). Prefer the new `user-guide` / `developer-guide` trees for anything that should stay current.
