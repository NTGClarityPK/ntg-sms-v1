# 🎧 Reach Support

**Product:** NTG Alma  
**Audience:** Developers / DevOps

Alma’s portal Support UI talks only to Nest `/api/v1/support/*`. Nest calls Reach server-to-server. Never put `REACH_API_KEY` in Next.js (`NEXT_PUBLIC_*`).

## 📋 Overview

Reach is the NTG customer-support chat platform. Alma Nest is the only client of Reach’s Support API. The browser uses Alma JWT + `X-Branch-Id`. Nest binds `tenant_id` from the session. The client must not send `tenant_id` or `product`.

```
Alma browser (/support + FAB)
  Bearer Alma JWT + X-Branch-Id
        │
        ▼
Backend (NestJS)  /api/v1/support/*  and  /api/v1/student/support/*
        │
        ├── Bind tenant_id, tenant_name, branch snapshot, sender_display_name
        ├── Campus unread rows in Alma `support_conversation_reads`
        ├── x-api-key → Reach /api/support/*
        └── Return { data } (camelCase). Pass scoped Realtime JWT through — never the API key
        │
        ▼
Reach (separate host + Supabase)
```

Coverage and monthly minutes are cached in memory for 60 seconds.

## 🔑 Environment variables

From `backend/.env.example`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `REACH_API_KEY` | Yes* | Same secret as Reach `SUPPORT_ALMA_API_KEY`. *Required for support routes; missing values return 503 |
| `REACH_BASE_URL` | Yes* | Reach **API** origin only (no `/api` suffix, no trailing slash). Local example: `http://localhost:3000`. Production: the Reach host that serves `/api/support/*` |

`REACH_API_KEY` must be the **secret only**. A pasted line such as `REACH_API_KEY=SUPPORT_ALMA_API_KEY=…` will 401 at Reach.

Alma currently has production only. When staging is added, use a **separate** Reach URL + key pair.

`SUPPORT_API_ACTOR_USER_ID` stays on Reach. Alma only sends `sender_display_name` (profile or student name plus tenant name).

## 🧱 Backend

| Area | Path |
|------|------|
| Module | `backend/src/modules/support/` |
| Portal controller | `support.controller.ts` — `JwtAuthGuard` + `BranchGuard` |
| Student controller | `student-support.controller.ts` — `StudentJwtGuard` |
| Orchestration | `support.service.ts` |
| HTTP client | `reach-client.service.ts` |
| Unread table | Migration `163_support_conversation_reads.sql` |

Registered in `app.module.ts`. Conversation and message bodies live in Reach. Alma stores campus-shared read state only.

Any authenticated portal user with a branch session may call the portal routes. Student self-service uses the student JWT; Nest loads `tenant_id` from that student’s branch. The main portal Support UI does not use the student routes yet.

### Alma routes

Client does **not** send `tenant_id` or `product`. Nest always sends the current branch snapshot on create/list.

| Method | Path | Reach / Alma |
|--------|------|--------|
| `GET` | `/api/v1/support/conversations` | List (`status`, `limit`; `branch_id` from session) |
| `POST` | `/api/v1/support/conversations` | Create (`title` optional) |
| `GET` | `/api/v1/support/conversations/:id/messages` | List messages (`limit`, `after`, `before`) |
| `POST` | `/api/v1/support/messages` | Send text/media metadata |
| `POST` | `/api/v1/support/uploads` | Multipart `file` + `conversationId` + `messageType` |
| `DELETE` | `/api/v1/support/messages/:id` | Delete own customer message |
| `GET` | `/api/v1/support/minutes-summary` | Optional `month=YYYY-MM` |
| `GET` | `/api/v1/support/coverage` | Duty banner payload |
| `POST` | `/api/v1/support/realtime-token` | Body `{ conversationId }` only |
| `GET` | `/api/v1/support/unread-summary` | Alma DB: `{ count, conversationIds }` for branch |
| `POST` | `/api/v1/support/conversations/:id/mark-read` | Alma DB: set `last_read_at = now()` (campus-wide) |
| `POST` | `/api/v1/support/conversations/:id/note-agent-activity` | Alma DB: upsert `last_agent_message_at` |

