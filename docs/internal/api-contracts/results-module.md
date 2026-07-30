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

---

# API contracts — Revenue report

Aggregates **collected** revenue across registered sources. **Roles:** `school_admin`, `principal`, `super_admin`. Guards: `JwtAuthGuard`, `BranchGuard` (header `x-branch-id` still required; scope selects which branches are aggregated).

## Extensibility

New modules add a `RevenueSourceProvider` implementation and register it in `ReportsModule` (`REVENUE_SOURCE_PROVIDERS`). Example future key: `uniform_inventory`.

## Revenue sources (v1)

| `sourceKey` | Data | Included when |
| --- | --- | --- |
| `fee_management` | `fee_payments` where `status = Verified`, sum `amount_paid` by `payment_date` | Tenant plan has `hasFeeManagement` |
| `id_card_reprints` | `id_card_reprints` where `fee_charged > 0`, by `printed_at` (fallback `created_at`) | Always enabled |

## `GET /api/v1/reports/revenue`

Query:

| Param | Values |
| --- | --- |
| `scope` | `current` (header branch only), `branch` (`branchId` required), `combined` (all branches user can access in tenant) |
| `branchId` | UUID — required when `scope=branch`; must be in `user_branches` |
| `startDate` / `endDate` | ISO dates (`YYYY-MM-DD`), required |
| `detail` | `summary` (default) \| `detailed` — line-level fee payments and ID reprint fees |
| `locale` | Optional (`en-GB`, `en-US`, `ar`) for export labels |

Response `data`:

```ts
{
  scope: 'current' | 'branch' | 'combined';
  startDate: string;
  endDate: string;
  grandTotal: number;
  detailMode: 'summary' | 'detailed';
  sources: Array<{ sourceKey: string; enabled: boolean; total: number; transactionCount: number }>;
  byBranch: Array<{ branchId: string; branchName: string; total: number; sources: Record<string, number> }>;
  feeManagement?: { byPaymentMethod: Array<{ methodKey: string; total: number }> };
  feeLines?: Array<{ id: string; personName: string; paymentMethodKey: string; amount: number; paymentDate: string; challanNumber?: string; branchName?: string }>;
  idCardLines?: Array<{ id: string; personName: string; personType: string; amount: number; eventDate: string; cardNumber?: string; branchName?: string }>;
  branding?: { schoolName: string; branchSubtitle: string };
}
```

## `GET /api/v1/reports/revenue/export`

Same query params plus `format` (`pdf` \| `excel`, default `pdf`). Returns file download.

---

# API contracts — School data export (Phase 1)

Branch header required. Access: `school_admin` or `super_admin` only.

## `GET /api/v1/data-export/status`

Returns `{ data: { canExport, lastExportAt, nextAvailableAt, lastScope } }`.

- Rate limit: **one successful export per tenant per 24 hours** (`canExport: false` until `nextAvailableAt`).

## `POST /api/v1/data-export`

Body (JSON):

| Field | Type | Notes |
| --- | --- | --- |
| `accountPassword` | string | Re-authentication; not stored |
| `backupPassword` | string | Min 12 chars; upper, lower, digit, symbol |
| `confirmBackupPassword` | string | Must match `backupPassword` |
| `scope` | `tenant` \| `branch` | Tenant = all active branches; branch = current branch only |
| `acknowledgedWarning` | boolean | Must be `true` |

Response: **binary ZIP** (`application/zip`), not JSON. Archive contains AES-encrypted `school-data.json.enc`, `.meta`, and `README.txt`. ZIP is password-protected with `backupPassword`.

Excluded from export: auth credentials, push subscriptions, invitation tokens, internal job queues, storage bucket files, and denylisted column names (passwords, tokens, API keys, Stripe secrets).

---

# API contracts — ID Cards module

