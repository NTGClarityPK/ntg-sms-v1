> **Historical — removed.** The `super_admin` role, email-domain privilege escalation (`ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION`), and Admin Portal were removed from NTG Alma. This migration note is kept for reference only.

# Privileged access migration (email-domain → `super_admin` role)

**Related:** Deep scan Phase 2 C5, Phase 3 M7, FIX_PLAN Part A Section 3.

## What changed

Platform / admin privilege is no longer granted because an email ends in `@ntg.com`, `@ntgclarity.com`, `@example.com`, or `@superuser.com`.

Privilege requires the **`super_admin`** role in `user_roles` (resolved at JWT auth time).

Inactive branch and tenant checks apply to **everyone**, including `super_admin`.

## Temporary env flag

```env
ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION=false
```

- **Default / production:** `false` — legacy email domains do **not** elevate.
- **Migration only:** set to `true` temporarily so legacy emails still work while you assign DB roles. Every use logs a Nest **WARN**.

Code: `backend/src/common/utils/privileged-access.util.ts`.

## Pre-deploy checklist

1. Identify ops accounts that previously relied on `@ntg.com` / `@superuser.com` email suffixes.
2. Ensure each has a `super_admin` row in `user_roles` (and an appropriate `user_branches` row if they use branch-scoped APIs).
3. Deploy with `ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION=false` (or omit the variable).
4. Smoke-test: legacy email **without** `super_admin` behaves as a normal school user.
5. Smoke-test: `super_admin` against an inactive tenant/branch is denied or falls back — not silently allowed.

### Example SQL pattern (adjust IDs)

```sql
-- Look up role id
SELECT id FROM roles WHERE name = 'super_admin';

-- Assign (example — use real user_id / branch_id for your env)
INSERT INTO user_roles (user_id, role_id, branch_id)
VALUES ('<user-uuid>', '<super_admin-role-uuid>', '<branch-uuid>');
```

## Step B (future)

Remove `ALLOW_EMAIL_DOMAIN_PRIVILEGE_ESCALATION`, `hasLegacyEmailDomainPrivilege`, and all callers that pass empty roles solely to trigger the legacy path.
