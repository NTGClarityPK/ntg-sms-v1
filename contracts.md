# API contracts — Results module (revamp)

This section documents the **Results** HTTP API after the report taxonomy and settings work. All successful JSON responses follow `{ data: T, meta?: … }` unless noted.

## Taxonomy (`result_cards`)

| Field | Description |
| --- | --- |
| `reportKind` | `term_report` \| `annual_report` \| `progress_report` |
| `termPhase` | For `term_report`: `interim` \| `mid_term` \| `final`. Null for other kinds. |
| `progressSequence` | Integer sequence for `progress_report`; null otherwise. |
| `resultType` | Legacy column; kept for transition; maps to historical snapshots. |

**Uniqueness (Postgres partial indexes)**

- Term: one row per `(student_id, class_section_id, academic_year_id, term_phase)` where `report_kind = term_report`.
- Annual: one row per `(student_id, class_section_id, academic_year_id)` where `report_kind = annual_report`.
- Progress: one row per `(student_id, class_section_id, academic_year_id, progress_sequence)` where `report_kind = progress_report`.

## Lifecycle

- **Generate** (`POST /api/v1/results/generate`): upserts snapshot JSON in `result_data`, sets `status` to **`draft`** (including regenerate).
- **Publish** (`PATCH /api/v1/results/:id/status` with `status: published`): sets published state; parents see only `published` rows when `publishedOnly` is enforced.
- **Comment** (`PATCH /api/v1/results/:id/comment`): **blocked** with **403** when `status = published`.

## Endpoints

### `GET /api/v1/results/class-section/:classSectionId`

Roster + aggregated marks for a term phase. Query: `academicYearId?`, `resultType` (`interim` \| `mid_term` \| `final`).

### `GET /api/v1/results/class-section/:classSectionId/cards`

List result cards for the section. Query: **`academicYearId` (required)**, `resultType` (term phase for term reports), **`reportKind`** (`term_report` \| `annual_report` \| `progress_report`; default `term_report`).

### `GET /api/v1/results/class-section/:classSectionId/marks-readiness`

Per-student list of assessment titles missing grades for the in-scope assessments used by the class results view. Query: `academicYearId?`, `resultType`.

### `GET /api/v1/results/class-section/:classSectionId/bulk-pdf`

ZIP of **basic** term PDFs. Query: `academicYearId?`, `resultType`. **Limits:** max **60** students; internal chunk size **3** PDFs at a time (see `ResultsService`). Behaviour: if one PDF fails, the whole ZIP operation may fail (synchronous path).

### `GET /api/v1/results/student/:studentId/cards`

Query: `academicYearId?`, `resultType?`, **`reportKind?`**, `publishedOnly?`. Parents implicitly get `publishedOnly=true`.

### `GET /api/v1/results/student/:studentId/result-card/pdf`

Query: **`classSectionId` (required)**, `academicYearId?`, `resultType`, **`reportKind?`** (default `term_report`), `reportType` (`basic` \| `detailed`), **`pdfVariant?`** (`minimal` \| `modern`). If `pdfVariant` is omitted, branch **`result_report_settings.pdf_variant`** is used for **basic** layout merge.

**Detailed PDF:** For `term_report` + `resultType=final`, or for **`annual_report`**, the server builds the **two-page mid-term + final** detailed view. Other term phases use a single detailed page.

### `POST /api/v1/results/generate`

Body: `studentId`, `classSectionId`, `academicYearId?`, **`reportKind?`** (default `term_report`), **`resultType?`** (required unless `reportKind` is `annual_report`), **`progressSequence?`** (optional; server allocates next if omitted for progress).

### `PATCH /api/v1/results/:id/status` / `PATCH /api/v1/results/:id/comment`

Existing shapes; comment patch forbidden when published.

### `GET` / `PUT /api/v1/results/report-settings`

Branch-scoped PDF defaults (`pdfVariant`, `progress_max_assessments`, `progress_window_days`). **Roles:** school admin, super admin, or principal only.

### `GET /api/v1/results/cards/:resultCardId/deliveries`

### `POST /api/v1/results/cards/:resultCardId/deliveries`

Body: `deliveryMethod` (`email` \| `sms` \| `portal_download` \| `printed`), optional `recipientContact`, `deliveryStatus`, `metadata`. **Only when parent card is `published`.** Intended for future messaging / audit aggregates.

## Grading, attendance, behaviour (source of truth)

- **Letter grades:** `class_grade_assignments` + `grade_ranges` (same path as portal / `getLetterGradeRanges`).
- **Attendance / behaviour on PDFs:** reuse existing attendance and behavioural services as described in the implementation plan (no duplicate grading tables).

## Progress report defaults

Server-side snapshot selection for `progress_report` follows configured **`progress_max_assessments`** and **`progress_window_days`** on `result_report_settings` when implemented in generation logic; defaults remain as product defaults until overridden per branch.

## Parent portal vs delivery

Published cards remain visible to authorised parents regardless of delivery rows; **`result_card_deliveries`** is additive metadata for “sent / printed / downloaded” style tracking.
