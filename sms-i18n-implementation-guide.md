# SMS2 Arabic Localization Implementation Guide

**Project:** School Management System (SMS2)  
**Stack:** Next.js 14 (App Router) + NestJS + Supabase + Mantine v7  
**Scope:** Arabic + English bilingual support with RTL  
**Approach:** Hybrid (next-intl for UI + Database JSONB for specific entities)

---

## Architecture Overview

This is NOT a full translation infrastructure like RMS. We use a **lightweight hybrid approach**:

1. **90% of text (UI strings)** → next-intl with JSON files (no database, no AI)
2. **10% of text (standard lists)** → Database JSONB columns with optional AI translation
3. **0% of text (proper nouns)** → Not translated (student/teacher names stay as-is)

---

## Core Decisions

### Decision 1: No URL Prefixes

**DO NOT use `/en/dashboard` or `/ar/dashboard` routing.**

SMS is a **portal app**, not a public website. Users don't share URLs. SEO doesn't matter.

**Use:** Cookie-based locale (`NEXT_LOCALE=ar`) + middleware.  
**Result:** Same URL (`/students`) works in both languages based on user preference.

---

### Decision 2: Locale Storage (Three Places)

User's language preference must exist in **three places simultaneously**:

```
1. Cookie (NEXT_LOCALE=ar)           ← Middleware reads this
2. localStorage ('locale': 'ar')     ← Prevents hydration flicker
3. Database (profiles.preferred_locale) ← Source of truth, syncs across devices
```

**Flow:**
- User toggles language → Update all three
- On login → Fetch from DB → Set cookie + localStorage
- On page load → Read from cookie (middleware) or localStorage (client fallback)

---

### Decision 3: What Gets Translated

| Entity Type | Translate? | Method | Example |
|-------------|-----------|---------|---------|
| UI strings (buttons, labels, errors) | ✅ YES | next-intl JSON | "Save" → "حفظ" |
| Subject names | ✅ YES | DB JSONB | "Mathematics" → "الرياضيات" |
| Assessment types | ✅ YES | DB JSONB | "Midterm Exam" → "امتحان منتصف الفصل" |
| Event types/titles | ✅ YES | DB JSONB | "Parent Meeting" → "اجتماع أولياء الأمور" |
| Notification templates | ✅ YES | DB JSONB | "Student was absent" → "كان الطالب غائبًا" |
| Student names | ❌ NO | N/A | "Ahmed Ali" stays "Ahmed Ali" |
| Teacher names | ❌ NO | N/A | "Sarah Johnson" stays "Sarah Johnson" |
| Class codes | ❌ NO | N/A | "10-A" stays "10-A" |
| Branch names | 🟡 MAYBE | DB JSONB | "Main Campus" → "الحرم الرئيسي" (if admins want) |

---

## Phase 1: Foundation (next-intl for UI)

### 1.1 Install Dependencies

```bash
cd frontend
npm install next-intl
```

**DO NOT install:** `next-i18next`, `react-intl`, `i18next` (wrong libraries for App Router)

---

### 1.2 File Structure

```
frontend/
├── messages/
│   ├── en/
│   │   ├── common.json          # Buttons, status, errors (shared across all pages)
│   │   ├── auth.json            # Login, register, password reset
│   │   ├── students.json        # Student list, profile, enrollment
│   │   ├── attendance.json      # Attendance page, status labels
│   │   ├── notifications.json   # Notification center, types
│   │   ├── leaves.json          # Leave requests, early departure
│   │   ├── staff.json           # Staff management
│   │   ├── grades.json          # Grades, assessments
│   │   ├── timetable.json       # Timetable, schedule
│   │   ├── reports.json         # Reports page
│   │   ├── settings.json        # Settings, preferences
│   │   └── events.json          # Events, calendar
│   └── ar/
│       ├── common.json          # Same structure, Arabic text
│       ├── auth.json
│       ├── students.json
│       └── ... (mirror en/ structure)
├── src/
│   ├── i18n/
│   │   ├── request.ts           # Server-side i18n config
│   │   └── routing.ts           # Locale detection from cookie
│   ├── middleware.ts            # Reads NEXT_LOCALE cookie, sets locale
│   └── app/
│       ├── layout.tsx           # Root layout with DirectionProvider
│       └── [locale]/            # DO NOT CREATE - we use cookie, not URL prefix
```