Branch-scoped. JSON responses: `{ data: T, meta?: … }`. Access: `school_admin`, `principal`, or `super_admin` (feature code `id_cards` for permission matrix).

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/id-cards` | Paginated list. Query: `personType`, `status`, `classSectionId` (or `classId` + `sectionId`), `search`, `missingPhotoOnly`, pagination. |
| `GET` | `/api/v1/id-cards/stats` | Counts: issued, pending, missingPhotos, draft. |
| `GET` | `/api/v1/id-cards/analytics` | Total cards, issued, reprint count/rate. |
| `GET` | `/api/v1/id-cards/templates` | Active templates for branch. Query: `roleType?`. |
| `GET` | `/api/v1/id-cards/card-data/:personType/:personId` | Render payload for preview (not persisted). |
| `GET` | `/api/v1/id-cards/verify/:cardNumber` | QR verification (minimal fields). |
| `POST` | `/api/v1/id-cards/photos` | Multipart `file`, `personType`, optional `personId`, `matchKey` (filename → roll/employee id). |
| `POST` | `/api/v1/id-cards/generate` | Body: `personType`, `personIds?`, `classSectionId?`, `templateId?`. Upserts draft cards. |
| `POST` | `/api/v1/id-cards/generation-jobs` | Enqueue bulk generation (worker). Returns `{ jobId }`. |
| `GET` | `/api/v1/id-cards/generation-jobs/:jobId` | Job status + progress. |
| `POST` | `/api/v1/id-cards/bulk-pdf` | Body: `cardIds[]`, `layout?` (`single` \| `a4_9up`). Returns ZIP. |
| `PATCH` | `/api/v1/id-cards/status` | Body: `status`, `cardIds[]`. Bulk status update. |
| `GET` | `/api/v1/id-cards/:id` | Single card. |
| `GET` | `/api/v1/id-cards/:id/pdf` | PDF stream. Query: `side?` (`front` \| `back` \| `both`). |
| `POST` | `/api/v1/id-cards/:id/reprint` | Body: `reason`, `feeCharged?`. Sets `is_reissued`, logs reprint. |

## Storage

- Bucket: `id-card-assets` (public URLs for photos/PDFs).
- Card size: CR80 85.6mm × 54mm via Puppeteer HTML templates under `backend/src/modules/id-cards/templates/`.

---

# API contracts — Certificates module

Branch-scoped. JSON responses: `{ data: T, meta?: … }`. Feature code: `certificates` (`view` / `edit` in permission matrix). Designs are fixed: **award** (landscape, sports/academic/promotion/participation/custom) and **administrative** (portrait, leaving/character). `custom` type supports editable title, subtitle, citation parts, signature labels, optional certificate number override, and show/hide toggles for distinction badge and certificate number (`certificateData` fields).

## Endpoints

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/certificates/designs` | view+ | Two design families and supported types. |
| `GET` | `/api/v1/certificates/settings` | edit | Branch branding settings. |
| `PUT` | `/api/v1/certificates/settings` | edit | Update logo URL, primary colour, tagline, signatory names. |
| `POST` | `/api/v1/certificates/settings/logo` | edit | Multipart logo upload. |
| `POST` | `/api/v1/certificates/generate-preview` | edit | Body: `{ studentId, certificateType, certificateData }` → `{ html }`. |
| `POST` | `/api/v1/certificates/issue` | edit | Body: `{ studentId, certificateType, certificateData }` → issued record + PDF. |
| `GET` | `/api/v1/certificates/history` | view+ | Paginated list. Query: `type`, `studentId`, `classSectionId`, `status`, `startDate`, `endDate`. |
| `GET` | `/api/v1/certificates/history/export` | edit | CSV download (same filters). |
| `PUT` | `/api/v1/certificates/:id/revoke` | edit | Sets `status` to `revoked`. |
| `GET` | `/api/v1/certificates/:id/pdf` | view+ | PDF stream (revoked includes CANCELLED watermark). |
| `GET` | `/api/v1/my-certificates` | student/parent view | Own / children's issued certificates. |
| `GET` | `/api/v1/my-certificates/:id/pdf` | student/parent view | Download if issued (revoked blocked). |
| `GET` | `/api/v1/student/certificates` | student JWT | Student self-service list. |
| `GET` | `/api/v1/student/certificates/:id/pdf` | student JWT | Student self-service PDF. |

## Business rules

- **Leaving:** `student_enrolments.status` ∈ `transferred_out`, `withdrawn`, `graduated` for active academic year.
- **Other types:** active enrolment required.
- **Certificate number:** `CERT-{year}-{seq}` via `allocate_certificate_number` RPC.
- **Storage:** bucket `certificate-documents`, path `{branchId}/{certificateId}.pdf`.

---

# API contracts — Teacher substitution

Branch-scoped substitute assignments for absent teachers. Feature code: `teacher_substitution`. Requires `JwtAuthGuard` + `BranchGuard`.

**Roles:** `school_admin` bypasses matrix; `principal` / `academic_coordinator` need **edit** via `role_permissions`; teachers need **view** for history or use `GET /me` without matrix.

## Notification type

- `teacher_substitution` — push deep-link `/substitution/me`
- Reminder uses same type with `data.isReminder: true`

## Endpoints

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/substitutions/suggest` | edit | Body: `absentTeacherId`, `date` (ISO date). Returns `{ data: { absentTeacherId, absentTeacherName, date, affectedSlots[], suggested[], others[] } }`. |
| `POST` | `/api/v1/substitutions/assign` | edit | Body: `absentTeacherId`, `substituteTeacherId`, `date`, `timetableSlotIds[]`, `absenceReason` (`sick_leave` \| `casual_leave` \| `emergency` \| `other`). Creates one row per slot; `status: confirmed`; notifies substitute. Returns `{ data: { substitutionIds[] } }`. |
| `GET` | `/api/v1/substitutions` | view | List. Query: `date?`, `startDate?`, `endDate?`, `status?`, pagination. Returns `{ data, meta }`. |
| `GET` | `/api/v1/substitutions/history` | view | Same as list (alias for history UI). |
| `GET` | `/api/v1/substitutions/history/export` | edit | CSV download. Same query filters as list. |
| `GET` | `/api/v1/substitutions/load-stats` | edit | Query: `startDate`, `endDate`. Returns `{ data: [{ staffId, staffName, substitutionCount, isOverloaded }] }` (`isOverloaded` when count > 10). |
| `GET` | `/api/v1/substitutions/me` | authenticated staff | Substitute’s own assignments. Query: date range / pagination. |
| `PATCH` | `/api/v1/substitutions/:id/cancel` | edit | Cancel if more than 1 hour before period start. |

## Errors

| Code | When |
| --- | --- |
| `400` | Past date; invalid slots; same teacher as substitute |
| `403` | Missing permission; cancel outside allowed window |
| `409` | Duplicate slot/date; substitute busy; substitute absent; monthly load > 8 on assign |
| `404` | Staff / substitution not found |
