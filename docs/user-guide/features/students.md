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
| **Active** | Enrolled and active |
| **Pending verification** | Account invited, setup incomplete |
| **Link expired** | Invitation expired — resend from **Users** |

Row actions (edit permission): edit modal, **Emergency contacts**, re-invitation flows where applicable.

---

## ➕ Create and edit

**Create student** opens the modal form: identity, class section, contacts, enrolment fields, and invitation options as shown.

**Subject Template (optional)** on the form places the pupil in a stream/group (e.g. Science vs Commerce). Templates are created under **Settings → Academic → Subject templates** — see [⚙️ Settings & Configuration](settings-and-configuration.md). Leave blank when the class does not use streams.

Enrolment outcomes used elsewhere (e.g. leaving certificates, promotion): **Graduated**, **Transferred out**, **Withdrawn**, **Inactive**, etc.

---

## 📤 Bulk import

**Path:** **Students → Bulk import** (edit permission required)

1. Open **Bulk import**
2. Download template if offered
3. Fill spreadsheet
4. Upload — review validation errors and fix rows
5. Re-import failed rows

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
**Parent cannot see child:** Confirm Mapping association for this branch.
**Subject template dropdown empty:** Create templates under **Settings → Academic → Subject templates** and assign them to the student’s class or level.
