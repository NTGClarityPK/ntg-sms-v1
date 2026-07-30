# Troubleshooting

## Backend will not start

- Confirm Node 20+ and `npm install` in `backend/`
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Port in use: change `PORT` or stop the other process (`npm run kill:port`)

## Frontend cannot reach API

- Backend health: `GET /health`
- `NEXT_PUBLIC_API_URL` matches backend host/port
- CORS / `FRONTEND_URL` includes the frontend origin

## Auth / login issues

- Supabase Auth URL configuration (Site URL + redirect URLs)
- Anon key on frontend vs service key on backend (do not swap them)
- Clear cookies and retry after env changes (restart `next dev`)

## Migrations

- Apply `supabase/migrations/` in filename order
- Prefer Supabase CLI `db push` or SQL Editor for controlled environments

## Google Classroom

See [Modules → Google Classroom](modules/google-classroom.md) for OAuth, token, and pull failures.

## Email not sending

- Mailjet keys and verified sender/domain
- `FRONTEND_URL` / logo URLs reachable from the public internet

## Still stuck?

1. Check terminal + browser console
2. Check Supabase logs
3. Search this developer guide
4. Ask the team with reproduction steps
