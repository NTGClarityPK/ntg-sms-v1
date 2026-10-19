# Admissions CRM — Cursor Implementation Prompts

These prompts build the Admissions CRM module for Alma, one feature section at a time.
Run them **in order** — later prompts depend on entities created in earlier ones.

Each prompt is written as business logic. Paste one prompt at a time into Cursor.

---

## READ THIS FIRST — Context for every prompt

> **Standing context — this applies to every prompt below. Read it once, keep it in mind for all of them.**
>
> We are building a new **Admissions CRM** module inside Alma. It captures a prospective
> student from the first enquiry all the way to becoming an enrolled student, replacing the
> WhatsApp-chats-and-Excel-sheets process schools use today.
>
> **The admissions pipeline (the stages a prospect moves through):**
> `Enquiry → Tour → Application → Documents → Entrance Test → Interview → Decision (Accept / Waitlist / Reject) → Offer → Fee Deposit → Enrolled`
>
> A prospect in this module is called a **Lead**. A Lead is NOT yet a student and the parent is
> NOT yet an Alma user — they only become real students/parents at the very end (Enrolment).
>
> **Rules that hold across the whole module — honour these everywhere:**
> 1. **Branch isolation.** Alma is multi-tenant and multi-branch. Every Lead belongs to exactly
>    one branch. A user only ever sees/acts on Leads for the branch(es) they have access to.
>    Never leak a Lead across branches.
> 2. **Bilingual + RTL.** Everything a parent sees (landing page, applicant portal, offer letter,
>    messages) must work in both English and Arabic, with correct RTL layout in Arabic.
> 3. **Parent-facing = mobile-first.** Parents do everything on a phone. Big buttons, camera
>    upload, minimal typing.
> 4. **Audit trail.** Every time a Lead changes stage, or a decision/document/payment action
>    happens, record who did it and when. This history is permanent.
> 5. **Nothing auto-sends in V1.** Where the doc says "sent to parent via WhatsApp/SMS/email,"
>    V1 means Alma *generates the message/link and shows a Send button / copy-to-clipboard*. We
>    are NOT integrating WhatsApp/SMS/email-provider APIs in V1. The officer sends it themselves.
>    Design the send-points as a pluggable step so real auto-send can drop in later (V2).
>
> **How I want you to work:** before writing code for each prompt, give me a short outline —
> what tables/entities you'll add or change, the main screens, and anything you're unsure about.
> I'll approve, then you build. Don't build the "Later (V2)" items — just don't design yourself
> into a corner that blocks them.

---

# PROMPT 1 — Lead Capture & Public Landing Page