**CRITICAL:** Do NOT create `app/[locale]/` folder. We use cookie-based routing, not URL-based.

---

### 1.3 Configure next-intl

**File: `src/i18n/request.ts`**

```typescript
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  // Read locale from cookie (set by middleware)
  const locale = cookies().get('NEXT_LOCALE')?.value ?? 'ar'; // Default Arabic for Iraqi schools

  return {
    locale,
    messages: {
      // Load only the namespaces needed (improves bundle size)
      ...(await import(`../../messages/${locale}/common.json`)).default,
      // Other namespaces loaded per-page using useTranslations('namespace')
    },
  };
});
```

**File: `src/i18n/routing.ts`**

```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'ar', // Iraqi schools default to Arabic
  localePrefix: 'never', // CRITICAL: No URL prefix, cookie-based only
});
```

---

### 1.4 Middleware

**File: `src/middleware.ts`**

```typescript
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware({
  ...routing,
  localeDetection: true, // Read from cookie
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'], // Skip API routes and static files
};
```

---

### 1.5 Root Layout with RTL

**File: `app/layout.tsx`**

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { cookies } from 'next/headers';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = cookies().get('NEXT_LOCALE')?.value ?? 'ar';
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <DirectionProvider initialDirection={dir}>
            <MantineProvider>
              {children}
            </MantineProvider>
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**CRITICAL:** The `dir={dir}` attribute on `<html>` + `DirectionProvider` is what makes RTL work. Mantine automatically mirrors all components.

---

### 1.6 Usage in Components

**Server Components:**

```typescript
import { useTranslations } from 'next-intl';

export default function StudentsPage() {
  const t = useTranslations('students'); // Loads messages/[locale]/students.json
  const common = useTranslations('common');

  return (
    <div>
      <h1>{t('pageTitle')}</h1>              {/* "Students" or "الطلاب" */}
      <Button>{common('save')}</Button>       {/* "Save" or "حفظ" */}
    </div>
  );
}
```

**Client Components:**

```typescript
'use client';
import { useTranslations } from 'next-intl';

export function StudentForm() {
  const t = useTranslations('students');
  const common = useTranslations('common');

  return (
    <form>
      <TextInput label={t('nameLabel')} />
      <Button type="submit">{common('save')}</Button>
    </form>
  );
}
```

---

### 1.7 Language Switcher Component

**File: `src/components/LanguageSwitcher.tsx`**

