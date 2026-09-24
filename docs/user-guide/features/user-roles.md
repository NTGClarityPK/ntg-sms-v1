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
| **Active** | Included in school operations (and can sign in once setup is done) |
| **Inactive** | Deactivated by an administrator — hidden from operational pickers |
| **Pending verification** | Invitation sent; **cannot sign in** until password setup. Staff remain usable in mappings and lists while pending |
| **Link expired** | Setup link expired — use **Resend invitation**. Staff stay in the system unless deactivated |

**System active vs login ready:** New staff from create/bulk import are system-active immediately. Portal login stays blocked until they complete the invitation link.

### Login identifiers

- **Staff** — often `username@school-domain` from invitation setup
- **Parents** — their own email
- **Students** — school-issued credentials; parents manage PINs on [🔐 Authentication & Access](authentication-and-access.md) → **PIN Management**

Invited users complete account setup at **`/setup?token=…`** (see Authentication guide).

### Actions (edit permission)

Create user, bulk import, edit roles, activate/deactivate, resend invitation, view linked students for parents.

### Bulk import

**Path:** **Users → Bulk Import** (edit permission required)

1. Open **Bulk Import** and download the template (includes an **Allowed Roles** sheet)
2. Fill rows:
   - **Full Name** (required)
   - **Roles** — use exact portal role names from the Allowed Roles sheet (comma-separated for multiple). After upload, fix roles with the **Roles** multiselect in the preview (avoids typos such as “Sub Teacher”)
   - **Staff:** **Username** (required) + **Invitation Email** (optional — blank uses the school login email)
   - **Parents:** **Email** (login and invitation)
3. Upload the file, edit the preview if needed, then **Validate**
4. **Import** creates accounts and sends invitation emails

Do **not** import the **student** role here — use [🎓 Students](students.md) → **Bulk import** for student accounts. Parent and staff roles cannot be mixed on the same row.

**Bulk import missing:** Need **user_management** **Edit** permission.

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
**Bulk Import missing:** Need **user_management** **Edit** permission.
**Student role rejected on Users import:** Use **Students → Bulk Import** instead.