> **Goal:** Give each school a public web page where a parent who clicked an "Apply / Admissions"
> link (from a Facebook ad, a flyer, a WhatsApp forward, the school website) lands, and can
> register their interest. This is how a stranger becomes a Lead in our system. No login,
> no Alma account — it's a public page.
>
> **What the parent does:**
> 1. Taps a shared link and lands on the school's branded admissions page (logo, colours, a hero
>    photo, a short blurb, and the list of classes currently accepting applications).
> 2. Fills a **Quick Enquiry Form** — just 3 fields: parent name, phone number, class interested in.
>    (30 seconds. The point is to capture the lead before they lose interest.)
> 3. Submits → immediately sees a thank-you screen with a **reference number** (e.g. `CRD-2026-0045`)
>    and reassurance that the school will be in touch. Alma also generates an SMS/email confirmation
>    message for the officer to send (per the standing context, V1 = generate + Send button, no auto-send).
>
> **What this creates in Alma:** a new **Lead** record for that branch, at stage **Enquiry**,
> stamped with where it came from (see Lead Source + Salesman tracking below).
>
> **Landing Page Editor (lives in Alma Settings, admin-only):** the school admin can customise
> their page with NO developer help — upload logo, pick colours, set the hero image, edit the
> blurb, and tick which classes are currently accepting applications. Each **branch has its own
> landing page and its own URL** (per-campus).
>
> **Short URL + QR Code:** each school/branch gets one clean shareable short URL and a
> downloadable, printable QR code (for gate banners, flyers, open-day posters). Scanning the QR
> opens the same landing page.
>
> ### Lead Source Tracking (important — this is how schools learn what's working)
> Every shared link can carry a **source tag** so we know what brought the lead. When the parent
> submits, we capture and store the source on the Lead. Examples: Facebook, flyer, website,
> WhatsApp. Mechanism: the tag rides along in the link (a URL parameter), the landing page reads
> it, and it's saved on the Lead silently. If a link has no tag, source = "Direct / Unknown".
>
> ### Salesman Link Generation & Tracking (build this carefully)
> The school owner/admin needs to see **which salesman brought which leads**. So:
> - In Admissions Settings, admin can register sales team members and assign each a short code
>   (e.g. salesman "Ali" = `001`).
> - Alma **generates a unique link for each salesman** — the same landing page, but the link
>   carries that salesman's code.
> - When a parent submits through that link, the Lead is permanently tagged with that salesman.
> - Later (dashboard/reports) we count leads and conversions **per salesman**. So store the
>   salesman reference as a proper relation on the Lead, not just free text — we'll aggregate on it.
> - A link can carry BOTH a source tag and a salesman code at once (e.g. Ali's Facebook link).
>   Capture both independently.
>
> ### Spam protection
> The enquiry form is public, so protect it: invisible CAPTCHA, basic rate-limiting per IP, and
> phone-number format validation. Goal is to keep junk out of the Leads board without adding
> friction for real parents.
>
> ### Rules & edge cases
> - Same phone submitting twice → don't create a duplicate Lead; attach the new enquiry to the
>   existing Lead and note it (we'll handle sibling detection separately later).
> - The reference number must be human-friendly and unique per branch.
> - Phone is the one required, validated field — everything hangs off it.
>
> ### Later (V2) — don't build now, just don't block it:
> Landing-page analytics (views, form start vs completion, drop-off, device, peak times),
> custom school domain (`admissions.schoolname.com`), Facebook Lead Ads webhook capture.

---

# PROMPT 2 — Admissions Leads Module (the officer's workspace inside Alma)

> **Goal:** Give the admissions team a dedicated place inside Alma to see and work every Lead.
> This is the internal counterpart to the public landing page from Prompt 1.
>
> **Add a new sidebar menu: "Admissions"** with these tabs: Pipeline, All Leads, Waitlist,
> Dashboard, Reports, Settings. (Waitlist, Dashboard, Reports, Settings get filled in by later
> prompts — set up the shell now.)
>
> ### Kanban Pipeline Board (the main screen)
> A drag-and-drop board. Each **column is a pipeline stage** (Enquiry, Tour, Application,
> Documents, Entrance Test, Interview, Decision, Offer, Fee Deposit — Enrolled leads leave the
> board). Each **card is a Lead** showing name, class, phone, source, days-in-stage, and the
> assigned officer. Officer drags a card to the next stage to move the Lead forward.
> - Live count at the top of each column (e.g. "Application — 12").
> - Moving a card = a stage change = write an audit entry (who, when, from→to).
> - Respect branch isolation: the board only shows the current branch's Leads.
>
> ### Lead Profile (click a card → full detail screen)
> One screen with everything about that Lead:
> - **Timeline** — every interaction and stage change in chronological order.
> - **Documents** — what's been uploaded, what's still missing (ties into Prompt 4).
> - **Communication Log** — see below.
> - **Internal Notes** — a notes area the admissions team uses for observations, concerns,
>   follow-up plans. **Never visible to the parent.**
> - Basic details, source, salesman, assigned officer, current stage.
>
> ### Communication Log — MANUAL logging via forms (not automatic)
> We do NOT auto-capture messages. Instead the officer manually records communications that
> happened, through two quick forms:
> - **Log WhatsApp** — opens a form: message content, date, and who it was with (recipient).
>   Save → appears in the timeline.
> - **Log Email** — opens a form: direction (sent or received), subject, from/to, date, and a
>   notes/body field. Save → appears in the timeline.
> Keep these as simple, fast forms. The value is a complete written history on the Lead, entered
> by hand.
>
> ### Filter & Search, and Export
> - Filter the Leads list by stage, source, salesman, class, assigned officer, and date range.
> - Search by name, phone, or email.
> - **Export to Excel** — whatever list is currently filtered can be downloaded as an .xlsx.
>
> ### Rules & edge cases
> - Assigning an officer to a Lead is a tracked action.
> - A Lead can only sit in one stage at a time.
> - Dragging backwards (e.g. Interview → Application) is allowed but must be audited — sometimes
>   schools re-open a step.
>
> ### Later (V2):
> Templated message library (one-click pre-written messages), bulk actions (select many Leads →
> move stage / message / export at once).

---

# PROMPT 3 — Tour Management

> **Goal:** Many schools invite the family in for a campus tour before they apply. Let the team
> schedule, confirm, and record tours against a Lead.
>
> **Flow:**
> 1. Officer opens a Lead at the Tour stage → **schedules a tour** (date + time slot).
> 2. Alma generates a **tour confirmation message** for the parent (date, time, address) — officer
>    sends it (V1 = generate + Send button, no auto-send).
> 3. On the day, officer **marks tour attendance** — did they actually show up? (Attended / No-show.)
> 4. Officer records **tour notes** — observations from the visit — saved on the Lead profile.
>
> ### Rules & edge cases
> - A no-show should be visible on the board (so the team can follow up), not silently dropped.
> - Rescheduling a tour keeps the history of the original slot.
>
> ### Later (V2):
> Automated tour reminder sent to the parent the day before (to cut no-shows).

---

# PROMPT 4 — Application & Documents (includes the Applicant Portal)

> **Goal:** Let the prospective parent fill the full application and upload documents —
> **even though they are NOT an Alma user yet.** This is the trickiest part: solving document
> upload and application for someone with no account.
>
> ### The Applicant Portal — a secure, zero-login portal via "magic link"
> This is the core of this prompt. The parent should never have to create an account or remember
> a password at this stage.
>
> **How it works:**
> - When a Lead reaches the Application stage, Alma generates a **unique secure link** tied to
>   that one Lead, and the officer sends it to the parent (WhatsApp/SMS/email — V1 = generate + Send).
> - The parent taps the link and lands in their **Applicant Portal** — a mobile-first page that
>   shows: their application status / where they are in the pipeline, a progress indicator, the
>   application form (fill + **save-and-resume**), and a documents section.
> - Through this same portal they will later also view the offer letter and pay the deposit
>   (those come in Prompts 7 and 9 — just know the portal is the parent's one home for everything).
>
> **Security — build this correctly, it's a public-internet door into a Lead:**
> - The link token must be **long and random** (unguessable — treat it like a password).
> - The token is tied to exactly ONE Lead. It can never list or browse other Leads.
> - HTTPS only. The token **expires** after a configurable period (default: end of the admissions
>   cycle + 90 days).
> - An officer can **revoke** a token (if the parent says the link leaked) and issue a fresh one.
> - Build an **optional** toggle (per school) for **phone OTP verification** before sensitive
>   actions — viewing the offer letter, downloading documents, paying. Default off; on for
>   high-security schools. (OTP generation can be stubbed as generate + Send in V1, same as other messaging.)
>
> ### Portal Link Recovery (parent lost the link)
> A public "retrieve my application" page: parent enters their phone number → Alma finds the Lead
> by phone, re-generates/re-sends the link. No password reset flow, because there's no password.
>
> ### Documents
> - Parent uploads from phone camera or gallery: birth certificate, child photo, previous report
>   cards, ID copies, vaccination record, etc.
> - **Required documents are configurable per class** (admin sets which docs are mandatory for
>   each class level in Settings).
> - **Missing Documents Alerts:** the officer's Lead Profile shows red/green ticks for exactly
>   which required docs are present vs missing, with a one-click "request missing document"
>   (generates a message for the parent).
> - Parent can **replace** a document the school rejected (e.g. blurry photo).
>
> ### Admin can fill on the parent's behalf
> For walk-ins or less tech-comfortable parents, the officer can fill the application form and
> upload documents from inside Alma, on the parent's behalf.
>
> ### Rules & edge cases
> - Save-and-resume: a half-finished application must persist, so the parent can come back via
>   the same link and continue.
> - Store uploaded documents against the Lead now; on enrolment they'll move to the student
>   record (Prompt 10) — so keep them in a form that can be transferred cleanly, not thrown away.
> - A rejected applicant's documents need a retention/cleanup policy — flag this to me; let's
>   decide how long we keep docs for Leads that never enrol.
> - The portal must degrade gracefully on a weak connection (parents on mobile data).

---

# PROMPT 5 — Entrance Test

> **Goal:** Schools test applicants before deciding. Manage scheduling, admit cards, attendance,
> and results.
>
> **Flow:**
> 1. Officer **schedules a test** for the applicant (date, time, venue).
> 2. Alma **auto-generates a branded Admit Card (PDF)** — school letterhead, applicant name, a
>    roll/seat number, date, venue — for the officer to send to the parent.
> 3. On test day, officer **marks test attendance** (who showed up) and can print a **roll list**
>    for the invigilator.
> 4. After marking, a teacher **enters each applicant's marks**.
> 5. Based on the school's **configurable pass cut-off**, Alma **auto-flags each applicant as
>    Passed or Failed**.
>
> ### Rules & edge cases
> - The pass cut-off is set per school (and ideally per class).
> - A no-show for the test should be clearly flagged, not treated as a fail — the school decides
>   what to do.
> - Admit card roll numbers must be unique within a test sitting.
>
> ### Later (V2):
> Multi-round testing (e.g. a written round plus a subject-specific round for senior classes).

---

# PROMPT 6 — Interview

> **Goal:** Record the parent/child interview step.
>
> **Flow:**
> 1. Principal or admissions head **schedules an interview slot**.
> 2. They record **interview notes** on the applicant profile.
> 3. They record an **outcome**: Recommend / Hold / Do not recommend. This feeds the Decision stage.
>
> ### Rules & edge cases
> - Keep notes and outcome separate — the outcome is a clean field we can report on later.

---

# PROMPT 7 — Decision & Offer

> **Goal:** Make the final call on each applicant and produce the offer.
>
> **Flow:**
> 1. Principal/admissions head makes a **three-way decision: Accept / Waitlist / Reject.** Logged
>    with timestamp and who decided.
> 2. On **Accept** → Alma **auto-generates a branded Offer Letter PDF**: school letterhead,
>    child's name, allocated class, fee breakdown, deposit amount, and the deadline to pay.
> 3. The offer is **delivered to the parent** (via the Applicant Portal + a Send message with a
>    payment link — V1 = generate + Send).
> 4. On **Reject** → a polite **rejection letter from a template**, and the **reason is recorded
>    internally** for the school's records.
> 5. On **Waitlist** → the Lead goes to the Waitlist (Prompt 8).
>
> ### Rules & edge cases
> - The offer letter's fee breakdown should pull from the fee quote logic (Prompt 9) so the
>   numbers always match.
> - A decision is a significant, audited action — capture who, when, and the reason.
> - The parent views the offer in their Applicant Portal (gated by OTP if that toggle is on).
>
> ### Later (V2):
> Offer expiry tracking and auto-reminders to the parent 2 days before the deadline.

---

# PROMPT 8 — Waitlist Management

> **Goal:** Hold Accept-able applicants when a class is full, in a fair, ordered queue.
>
> **V1 flow:**
> - Each class has an **ordered waitlist** showing position #1, #2, #3…
> - Officer can see and manually manage positions per class.
>
> ### Rules & edge cases
> - Position changes should be auditable even in V1 (who moved whom).
> - A waitlisted Lead is still a live Lead — it shouldn't disappear from the team's view.
>
> ### Later (V2):
> Auto-notify the top of the waitlist when a seat opens; a configurable response window
> (e.g. 48 hours) for them to accept; full waitlist audit trail of positions and acceptances.

---

# PROMPT 9 — Fee Deposit

> **Goal:** Collect the admission deposit that locks the seat. (V1 is manual bank-transfer +
> proof upload; no live payment gateway yet.)
>
> **Flow:**
> 1. Alma **auto-calculates the fee quote** based on the allocated class: admission fee +
>    first-month tuition + any sibling discount (sibling discount from Prompt 11).
> 2. Parent **uploads payment proof** (bank transfer receipt) from their phone, via the Applicant Portal.
> 3. Officer reviews and confirms → Alma **generates an official receipt PDF** shared with the parent.
> 4. On confirmation, the **seat is locked** for that student.
>
> ### Rules & edge cases
> - The fee quote must be the single source of truth the offer letter (Prompt 7) also uses.
> - "Seat locked" is a state that should prevent the seat being offered to someone else.
> - Keep payment-confirmation as its own audited step (officer confirms the money arrived).
>
> ### Later (V2):
> Online gateway payment (parent pays directly — depends on the payment-gateway module);
> fee-payment reminders 2 days before the deadline.

---

# PROMPT 10 — Enrolment Conversion (the hand-off into the real student system)

> **Goal:** Turn an accepted-and-paid Lead into a real enrolled student + a real Alma parent
> account, with zero re-typing and nothing lost. This is where a Lead stops being a Lead.
>
> **Flow:** officer clicks **"Enrol in Grade X, Section Y"** on the Lead → Alma does all of this
> as one operation:
> 1. **Creates the student master record** using all details already captured in the application
>    (no re-typing).
> 2. **Creates/activates the parent's real Alma parent-portal account** and generates login
>    credentials (sent via WhatsApp/email — V1 = generate + Send). The parent sets their password
>    via that link. From this moment the parent is a real Alma user and the Applicant Portal retires.
> 3. **Moves all uploaded application documents** onto the new student's profile.
> 4. **Preserves the full admissions history** as a permanent, searchable record linked to the student.
>
> ### Rules & edge cases — this one matters
> - **Make the conversion atomic.** If any step fails, the whole thing rolls back — we must never
>   end up with a half-created student, or a parent account with no student, or documents stranded.
>   Tell me your approach to this before building.
> - Don't duplicate a parent account if one already exists for this phone/email (sibling case —
>   see Prompt 11); link the new student to the existing parent instead.
> - After conversion the Lead leaves the pipeline board but stays fully searchable in history.

---

# PROMPT 11 — Sibling Management

> **Goal:** Recognise when an applicant's family already has a child in the school, and handle
> them accordingly.
>
> **V1 flow:**
> - **Sibling auto-detection:** when a Lead's parent phone/email matches an existing enrolled
>   student's parent, flag it clearly — e.g. "This parent already has a child in Grade 5."
> - **Sibling discount flag:** surface a discount option so the officer can apply it when
>   generating the fee quote (Prompt 9).
>
> ### Rules & edge cases
> - Matching is on parent phone/email — be careful with partial matches; prefer exact.
> - The flag should appear early (ideally at Enquiry) so the team treats the family right.
>
> ### Later (V2):
> Sibling fast-track — configurable per school, lets siblings of existing students skip the
> entrance test.

---

# PROMPT 12 — Owner Dashboard

> **Goal:** Give the school owner live admissions numbers on any device, any time — no phone
> calls to the office.
>
> **V1 screen:**
> - **Live admission numbers (this month):** enquiries, tours, tests, offers, paid, seats left —
>   at a glance.
> - **Conversion funnel visualisation:** how many Leads are at each stage and where they drop off.
> - Respect branch isolation — owner sees their branch; multi-branch roll-up is V2.
>
> ### Rules & edge cases
> - Numbers must be real-time (or near), and must reconcile with the pipeline board counts.
> - This is a read-only, glanceable screen — optimise it for a phone.
>
> ### Later (V2):
> Lead-source performance (ROI per campaign — ties into source + salesman tracking from Prompt 1),
> month-vs-month comparison, year-vs-year seasonal comparison (e.g. Sep 2027 vs Sep 2026),
> dashboard alerts (stale leads, expiring offers, low enquiry volume).

---

# PROMPT 13 — Multi-Branch Support

> **Goal:** Make sure everything built so far works cleanly for schools with multiple campuses.
> (Much of this you'll have honoured already via the branch-isolation rule — this prompt is to
> verify and complete it.)
>
> **V1:**
> - **Per-campus admissions pipeline:** each branch has its own independent pipeline, Leads board,
>   and admissions settings.
> - **Per-campus landing page:** each branch has its own landing page URL and branding (from Prompt 1).
>
> ### Rules & edge cases
> - A user with access to several branches should be able to switch between them, but never see
>   two branches' Leads mixed together.
> - Reference numbers, waitlist positions, and fee quotes are all scoped per branch.
>
> ### Later (V2):
> Combined owner view — a roll-up of all campuses' admissions in one dashboard.

---

# PROMPT 14 — Automation & Notifications

> **Goal:** Finish the audit trail (V1) and set up the ground for automated messaging (V2).
>
> **V1:**
> - **Full audit trail** across the module: every stage change, decision, document action, and
>   payment confirmation is logged with timestamp and user. (You've been writing these throughout
>   — this prompt is to make sure it's complete and viewable.)
>
> ### Later (V2):
> Automated SMS/WhatsApp reminders (tour, test, offer expiry, fee) replacing the manual Send
> buttons; templated communication library; in-app status-change notifications to the admissions team.

---

# PROMPT 15 — Reporting

> **Goal:** Let the school pull the numbers it needs.
>
> **V1:**
> - **Lead export to Excel** — any filtered list of Leads exportable at any time (you built the
>   core of this in Prompt 2; make sure it's available as a proper report too).
>
> ### Later (V2):
> Conversion funnel report (drop-off per stage with reasons), lead-source ROI report
> (cost-per-lead / cost-per-enrolment per source if ad spend is entered), admissions-officer
> performance report (leads handled, conversion rate, response time — uses the salesman/officer
> data from Prompt 1), rejection-reasons report (aggregated, to help the school improve).

---

## Suggested build order (quick reference)

1. Lead Capture & Landing Page  ← foundation: creates the Lead, source + salesman tracking
2. Admissions Leads Module  ← the officer's board + lead profile + manual comms log
3. Tour Management
4. Application & Documents  ← the Applicant Portal / magic link (security-critical)
5. Entrance Test
6. Interview
7. Decision & Offer
8. Waitlist Management
9. Fee Deposit
10. Enrolment Conversion  ← atomic hand-off into the real student system
11. Sibling Management
12. Owner Dashboard
13. Multi-Branch Support  ← verify isolation end-to-end
14. Automation & Notifications  ← complete the audit trail
15. Reporting

Build V1 for all sections first. V2 items are listed per prompt — tackle them once V1 is live
and stable.