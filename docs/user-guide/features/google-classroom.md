# 🏫 Google Classroom

**Product:** NTG Alma
**Feature:** Read-only Google Classroom grade and rubric sync
**Audience:** School staff

## 🔎 What this feature does
Alma can **connect to Google Classroom** (read-only) so teachers do not have to re-type marks that already exist in Classroom.

| Alma can… | Alma cannot… |
|-----------|--------------|
| Connect one Google account per branch | Push grades *back* into Classroom |
| Map Alma class/subject → Google course | Auto-sync on a schedule (pull is manual) |
| Link an Alma assessment → Google coursework | Replace Classroom as the place students submit work |
| Pull overall marks into Alma | Guess student identity without email matching |
| Import / refresh Google rubrics into Alma | Edit a Google-synced rubric inside Alma |
| Pull per-criterion (KTAC-style) rubric scores | Work without OAuth reconnect when scopes change |

**Rubrics** are included: Alma has its own rubric presets (e.g. Ontario KTAC), and when an assessment is linked to Classroom, **Google’s rubric becomes the source of truth** and is imported into Alma when needed.

---


## 📘 Using Google Classroom
### 👥 Who can do what

| Action | Typical roles |
|--------|----------------|
| Turn feature on/off, connect/reconnect Google, map courses | School admin, Principal |
| Link assessment, Pull grades, view sync status | Admin / Principal, or staff with **edit** on Google Classroom integration (e.g. academic coordinator, class/subject teacher) |
| Attach Alma rubrics (when *not* Google-linked) | Staff with assessment edit permission |
| Enter / edit student Google Account Email | Staff who manage students |

Exact permissions depend on your branch role setup (`google_classroom_integration` and `assessment_rubrics` features).

---

### 🏗️ One-time setup (admin)

Step A explains who is responsible for what. Steps B–E are done once per school branch.

#### Step A — Before connecting

- The school does **not** create Google Cloud credentials in the portal.
- A school Workspace administrator may need to allow NTG Alma if third-party apps are restricted.
- A school admin or principal connects one suitable Google account per branch.
- School staff then map courses and set students’ Google Account Email values.

#### Step B — Open Integrations

1. Go to **Settings**.
2. Open the **Integrations** section
   (`/settings?section=integrations`).

You will see two areas:

- **Google Classroom** — connection and course mappings
- **Rubric presets** — reusable marking templates (e.g. KTAC)

#### Step C — Enable the feature

1. Turn **Google Classroom** on with the feature toggle.
2. Until this is on, Connect and mappings stay hidden / blocked.

#### Step D — Connect Google

1. Click **Connect**.
2. Sign in with the Google account that can see your Classroom courses (usually a teacher or Workspace admin account for that school).
3. Approve the requested permissions (courses, coursework, rosters, submissions, profile emails — **read-only**).
4. You return to Integrations with a success or error message.
5. Optionally use **Test connection** to confirm Alma can list courses.
6. Use **Disconnect** if you need to switch accounts or refresh permissions (feature toggle stays as you left it).

**Tip:** If Google does not return a refresh token, disconnect Alma’s access in your Google Account security settings, then Connect again with consent.

**Which Google account should you connect?**

Alma stores **one** Google connection per branch, and every pull uses that account. Choose it deliberately:

- ✅ Use a **school Google Workspace for Education account** on the school’s own domain.
- ✅ Prefer a **stable institutional account** (e.g. `classroom-sync@yourschool.edu`) that has teacher access to the relevant courses — not a personal account belonging to one member of staff.
- ✅ The account must be able to see the courses you want to sync. Classroom only returns coursework, rosters and grades for courses the account teaches or administers.
- ❌ Avoid personal Gmail accounts, and avoid an individual teacher’s account that will be deactivated when they leave — the connection dies with the account and every mapping stops pulling.

**If your Workspace administrator restricts third-party apps**, they must allow the Alma app in **Google Admin console → Security → API controls** before Connect will succeed. A Workspace administrator can block any app regardless of whether Google has verified it. Marking Alma as **Trusted** there is the smoothest configuration.

#### Step E — Map Alma classes to Google courses

