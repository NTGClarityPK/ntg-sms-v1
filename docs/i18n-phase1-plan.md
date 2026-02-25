# Phase 1: next-intl Foundation (UI Translation) — Implementation Plan

**Goal:** Set up next-intl with cookie-based locale (no URL prefixes), load UI messages, and enable RTL for Arabic. No database or language switcher yet (Phase 2).

**Reference:** `sms-i18n-implementation-guide.md` sections 1.1–1.6, 1.8–1.10; `prompts.md` Prompt 16 Phase 1.

---

## 1. Current State Summary

| Area | Current | After Phase 1 |
|------|--------|----------------|
| **next-intl** | Not installed | Installed and configured |
| **Locale** | Hardcoded `lang="en"` in root layout | Cookie `NEXT_LOCALE` (default `ar`), `dir`/`lang` from locale |
| **Middleware** | Supabase auth only | next-intl first (locale/cookie), then Supabase (session refresh) |
| **Messages** | None | `messages/en/*.json` and `messages/ar/*.json` (start with `common`) |
| **Components** | Hardcoded English strings | Use `useTranslations('namespace')` / `getTranslations('namespace')` |
| **RTL** | Not applied | `<html dir={dir}>` + Mantine `DirectionProvider` |

**DB note (for later phases):** `profiles` has no `preferred_locale` yet. `subjects`, `assessment_types`, `branches` use `name` + `name_ar` (Phase 3 may add JSONB or keep columns). Phase 1 does not touch the database.

---

## 2. Implementation Steps (Order Matters)

### Step 2.1 — Install next-intl

```bash
cd frontend && npm install next-intl
```

- No other i18n libs (`react-i18next`, `i18next`, etc.).

---

### Step 2.2 — File structure

Create (empty or minimal content first, then fill):

```
frontend/
├── messages/
│   ├── en/
│   │   └── common.json
│   └── ar/
│       └── common.json
├── src/
│   ├── i18n/
│   │   ├── request.ts
│   │   └── routing.ts
│   └── middleware.ts   (replace existing)
```

- Do **not** create `app/[locale]/` — routing is cookie-based only.

---

### Step 2.3 — next-intl configuration

**`src/i18n/routing.ts`**

- `defineRouting({ locales: ['en','ar'], defaultLocale: 'ar', localePrefix: 'never' })`.
- Optional: set `localeCookie` name if we want an explicit name (default is fine for Phase 1).

**`src/i18n/request.ts`**

- Use `getRequestConfig` from `next-intl/server`.
- Read locale from `cookies().get('NEXT_LOCALE')?.value ?? 'ar'`.
- Load messages: at minimum merge `common.json` for the resolved locale.  
- For Phase 1 we can load only `common`; when we add more namespaces (auth, students, etc.) we either:
  - Merge all needed namespaces in `request.ts` (simpler, slightly larger initial payload), or
  - Load only `common` here and add other namespaces as we add pages (better perf, more files to touch later).
- Recommendation: **merge `common` only in Phase 1**; add other namespaces when we add translated pages.

**Important:** With `localePrefix: 'never'`, the docs say the middleware may not run on every request in some setups; `getRequestConfig` **must** always return a valid `locale` (hence cookie fallback to `'ar'`).

---

### Step 2.4 — Middleware chain

- Next.js allows only one middleware. We must **compose** next-intl and Supabase in one `middleware.ts`.
- Order:
  1. Run **next-intl** middleware first (locale detection, set cookie, no URL rewrite when `localePrefix: 'never'`).
  2. Run **Supabase** session refresh (existing logic: create server client, `getUser()`, cookie handling).
- Pattern: call `createMiddleware(routing)(request)` first; if it returns a response (redirect/rewrite), return it; otherwise create Supabase client and run current auth logic, then return `NextResponse.next()` (or the response that sets cookies).
- Matcher: keep excluding `_next`, static files, and API routes; include the same routes as now so auth still runs where needed.

---

### Step 2.5 — Root layout and RTL

**`app/layout.tsx`**

- Must be **async** (we need `cookies()` and `getMessages()`).
- Read locale from cookie (same as request: `NEXT_LOCALE` ?? `'ar'`).
- Compute `dir = locale === 'ar' ? 'rtl' : 'ltr'`.
- Set `<html lang={locale} dir={dir}>`.
- Fetch messages: `getMessages()` from `next-intl/server` (so they’re available to client).
- Wrap children with:
  - `NextIntlClientProvider` (pass `messages` and optionally `locale`).
  - Mantine’s `DirectionProvider` with `initialDirection={dir}` (so Mantine mirrors layout).
- Keep existing font class names on `<body>` (e.g. Saira, Rajdhani, JetBrains Mono).

**`app/providers.tsx`**

- Stays client; no need for next-intl here — layout provides `NextIntlClientProvider`. Ensure `DirectionProvider` is in layout, not only in MantineProvider (Mantine supports direction from DirectionProvider).

---

### Step 2.6 — Initial message files

**`messages/en/common.json`**

