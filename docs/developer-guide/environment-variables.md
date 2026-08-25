# 🔑 Environment Variables

Canonical examples live in `backend/.env.example`. Never commit real `.env` files.

## Backend (`backend/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key (bypasses RLS — backend only) |
| `SUPABASE_ANON_KEY` | Yes* | Needed for Settings → Data export password re-verify (*same value as frontend anon key) |
| `SUPABASE_JWT_SECRET` | Yes | JWT verification |
| `PORT` | No | Default `3001` |
| `NODE_ENV` | No | `development` / `production` |
| `FRONTEND_URL` | Yes | CORS + OAuth/email redirects (must be public HTTPS in production) |
| `GOOGLE_CLASSROOM_CLIENT_ID` | No | Google OAuth client for Classroom |
| `GOOGLE_CLASSROOM_CLIENT_SECRET` | No | Google OAuth secret |
| `GOOGLE_CLASSROOM_REDIRECT_URI` | No | Must match Google Cloud OAuth client exactly |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | No* | 32+ char secret to encrypt stored tokens (*required if Classroom enabled) |
| `STRIPE_SECRET_KEY` | No | Stripe checkout; Pay Now hidden when unset |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook verification |
| `MAILJET_API_KEY` / `MAILJET_SECRET_KEY` | Yes* | Transactional email (*for invitations/notifications) |
| `MAILJET_FROM_EMAIL` / `MAILJET_FROM_NAME` | Yes* | From identity |
| `INVITATIONS_RATE_LIMIT_PER_MINUTE` | No | Default `20` |
| `INVITATION_NTG_LOGO_URL` | No | Email logo override |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | No | Web push |
| `PUPPETEER_EXECUTABLE_PATH` | No | PDF/chromium path override |
| `*_JOB_ENABLED` flags | No | Background jobs (invitations expiry, substitution reminders, tenant deletion, late fees, subscription end-of-period) |
| `REACH_API_KEY` | No* | Reach Support API key (same secret as Reach `SUPPORT_ALMA_API_KEY`; *required for `/api/v1/support/*`) |
| `REACH_BASE_URL` | No* | Reach API origin, no trailing slash or `/api` suffix (*required for support routes) |

## Frontend (`frontend/.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Same project URL as backend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL (e.g. `http://localhost:3001`) |

## Security rules

- Example files must contain **placeholders only** — never real Mailjet/Stripe/Google secrets
- Rotating `GOOGLE_TOKEN_ENCRYPTION_KEY` invalidates all stored Classroom connections
- Production `FRONTEND_URL` and logo URLs must be stable HTTPS hosts email clients can reach
- Never put `REACH_API_KEY` in the frontend. Nest is the only client of the Reach Support API.
