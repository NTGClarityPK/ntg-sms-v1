# 🛠️ Admin Portal

Operations console for **NTG platform administrators** (super-admin), not day-to-day school staff.

## Who this is for

- Super Admin / NTG operations accounts only

## Where to find it

Admin portal routes (separate from the school portal sidebar), including:

- Tenants
- Payment models
- Unlock academic year
- Assign branch
- Audit trail (also linked from school admin contexts where enabled)

## What you can do

| Area | Purpose |
|------|---------|
| **Tenants** | Create/update schools; set organisation fields including **default locale** |
| **Payment models** | Configure commercial/payment model options used by billing |
| **Unlock academic year** | Unlock a locked academic year when a school needs corrections |
| **Assign branch** | Operational branch assignment helpers |
| **Audit trail** | Review sensitive administrative actions |

## Default language (tenants)

Tenant/organisation **default locale** can be set from Admin → Tenants (as well as from the school Settings → Business Information for school admins). Options: English (UK), English (US), Arabic. See [Settings & Configuration](settings-and-configuration.md).

## Security note

Admin portal actions are privileged. Use named ops accounts with `super_admin` roles — do not rely on legacy email-domain elevation flags in production.

## Related

- [Audit Trail](audit-trail.md)
- [Billing & Subscription](billing.md)
- [Settings & Configuration](settings-and-configuration.md)