- Buttons: save, cancel, delete, edit, submit, search, loading, back, next, close, confirm, yes, no.
- Status: active, inactive, pending, approved, rejected.
- Generic errors: e.g. `error`, `success`, `errors.generic`, `errors.notFound` (and any used in Phase 1).
- Structure can be nested, e.g. `status.active`, `errors.studentNotFound`, to match guide.

**`messages/ar/common.json`**

- Same keys, Arabic values (you can paste the English file into ChatGPT to translate, then paste result into `ar/common.json`).

---

### Step 2.7 — Use translations in components

- **Server components:** `import { getTranslations } from 'next-intl/server';` then `const t = await getTranslations('common');` and use `t('save')`, etc.
- **Client components:** `import { useTranslations } from 'next-intl';` then `const t = useTranslations('common');` — same API.
- Phase 1 scope: **start with a small set of high-visibility components** so we can verify the pipeline (cookie → request config → layout → RTL + translations) without touching every screen.
- Suggested first targets:
  - One or two buttons in the header or sidebar (e.g. “Save” or “Logout” if present).
  - Login page (auth strings) — if we add `auth.json` in Phase 1, we can add it to `request.ts` and use `useTranslations('auth')` there.
  - One list page (e.g. “Students” title + common buttons).
- Replace **only** the strings we’ve added to `common` (and optionally `auth`); leave the rest for a follow-up pass so Phase 1 stays shippable and testable.

---

### Step 2.8 — Next.js config (required for App Router)

- **Plugin is required:** The official App Router setup uses `createNextIntlPlugin()` so that `i18n/request.ts` is linked to next-intl. Without it, `getRequestConfig` is not used.
- In `next.config.js`: import `createNextIntlPlugin` from `'next-intl/plugin'`, then wrap the existing config: `const withNextIntl = createNextIntlPlugin(); module.exports = withNextIntl(pwaConfig(nextConfig));` (or equivalent so PWA and next-intl both wrap the base config).
- Default plugin path is `./i18n/request.ts` (or `./src/i18n/request.ts` depending on project structure); specify custom path in the plugin only if we move the file.

---

## 3. Message loading strategy (performance)

- **Phase 1:** Load only `common` in `getRequestConfig` (one JSON per locale). No lazy loading yet.
- **Later:** When adding auth, students, attendance, etc., either:
  - Merge all namespaces in `request.ts` (simpler, one place to add imports), or
  - Use a pattern that loads namespaces on demand (if supported by next-intl for App Router).
- Avoid loading unused namespaces on every request; keep `common` small and add namespaces as we translate more pages.

---

## 4. Testing checklist (Phase 1)

- [ ] **Install & build:** `npm run build` succeeds with next-intl and new files.
- [ ] **Default locale:** With no cookie, app uses Arabic (e.g. `ar` in `<html lang>` and RTL).
- [ ] **Cookie override:** Setting `NEXT_LOCALE=en` (e.g. in DevTools) and refresh shows English and LTR.
- [ ] **RTL:** With locale `ar`, sidebar/nav and form layout are mirrored (right-side layout).
- [ ] **Translations:** Replaced strings (e.g. common buttons) show correct EN/AR per cookie.
- [ ] **Auth still works:** Login and protected routes still work (Supabase middleware runs after next-intl).
- [ ] **No URL prefix:** URLs remain without `/en` or `/ar` (e.g. `/dashboard`, `/students`).

---

## 5. Out of scope for Phase 1

- Language switcher UI (Phase 2).
- `profiles.preferred_locale` or any DB change (Phase 2).
- Database JSONB translations / tabbed inputs (Phases 3–4).
- Replacing every hardcoded string in the app (we do a subset for Phase 1; rest can be incremental).
- Custom CSS logical properties (Phase 5); Mantine already uses logical properties.

---

## 6. Risk and mitigation

| Risk | Mitigation |
|------|------------|
| Middleware order breaks auth | Run next-intl first, then Supabase; test login and a protected route. |
| Cookie not read in layout | Use same cookie name as middleware (`NEXT_LOCALE`); ensure middleware runs on page routes (matcher). |
| RTL not applied | Set both `<html dir={dir}>` and Mantine `DirectionProvider` with same `dir`. |
| getRequestConfig not found | Add next-intl plugin to next.config if required by our Next/next-intl version. |

---

## 7. Suggested implementation order (concrete)

1. Install next-intl; add `i18n/routing.ts` and `i18n/request.ts`; add minimal `messages/en/common.json` and `messages/ar/common.json`.
2. Update middleware: create next-intl middleware from routing, run it first, then run Supabase logic; return combined response.
3. Update root layout: async, cookie + getMessages, html lang/dir, NextIntlClientProvider + DirectionProvider.
4. Add next-intl plugin to next.config if needed; run build and fix any “request config” or “locale” errors.
5. Replace a few UI strings in one or two components (e.g. login + one portal page) with `getTranslations`/`useTranslations('common')`.
6. Manually test: default ar/RTL, cookie en/LTR, auth flow, and that replaced strings switch with locale.

After this, Phase 1 is done. Phase 2 will add the language switcher, DB preference, and sync on login.
