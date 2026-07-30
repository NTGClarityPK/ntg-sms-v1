# ntg-sms-v1

**NTG Alma** — School Management System (Next.js + NestJS + Supabase).

## Documentation

| Guide | Location |
|-------|----------|
| User guide (GitBook source) | [`docs/user-guide/`](docs/user-guide/) |
| Developer guide (GitBook source, private) | [`docs/developer-guide/`](docs/developer-guide/) |
| Team-only notes / audits | [`docs/internal/`](docs/internal/) |
| Git Sync setup | [`docs/GITBOOK_SYNC_SETUP.md`](docs/GITBOOK_SYNC_SETUP.md) |

Live user docs: https://ntg-1.gitbook.io/ntg-sms-user-docs/

## Quick run

```bash
# Backend
cd backend && cp .env.example .env   # fill values
npm install && npm run start:dev

# Frontend
cd frontend && cp .env.local.example .env.local   # if present; fill values
npm install && npm run dev
```

See [`docs/developer-guide/getting-started.md`](docs/developer-guide/getting-started.md) for full setup.