For each class + subject that uses Classroom:

1. In Integrations → Google Classroom → **Course mappings**.
2. Choose Alma **class section** and **subject**.
3. Choose the matching **Google course**.
4. Save.
   You can also use **Auto-suggest** for name-based matches (review carefully before relying on them).

**Important**

- Mapping is per **class section + subject**, not just class name.
- Use the **active academic year** class sections so you do not map last year’s “Class II – C” by mistake.
- One active mapping per Alma class-section + subject pair.

---

### 📧 Student Google Account Email

Classroom login emails are often **personal Gmail**, while Alma login emails are often **school domain**. Matching only on Alma login email fails.

**Fix:** on each student record, set **Google Account Email** to the address they use in Classroom (e.g. `student@gmail.com`).

Alma matching order:

1. Prefer **Google Account Email** when set.
2. Otherwise fall back to the student’s Alma profile email.

Without a correct match, Pull grades will sync overall marks for matched students only; unmatched Classroom emails appear in the pull result / failure counts.

---

### 📐 Rubric presets (Alma-side, optional)

In **Settings → Integrations → Rubric presets**:

- Browse global presets (e.g. **Ontario KTAC**: Knowledge, Thinking, Application, Communication).
- Create branch presets or edit category default marks.
- Category marks are **flexible starting points**, not a fixed official total.

Use this when you grade **inside Alma only**.
When an assessment is **linked to Google Classroom**, do **not** rely on editing the Alma rubric — Google wins (see below).

---

### 🗓️ Day-to-day: assessments & grades

#### Create / publish assessment as usual

Create the assessment in Alma for the correct class section, subject, and academic year. Set Alma **total marks** as you want them for reporting (e.g. 100). Attaching a rubric does **not** silently overwrite assessment total marks.

#### Link to Google Classroom

1. Open the assessment **Grade Entry** page.
2. If not linked, click **Link to Google**.
3. Alma loads coursework from the mapped Google course for that class + subject.
4. Pick the matching Classroom assignment / coursework.
5. Confirm.

After linking:

- Assessment `grading source` becomes Google Classroom.
- Sync status badge appears (last synced time).
- If Classroom has a rubric, Alma **imports it** (and replaces any previous Alma rubric for that assessment when the structure differs).
- The rubric on Grade Entry becomes **read-only**, with a note that it is synced from Classroom.

#### Enter / pull marks

**Option 1 — Pull from Classroom (recommended when linked)**

1. In Classroom, grade the assignment (overall and, if using a rubric, **per criterion**).
2. In Alma Grade Entry, click **Pull grades**.
3. If Alma already has marks, confirm overwrite.
4. Alma updates:
   - Overall marks (scaled to Alma total marks when both sides have valid maxima)
   - Rubric category scores when Google provides criterion grades and Alma categories are linked to Google criteria

**Option 2 — Manual entry in Alma**

- Still possible for category scores / overall marks depending on your workflow.
- For Google-linked assessments, prefer Pull so Alma stays aligned with Classroom.

#### Unlink

There is **no Unlink button in Grade Entry today**. If an assessment was linked to the wrong coursework, contact your Alma administrator/support rather than looking for a hidden UI action.

---

### 🔗 How rubrics work with Google (important)

Think of two modes:

| Situation | Who owns the rubric |
|-----------|---------------------|
| Assessment **not** linked to Google | You create/edit Alma rubrics (preset or custom) |
| Assessment **linked** to Google | **Google Classroom** owns the rubric |

When linked:

1. Build the rubric in **Classroom** (default or custom criteria).
2. Link (or Pull grades).
3. Alma fetches Google’s rubric and stores it.
4. Later Pulls **skip** the Google rubric API if nothing changed (saves quota).
5. If you change the rubric in Classroom (or add a custom one), the next Pull that detects a change **overrides** Alma’s copy.

**For category scores to appear in Alma**, teachers must grade **by criterion** in Classroom (not only an overall mark). Overall mark can sync without category breakdown; KTAC rows stay 0 until criterion grades exist.

---

### 📊 Statistics page (Status / Graded / Read)

