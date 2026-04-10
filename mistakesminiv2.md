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