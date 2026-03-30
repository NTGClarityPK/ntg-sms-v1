## Compact Lessons - Common Mistakes (Use as Rules) — v2

### Mantine v7 Radio “checked” indicator invisible (custom CSS override)
- **Issue**: Radio buttons worked functionally (value changed) but the circle stayed empty/white — no filled “checked” indicator in the UI (e.g. resend invitation modal).
- **Cause**: Our theme CSS injection in `DynamicThemeProvider.tsx` targeted old selectors like `.mantine-Radio-input:checked + .mantine-Radio-radio`, which don’t match Mantine v7’s DOM/state model. Mantine v7 uses root `data-*` attributes (e.g. `data-checked`, `data-disabled`) instead of relying on an adjacent sibling selector from the hidden input.
- **Fix**: Update the injected CSS to style based on Mantine v7 state attributes:
  - `.mantine-Radio-root[data-checked] .mantine-Radio-radio { ... }`
  - `.mantine-Radio-root[data-disabled] ...`
  - Ensure the inner indicator (`.mantine-Radio-inner` / `.mantine-Radio-icon`) remains visible.
- **Lesson**: When overriding Mantine components globally, **verify selectors against the exact Mantine version’s rendered markup**. Prefer stable state selectors (`[data-checked]`, `[data-disabled]`) over fragile `input:checked + ...` patterns, and keep a quick visual QA checklist for form controls after theme changes.