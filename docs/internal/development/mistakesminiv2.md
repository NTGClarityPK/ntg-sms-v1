## Compact Lessons - Common Mistakes (Use as Rules) — v2

### Mantine v7 Radio “checked” indicator invisible (custom CSS override)
- **Issue**: Radio buttons worked functionally (value changed) but the circle stayed empty/white — no filled “checked” indicator in the UI (e.g. resend invitation modal).
- **Cause**: Our theme CSS injection in `DynamicThemeProvider.tsx` targeted old selectors like `.mantine-Radio-input:checked + .mantine-Radio-radio`, which don’t match Mantine v7’s DOM/state model. Mantine v7 uses root `data-*` attributes (e.g. `data-checked`, `data-disabled`) instead of relying on an adjacent sibling selector from the hidden input.
- **Fix**: Update the injected CSS to style based on Mantine v7 state attributes:
  - `.mantine-Radio-root[data-checked] .mantine-Radio-radio { ... }`
  - `.mantine-Radio-root[data-disabled] ...`
  - Ensure the inner indicator (`.mantine-Radio-inner` / `.mantine-Radio-icon`) remains visible.
- **Lesson**: When overriding Mantine components globally, **verify selectors against the exact Mantine version’s rendered markup**. Prefer stable state selectors (`[data-checked]`, `[data-disabled]`) over fragile `input:checked + ...` patterns, and keep a quick visual QA checklist for form controls after theme changes.

### Regex escaping broke email validation (DTO @Matches)
- **Issue**: Manual student creation (and re-invite) failed with HTTP 400 “Invalid invitation recipient email address” for valid emails (notably emails containing the letter `s`, e.g. `...shaheer...@gmail.com`).
- **Cause**: Regex used `\\s` inside a JavaScript regex literal: `@Matches(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/...)`. In regex literals, `\\s` matches a *literal* `\s`, so the character class `[^\\s@]` unintentionally excluded the letter `s` (and `\`) rather than excluding whitespace. This created a “works for some emails, fails for others” bug.
- **Fix**: Use the correct whitespace escape in regex literals: `@Matches(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/...)` → `@Matches(/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/...)` with single `\s` (i.e. `^[^\\s@]` becomes `^[^\\s@]` where `\s` is a real whitespace token). Updated both:
  - `backend/src/modules/students/dto/create-student-with-invitation.dto.ts`
  - `backend/src/modules/students/dto/reinvite-student.dto.ts`
- **Lesson**: **Be extremely careful with escaping in regex literals vs string regexes.** If the symptom is “valid input fails for a specific character”, suspect an accidental character class restriction. Also ensure backend errors are specific (field-level) so debugging doesn’t stall on generic “Invalid email address”.

### “Empty list only for some roles” was actually wrong branch selected (not permissions)
- **Issue**: Subject teacher saw empty `Assessment Type` dropdown while class teacher/admin saw types. API call returned HTTP 200 with `{"data":[],"meta":{"total":0,...}}` for subject teacher.
- **Root cause**: The subject teacher’s `profiles.current_branch_id` pointed to a different branch (“Secondary Branch”) that had **no `assessment_types` rows**. The teacher still had access to the main branch, but their current branch selection was wrong/stale, so BranchGuard + RLS correctly scoped the query to the empty branch.
- **What slowed debugging**: We iterated on frontend hook timing/caching (`enabled`/queryKey/localStorage) assuming hydration issues, without first verifying which `branch_id` the backend resolved for that user.
- **Fix pattern**:
  - First confirm which branch the user is effectively on:
    - Check `profiles.current_branch_id` for the affected user.
    - Check `user_branches` membership for the intended branch.
    - Compare `count(*)` of the relevant table (`assessment_types`) across those branches.
  - Only then adjust frontend caching/hydration.
  - If users frequently land on an unconfigured branch, add a safe server-side heuristic to auto-switch to a configured branch (or force a branch-selection UX).
- **Lesson**: When an endpoint returns **200 + empty data** for one user but not another, **don’t assume permissions or frontend state first**. Immediately validate the effective `branch_id` and whether that branch has any rows for the resource.

### Help modal showed “No subject templates found” despite templates existing (API response shape mismatch)
- **Issue**: Bulk import “subject template help” modal always showed **No subject templates found**, even though the tenant/branch had subject templates in the database.
- **Root cause**: Backend endpoint returned `{ data: Template[] , meta }`, but frontend treated it as the standard wrapper and effectively expected `{ data: { templates: Template[] }, meta }`. This mismatch made the UI read the wrong property and interpret the response as “empty”.
- **What slowed debugging**: We focused on branch context/stale `currentBranchId` hypotheses before verifying the **actual JSON response shape** returned by the endpoint, which would have immediately revealed the contract mismatch.
- **Fix pattern**:
  - First inspect the Network response payload and confirm it matches the frontend type expectations.
  - Ensure backend endpoints always follow the standard `{ data: T, meta? }` contract; if `T` needs multiple fields, make it an object (e.g. `{ templates: [...] }`) rather than returning a bare array.
- **Lesson**: When a UI shows an “empty state” but DB checks prove data exists, **validate the API contract shape first** (actual response body vs expected type), before deeper state/branch debugging.

### Portal defaulted to Arabic in incognito (column-level default + scattered hardcoded fallbacks)
- **Issue**: An English-speaking school (“Baghdad International School”) logged in as Arabic in incognito, even though nobody had chosen Arabic.
- **Root causes** (three layers, all had to be fixed):
  1. `profiles.preferred_locale` shipped as `VARCHAR(2) DEFAULT 'ar'`, so **every** account was born Arabic. The column also existed only as live-schema drift — there was no matching migration in the repo, so the default was invisible when reading migration files.
  2. Backend content services used `language: string = 'ar'` / `language ?? 'ar'` as the parameter default, so any request that omitted `language` got Arabic names.
  3. The frontend wrote `NEXT_LOCALE` **only when the cookie was absent**, so a stale cookie from a previous session or tenant beat the server-resolved language.
- **What slowed debugging**: reading migrations instead of the **live** column definition (`information_schema.columns.column_default`), and assuming a single culprit rather than checking DB default, backend fallbacks, and cookie logic independently.
- **Fix pattern**:
  - Make the personal preference **nullable with no column default**; put the default one level up (`tenants.default_locale NOT NULL DEFAULT 'en-GB'`). `NULL` then unambiguously means “inherit”.
  - Centralise resolution in one util per side (`backend/src/common/utils/locale.util.ts`, `frontend/src/lib/ui-locale.ts`) exporting `SYSTEM_DEFAULT_LOCALE` and `resolveEffectiveLocale(preferred, tenantDefault)`; delete every inline literal.
  - Return the resolved value from the server (`auth/me → effectiveLocale`) and **reconcile** the cookie (overwrite when different), never write-if-absent.
- **Lessons**:
  - **A column-level `DEFAULT` is a product decision, not a convenience.** For preference columns, prefer `NULL = inherit` over baking a value into the schema.
  - **Verify live schema, not just migrations**, when behaviour can’t be explained by repo state — drift hides defaults, constraints, and triggers.
  - **A “default” that appears in more than one place is a bug waiting to happen.** One exported constant, imported everywhere; a grep for the literal (`'ar'`, `'en-US'`) should return zero fallback sites.
  - When migrating a preference whose old value came from a DB default, you **cannot** distinguish deliberate choices from defaults — decide explicitly (we cleared legacy `'ar'` to `NULL`) and record the decision in the migration comment.
