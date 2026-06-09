# Teacher substitution — user guide

Short guide for staff who arrange cover when a teacher is absent.

## Who uses what

| Role | Typical access |
| --- | --- |
| **School admin / Principal / Academic coordinator** | Create and cancel substitutions, view history, export data |
| **Any teacher (substitute)** | See **My substitution assignments** and app notifications |
| **All staff with timetable access** | See **SUB** badges on the class timetable when cover is active |

Permissions are set under **Settings → Roles** (`teacher_substitution`).

---

## Where to find it

- **Substitution** in the main menu → tabs **Substitute** and **History**
- **Assign substitute** opens after you pick an absent teacher and date(s)
- **My substitution assignments** (`/substitution/me`) — for teachers who are covering someone else
- **Timetable** — turn on **Show substitutions (SUB)** and pick the week to see who is covering which period

---

## Substitute tab

### Quick substitute (today)

1. Choose the **absent teacher** and **absence reason** (sick leave, casual leave, emergency, other).
2. Click **Find substitute**.
3. On the assign screen, pick a cover teacher (see below).
4. Today’s assignments appear in the list at the bottom. Use the bin icon to **remove** a substitution (only if it is still more than **1 hour** before that period starts).

### Planned leave (date range)

1. Select the same absent teacher and reason.
2. Choose a **leave date range** (e.g. 1–10 May).
3. Click **Schedule substitutes**.
4. The system finds the same timetable periods on **each school day** in that range (matching day of week). Assign substitutes the same way as for a single day.

---

## Assign substitute screen

You will see:

- Absent teacher and date range
- **Affected periods** (class, section, subject, time)
- **Suggested substitutes** — ranked by fit (subject, free periods, recent load)
- **Other available teachers** — expand if you need more options

Each teacher row shows availability (available / partial / unavailable) and how many substitutions they already did this month. A **high load** warning appears if they are heavily used.

**Two ways to confirm:**

1. **Assign & notify** — assigns immediately and sends a notification to the substitute (recommended).
2. **Select** → then **Notify & confirm** at the bottom — use this if you want to compare options first.

After success you return to the Substitution page. The substitute receives a notification; a **reminder** may be sent about an hour later if needed.

---

## History tab

- Filter by **this week**, **this month**, or a **custom date range**
- Table of past substitutions (absent teacher, substitute, period, status)
- **Export CSV** for records
- **Substitution load** chart — shows how many times each teacher covered in the range; teachers over **10** substitutions in the month are flagged as overloaded
- Remove a row with the bin icon (same 1-hour rule as on the dashboard)

---

## Timetable (SUB badges)

On **Timetable**:

1. Enable **Show substitutions (SUB)**.
2. Pick the **week** you want to view.

Periods with active cover show the substitute’s name and a **SUB** badge for those dates only. The underlying timetable is not changed — this is display only.

---

## My assignments (substitute teachers)

Open **My substitution assignments** (or follow the link from a notification).

You see your upcoming cover: date, period, class, and who you are covering for. No action is required on this screen unless your school adds more steps later.

---

## Statuses (what they mean)

| Status | Meaning |
| --- | --- |
| **Confirmed** | Cover is set; substitute was notified |
| **Pending** | Rare in normal flow; may appear for older data |
| **Completed** | Period has passed |
| **Cancelled** | Removed before the period |

---

## Tips

- Prefer **Assign & notify** for a single clear choice; use **Select** only when you want to confirm at the bottom.
- If no substitutes appear, the absent teacher may have no classes that day, or everyone else is already busy.
- You cannot assign the absent teacher as their own substitute.
- The system blocks assigning someone who is already teaching that slot or is marked absent.

---

## Need help?

- **Cannot see Substitution** — ask an admin to grant `teacher_substitution` view/edit on your role.
- **Cannot remove a substitution** — cancellation is only allowed more than one hour before the period starts.
- **Notification not received** — check app notifications and that the substitute has a valid staff account.
