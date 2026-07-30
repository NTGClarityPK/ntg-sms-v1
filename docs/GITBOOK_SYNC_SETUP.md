# GitBook Git Sync setup

Do this **after** `docs/user-guide/` and `docs/developer-guide/` exist in the repo and have been committed.

## 1. Privatise the developer space (required)

1. Open [NTG Alma Dev Docs](https://ntg-1.gitbook.io/ntg-alma-dev-docs/).
2. Space settings → **Visibility** → set to **Private** (or organisation-only).
3. Confirm the published URL no longer shows security findings to anonymous readers.

## 2. Enable Git Sync (monorepo)

GitBook supports one repository with multiple spaces via **Project directory**.

### User documentation space (`ntg-sms-user-docs`)

1. Open the space → **Git Sync** → connect GitHub/GitLab to this repo.
2. Set **Project directory** to: `docs/user-guide`
3. Prefer: repository → GitBook as source of truth after the first import.

### Developer documentation space (`ntg-alma-dev-docs`)

1. Open the space → **Git Sync** → connect the **same** repository.
2. Set **Project directory** to: `docs/developer-guide`
3. Keep the space private.

Each directory already contains `.gitbook.yaml` and `SUMMARY.md`.

## 3. Verify round-trip

1. Commit a tiny change (e.g. add a sentence to `docs/user-guide/README.md`).
2. Confirm it appears in the User GitBook after sync.
3. Edit the same page lightly in GitBook (optional) and confirm a commit returns to the repo.

## 4. Stop copy-paste

Once sync works, do **not** paste pages into GitBook by hand. Edit the matching `.md` file (or ask the agent to update docs for the feature).