On **Assessment → Statistics**, each student row shows:

| Column | Meaning |
|--------|---------|
| **Status** | Student engagement in Alma portal: Not started / In progress / Submitted (`student_assessment_statuses`) |
| **Graded** | Whether Alma has a grade with `graded_at` (includes grades created by Pull) |
| **Read** | Whether the student marked the assessment as read in Alma |
| **Last updated** | Latest of student status update **or** grade time |

So a student can be:

- **Graded** + **Unread** + **Not started** — common when marks came from Classroom but the student never opened Alma.

That is intentional: grading and “read in portal” are separate ideas.

---

### ✅ Suggested classroom workflow (checklist)

1. Admin enables feature and Connects Google.
2. Admin maps class/subject → Google course (active year).
3. Staff set **Google Account Email** on students.
4. Teacher creates Alma assessment + Classroom assignment.
5. Teacher **links** Alma assessment → Classroom coursework.
6. Teacher builds rubric in **Classroom** (if using categories).
7. Teacher grades in Classroom (overall + criteria).
8. Teacher **Pulls grades** in Alma.
9. Check Grade Entry (marks + KTAC) and Statistics (**Graded** column).

---

### ❓ Quick FAQ (users)

**Why did overall marks sync but KTAC stayed 0?**
Classroom only sent a total mark, or Alma had no Google criterion IDs yet. Grade by criterion in Classroom, then Pull again (and ensure the assessment is linked so the Google rubric can import).

**Why is Shaheer unmatched / missing?**
Set his **Google Account Email** to the Gmail used in Classroom, reconnect Google if profile email scope was missing, then Pull again.

**Can I edit the rubric in Alma after linking?**
No — it is read-only. Edit in Classroom; Pull will refresh Alma when the structure changes.

**Does Pull change Alma total marks (e.g. 100)?**
No. Assessment total marks stay as set in Alma. Google points can be **scaled** into that total when both maxima are known.

**Do I need to create the rubric twice?**
Not once linked. Create it in Classroom; Alma imports/overrides from Google. Alma presets are for non-linked (Alma-only) grading.

**Our Workspace blocks the connection.**
Ask your school Workspace administrator to allow NTG Alma under Google Admin → Security → API controls, then reconnect.

---


## 🆘 Troubleshooting
| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| Connect fails / no refresh token | Google omitted refresh token | Revoke Alma app access in Google Account → Connect again |
| Courses empty | Wrong Google account / feature off | Reconnect correct account; ensure feature enabled |
| Cannot link assessment | No mapping for class+subject | Create mapping for **active** academic year section |
| Pull: missing emails | Google permission or old connection | Reconnect the branch Google account, then pull again |
| Pull: unmatched students | Email mismatch | Set **Google Account Email** on student |
| Overall mark OK, KTAC 0 | No criterion grades or Alma rubric not Google-linked | Grade by criterion in Classroom; Pull (triggers import if needed) |
| Rubric not updating after Classroom edit | Structure unchanged or pull skipped fetch | Change criteria in Classroom; Pull again; check fingerprint / criterion IDs in submissions |
| Statistics shows Not started but Graded | Expected | Graded comes from grades; Status/Read from portal engagement |
| Access blocked by Google | Workspace policy | Ask the school Workspace administrator to allow NTG Alma, then reconnect |
| Connection repeatedly expires | Connection needs operator attention | Reconnect once; if it repeats, contact Alma support |

---


## ⚠️ Limitations & design choices
1. **Read-only** — Alma never writes grades or rubrics back to Classroom.
2. **Manual pull only** — no cron auto-sync (by design, to control API usage and teacher timing).
3. **One Google connection per branch** — not per-teacher OAuth.
4. **Google rubric is authoritative when linked** — Alma editing disabled to avoid drift.
5. **No assessment Unlink button** — contact your Alma administrator/support if coursework was linked incorrectly.
6. **Turning the feature off** hides Google actions but does not remove existing mappings or grades.
7. **Auto-suggest** is heuristic (name similarity); always verify mappings.

---

For operator setup and OAuth details, contact your NTG Alma administrator.

