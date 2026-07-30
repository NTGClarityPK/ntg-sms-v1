# 🧩 Class

Class × section combinations for the branch — capacity, status, and class teacher.

## 📋 Overview

**Path:** Sidebar → **Management → Setup → Class** (`/academic/class-sections`)
**Page title:** **Class**

Permission feature: `class_sections`. Defaults: edit for principal and academic coordinator (school admin bypasses); view for many teaching roles; none for parent/student.

Classes and section **names** are created under **Settings** first; this page builds the **combinations**.

---

## 🧩 Class-section matrix

The grid shows every class × section pair (ordered by Settings sort order).

| Card state | Meaning |
| --- | --- |
| **Active** / **Inactive** | Combination exists |
| **Not created** | Combination missing |

Existing cards also show student count vs capacity and the assigned **Class Teacher** when set.

If no classes or sections exist yet: **Please create classes and sections first before creating class-sections.**

---

## ✏️ Actions (edit permission)

| Action | Effect |
| --- | --- |
| **Create All ({count})** | Creates every missing combination (default capacity **30** each) — confirm with **Create All** |
| **Edit** | Change capacity and Active / Inactive |
| **Assign Teacher** / **Change Teacher** / unassign | Set the class teacher for that combination |
| **Delete** | Remove a combination (blocked while students are still enrolled — move or remove students first) |

View access still allows **View Students** and read-only capacity / teacher / status.

There is no separate “create one missing cell” button on this page — creation is via **Create All**.

---

## ⚙️ Classes and sections in Settings

1. Open **Settings → Academic** (academic years / academic settings area).
2. **Classes** tab → **Add class** — class name, display name, sort order.
3. **Sections** tab → **Add section** — section name.
4. Return to **Class** and run **Create All** for new combinations.

---

## 💡 Tips & Best Practices

- Define class and section catalogues in Settings before term start, then **Create All** once.
- Set class teachers here so Results and teacher dashboards resolve the right sections.
- Lower capacity only when the room or policy requires it — default is 30.

---

## 🆘 Troubleshooting

**Create All disabled or missing:** You need edit permission on class sections.

**Cannot delete:** Remove or reassign enrolled students first.

**Empty page message about creating classes/sections:** Add them under Settings, then refresh Class.
