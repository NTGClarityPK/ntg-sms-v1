**Prompt: Build Alma Support tab to match NTG Resto Support**
 
Alma’s portal UI is similar to NTG Resto. Implement Support the same way: in-app chat with NTG agents (via **NTG Reach**), not a generic help page.
 
### Product
- Product slug for Reach: **`alma`** (Resto uses `resto`).
- Map Resto **branch** → Alma **campus / school location** (whatever Alma already uses as the selected site in the header). Always send that selected site on create/list/unread. Do not allow HQ/no-campus chats.
 
### Architecture (do not skip)
- Browser talks only to **Alma Nest BFF** with the user’s JWT (`/api/v1/support/*`).
- Nest calls Reach (`REACH_BASE_URL` + `REACH_API_KEY`) server-side. **Never** put the Reach API key in the browser / `NEXT_PUBLIC_*`.
- Nest binds `tenant_id` from the session.
 
### UI layout (match Resto)
1. **Sidebar tab** “Support” (headset icon). Role-access tab like other portal pages. Default: all roles except ones that should not contact support (Resto excludes delivery).
2. **Floating Affix button** (headset, bottom-right, theme primary). Hide on the Support page itself, hide when offline, hide if the role cannot access Support. Unread badge `1–9` / `9+`. Light pulse when unread goes from 0 → ≥1. Poll unread ~**20s**. **No browser notifications.**
3. **Support page** (standard Alma title bar “Support”):
   - **Left:** conversation list + **New chat**. Closed chats visually distinct. Red unread dot on unread threads. Clicking a thread opens it and **mark-read** (shared for everyone on that campus).
   - **Right:** message thread + composer. Mobile: list first, drawer/full screen for the thread.
   - **Coverage banner:** if agents offline, show offline message / “Back at {time}”. If coverage ends within 30 minutes, show “Ends in X min”. Refresh coverage ~30s.
   - **Minutes summary** in the header/actions: this month + last month (platform vs operational minutes). Timezone for month: **Asia/Karachi**.
4. **Composer:**
   - Text send.
   - Paperclip: images → `image`; other files → `file` (`content` = filename). Show a download card for files.
   - Screenshot (display capture → image).
   - Voice note: max **5 min**; elapsed timer; tap again to stop & send.
   - Screen record: max **30s**; elapsed/max timer; Stop & send / Cancel.
5. **Messages:**
   - Customer vs agent bubbles (agent = NTG).
   - Types: `text | image | voice | video | file`.
   - Respect `expires_at` (video ~7 days); show expired state, don’t play dead URLs.
   - Default new-chat title in **English** for the Reach inbox, e.g. `New chat — 24 Aug 14:30`.
 
### Media limits (must match Reach)
| Type | Max |
|---|---|
| image | 5 MB original (compress max edge 1280, JPEG ~0.72) |
| file | 3 MB |
| voice | 2 MB |
| video | **12 MB**, 30s screen capture |
 
Upload via Nest multipart, then send message with `file_url`.
 
### Unread (Alma DB, not Reach)
- Table like `support_conversation_reads` keyed by tenant + campus + conversation.
- Shared per campus: opening a chat clears unread for all users of that campus.
- Endpoints: unread-summary, mark-read, note-agent-activity.
- Enable RLS; service role bypasses it.
 
### Live updates
- Open chat → Nest `POST /support/realtime-token`.
- If Reach returns realtime JWT + Supabase url/anon: subscribe `postgres_changes` on `support_messages` for that conversation; refresh token ~5 min.
- If `mode: "poll"` or subscribe fails: poll `GET messages?after=`.
 
### Offline
- Support is **online-only**. If offline, hide FAB and block/redirect the Support route (same idea as Resto).
 
### What not to copy
- Restaurant-only concepts (POS, tables, KOT).
- Don’t invent a second chat product; this is Reach Support with Alma as the customer app.
 
Match Resto’s look: Mantine, theme primary, two-pane chat, Affix headset, campus-scoped chats, unread dots only (no toasts/push).
 
---
 