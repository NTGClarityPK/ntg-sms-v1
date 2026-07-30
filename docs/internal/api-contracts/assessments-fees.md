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

---

## Fees — templates, challans, payments

### Data fields (DB → API)

- **Fee templates** (`fee_templates`): `type` (`Fee` | `Discount`), `scope` (`Levels` | `Class` | `Class-Section` | `Individual`), `autoApply` (DB `auto_apply`), `autoApplyCondition` (DB `auto_apply_condition`), `daysUntilDue` (DB `days_until_due`), `isActive` (DB `is_active`). Billing uses **full-month** metric amounts only (no pro-rate modes).
- **Template metrics** (`fee_template_metrics`): `amountType` (`Absolute` | `Percentage`), `perDay` (DB `per_day`), `displayOrder` (DB `display_order`).
- **Assignments** (`fee_template_assignments`): `scopeType` (`Level` | `Class` | `Section`), `scopeId` (UUID).
- **Student template links** (`fee_student_template_links`): `startDate`, `endDate`, `isActive`.
- **Metric exclusions** (`fee_metric_exclusions`): `reason`, `excludedBy` (DB `excluded_by`).
- **Challans** (`fee_challans`): `challanNumber` (DB `challan_number`), `monthsIncluded` (DB `months_included`), `generationDate`, `dueDate`, `subtotal`, `totalDiscount`, `payableAmount`, `status`, `pdfUrl` (DB `pdf_url`), `receiptUrl` (DB `receipt_url`).
- **Challan items** (`fee_challan_items`): `billingMonth` (DB `billing_month`), `itemType` (`Fee` | `Discount`), `isDiscount`, `displayOrder`.
- **Payments** (`fee_payments`): `amountPaid`, `paymentDate`, `paymentMethod` (`Bank_Transfer` | `Cash` | `Online` | `Cheque`), `transactionReference` (DB `transaction_reference`), `proofDocumentUrl` (DB `proof_document_url`), `status` (`Pending_Review` | `Verified` | `Rejected`), `verifiedBy`, `verifiedAt`, `rejectionReason`.
- **Late fees** (`fee_late_fee_applications`): `appliedAutomatically` (DB `applied_automatically`), `daysOverdue`, `canBeWaived`, `waived`, `waivedBy`, `waivedAt`.

### Endpoints

All endpoints are **branch-scoped** (via `BranchGuard`) and return `{ data: ... }` (and `meta` only for paginated lists).

#### Templates

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/fees/templates` | Create template + metrics. |
| `GET` | `/api/v1/fees/templates` | List templates. Query supports filters like `scope`, `type`, `isActive`. |
| `GET` | `/api/v1/fees/templates/:id` | Template detail. |
| `PUT` | `/api/v1/fees/templates/:id` | Update template (including deactivate). |
| `DELETE` | `/api/v1/fees/templates/:id` | Delete template (restricted; historical challans should keep amounts via challan_items). |
| `POST` | `/api/v1/fees/templates/:templateId/assignments` | Link template to `Level`/`Class`/`Section` scope. |

#### Student fee configuration

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/fees/students/:studentId/templates` | Aggregated inherited + individual templates and current exclusions. |
| `POST` | `/api/v1/fees/student-template-links` | Link an individual template to student (optionally date-ranged). |
| `PUT` | `/api/v1/fees/student-template-links/:id` | Update link (e.g. deactivate). |
| `POST` | `/api/v1/fees/metric-exclusions` | Exclude a metric for a student. |

