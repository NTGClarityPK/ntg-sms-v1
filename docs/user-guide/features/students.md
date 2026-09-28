# 🎓 Students

Student records for the current branch — list, modal edit, bulk import, and links to guardians.

## 📋 Overview

**Path:** Sidebar → **Students**

There is **no** separate student detail page — open a row to edit in a **modal** on the list.

---

## 👥 Student list

| Control | Behaviour |
| --- | --- |
| Search | Name / ID (debounced) |
| Class / section filters | Multi-select |
| Sort | Column sort (e.g. created date) |
| Pagination | 20 per page |

### Status badges

| Status | Meaning |
| --- | --- |
| **Active** | On the school roster — included in attendance, assessments, and other modules |
| **Inactive** | Withdrawn / deactivated by staff — hidden from operational rosters |
| **Pending verification** | Invitation sent; pupil **cannot log in** until they set a password. Still **Active** on the roster unless staff deactivate them |
| **Link expired** | Setup link expired (login removed) — re-invite from the row. Roster **Active** status is unchanged unless staff deactivate them |

**System active vs login ready:** Bulk import and invitation create set the student **Active** for school operations immediately. Portal login stays blocked until password setup completes (`Pending verification`).

Row actions (edit permission): edit modal, **Emergency contacts**, re-invitation flows where applicable.

### Bulk deactivate

1. Click **Deactivate** (edit permission required)
2. Tick the students to deactivate (only **Active** rows are selectable; use the header checkbox for the current page)
3. Click **Deactivate selected** and confirm

Inactive students leave operational rosters. You can set a student back to **Active** from the edit modal.

---

## ➕ Create and edit

**Create student** opens the modal form: identity, class section, contacts, enrolment fields, and invitation options as shown.

**Subject Template (optional)** on the form places the pupil in a stream/group (e.g. Science vs Commerce). Templates are created under **Settings → Academic → Subject templates** — see [⚙️ Settings & Configuration](settings-and-configuration.md). Leave blank when the class does not use streams.

Enrolment outcomes used elsewhere (e.g. leaving certificates, promotion): **Graduated**, **Transferred out**, **Withdrawn**, **Inactive**, etc.

---

## 📤 Bulk import

**Path:** **Students → Bulk import** (edit permission required)

1. Open **Bulk import**
2. **Export students** (optional) — downloads current branch pupils in the same column layout as the import template, so you can edit and re-upload
3. Or download the blank template and fill it (enter **phone** and **dates** as text; the template formats those columns as text)
4. Upload — spare blank rows at the bottom are ignored. Review row errors and warnings (e.g. username cleaned, role spelling matched)
5. Edit cells if needed (this clears Validated — press **Validate** again), then import
6. After import, a **status modal** shows counts: added, updated, unchanged, failed inserts, failed updates (with row list)
7. If anything failed, download the **results spreadsheet** (Import Status column; failed rows highlighted). Fix failed rows and re-import the same file — rows marked **added** / **updated** / **unchanged** are skipped

Match key remains portal **username**. New students get invitations after create succeeds. Student setup invitations are not resent on update; parent-account invitations still follow the create/resend rules below when **Create Parent Account** is yes.

**On update (re-import of an existing username):** blank optional fields **clear** the stored value (phone, address, dates, blood group, medical notes, Google email, class/section/template). Changing **class**, **section**, or **subject template** is blocked if the pupil already has **attendance** or **assessment grades** for that academic year.

**Parent linking (create and update):** set **Create Parent Account** to yes and provide **Parent Email** (optional name, phone, relationship). Alma creates or reuses the parent user and adds the Mapping → Parent–Student link. Already-linked pairs are left as-is (no error). A parent invite is sent for newly created parents, or when their unused invite has expired.

Optional spreadsheet columns (same as the create modal where relevant): **address**, **blood group**, **medical notes**, **admission date**, and **Google Account Email**. Leave blank on a new row if unused; leave blank on an update to clear.

Not a separate permission flag in the UI — requires students **Edit** and the route.

---

## 🔗 Related

- Link guardians: [🔀 Mapping](mapping.md) → Parent–Student
- Parent view: [👨‍👩‍👧 Parent Associations](parent-associations.md) → **My Child**
- PIN for student login: [🔐 Authentication & Access](authentication-and-access.md) → **PIN Management**
- Class placement: [🧩 Class](class-sections.md), [🎯 Promotion & Placement](promotion-and-placement.md)
- Subject streams: [⚙️ Settings & Configuration](settings-and-configuration.md) → Subject templates

---

## 🆘 Troubleshooting

**Empty list:** Wrong branch or no active academic year.
**Bulk import missing:** Need students **Edit** permission.
**Couldn't find required column(s):** Headers must include Username, First Name, Last Name, and Gender — download the template for exact labels.
**Cannot change class/section/template:** The pupil already has attendance or grades for that year; change placement only when those records do not exist (or use a supported transfer process later).
**Parent cannot see child:** Confirm Mapping association for this branch.
**Subject template dropdown empty:** Create templates under **Settings → Academic → Subject templates** and assign them to the student’s class or level.
