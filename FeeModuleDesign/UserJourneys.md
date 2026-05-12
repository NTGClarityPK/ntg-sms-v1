# NTG Alma Fee Management - User Journeys

**Document Version:** 1.0  
**Last Updated:** May 5, 2026  
**Purpose:** Complete user journey documentation for fee management module covering all scenarios

---

## Table of Contents

1. [Journey 1: Initial Fee System Setup](#journey-1-initial-fee-system-setup)
2. [Journey 2: Monthly Challan Generation (Standard Flow)](#journey-2-monthly-challan-generation-standard-flow)
3. [Journey 3: Mid-Month Student Admission (Pro-Rating)](#journey-3-mid-month-student-admission-pro-rating)
4. [Journey 4: Metric Exclusion for Individual Student](#journey-4-metric-exclusion-for-individual-student)
5. [Journey 5: Staff Child Discount (Auto-Apply)](#journey-5-staff-child-discount-auto-apply)
6. [Journey 6: Parent Pays Fee & Uploads Proof](#journey-6-parent-pays-fee--uploads-proof)
7. [Journey 7: Admin Verifies Payment](#journey-7-admin-verifies-payment)
8. [Journey 8: Late Fee Application](#journey-8-late-fee-application)
9. [Journey 9: Multi-Month Payment](#journey-9-multi-month-payment)
10. [Journey 10: Fee Template Modification](#journey-10-fee-template-modification)
11. [Journey 11: Payment History Review](#journey-11-payment-history-review)
12. [Journey 12: Exception Handling - Payment Rejection](#journey-12-exception-handling---payment-rejection)

---

## Journey 1: Initial Fee System Setup

**Actor:** School Admin (Mr. Ahmed - Accounts Manager)  
**Goal:** Set up fee structure for the entire school for the first time  
**Frequency:** One-time (beginning of academic year)  
**Duration:** ~2 hours

### Preconditions
- School has defined levels (Junior, Middle, Senior)
- Classes and sections are already created in system
- Admin has `school_admin` role

### Steps

#### Step 1.1: Create Base Fee Template for Junior Level
**Business:** Ahmed creates a template called "Junior Level Monthly Fee" that includes tuition (10,000 PKR), transport (2,000 PKR), and library fee (500 PKR).

**Dev Notes:** 
```
POST /api/v1/fees/templates
Body: {
  name: "Junior Level Monthly Fee",
  type: "Fee",
  scope: "Levels",
  pro_rate_type: "Full_Month",
  days_until_due: 30,
  metrics: [
    { name: "Tuition Fee", amount_type: "Absolute", amount: 10000 },
    { name: "Transport Fee", amount_type: "Absolute", amount: 2000 },
    { name: "Library Fee", amount_type: "Absolute", amount: 500 }
  ]
}
```
- System validates unique template name per organization
- Template saved with organization_id from JWT token
- Each metric gets UUID and links to template

---

#### Step 1.2: Create Additional Templates for Other Levels
**Business:** Ahmed repeats process for Middle Level (15,000 PKR total) and Senior Level (18,000 PKR total).

**Dev Notes:**
- Same API endpoint, different template names
- Metrics can differ per template
- System enforces unique names via database constraint

---

#### Step 1.3: Create Lab Fee Template for Science Sections
**Business:** Science sections need extra lab fee (3,000 PKR). Ahmed creates "Science Lab Fee" template scoped to Class-Section.

**Dev Notes:**
```
POST /api/v1/fees/templates
Body: {
  name: "Science Lab Fee",
  type: "Fee",
  scope: "Class-Section",
  pro_rate_type: "Full_Month",
  days_until_due: 30,
  metrics: [
    { name: "Lab Fee", amount_type: "Absolute", amount: 3000 }
  ]
}
```

---

#### Step 1.4: Create Staff Discount Template
**Business:** Children of staff members get 50% discount. Ahmed creates "Staff Child Discount" with auto-apply enabled.

**Dev Notes:**
```
POST /api/v1/fees/templates
Body: {
  name: "Staff Child Discount",
  type: "Discount",
  scope: "Individual",
  auto_apply: true,
  auto_apply_condition: { parent_has_role: "staff" },
  metrics: [
    { name: "Staff Discount", amount_type: "Percentage", amount: 50 }
  ]
}
```
- auto_apply flag triggers background detection
- Condition stored as JSONB for flexibility

---

#### Step 1.5: Link Templates to Scopes
**Business:** Ahmed links "Junior Level Monthly Fee" to Junior level, "Science Lab Fee" to all science sections (8-A, 8-B, 9-A, 9-B).

**Dev Notes:**
```
POST /api/v1/fees/templates/{templateId}/assignments
Body: {
  scope_type: "Level",
  scope_id: "junior-level-uuid"
}
```
- Creates template_assignment records
- Links template to level/class/section
- Multiple assignments allowed per template

---

### Expected Outcome
✅ 5 templates created (3 base level fees, 1 lab fee, 1 discount)  
✅ All templates linked to appropriate scopes  
✅ System ready for monthly challan generation

### Edge Cases
- **Duplicate template name:** System rejects with error message
- **Invalid scope_id:** Foreign key constraint prevents invalid links
- **Metric amount = 0:** Validation error (must be > 0)

---

## Journey 2: Monthly Challan Generation (Standard Flow)

**Actor:** School Admin (Mr. Ahmed)  
**Goal:** Generate May 2026 fee challans for entire Grade 9-A class  
**Frequency:** Monthly (1st of every month)  
**Duration:** ~5 minutes

### Preconditions
- Templates are created and linked
- Students enrolled in Grade 9-A
- It's May 1, 2026

### Steps

#### Step 2.1: Navigate to Fee Tab → Challan Management
**Business:** Ahmed opens Fee tab, clicks "Challan Management" sub-tab, selects Grade 9-A from dropdown.

**Dev Notes:**
- Frontend loads class roster with student list
- Shows student name, parent name, staff badge (if applicable), current fee status
- Uses GET /api/v1/classes/{classId}/students

---

#### Step 2.2: Select Bulk Generation
**Business:** Ahmed checks "All Students" checkbox, selects month "May 2026", sets due date to "Auto Calculate" (will be May 31).

**Dev Notes:**
```
UI State:
- student_ids: [array of all 30 student UUIDs in 9-A]
- months: ["2026-05"]
- auto_calculate_due_date: true
```

---

#### Step 2.3: Generate Challans
**Business:** Ahmed clicks "Generate Challans". System processes for 10 seconds. Success message appears: "30 challans generated successfully".

**Dev Notes:**
```
POST /api/v1/fees/challans/generate
Body: {
  student_ids: ["uuid1", "uuid2", ...],
  months: ["2026-05"],
  auto_calculate_due_date: true
}

Backend Process (for each student):
1. Get student details (class, section, level)
2. Find applicable templates:
   - Junior Level Monthly Fee (Level scope)
   - Science Lab Fee IF section is science (Section scope)
   - Staff Discount IF parent is staff (Individual auto-apply)
   - Sibling Discount IF has siblings (Individual auto-apply)
3. Get metric exclusions for student (if any)
4. Calculate:
   - Base fees: Sum all Fee template metrics (not excluded)
   - Discounts: Stack multiplicatively
   - Payable = Base × (1 - D1%) × (1 - D2%)
5. Generate challan number (CHL-2026-001234)
6. Calculate due date (May 1 + 30 days = May 31)
7. Create challan record (status: Pending_Payment)
8. Create challan_items for each metric
9. Generate PDF (save to Supabase Storage)
10. Return challan with pdf_url
```
- Transaction wrapped for atomicity
- If any fails, rollback entire batch
- Parallel processing for performance (Promise.all)

---

#### Step 2.4: Review Generated Challans
**Business:** Ahmed sees updated roster. Each student now shows status "Pending Payment 🟡" with "Download Challan" button.

**Dev Notes:**
- Frontend refetches student list
- Shows challan status from challans table
- Download button links to pdf_url

---

### Expected Outcome
✅ 30 challans generated with unique numbers  
✅ Each student has downloadable PDF  
✅ Status shows "Pending Payment"  
✅ Due date set to May 31, 2026

### Edge Cases
- **Student has no applicable templates:** Skip student, log warning
- **Calculation results in negative amount:** Error (shouldn't happen with validation)
- **PDF generation fails:** Retry 3 times, then mark for manual review

---

## Journey 3: Mid-Month Student Admission (Pro-Rating)

**Actor:** School Admin (Mr. Ahmed)  
**Goal:** Enroll new student Ahmed Hassan who joins on May 15 (mid-month)  
**Frequency:** As needed  
**Duration:** ~3 minutes

### Preconditions
- Ahmed Hassan enrolled as student in system
- Daily pro-rate template exists OR admin will create custom
- It's May 15, 2026

### Steps

#### Step 3.1: Create Daily Pro-Rate Template (if not exists)
**Business:** Ahmed creates special template "Daily Pro-Rate Fee" with per-day amounts: Tuition 333 PKR/day, Transport 67 PKR/day.

**Dev Notes:**
```
POST /api/v1/fees/templates
Body: {
  name: "Daily Pro-Rate Fee",
  type: "Fee",
  scope: "Individual",
  pro_rate_type: "Daily_Pro_Rate",
  days_until_due: 30,
  metrics: [
    { name: "Tuition Fee", amount_type: "Absolute", amount: 333, per_day: true },
    { name: "Transport Fee", amount_type: "Absolute", amount: 67, per_day: true }
  ]
}
```
- per_day flag indicates daily rate

---

#### Step 3.2: Link Pro-Rate Template to New Student
**Business:** Ahmed goes to Fee Tab → Template Assignments → Searches for "Ahmed Hassan" → Clicks "Link Individual Template" → Selects "Daily Pro-Rate Fee" → Modal asks for dates.

**Dev Notes:**
- GET /api/v1/fees/templates?scope=Individual (fetch available individual templates)
- Modal shows date pickers

---

#### Step 3.3: Set Date Range
**Business:** Ahmed sets Start Date: May 15, 2026, End Date: May 31, 2026. System shows: "16 days × 400 PKR/day = 6,400 PKR".

**Dev Notes:**
```
POST /api/v1/fees/student-template-links
Body: {
  student_id: "ahmed-uuid",
  template_id: "pro-rate-template-uuid",
  start_date: "2026-05-15",
  end_date: "2026-05-31"
}

Calculation:
- Days = (May 31 - May 15) + 1 = 16 days
- Tuition: 333 × 16 = 5,328 PKR
- Transport: 67 × 16 = 1,072 PKR
- Total: 6,400 PKR
```
- Creates student_template_link record
- start_date and end_date stored for calculation

---

#### Step 3.4: Generate Pro-Rated Challan
**Business:** Ahmed generates challan for Ahmed Hassan. System creates challan for 6,400 PKR (16 days only).

**Dev Notes:**
```
POST /api/v1/fees/challans/generate
Body: {
  student_ids: ["ahmed-uuid"],
  months: ["2026-05"],
  auto_calculate_due_date: true
}

Backend:
1. Finds student_template_link with dates
2. Calculates days between dates
3. Multiplies per_day amount × days
4. Creates challan with pro-rated amount
```

---

#### Step 3.5: Switch to Regular Template Next Month
**Business:** For June onwards, Ahmed removes pro-rate template, links Ahmed to regular "Junior Level Monthly Fee".

**Dev Notes:**
```
PUT /api/v1/fees/student-template-links/{linkId}
Body: { is_active: false }

Then:
POST /api/v1/fees/student-template-links
Body: {
  student_id: "ahmed-uuid",
  template_id: "junior-level-fee-uuid"
}
```
- Deactivates pro-rate link
- Links to regular template
- June challan will be full month

---

### Expected Outcome
✅ Ahmed Hassan charged 6,400 PKR for May (16 days only)  
✅ June onwards charged 12,500 PKR (full month)  
✅ No overpayment or underpayment

### Edge Cases
- **End date before start date:** Validation error
- **Date range spans multiple months:** Calculate per month separately
- **Overlapping template links:** System uses most recent active link

---

## Journey 4: Metric Exclusion for Individual Student

**Actor:** School Admin (Mr. Ahmed)  
**Goal:** Remove transport fee from Sara Ali who walks to school  
**Frequency:** As needed  
**Duration:** ~2 minutes

### Preconditions
- Sara Ali enrolled in Grade 9-A
- Junior Level Monthly Fee template linked (includes transport)
- No challan generated yet for current month

### Steps

#### Step 4.1: Open Student Fee Details
**Business:** Ahmed goes to Fee Tab → Template Assignments → Finds Sara Ali → Clicks "View Details".

**Dev Notes:**
```
GET /api/v1/fees/students/{studentId}/templates
Response: {
  templates: [
    {
      id: "junior-template-uuid",
      name: "Junior Level Monthly Fee",
      scope: "Level",
      metrics: [
        { id: "m1", name: "Tuition Fee", amount: 10000 },
        { id: "m2", name: "Transport Fee", amount: 2000 },
        { id: "m3", name: "Library Fee", amount: 500 }
      ]
    }
  ],
  exclusions: [] // currently empty
}
```

---

#### Step 4.2: Uncheck Transport Metric
**Business:** Modal shows checklist of metrics. Ahmed unchecks "Transport Fee".

**Dev Notes:**
```
UI: Checkbox state changes
Frontend State:
- excluded_metric_ids: ["m2"]
```

---

#### Step 4.3: Save Exclusion
**Business:** Ahmed clicks "Save Changes". System confirms: "Transport fee excluded for Sara Ali".

**Dev Notes:**
```
POST /api/v1/fees/metric-exclusions
Body: {
  student_id: "sara-uuid",
  template_id: "junior-template-uuid",
  metric_id: "m2",
  reason: "Student walks to school"
}
```
- Creates metric_exclusion record
- Unique constraint prevents duplicates

---

#### Step 4.4: Generate Challan with Exclusion
**Business:** When generating Sara's challan, system calculates: Tuition (10,000) + Library (500) = 10,500 PKR (no transport).

**Dev Notes:**
```
Fee Calculation Service:
1. Get templates for Sara
2. For each metric:
   - Check if metric_id exists in metric_exclusions table
   - If yes, skip this metric
   - If no, include in calculation
3. Transport metric (m2) found in exclusions → skipped
4. Final amount: 10,500 PKR
```

---

### Expected Outcome
✅ Sara's challan shows 10,500 PKR (not 12,500 PKR)  
✅ Challan PDF doesn't list transport fee  
✅ Exclusion persists for future months

### Edge Cases
- **Exclude all metrics:** Validation error (must have at least one fee)
- **Re-include excluded metric:** Delete exclusion record
- **Student changes class:** Exclusion remains (tied to student, not class)

---

## Journey 5: Staff Child Discount (Auto-Apply)

**Actor:** System (Automated) + School Admin (verification)  
**Goal:** Automatically apply 50% discount to children of staff members  
**Frequency:** Automatic when challan generated  
**Duration:** Instant

### Preconditions
- "Staff Child Discount" template exists with auto_apply: true
- Muhammad Hassan is both a parent (user role: parent) AND staff (user role: staff)
- His son Usman is enrolled as student

### Steps

#### Step 5.1: System Detects Staff-Parent Relationship
**Business:** When generating Usman's challan, system automatically detects his parent has staff role and applies 50% discount.

**Dev Notes:**
```
Fee Calculation Service:
1. Get student (Usman)
2. Get student's parent (Muhammad Hassan)
3. Check user.roles array for parent
4. Find parent has "staff" role
5. Query templates with:
   - scope: Individual
   - auto_apply: true
   - auto_apply_condition: { parent_has_role: "staff" }
6. Found "Staff Child Discount" template
7. Auto-link to student (create student_template_link)
8. Include in calculation

Database Query:
SELECT * FROM fee_templates
WHERE scope = 'Individual'
  AND auto_apply = true
  AND auto_apply_condition->>'parent_has_role' = 'staff'
  AND organization_id = '...'
```

---

#### Step 5.2: Calculate Discounted Amount
**Business:** Usman's base fee: 12,500 PKR. With 50% staff discount: 6,250 PKR payable.

**Dev Notes:**
```
Calculation:
Base: 12,500 PKR (Tuition + Transport + Library)
Staff Discount (50%): 12,500 × 0.50 = 6,250 PKR discount
Payable: 12,500 - 6,250 = 6,250 PKR

Challan Items:
1. Tuition Fee: 10,000 PKR (Fee)
2. Transport Fee: 2,000 PKR (Fee)
3. Library Fee: 500 PKR (Fee)
4. Staff Discount (50%): -6,250 PKR (Discount)
───────────────────────────
Total: 6,250 PKR
```

---

#### Step 5.3: Admin Verification (Optional)
**Business:** Ahmed reviews challans. Sees Usman's row has "👔 Staff" badge next to parent name. Confirms discount was correctly applied.

**Dev Notes:**
```
GET /api/v1/fees/challans/{challanId}
Response includes:
- student details
- parent details (with role indicator)
- challan items showing discount
```

---

### Expected Outcome
✅ Discount applied automatically without manual intervention  
✅ Staff badge visible in UI for transparency  
✅ No extra work for admin

### Edge Cases
- **Parent loses staff role mid-year:** Next challan won't have discount (auto-apply checks role each time)
- **Student has multiple parents, one is staff:** Any parent with staff role triggers discount
- **Multiple auto-apply discounts:** All apply and stack multiplicatively

---

## Journey 6: Parent Pays Fee & Uploads Proof

**Actor:** Parent (Mrs. Fatima Ali - Sara's mother)  
**Goal:** Pay May 2026 fee and submit payment proof  
**Frequency:** Monthly  
**Duration:** ~5 minutes (after bank visit)

### Preconditions
- Sara's May challan generated (status: Pending Payment)
- Parent has login credentials
- Parent has paid at bank and received receipt

### Steps

#### Step 6.1: View Pending Fees
**Business:** Fatima logs into parent portal. Dashboard shows: "1 pending fee challan - Sara Ali - May 2026 - 10,500 PKR - Due: May 31".

**Dev Notes:**
```
GET /api/v1/fees/challans/my-students
Response: [
  {
    challan_number: "CHL-2026-001235",
    student_name: "Sara Ali",
    month: "2026-05",
    payable_amount: 10500,
    due_date: "2026-05-31",
    status: "Pending_Payment",
    pdf_url: "https://..."
  }
]
```
- Queries challans for all children of logged-in parent
- Filters by status: Pending_Payment

---

#### Step 6.2: Download and Print Challan
**Business:** Fatima clicks "Download Challan PDF" → Opens PDF showing full fee breakdown → Prints it.

**Dev Notes:**
- Frontend fetches pdf_url from challan record
- PDF includes:
  - School logo and details
  - Student info
  - Challan number
  - Fee breakdown (each metric)
  - Total amount
  - Due date
  - Bank account details
  - QR code (for quick upload later)

---

#### Step 6.3: Pay at Bank
**Business:** Fatima visits HBL bank → Deposits 10,500 PKR to school's account → Receives stamped bank receipt with transaction ID: HBL202605050123.

**Dev Notes:**
- This happens offline (outside system)
- Bank receipt is physical proof

---

#### Step 6.4: Upload Payment Proof
**Business:** Fatima logs back into portal → Clicks challan → Clicks "Upload Payment Proof" → Selects photo of bank receipt from phone → Fills form:
- Payment Date: May 5, 2026
- Amount Paid: 10,500 PKR
- Payment Method: Bank Transfer
- Bank Name: HBL
- Transaction ID: HBL202605050123

**Dev Notes:**
```
POST /api/v1/fees/payments
FormData: {
  challan_id: "challan-uuid",
  amount_paid: 10500,
  payment_date: "2026-05-05",
  payment_method: "Bank_Transfer",
  bank_name: "HBL",
  transaction_reference: "HBL202605050123",
  proof_document: [File object]
}

Backend:
1. Validate amount matches challan
2. Upload file to Supabase Storage
3. Create payment record
4. Set payment.status = Pending_Review
5. Update challan.status = Under_Review
6. Return success
```

---

#### Step 6.5: Confirmation
**Business:** Success message: "Payment proof uploaded successfully. School will verify within 2 business days." Email notification sent.

**Dev Notes:**
```
- Frontend shows updated status: Under Review 🟠
- Email service sends notification to parent
- Also notifies school admin (new payment to verify)
```

---

### Expected Outcome
✅ Payment proof uploaded with details  
✅ Challan status changed to "Under Review"  
✅ Parent and admin notified

### Edge Cases
- **Upload wrong amount:** Admin will reject and request correct proof
- **File too large:** Frontend validation (max 5MB)
- **Invalid file type:** Accept only images (JPG, PNG) and PDFs

---

## Journey 7: Admin Verifies Payment

**Actor:** School Admin (Mr. Ahmed)  
**Goal:** Verify Sara's payment and mark challan as paid  
**Frequency:** Daily (morning routine)  
**Duration:** ~1 minute per payment

### Preconditions
- Sara's payment uploaded by parent
- Challan status: Under Review
- Payment record exists with proof document

### Steps

#### Step 7.1: Open Verification Queue
**Business:** Ahmed logs in → Goes to Fee Tab → Clicks "Payment History" sub-tab → Sees "45 payments awaiting verification" banner.

**Dev Notes:**
```
GET /api/v1/fees/payments/pending-verifications
Response: [
  {
    id: "payment-uuid",
    challan_number: "CHL-2026-001235",
    student_name: "Sara Ali",
    amount_paid: 10500,
    payment_date: "2026-05-05",
    bank_name: "HBL",
    transaction_reference: "HBL202605050123",
    proof_document_url: "https://...",
    uploaded_at: "2026-05-05T14:30:00Z"
  },
  // ... 44 more
]
```
- Filters payments by status: Pending_Review
- Orders by created_at ASC (oldest first)

---

#### Step 7.2: Review Payment Details
**Business:** Ahmed clicks on Sara's payment row → Modal opens showing:
- Challan details (10,500 PKR due)
- Payment details (10,500 PKR paid on May 5)
- Bank receipt image (full screen view available)

**Dev Notes:**
```
GET /api/v1/fees/payments/{paymentId}
Response: {
  challan: {
    challan_number: "CHL-2026-001235",
    payable_amount: 10500,
    due_date: "2026-05-31"
  },
  payment: {
    amount_paid: 10500,
    payment_date: "2026-05-05",
    bank_name: "HBL",
    transaction_reference: "HBL202605050123",
    proof_document_url: "https://..."
  }
}
```
- Frontend displays side-by-side comparison
- Image viewer for receipt

---

#### Step 7.3: Verify Receipt Authenticity
**Business:** Ahmed checks:
- ✅ Amount matches (10,500 PKR)
- ✅ Date is reasonable (May 5, before due date)
- ✅ Transaction ID format looks valid
- ✅ Bank stamp visible on receipt
- ✅ Deposited to correct school account

**Dev Notes:**
- Manual verification by admin
- System provides all info for easy checking
- No automation here (requires human judgment)

---

#### Step 7.4: Approve Payment
**Business:** Ahmed clicks "Verify Payment ✓" → Confirmation modal: "Mark this payment as verified?" → Clicks "Yes".

**Dev Notes:**
```
PUT /api/v1/fees/payments/{paymentId}/verify
Body: {
  admin_notes: "Verified against bank statement"
}

Backend:
1. Update payment record:
   - status = Verified
   - verified_by = current_user_id
   - verified_at = NOW()
2. Update challan record:
   - status = Verified
3. Generate official receipt PDF
4. Send notification to parent (email + in-app)
5. Return success
```

---

#### Step 7.5: Receipt Generated
**Business:** System auto-generates official receipt for parent. Fatima receives email: "Your payment has been verified. Receipt available in portal."

**Dev Notes:**
```
Receipt PDF includes:
- School letterhead
- Receipt number (REC-2026-001235)
- Date of verification
- Student name
- Fee breakdown
- Amount paid
- Payment method and date
- Admin signature (digital)
- "Paid in Full" watermark
```

---

### Expected Outcome
✅ Payment verified and challan marked as paid  
✅ Official receipt generated  
✅ Parent notified  
✅ Payment moves to history

### Edge Cases
- **Amount mismatch:** Admin rejects payment, requests correct amount
- **Suspicious receipt:** Admin can request additional proof
- **Partial payment:** System doesn't support yet (admin creates new challan for balance)

---

## Journey 8: Late Fee Application

**Actor:** System (Automated Cron Job) + School Admin  
**Goal:** Apply late fee penalty to overdue challans  
**Frequency:** Daily (midnight check)  
**Duration:** Automated

### Preconditions
- "Late Fee Penalty" template exists (5% of original amount)
- Some challans are overdue (due_date < today, status: Pending_Payment)
- It's June 5, 2026 (5 days past May 31 due date)

### Steps

#### Step 8.1: Nightly Cron Job Runs
**Business:** Every night at midnight, system checks for overdue challans and applies late fees automatically.

**Dev Notes:**
```
Cron Job: 0 0 * * * (runs daily at midnight)

Process:
1. Query overdue challans:
   SELECT * FROM challans
   WHERE status = 'Pending_Payment'
     AND due_date < CURRENT_DATE
     AND NOT EXISTS (
       SELECT 1 FROM late_fee_applications
       WHERE challan_id = challans.id
     )

2. For each overdue challan:
   a. Calculate days overdue
   b. Find applicable late fee template
   c. Calculate late fee amount
   d. Create late_fee_application record
   e. Add late fee to challan (new challan_item)
   f. Update challan totals
   g. Send notification to parent
```

---

#### Step 8.2: Late Fee Calculated
**Business:** Usman's May challan (6,250 PKR) is 5 days overdue. Late fee template: 5% per month. System adds 312.50 PKR late fee.

**Dev Notes:**
```
Calculation:
Original: 6,250 PKR
Late Fee (5%): 6,250 × 0.05 = 312.50 PKR
New Total: 6,562.50 PKR

late_fee_applications record:
{
  challan_id: "usman-may-challan-uuid",
  template_id: "late-fee-template-uuid",
  amount: 312.50,
  applied_automatically: true,
  days_overdue: 5,
  can_be_waived: true
}

New challan_item:
{
  challan_id: "...",
  description: "Late Fee Penalty (5 days overdue)",
  item_type: "Fee",
  amount: 312.50
}
```

---

#### Step 8.3: Parent Notification
**Business:** Usman's parent receives email: "Your May 2026 fee is overdue. A late fee of 312.50 PKR has been added. New total: 6,562.50 PKR."

**Dev Notes:**
- Email service triggers
- In-app notification badge
- SMS notification (optional)

---

#### Step 8.4: Admin Reviews Late Fees
**Business:** Ahmed checks "Late Fees Applied" report. Sees 15 challans had late fees added overnight.

**Dev Notes:**
```
GET /api/v1/fees/late-fees/recent
Response: [
  {
    student_name: "Usman Khan",
    challan_number: "CHL-2026-001240",
    original_amount: 6250,
    late_fee_amount: 312.50,
    new_total: 6562.50,
    days_overdue: 5,
    applied_at: "2026-06-05T00:00:00Z"
  },
  // ... 14 more
]
```

---

#### Step 8.5: Waive Late Fee (Exception Case)
**Business:** Usman's parent calls school explaining family emergency. Ahmed decides to waive late fee as one-time courtesy.

**Dev Notes:**
```
PUT /api/v1/fees/late-fees/{lateFeeId}/waive
Body: {
  reason: "Family emergency - one-time courtesy"
}

Backend:
1. Update late_fee_application:
   - waived = true
   - waived_by = current_user_id
   - waived_at = NOW()
2. Remove late fee challan_item
3. Recalculate challan totals
4. Notify parent: "Late fee waived"
```

---

### Expected Outcome
✅ Late fees applied automatically to overdue challans  
✅ Parents notified  
✅ Admin can waive on case-by-case basis

### Edge Cases
- **Late fee template doesn't exist:** Skip late fee application
- **Already paid but not verified:** Don't apply late fee (check payment records)
- **Multiple late fee applications:** Only apply once per challan

---

## Journey 9: Multi-Month Payment

**Actor:** Parent (Mrs. Ayesha - Ali's mother)  
**Goal:** Pay 3 months of fees at once (May, June, July 2026)  
**Frequency:** Occasional (when parent has bulk cash available)  
**Duration:** ~5 minutes

### Preconditions
- Ali enrolled in Grade 10-A
- Templates configured
- Parent prefers to pay multiple months together

### Steps

#### Step 9.1: Request Multi-Month Challan
**Business:** Ayesha contacts school office. Ahmed generates special challan for 3 months.

**Dev Notes:**
```
POST /api/v1/fees/challans/generate
Body: {
  student_ids: ["ali-uuid"],
  months: ["2026-05", "2026-06", "2026-07"],
  auto_calculate_due_date: true
}
```

---

#### Step 9.2: System Calculates Total
**Business:** System calculates: May (15,000) + June (15,000) + July (15,000) = 45,000 PKR. Single challan created.

**Dev Notes:**
```
Fee Calculation:
- Multiply base template amount × 3 months
- Apply discounts (if any)
- Create single challan record with:
  - month: "2026-05" (primary month)
  - months_included: ["2026-05", "2026-06", "2026-07"]
  - payable_amount: 45000

Challan Items:
1. Tuition Fee (May): 10,000 PKR
2. Tuition Fee (June): 10,000 PKR
3. Tuition Fee (July): 10,000 PKR
4. Transport Fee (May): 2,000 PKR
5. Transport Fee (June): 2,000 PKR
6. Transport Fee (July): 2,000 PKR
... (all metrics × 3 months)
```

---

#### Step 9.3: Parent Pays and Uploads Proof
**Business:** Ayesha pays 45,000 PKR at bank, uploads receipt showing full amount paid.

**Dev Notes:**
- Same payment upload flow as single month
- Validation: amount_paid must equal payable_amount (45,000)

---

#### Step 9.4: Verification
**Business:** Ahmed verifies payment. System marks May, June, July as pre-paid for Ali.

**Dev Notes:**
```
Backend Logic:
1. Verify payment
2. Mark challan as Verified
3. System flags student as "Paid Through July"
4. Future challan generation skips May/June/July
5. August challan generated normally
```

---

### Expected Outcome
✅ Single payment covers 3 months  
✅ System tracks pre-paid months  
✅ August challan generated automatically

### Edge Cases
- **Partial month already paid:** Calculate pro-rata balance
- **Discount changes mid-period:** Apply discount as per month of payment

---

## Journey 10: Fee Template Modification

**Actor:** School Admin (Mr. Ahmed)  
**Goal:** Increase tuition fee for next academic year  
**Frequency:** Annually  
**Duration:** ~10 minutes

### Preconditions
- Current template: Junior Level Fee (12,500 PKR total)
- Board approves 10% increase for 2026-2027 session
- New session starts August 2026

### Steps

#### Step 10.1: Review Current Template
**Business:** Ahmed opens "Junior Level Monthly Fee" template → Sees current metrics: Tuition (10,000), Transport (2,000), Library (500).

**Dev Notes:**
```
GET /api/v1/fees/templates/{templateId}
Response: {
  id: "...",
  name: "Junior Level Monthly Fee",
  metrics: [
    { id: "m1", name: "Tuition Fee", amount: 10000 },
    { id: "m2", name: "Transport Fee", amount: 2000 },
    { id: "m3", name: "Library Fee", amount: 500 }
  ]
}
```

---

#### Step 10.2: Update Template for New Session
**Business:** Ahmed decides to create new template for new session (best practice: version templates per year).

**Dev Notes:**
```
POST /api/v1/fees/templates
Body: {
  name: "Junior Level Monthly Fee 2026-27",
  type: "Fee",
  scope: "Levels",
  pro_rate_type: "Full_Month",
  days_until_due: 30,
  metrics: [
    { name: "Tuition Fee", amount: 11000 }, // 10% increase
    { name: "Transport Fee", amount: 2200 }, // 10% increase
    { name: "Library Fee", amount: 550 }      // 10% increase
  ]
}

Total: 13,750 PKR (was 12,500)
```
- Creates new template instead of editing old one
- Preserves historical data

---

#### Step 10.3: Deactivate Old Template
**Business:** Ahmed marks old template as inactive (effective July 31).

**Dev Notes:**
```
PUT /api/v1/fees/templates/{oldTemplateId}
Body: {
  is_active: false
}
```
- Old challans still reference old template
- New challans won't use it

---

#### Step 10.4: Link New Template
**Business:** Ahmed links new template to Junior level (effective August 1).

**Dev Notes:**
```
POST /api/v1/fees/templates/{newTemplateId}/assignments
Body: {
  scope_type: "Level",
  scope_id: "junior-level-uuid"
}
```

---

#### Step 10.5: Generate August Challans
**Business:** On August 1, Ahmed generates new month challans. System uses new template → All Junior students charged 13,750 PKR.

**Dev Notes:**
```
Fee Calculation Service:
1. Query active templates for Junior level
2. Finds new template (is_active: true)
3. Uses updated amounts (11,000 tuition)
4. Generates challans with new prices
```

---

### Expected Outcome
✅ New prices apply from August 2026  
✅ Historical challans preserve old prices  
✅ Clean version control of fee structures

### Edge Cases
- **Mid-session price change:** Create effective_from date field
- **Student-specific pricing:** Individual template overrides level template

---

## Journey 11: Payment History Review

**Actor:** Parent (Any) / School Admin  
**Goal:** View complete payment history for a student  
**Frequency:** As needed (tax filing, audits, reconciliation)  
**Duration:** ~2 minutes

### Steps

#### Step 11.1: Parent Views Payment History
**Business:** Parent logs in → Dashboard → Clicks "Payment History" → Sees table of all past payments.

**Dev Notes:**
```
GET /api/v1/fees/payments/my-students
Response: [
  {
    challan_number: "CHL-2026-001235",
    student_name: "Sara Ali",
    month: "2026-05",
    amount_paid: 10500,
    payment_date: "2026-05-05",
    status: "Verified",
    receipt_url: "https://...",
    verified_at: "2026-05-06"
  },
  {
    challan_number: "CHL-2026-000890",
    student_name: "Sara Ali",
    month: "2026-04",
    amount_paid: 10500,
    payment_date: "2026-04-03",
    status: "Verified",
    receipt_url: "https://...",
    verified_at: "2026-04-04"
  },
  // ... all past payments
]
```
- Sorted by payment_date DESC
- Filterable by student, month, status

---

#### Step 11.2: Download Receipt
**Business:** Parent clicks receipt icon → PDF receipt downloads → Saved for tax records.

**Dev Notes:**
- receipt_url links to generated PDF in storage
- PDF includes all payment details + school stamp

---

#### Step 11.3: Admin Export for Audit
**Business:** Ahmed needs Q1 payment report for auditors. Exports all verified payments from Jan-Mar 2026 to Excel.

**Dev Notes:**
```
GET /api/v1/fees/payments/export?start_date=2026-01-01&end_date=2026-03-31&status=Verified

Backend:
1. Query payments in date range
2. Generate Excel file (using exceljs library)
3. Columns: Date, Student, Grade, Amount, Method, Transaction ID, Verified By
4. Return file download
```

---

### Expected Outcome
✅ Parents have full payment history  
✅ Receipts downloadable anytime  
✅ Admin can export for reporting

---

## Journey 12: Exception Handling - Payment Rejection

**Actor:** School Admin (Mr. Ahmed) + Parent  
**Goal:** Handle invalid/incorrect payment proof  
**Frequency:** ~5% of submissions  
**Duration:** ~5 minutes

### Steps

#### Step 12.1: Admin Reviews Suspicious Payment
**Business:** Ahmed reviews Bilal's payment. Receipt shows 8,000 PKR paid, but challan amount is 10,500 PKR.

**Dev Notes:**
```
GET /api/v1/fees/payments/{paymentId}
Response: {
  challan: { payable_amount: 10500 },
  payment: { amount_paid: 8000 } // Mismatch!
}
```

---

#### Step 12.2: Reject Payment
**Business:** Ahmed clicks "Reject Payment ❌" → Modal asks for reason → Ahmed types: "Amount mismatch. Paid 8,000 but owed 10,500. Please pay remaining 2,500 or submit correct receipt."

**Dev Notes:**
```
PUT /api/v1/fees/payments/{paymentId}/reject
Body: {
  reason: "Amount mismatch. Paid 8,000 but owed 10,500..."
}

Backend:
1. Update payment record:
   - status = Rejected
   - rejection_reason = reason
2. Update challan record:
   - status = Pending_Payment (back to original)
3. Send notification to parent
```

---

#### Step 12.3: Parent Notified
**Business:** Bilal's parent receives email: "Your payment submission was rejected. Reason: [reason]. Please correct and resubmit."

**Dev Notes:**
- Email includes rejection reason
- Link to re-upload payment proof
- Challan still accessible

---

#### Step 12.4: Parent Resubmits
**Business:** Parent pays remaining 2,500 PKR → Uploads new receipt showing full 10,500 PKR paid → Submits again.

**Dev Notes:**
```
POST /api/v1/fees/payments
Body: {
  challan_id: "...",
  amount_paid: 10500,
  proof_document: [new file]
}

- Creates new payment record
- Old rejected payment archived
```

---

#### Step 12.5: Second Verification
**Business:** Ahmed reviews again → Confirms 10,500 PKR paid → Verifies payment ✅.

---

### Expected Outcome
✅ Incorrect submissions caught and rejected  
✅ Clear communication with parent  
✅ Resolution through resubmission

---

## Summary Statistics

| Journey | Actors | Frequency | Duration | Complexity |
|---------|--------|-----------|----------|------------|
| 1. Initial Setup | Admin | One-time | 2 hours | High |
| 2. Monthly Challan Gen | Admin | Monthly | 5 min | Medium |
| 3. Pro-Rating | Admin | As needed | 3 min | Medium |
| 4. Metric Exclusion | Admin | As needed | 2 min | Low |
| 5. Auto-Discount | System | Automatic | Instant | High |
| 6. Parent Payment | Parent | Monthly | 5 min | Low |
| 7. Admin Verification | Admin | Daily | 1 min/payment | Low |
| 8. Late Fee | System | Daily | Automatic | Medium |
| 9. Multi-Month | Parent + Admin | Occasional | 5 min | Medium |
| 10. Template Update | Admin | Annually | 10 min | Medium |
| 11. History Review | Parent/Admin | As needed | 2 min | Low |
| 12. Rejection Flow | Admin + Parent | 5% of payments | 5 min | Medium |

---

## Technical Implementation Notes

### Key Backend Services
1. **TemplateService** - CRUD for fee templates
2. **FeeCalculationService** - Core business logic for calculating fees
3. **ChallanService** - Challan generation and management
4. **PaymentService** - Payment processing and verification
5. **LateFeeService** - Automated late fee application
6. **PdfGenerationService** - Generate challan and receipt PDFs

### Key Database Tables
- `fee_templates` - Reusable fee/discount templates
- `template_metrics` - Line items within templates
- `template_assignments` - Links templates to scopes
- `student_template_links` - Individual template assignments
- `metric_exclusions` - Per-student metric exclusions
- `challans` - Generated fee challans
- `challan_items` - Line items in challans
- `payments` - Payment records with proof
- `late_fee_applications` - Late fee tracking

### Critical Calculations
```
Base Fees = Sum(all Fee metrics not excluded)
Discounts = Stack multiplicatively: Base × (1 - D1%) × (1 - D2%) × ...
Payable = Base - Total Discounts + Late Fees
Pro-Rate = (Amount / Days in Month) × Days Student Enrolled
```

### Automation Points
- Daily cron job for late fee application (midnight)
- Auto-apply templates based on parent role / sibling detection
- Notification triggers (email/SMS) on status changes
- PDF generation on challan creation and payment verification

---

**End of Document**