```typescript
'use client';
import { useRouter } from 'next/navigation';
import { Select } from '@mantine/core';

export function LanguageSwitcher() {
  const router = useRouter();
  const currentLocale = document.documentElement.lang; // Read from <html lang="">

  const handleChange = async (locale: string | null) => {
    if (!locale) return;

    // 1. Set cookie
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`; // 1 year

    // 2. Set localStorage
    localStorage.setItem('locale', locale);

    // 3. Update database (call your API)
    await fetch('/api/v1/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_locale: locale }),
    });

    // 4. Refresh page to apply new locale
    router.refresh();
  };

  return (
    <Select
      value={currentLocale}
      onChange={handleChange}
      data={[
        { value: 'en', label: 'English' },
        { value: 'ar', label: 'العربية' },
      ]}
    />
  );
}
```

---

### 1.8 JSON File Structure Example

**File: `messages/en/common.json`**

```json
{
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "edit": "Edit",
  "submit": "Submit",
  "search": "Search",
  "loading": "Loading...",
  "error": "An error occurred",
  "success": "Success",
  "confirm": "Are you sure?",
  "yes": "Yes",
  "no": "No",
  "status": {
    "active": "Active",
    "inactive": "Inactive",
    "pending": "Pending",
    "approved": "Approved",
    "rejected": "Rejected"
  }
}
```

**File: `messages/ar/common.json`**

```json
{
  "save": "حفظ",
  "cancel": "إلغاء",
  "delete": "حذف",
  "edit": "تعديل",
  "submit": "إرسال",
  "search": "بحث",
  "loading": "جاري التحميل...",
  "error": "حدث خطأ",
  "success": "نجح",
  "confirm": "هل أنت متأكد؟",
  "yes": "نعم",
  "no": "لا",
  "status": {
    "active": "نشط",
    "inactive": "غير نشط",
    "pending": "قيد الانتظار",
    "approved": "موافق عليه",
    "rejected": "مرفوض"
  }
}
```

---

### 1.9 Pluralization (Arabic Has 6 Plural Forms)

Arabic plural rules are complex. next-intl handles this automatically via ICU message format.

**English (`messages/en/students.json`):**

```json
{
  "studentCount": "{count, plural, =0 {No students} one {1 student} other {# students}}"
}
```

**Arabic (`messages/ar/students.json`):**

```json
{
  "studentCount": "{count, plural, =0 {لا يوجد طلاب} one {طالب واحد} two {طالبان} few {# طلاب} many {# طالبًا} other {# طالب}}"
}
```

**Usage:**

```typescript
const t = useTranslations('students');
<p>{t('studentCount', { count: 5 })}</p>  // "5 طلاب" in Arabic
```

---

### 1.10 CSS Logical Properties (RTL Support)

**Replace physical properties with logical properties in custom CSS:**

```css
/* ❌ WRONG - Breaks in RTL */
.sidebar {
  margin-left: 16px;
  padding-right: 8px;
  border-left: 1px solid #ccc;
}

/* ✅ CORRECT - Works in both LTR and RTL */
.sidebar {
  margin-inline-start: 16px;   /* left in LTR, right in RTL */
  padding-inline-end: 8px;     /* right in LTR, left in RTL */
  border-inline-start: 1px solid #ccc;
}
```

**Common replacements:**

| Physical | Logical |
|----------|---------|
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |
| `border-left` | `border-inline-start` |
| `border-right` | `border-inline-end` |
| `left: 0` | `inset-inline-start: 0` |
| `right: 0` | `inset-inline-end: 0` |
| `text-align: left` | `text-align: start` |
| `text-align: right` | `text-align: end` |

**NOTE:** Mantine components already use logical properties internally. This is only for your custom CSS.

---

## Phase 2: Database Translation (Specific Entities Only)

### 2.1 Database Schema Changes

**Add JSONB columns to existing tables (DO NOT create separate translation tables):**

```sql
-- Subjects
ALTER TABLE subjects 
ADD COLUMN name_translations JSONB DEFAULT '{}';

-- Assessment Types (if you have a separate table)
ALTER TABLE assessment_types 
ADD COLUMN name_translations JSONB DEFAULT '{}';

-- Event Types (if you have a separate table)
ALTER TABLE event_types 
ADD COLUMN name_translations JSONB DEFAULT '{}',
ADD COLUMN description_translations JSONB DEFAULT '{}';

-- Optional: Branches
ALTER TABLE branches 
ADD COLUMN name_translations JSONB DEFAULT '{}';

-- Notification Templates (if you build a templates feature)
ALTER TABLE notification_templates 
ADD COLUMN title_translations JSONB DEFAULT '{}',
ADD COLUMN body_translations JSONB DEFAULT '{}';
```

**JSONB Structure:**

```json
{
  "en": "Mathematics",
  "ar": "الرياضيات"
}
```

---

### 2.2 Backend DTO Updates

**Example: Subjects**

**File: `backend/src/modules/subjects/dto/create-subject.dto.ts`**

```typescript
export class CreateSubjectDto {
  @IsString()
  name: string; // Primary name (English or Arabic, whatever admin enters)

