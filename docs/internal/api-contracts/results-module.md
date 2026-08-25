# API contracts — Results module (Report Cards)

This section documents the **Results** HTTP API (portal label: **Report Cards**). All successful JSON responses follow `{ data: T, meta?: … }` unless noted.

## Taxonomy (`result_cards`)

| Field | Description |
| --- | --- |
| `reportKind` | `term_report` \| `annual_report` (legacy only) \| `progress_report` |
| `termPhase` | For `term_report`: `mid_term` \| `final` for new cards. Legacy rows may still have `interim`. Null for other kinds. |
| `progressSequence` | For `progress_report`: **calendar month 1–12** (not an auto-increment sequence). Null otherwise. |
| `resultType` | Legacy column; kept for transition; maps to historical snapshots. |

**Uniqueness (Postgres partial indexes)**

- Term: one row per `(student_id, class_section_id, academic_year_id, term_phase)` where `report_kind = term_report`.
- Annual: one row per `(student_id, class_section_id, academic_year_id)` where `report_kind = annual_report` (legacy; **new creates rejected**).
- Progress: one row per `(student_id, class_section_id, academic_year_id, progress_sequence)` where `report_kind = progress_report`.

## Lifecycle

- **Generate** (`POST /api/v1/results/generate`): upserts snapshot JSON in `result_data`, sets `status` to **`draft`** (including regenerate). **`annual_report` is rejected.** Term cards must use `mid_term` or `final` (not `interim`). Progress requires `progressSequence` 1–12 (month).
- **Publish** (`PATCH /api/v1/results/:id/status` with `status: published`): parents see only `published` rows when `publishedOnly` is enforced.
- **Unpublish** (`PATCH .../status` with `status: draft`): clears `approved_by` / `approved_at`; remarks editable again; parents lose visibility.
- **Comment** (`PATCH /api/v1/results/:id/comment`): **blocked** with **403** when `status = published`.

## Interim PDF banner (display only)

For **term** PDFs, the server resolves a **display** phase:

- Identifies mid/final exams via `assessment_types` with `is_term_examination = true` and name containing `mid` / `final`.
- If every enrolled student has grades for all exams of the selected Status (`mid_term` / `final`), the PDF banner uses Mid-term / Final.
- Otherwise the banner uses **Interim**. Stored `term_phase` remains what staff selected.

Marks readiness uses the same phase-exam rule (not all assessments).

## Endpoints

### `GET /api/v1/results/class-section/:classSectionId`

Roster + aggregated marks. Query: `academicYearId?`, `resultType` (`interim` \| `mid_term` \| `final`), optional **`progressMonth`** (1–12) to scope assessments to that calendar month (due date, else created date).

### `GET /api/v1/results/class-section/:classSectionId/cards`

List result cards for the section. Query: **`academicYearId` (required)**, `resultType` (term phase for term reports), **`reportKind`**, optional **`progressSequence`** (1–12) for progress month filter.

### `GET /api/v1/results/class-section/:classSectionId/marks-readiness`

Per-student missing **mid/final term examination** grades for the selected `resultType`. Query: `academicYearId?`, `resultType`.

### `GET /api/v1/results/class-section/:classSectionId/bulk-pdf`

ZIP of **basic** (summary) term PDFs. Query: `academicYearId?`, `resultType`. **Limits:** max **60** students.

### `GET /api/v1/results/student/:studentId/cards`

Query: `academicYearId?`, `resultType?`, **`reportKind?`**, `publishedOnly?`. Parents implicitly get `publishedOnly=true`.

### `GET /api/v1/results/student/:studentId/result-card/pdf`

Query: **`classSectionId` (required)**, `academicYearId?`, `resultType`, **`reportKind?`**, optional **`progressMonth`** (1–12 for progress), `reportType` (`basic` \| `detailed`), **`pdfVariant?`** (`minimal` \| `modern`).

**Detailed PDF:** For `term_report` + `resultType=final`, or legacy **`annual_report`**, the server may build the **two-page mid-term + final** detailed view. Progress with `progressMonth` uses month-scoped marks.

**Summary cards:** PDF builders include **Conduct** (behavioural average / framework label for the report date window) and **Attendance** (`present/total (pct%)` via `AttendanceService.getAttendanceSummaryByStudent`). Empty → `—`.

### `GET /api/v1/results/student/:studentId/monthly-pack/attendance/pdf`

Query: **`month`** (1–12 required), `academicYearId?`. Auth: `ensureUserCanAccessStudent`. **Gate:** published `progress_report` with matching `progress_sequence` month. Compact attendance summary PDF for that calendar month.

### `GET /api/v1/results/student/:studentId/monthly-pack/behaviour/pdf`

Same gate/query as attendance pack. Month-filtered behavioural PDF (`allowEmpty` — empty-state PDF if no ratings).

### `POST /api/v1/results/generate`

Body: `studentId`, `classSectionId`, `academicYearId?`, **`reportKind?`** (default `term_report`; **`annual_report` rejected**), **`resultType?`** (required for term; `mid_term` \| `final`), **`progressSequence?`** (**required** 1–12 for progress).

### `PATCH /api/v1/results/:id/status` / `PATCH /api/v1/results/:id/comment`

Status: `draft` \| `approved` \| `published`. Setting `draft` after publish = unpublish. Comment patch forbidden when published.

### `GET` / `PUT /api/v1/results/report-settings`

Branch-scoped PDF defaults (`pdfVariant`). **GET** is available to any authenticated branch user. **PUT:** school admin or principal only.

### Deliveries

`GET` / `POST /api/v1/results/cards/:resultCardId/deliveries` — only when card is `published`.

## Parent portal

Published cards remain visible to authorised parents under My Child. Unpublishing hides them until published again.

**Monthly pack (1B):** Published Progress months show three downloads — Academic (existing result-card PDF), Attendance, Behaviour (monthly-pack endpoints above). Term Mid/Final remain single academic downloads (with Conduct + Attendance on the PDF).