Student copies live under `/api/v1/student/support/...`.

Responses are `{ data: T }` (camelCase). Realtime `data` is either `{ mode: "realtime", accessToken, expiresAt, supabaseUrl, supabaseAnonKey, refreshAfterSeconds }` or `{ mode: "poll", pollIntervalMs, message }`. Token TTL is 10 minutes; refresh after about 5 minutes while the chat stays open.

Upload caps (enforced in Nest, then again by Reach): image 5 MB, file 3 MB, voice 2 MB, video 20 MB.

### Campus unread (`support_conversation_reads`)

Unique on `(tenant_id, branch_id, conversation_id)`. RLS enabled; only Nest (service role) touches the table.

Unread when `last_agent_message_at` is set and (`last_read_at` is null or `last_agent_message_at > last_read_at`). Marking read clears unread for the **entire campus branch**.

## 🖥️ Frontend UI

| Area | Path |
|------|------|
| Page | `frontend/src/app/(portal)/support/page.tsx` |
| Components | `frontend/src/components/features/support/` |
| Hooks / types | `frontend/src/hooks/api/useSupport.ts`, `frontend/src/types/support.ts` |
| FAB | `SupportFloatingButton` mounted from `AppShell` |
| Nav | Sidebar Communication group → `/support` (`IconHeadset`). **Not** in `navFeatureMap` (no matrix / plan gate) |

Behaviour notes:

- New chat title (English): `New chat — {dd MMM HH:mm}` (Asia/Karachi via formatter).
- Open thread → `mark-read` + messages + `realtime-token`.
- Realtime: separate Reach Supabase client + `realtime.setAuth`; poll `messages` when `mode: "poll"` or subscribe fails.
- On agent INSERT (or poll discovery) → `note-agent-activity` and invalidate unread/list.
- FAB polls unread ~20s; badge `1`–`9` / `9+`; no browser Notification API.
- Online-only: hide FAB/nav and block the page when offline.

## 🔐 Security

- Nest → Reach only. CORS on Reach is not required for the Alma browser.
- Do **not** put `REACH_API_KEY`, Reach `SUPABASE_JWT_SECRET`, or a Reach service-role key in the frontend.
- The scoped Realtime JWT is conversation-bound and read-only. The public anon key from the token response is only for opening the socket; it does not grant support-table reads by itself.
- If token fetch or the subscription fails, the UI polls `GET .../messages` on an interval.

## 🛠️ Manual checklist

1. Set `REACH_API_KEY` to the same value as Reach `SUPPORT_ALMA_API_KEY` (secret only).
2. Confirm `REACH_BASE_URL` is the API origin: `GET {REACH_BASE_URL}/api/support/coverage` with `x-api-key` must return JSON (`200` or `401 { "error": "Unauthorized" }`), not an HTML app shell.
3. Put the same two variables in the production secret store. Do not commit `.env`.
4. Alma sends `tenants.id` (UUID) as `tenant_id`. That is expected; agents see `tenant_name`.
5. Confirm migration `163_support_conversation_reads` is applied.
6. Smoke `/support`: create chat, send text, open FAB badge after agent activity.

## 🆘 Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `503` “Reach support is not configured” | Missing `REACH_API_KEY` or `REACH_BASE_URL` |
| `503` “Support service is not configured correctly” | Key does not match Reach, or the double-assignment paste (`SUPPORT_ALMA_API_KEY=` prefix) |
| `503` “unexpected response” | `REACH_BASE_URL` points at the agent UI, not the API |
| `400` on create/list mentioning `tenant_id` | Client sent `tenant_id`; strip it — Nest binds it |
| Reach `401` when curling coverage | Align secrets with the Reach environment you are calling |
| Unread never clears | `mark-read` not called on open, or wrong branch header |
| Realtime silent | Token `mode: "poll"` or subscribe error — UI should fall back to polling |