  @IsOptional()
  @IsObject()
  name_translations?: {
    en?: string;
    ar?: string;
  };

  // ... other fields
}
```

---

### 2.3 Backend Service Pattern

**Option A: Manual Translation (Recommended for MVP)**

Admin pastes translations manually. No AI.

```typescript
// subjects.service.ts
async create(dto: CreateSubjectDto, branchId: string) {
  const subject = this.supabase
    .from('subjects')
    .insert({
      name: dto.name,
      name_translations: dto.name_translations ?? { en: dto.name }, // Fallback
      branch_id: branchId,
    })
    .select()
    .single();

  return subject.data;
}
```

**Option B: AI Translation (Optional, Copy from RMS if Needed)**

Only implement if admins explicitly request auto-translation.

```typescript
// Install: npm install @google/generative-ai
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiTranslationService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async translateText(
    text: string,
    targetLanguages: string[],
    sourceLanguage: string = 'en',
  ): Promise<Record<string, string>> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguages.join(', ')}.
Return ONLY a JSON object with language codes as keys and translated text as values.
Do NOT include any markdown, code blocks, or extra text.

Text: "${text}"

Example output format:
{"ar": "translated text in Arabic", "en": "original or translated text"}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    try {
      // Remove markdown code blocks if present
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('Failed to parse Gemini response:', response);
      throw new Error('Translation failed');
    }
  }
}

// subjects.service.ts
async create(dto: CreateSubjectDto, branchId: string) {
  const subject = await this.supabase
    .from('subjects')
    .insert({
      name: dto.name,
      name_translations: { en: dto.name }, // Start with English
      branch_id: branchId,
    })
    .select()
    .single();

  // Fire-and-forget translation (like RMS)
  this.translateSubject(subject.data.id, dto.name).catch(err => 
    console.error('Translation failed:', err)
  );

  return subject.data;
}

private async translateSubject(subjectId: string, name: string) {
  const translations = await this.geminiService.translateText(name, ['ar'], 'en');
  
  await this.supabase
    .from('subjects')
    .update({ name_translations: translations })
    .eq('id', subjectId);
}
```

---

### 2.4 Backend API Returns Translated Fields

**Always resolve translations on the backend, not the frontend.**

```typescript
// subjects.service.ts
async list(branchId: string, language: string = 'ar') {
  const { data: subjects } = await this.supabase
    .from('subjects')
    .select('*')
    .eq('branch_id', branchId);

  // Resolve translations
  return subjects.map(subject => ({
    ...subject,
    name: subject.name_translations?.[language] 
      ?? subject.name_translations?.en 
      ?? subject.name, // Fallback chain
  }));
}
```

**Controller:**

```typescript
// subjects.controller.ts
@Get()
async list(
  @Query('language') language: string = 'ar',
  @BranchId() branchId: string,
) {
  return this.subjectsService.list(branchId, language);
}
```

---

### 2.5 Frontend Usage

**Frontend just passes `language` query param:**

```typescript
// hooks/useSubjects.ts
export function useSubjects() {
  const locale = useLocale(); // From next-intl: 'en' or 'ar'

  return useQuery({
    queryKey: ['subjects', locale],
    queryFn: () => api.get('/api/v1/subjects', { params: { language: locale } }),
  });
}
```

**Component:**

```typescript
export function SubjectsList() {
  const { data: subjects } = useSubjects();
  
  return (
    <Table>
      {subjects?.map(subject => (
        <tr key={subject.id}>
          <td>{subject.name}</td>  {/* Already translated by backend */}
        </tr>
      ))}
    </Table>
  );
}
```

---

## Phase 3: Database Migration (Add preferred_locale to profiles)

### 3.1 Add Column

```sql
ALTER TABLE profiles 
ADD COLUMN preferred_locale VARCHAR(2) DEFAULT 'ar' CHECK (preferred_locale IN ('en', 'ar'));

