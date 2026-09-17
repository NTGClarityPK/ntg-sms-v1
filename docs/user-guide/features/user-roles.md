# 👥 User Roles

Users, roles, and branch-scoped permissions that drive the sidebar and actions.

## 📋 Overview

| Concept | Behaviour |
| --- | --- |
| **Roles** | One user can hold several roles (except parent + staff mix — not allowed) |
| **Permissions** | Per **branch**: **None**, **View**, or **Edit** per feature |
| **Sidebar** | Hidden if None; actions disabled or hidden if View only |
| **Plan** | Some modules also need subscription features (fees, library, inventory, behavioural) |

School admin bypasses the permission matrix.

Configure under **Settings → Permissions** — tabs **Assign Access** and **Role Access View**.

---

## 👤 Users

**Path:** Sidebar → **Users** (Staff menu redirects here)

### Filters and list

- Search by name or email
- **Role** multi-filter
- Status chips: **All**, **Active**, **Inactive**
- Sortable columns; paginated (20 per page)

### Account statuses

| Badge | Meaning |
| --- | --- |
| **Active** | Can sign in |
| **Inactive** | Deactivated |
| **Pending verification** | Invited, not finished setup |
| **Link expired** | Invitation expired — use **Resend invitation** |

### Login identifiers

- **Staff** — often `username@school-domain` from invitation setup
- **Parents** — their own email
- **Students** — school-issued credentials; parents manage PINs on [🔐 Authentication & Access](authentication-and-access.md) → **PIN Management**

Invited users complete account setup at **`/setup?token=…`** (see Authentication guide).

### Actions (edit permission)

Create user, edit roles, activate/deactivate, resend invitation, view linked students for parents.

---

## 🧩 Roles in NTG Alma

Examples (UI spelling):

- School Admin, Principal, Academic Coordinator, **Admin Assistant**
- Class Teacher, Subject Teacher
- **Guidance Counselor** (US spelling in the portal)
- Parent, Student

---

## 🛡️ Permissions matrix

**Settings → Permissions → Assign Access**

- Rows: roles (except school admin)
- Columns: features (Dashboard, Students, Users, Mapping, etc.)
- Values: **None** / **View** / **Edit**

**Role Access View** summarises edit/view/none counts per role with filters.

Special rules:

- **Parent** and **Student** rows: staff-only features are **disabled** (locked to None).
- **Class Teacher**, **Subject Teacher**, **Academic Coordinator**, **Admin Assistant**, and **Guidance Counselor** rows: family-personal features (**My Assessments**, personal timetable/events where applicable) are **disabled**. **School Admin** and **Principal** are exempt from this staff-side lock.
- Saving permissions clears any old grants. The sidebar also hides cross-audience tabs even if a legacy grant remains.
- **Student** leave requests: class picker on the same tab limits which classes students may raise leaves for
- Family personal tabs stay available where intended (**My Assessments**, **My Certificates**, **My Events**, etc.)

---

## 👪 Parent and child context

Parents switch child session from the **header child switcher**, not from **My Child** alone. See [👨‍👩‍👧 Parent Associations](parent-associations.md).

**My-* portal views** (when permitted):

| View | Path |
| --- | --- |
| My Child | `/my-children` (from Dashboard; not in sidebar) |
| Report Cards (parent) | `/my-report-cards` |
| My Assessments | `/my-assessments` |
| My Timetable | `/my-timetable` |
| My Events | `/my-events` |
| My Certificates | `/my-certificates` |
| My Fees | **Fees** (parent tab) |
| My Schedule | `/my-schedule` (teachers) |

---

## 🆘 Troubleshooting

**Module visible but buttons missing:** Permission is **View**, not **Edit**.
**Users page hidden:** No **user_management** access.
**Cannot mix parent and staff on one account:** Create separate users.
