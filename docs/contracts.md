# API contracts (selected)

## Assessments — term examinations and schedule

### Data fields

- **Assessment types** (`assessment_types`): `isTermExamination` (boolean, API camelCase; DB `is_term_examination`).
- **Assessments** (`assessments`): `roomNumber` (optional string; stored only when the type is a term examination; cleared server-side when the type is not). For term examinations, `dueDate` is the **exam start** (ISO **date-time**, `TIMESTAMPTZ`). `examinationDurationMinutes` (optional positive integer, max 720) stores length in minutes; **end time is derived** as start + duration (not stored). Non–term examinations use `dueDate` as the assignment due instant and leave `examinationDurationMinutes` null. `allowLateSubmission` is forced **false** for term examinations on create/update.

### Endpoints

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/assessments/examination-schedule` | Paginated list of **published** assessments whose type has `isTermExamination: true`. Query: pagination, `academicYearId`, `classSectionId`, `subjectId`, `startDate`, `endDate`. Response: `{ data: Assessment[], meta }`. |
| `GET` | `/api/v1/assessments/examination-schedule/export/pdf` | PDF for the same filter set as the schedule list (server uses up to 500 rows). Optional query `language`: `en`, `en-GB`, `en-US`, `ar`. |
| `GET` | `/api/v1/assessments/my/examination-schedule` | Same shape as staff schedule, for the **current user’s student** context (parent portal). |
| `GET` | `/api/v1/student/assessments/examination-schedule` | Student JWT: `{ data: Assessment[] }` (published term exams for that student). |

Create/update assessment payloads accept optional `roomNumber` (max length per DTO); `dueDate` as full ISO instant when time is used.