CREATE INDEX idx_profiles_preferred_locale ON profiles(preferred_locale);
```

---

### 3.2 Update Auth Service

**Backend: `auth.service.ts`**

```typescript
async getCurrentUser(userId: string) {
  const { data: profile } = await this.supabase
    .from('profiles')
    .select('*, preferred_locale')
    .eq('id', userId)
    .single();

  return {
    ...profile,
    preferredLocale: profile.preferred_locale ?? 'ar',
  };
}
```

---

### 3.3 Frontend: Sync on Login

**Frontend: `app/login/page.tsx` (or wherever login happens)**

```typescript
const handleLogin = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  const { user } = response.data;

  // Sync locale across all three storage layers
  const locale = user.preferredLocale ?? 'ar';
  
  // 1. Cookie
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
  
  // 2. localStorage
  localStorage.setItem('locale', locale);
  
  // 3. DB is already the source (we just read from it)

  // Redirect and refresh to apply locale
  router.push('/dashboard');
  router.refresh();
};
```

---

### 3.4 Update Preference Endpoint

**Backend: `users.controller.ts`**

```typescript
@Patch('me/preferences')
async updatePreferences(
  @UserId() userId: string,
  @Body() dto: { preferred_locale?: string },
) {
  await this.supabase
    .from('profiles')
    .update({ preferred_locale: dto.preferred_locale })
    .eq('id', userId);

  return { success: true };
}
```

---

## What NOT to Do (Anti-Patterns)

### ❌ DON'T Create These (RMS Over-Engineering)

1. **DO NOT create `translation_metadata` table**  
   We use JSONB columns directly on entities. Separate tables are overkill for SMS.

2. **DO NOT create `translations` table**  
   Same reason. JSONB is simpler and faster for our small scope.

3. **DO NOT create `supported_languages` table**  
   We only support en/ar. Hardcode in `i18n/routing.ts`.

4. **DO NOT create `tenant_languages` table**  
   All tenants get both languages. No per-tenant enable/disable needed.

5. **DO NOT translate student/teacher names**  
   Proper nouns stay as entered. Don't waste AI calls.

6. **DO NOT build a "re-translate" admin feature**  
   Admins can just edit the JSONB field directly.

7. **DO NOT use a job queue for translations**  
   Simple fire-and-forget `Promise` is enough if using AI.

8. **DO NOT create pre-translations constant**  
   Subject list is small. Just hardcode or let admins paste.

9. **DO NOT cache translations in memory**  
   React Query already caches API responses. No extra layer needed.

---

### ❌ DON'T Use These Libraries

- `next-i18next` → Incompatible with App Router
- `react-intl` → More boilerplate than next-intl
- `i18next` → Overkill and complex setup
- `react-i18next` → Not designed for Next.js App Router

**ONLY use:** `next-intl`

---

### ❌ DON'T Use URL-Based Routing

**WRONG:**
```
/en/students  /ar/students  /en/attendance
```

**CORRECT:**
```
/students  (locale from cookie)
```

---

## Translation Workflow (How to Generate Arabic JSON)

### Step 1: Build Feature in English

Create feature with English strings in `messages/en/students.json`:

```json
{
  "pageTitle": "Students",
  "addStudent": "Add Student",
  "nameLabel": "Student Name",
  "emailLabel": "Email Address"
}
```

---

### Step 2: AI-Translate to Arabic

**Paste to Claude/ChatGPT:**

> Translate this JSON file to Iraqi Arabic. Keep the same keys, translate only the values. Return only the JSON, no explanation.
>
> ```json
> {
>   "pageTitle": "Students",
>   "addStudent": "Add Student",
>   "nameLabel": "Student Name",
>   "emailLabel": "Email Address"
> }
> ```

**Output:**

```json
{
  "pageTitle": "الطلاب",
  "addStudent": "إضافة طالب",
  "nameLabel": "اسم الطالب",
  "emailLabel": "البريد الإلكتروني"
}
```

---

### Step 3: Save as `messages/ar/students.json`

Done. No merging, no conflicts.

---

## Testing Checklist

### Frontend Testing

- [ ] Toggle language switcher → page refreshes in new language
- [ ] All buttons, labels, errors appear in correct language
- [ ] RTL layout: sidebar on right, text right-aligned, icons mirrored
- [ ] Login with user → locale from DB is applied
- [ ] Change locale → preference saved to DB
- [ ] Refresh page → locale persists (from cookie)
- [ ] Open in new tab → locale persists (from DB after login)
- [ ] Arabic plural forms work correctly (0, 1, 2, 3-10, 11-99, 100+)

### Backend Testing

- [ ] `GET /subjects?language=ar` returns Arabic names
- [ ] `GET /subjects?language=en` returns English names
- [ ] Missing translation → falls back to English → falls back to original
- [ ] Create subject → `name_translations` JSONB is populated
- [ ] (If using AI) Create subject → translation completes in background (check DB after 5s)

### Database Testing

- [ ] `profiles.preferred_locale` exists and has default 'ar'
- [ ] `subjects.name_translations` is JSONB type
- [ ] JSONB structure is valid: `{ "en": "Math", "ar": "الرياضيات" }`

---

## Performance Considerations

### Bundle Size

- ✅ next-intl only loads active locale's messages
- ✅ Per-feature JSON files keep bundles small
- ✅ Dynamic import for heavy namespaces (e.g. reports) if needed

### API Performance

- ✅ JSONB column query is fast (indexed automatically)
- ✅ Translation resolution happens once in service layer (not in loop)
- ✅ React Query caches translated responses

### Database

- ✅ JSONB columns have GIN index support (add if list endpoints are slow)
- ✅ No extra JOINs (unlike RMS's separate tables approach)

---

## Migration Path (For Existing Data)

If you already have subjects/events/etc. in the database:

```sql
-- Migrate existing subjects to have translations
UPDATE subjects 
SET name_translations = jsonb_build_object('en', name, 'ar', name)
WHERE name_translations = '{}' OR name_translations IS NULL;
```

Admins can then edit the Arabic values in the UI later.

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Install next-intl
- [ ] Create `messages/` folder structure
- [ ] Add middleware, routing config
- [ ] Update root layout with DirectionProvider
- [ ] Build LanguageSwitcher component

### Week 2: Common Translations
- [ ] Translate `common.json` (buttons, status, errors)
- [ ] Test RTL layout with Mantine components
- [ ] Fix any custom CSS to use logical properties

### Week 3: Feature by Feature
- [ ] Translate `auth.json`, `students.json`, `attendance.json`
- [ ] Test pluralization for student counts, notification counts
- [ ] Add `preferred_locale` to profiles table

### Week 4: Database Translations (Optional)
- [ ] Add JSONB columns to subjects, events, etc.
- [ ] Update backend services to resolve translations
- [ ] (Optional) Add Gemini service for auto-translation
- [ ] Test with both languages

---

## Summary

**This approach gives you:**

✅ Full Arabic + English bilingual support  
✅ RTL layout that works perfectly with Mantine  
✅ Lightweight (no complex translation infrastructure)  
✅ Fast (JSONB columns, no extra tables/joins)  
✅ Scalable (per-feature JSON files, easy to add more languages)  
✅ Developer-friendly (Cursor can translate JSON files easily)  
✅ Optional AI (add later if admins demand it)  

**What you avoid:**

❌ URL-based routing complexity  
❌ Separate translation tables (RMS over-engineering)  
❌ Translating things that shouldn't be translated (names)  
❌ Complex caching/job queues  
❌ Bundle bloat from wrong libraries  

**Total implementation time:** 2-3 weeks for full bilingual support.

---

## References

- next-intl docs: https://next-intl-docs.vercel.app/
- Arabic plural rules: https://unicode-org.github.io/cldr-staging/charts/latest/supplemental/language_plural_rules.html#ar
- CSS logical properties: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties
- Mantine RTL: https://mantine.dev/guides/rtl/
