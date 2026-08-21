# 🔀 Mapping

Link parents to students and teachers to class sections — the Setup home for both association types.

## 📋 Overview

**Path:** Sidebar → **Management → Setup → Mapping**

| Tab | Permission feature | Typical editors (defaults) |
| --- | --- | --- |
| **Parent–Student** | `parent_associations` | Principal, admin assistant (+ school admin) |
| **Teacher–Class** | `teacher_mapping` | Principal, academic coordinator (+ school admin) |

Only tabs you can view appear. If neither is allowed: **Access denied**.

Legacy URLs redirect here:

- Parent associations → **Mapping** with Parent–Student tab
- Teacher mapping → **Mapping** with Teacher–Class tab

Parents manage day-to-day child views on **My Child**, not on Mapping. See also [👨‍👩‍👧 Parent Associations](parent-associations.md).

---

## 👪 Parent–Student

### List

Columns: **Parent Name**, **Student Name**, **Student ID**, **Relationship**, **Priority**, **Phone**, **Can Approve**, **Actions**.

Filters: search by parent name, email, or student name; filter by parent; filter by student.

### Create association

1. Click **Create Association**.
2. Choose **Parent**, **Student**, **Relationship** (**Father**, **Mother**, or **Guardian**).
3. Set **Can approve requests** (on by default).
4. Save.

**Rules:**

- Maximum **two** guardians per student — a third is blocked (**Maximum 2 guardians reached**).
- First link = **Primary** (priority 1); second = **Secondary** (priority 2).
- Duplicate parent–student pairs are rejected.
- **Edit** only changes **Can approve requests** — not parent, student, relationship, or priority.
- Approval access feeds leave and early departure workflows for that child.

### Remove

Use row actions to remove a link when the association is no longer valid.

---

## 👩‍🏫 Teacher–Class

### Views

- **List View** — filter by class section, subjects, teacher; edit teacher or delete assignment.
- **Matrix View** — rows = class sections, columns = subjects; cells can hold several teachers.

### Create assignment

1. Click **Create Mapping** (dialog: **Create Teacher Assignment**).
2. Required: **Class-Section**, **Subject**, **Teacher**.
3. Eligible teachers are active staff with class teacher or subject teacher roles.

Matrix: use **+** to add another eligible teacher to a cell; remove to unassign. Filters include showing only rows/columns that already have an assignment.

**Curriculum control:** A subject can only be mapped for a class when it belongs to a [subject template](settings-and-configuration.md) assigned to that class or its level. Cells for subjects outside that curriculum show a disabled **+** (for example Accounting on a Primary class that only has a Primary Core template). **Create Mapping** lists only subjects that apply to the class-section you choose.

**Edit** on a list row changes the assigned teacher only.

View-only users may still see action buttons; the server rejects mutations without **edit** permission.

---

## 👪 Mapping vs My Child

| | **Mapping** | **My Child** |
| --- | --- | --- |
| Audience | School staff | Parents |
| Purpose | Create / edit / remove links and teaching assignments | View linked children, approval badge, published results |
| Child session | No | Header child switcher for acting as a child |

**My Child** does not create associations.

---

## 💡 Tips & Best Practices

- Add both guardians early so approval and PIN setup work for either parent.
- Finish Teacher–Class mapping before expecting **My Schedule** or Results class lists to look complete.
- Prefer Matrix view when staffing a whole year group at once.

---

## 🆘 Troubleshooting

**Cannot save a third guardian:** Limit is two per student — remove or replace an existing link.

**Teacher missing from picker:** User must be active staff with a teaching role on **Users**.

**Cannot assign a subject on Matrix / Create Mapping:** Check **Settings → Academic → Subject templates** — the subject must be in a template assigned to that class or its level.

**Parent cannot see a child:** Confirm the association on **Parent–Student** for the current branch.