#### Challans

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/fees/challans/generate` | Generate one or many challans for `months[]` (supports multi-month). |
| `GET` | `/api/v1/fees/challans/:id` | Challan detail + items. |
| `GET` | `/api/v1/fees/challans/student/:studentId` | Student challans list. |
| `GET` | `/api/v1/fees/challans/my-students` | Parent portal list (only children via `parent_students`). |

#### Payments

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/v1/fees/payments` | Multipart upload proof; sets challan `Under_Review`. |
| `GET` | `/api/v1/fees/payments/pending-verifications` | Admin queue (status `Pending_Review`). |
| `GET` | `/api/v1/fees/payments/:id` | Payment + challan summary for review. |
| `PUT` | `/api/v1/fees/payments/:id/verify` | Verify payment; sets challan `Verified`; generates receipt. |
| `PUT` | `/api/v1/fees/payments/:id/reject` | Reject payment; sets challan back to `Pending_Payment`. |
| `GET` | `/api/v1/fees/payments/my-students` | Parent payment history. |
| `GET` | `/api/v1/fees/payments/export` | Admin export (Excel). |

#### Late fees

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/fees/late-fees/recent` | Report of recently applied late fees. |
| `PUT` | `/api/v1/fees/late-fees/:id/waive` | Waive an applied late fee and adjust challan totals. |

---

## Subscription & billing

Manual billing (no Stripe). Plans: `free`, `starter`, `pro`, `enterprise`. Limits enforced per **tenant** (all branches).

### Portal (`school_admin` for mutating billing)

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/api/v1/subscription/plans` | `{ data: PlanConfig[] }` |
| `GET` | `/api/v1/subscription/current-plan` | `{ data: { planId } }` |
| `GET` | `/api/v1/subscription` | `{ data: Subscription }` |
| `GET` | `/api/v1/subscription/usage` | `{ data: { usage, limits, planId } }` — query `refresh=true` recomputes usage |
| `POST` | `/api/v1/subscription/change-plan` | `{ data: ChangePlanResult }` — body `{ planId, billingCycle? }`. Paid upgrades with Stripe configured and amount &gt; 0 return `type: checkout_required` + `checkoutUrl` (plan applies after payment webhook). Without Stripe or zero amount, immediate `upgrade`. |
| `DELETE` | `/api/v1/subscription/pending-change` | `{ data: { message } }` |
| `GET` | `/api/v1/subscription/invoices` | `{ data: SubscriptionInvoice[], meta }` — paginated billing history |
| `GET` | `/api/v1/subscription/invoices/:invoiceId/download` | `{ data: { url } }` — signed PDF URL or Stripe hosted URL |
| `GET` | `/api/v1/subscription/payment-config` | `{ data: { stripeEnabled: boolean } }` — school admin |
| `POST` | `/api/v1/subscription/invoices/:invoiceId/checkout` | `{ data: { checkoutUrl, sessionId } }` — Stripe Checkout for open invoice |
| `GET` | `/api/v1/subscription/customer-portal` | `{ data: { url } }` — Stripe Billing Portal (saved cards) |
| `POST` | `/api/v1/subscription/webhooks/stripe` | Stripe webhook (no JWT; `stripe-signature` + raw body) |

Invoices are created automatically on paid-plan **upgrade**, **period renewal**, or **admin** generate. Amount = per-student rate × active students (see marketing pricing). Status aligns with Stripe (`open`, `paid`, etc.). `payment_provider`: `manual` \| `stripe`. Checkout stores `stripe_checkout_session_id` on the invoice while payment is in progress; webhook `checkout.session.completed` marks the invoice `paid` and records `billing_payment_events`.

### Admin (`super_admin`)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/v1/admin/subscriptions` | All tenants with subscription + usage |
| `PATCH` | `/api/v1/admin/subscriptions/invoices/:invoiceId` | Mark paid / void — body `{ status?, notes? }` |
| `PATCH` | `/api/v1/admin/subscriptions/:tenantId` | Manual override: `planId`, `billingCycle`, `status`, `notes`, `clearPending` |
| `POST` | `/api/v1/admin/subscriptions/:tenantId/sync-usage` | Recompute usage counters |
| `POST` | `/api/v1/admin/subscriptions/:tenantId/invoices` | Generate invoice for current period (idempotent) |

### Error codes (403 body)

- `SUBSCRIPTION_FEATURE` — feature not on current plan
- `SUBSCRIPTION_LIMIT` — `{ metric, limit, used }`
- `DOWNGRADE_NOT_ALLOWED` — `{ reasons: string[] }`
