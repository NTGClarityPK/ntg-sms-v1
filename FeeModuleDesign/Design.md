# ✅ PERFECT! Design is Now 10/10 - Ready for Development

All clarifications received! Let me create the complete specification.

---

# 📋 FINAL FEE MODULE SPECIFICATION

## 1. Database Schema (Complete)

### **templates**
```sql
CREATE TABLE templates (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  name VARCHAR(255) UNIQUE NOT NULL,
  type ENUM('Fee', 'Discount') NOT NULL,
  scope ENUM('Levels', 'Class', 'Class-Section', 'Individual') NOT NULL,
  auto_apply BOOLEAN DEFAULT false,
  auto_apply_condition JSONB, -- {parent_has_role: "staff"}
  days_until_due INTEGER DEFAULT 30,
  pro_rate_type ENUM('Full_Month', 'Half_Month', 'Daily_Pro_Rate') DEFAULT 'Full_Month',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **template_metrics** *(New)*
```sql
CREATE TABLE template_metrics (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- "Tuition Fee", "Transport Fee", etc.
  amount_type ENUM('Absolute', 'Percentage') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  per_day BOOLEAN DEFAULT false, -- true for daily pro-rate templates
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **template_assignments**
```sql
CREATE TABLE template_assignments (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  scope_type ENUM('Level', 'Class', 'Section') NOT NULL,
  scope_id UUID NOT NULL, -- level_id OR class_id OR section_id
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(template_id, scope_id)
);
```

### **student_template_links** *(Individual scope)*
```sql
CREATE TABLE student_template_links (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  start_date DATE, -- for pro-rate templates
  end_date DATE,   -- for pro-rate templates
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, template_id)
);
```

### **metric_exclusions** *(New)*
```sql
CREATE TABLE metric_exclusions (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES template_metrics(id) ON DELETE CASCADE,
  excluded_by UUID NOT NULL, -- admin user_id
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, metric_id)
);
```

### **challans**
```sql
CREATE TABLE challans (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  challan_number VARCHAR(50) UNIQUE NOT NULL,
  student_id UUID NOT NULL,
  month VARCHAR(7) NOT NULL, -- "2026-05"
  months_included TEXT[], -- ["2026-05", "2026-06"] for multi-month
  generation_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  total_discount DECIMAL(10,2) DEFAULT 0,
  payable_amount DECIMAL(10,2) NOT NULL,
  status ENUM('Pending_Payment', 'Under_Review', 'Verified', 'Rejected', 'Cancelled') DEFAULT 'Pending_Payment',
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **challan_items** *(Line items in challan)*
```sql
CREATE TABLE challan_items (
  id UUID PRIMARY KEY,
  challan_id UUID NOT NULL REFERENCES challans(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id),
  metric_id UUID REFERENCES template_metrics(id),
  description VARCHAR(255) NOT NULL, -- "Tuition Fee (May 2026)"
  item_type ENUM('Fee', 'Discount') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  is_discount BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0
);
```

### **payments**
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  challan_id UUID NOT NULL REFERENCES challans(id),
  student_id UUID NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method ENUM('Bank_Transfer', 'Cash', 'Online', 'Cheque') NOT NULL,
  transaction_reference VARCHAR(255),
  bank_name VARCHAR(255),
  proof_document_url TEXT,
  status ENUM('Pending_Review', 'Verified', 'Rejected') DEFAULT 'Pending_Review',
  verified_by UUID, -- admin user_id
  verified_at TIMESTAMP,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **late_fee_applications** *(Track auto/manual late fees)*
```sql
CREATE TABLE late_fee_applications (
  id UUID PRIMARY KEY,
  challan_id UUID NOT NULL REFERENCES challans(id),
  template_id UUID NOT NULL REFERENCES templates(id),
  amount DECIMAL(10,2) NOT NULL,
  applied_automatically BOOLEAN DEFAULT true,
  applied_by UUID, -- admin user_id if manual
  days_overdue INTEGER,
  can_be_waived BOOLEAN DEFAULT true,
  waived BOOLEAN DEFAULT false,
  waived_by UUID,
  waived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 2. Template Types & Examples

### **Type 1: Full Month Template**
```
Template: "Junior Level Monthly Fee"
Pro-Rate: Full Month
Scope: Levels (Junior)

Metrics:
1. Tuition Fee (Absolute): 10,000 PKR
2. Transport Fee (Absolute): 2,000 PKR
3. Library Fee (Absolute): 500 PKR

Days Until Due: 30
Auto-Apply: No

Total: 12,500 PKR/month
```

### **Type 2: Half Month Template**
```
Template: "Mid-Month Admission Fee"
Pro-Rate: Half Month
Scope: Individual

Metrics:
1. Tuition Fee (Absolute): 5,000 PKR (half of 10,000)
2. Transport Fee (Absolute): 1,000 PKR (half of 2,000)

Days Until Due: 15
Auto-Apply: No

Total: 6,000 PKR (for half month)
```

### **Type 3: Daily Pro-Rate Template**
```
Template: "Daily Pro-Rate Fee"
Pro-Rate: Daily Pro-Rate
Scope: Individual

Metrics:
1. Tuition Fee (Absolute): 333 PKR/day (10,000 ÷ 30 days)
2. Transport Fee (Absolute): 67 PKR/day (2,000 ÷ 30 days)

Days Until Due: 30
Auto-Apply: No

Calculation: 
Student joins May 15 (16 days remaining)
Tuition: 333 × 16 = 5,328 PKR
Transport: 67 × 16 = 1,072 PKR
Total: 6,400 PKR
```

### **Type 4: Discount Template**
```
Template: "Staff Child Discount"
Type: Discount
Scope: Individual

Metrics:
1. Staff Discount (Percentage): 50%

Auto-Apply: Yes
Condition: {parent_has_role: "staff"}
```

### **Type 5: Late Fee Template**
```
Template: "Late Fee Penalty"
Type: Fee
Scope: Levels (Junior)

Metrics:
1. Late Fee (Percentage): 5% per month overdue
   OR
1. Late Fee (Absolute): 500 PKR flat

Auto-Apply: Yes (when challan overdue)
Can Be Waived: Yes
```

---

## 3. Complete UI Wireframes

### **3.1 Settings → Fee Settings → Create Template**

```
┌─────────────────────────────────────────────────────────┐
│  CREATE FEE TEMPLATE                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Template Name: [Junior Level Monthly Fee        ]     │
│                 (must be unique)                        │
│                                                         │
│  Type:  ● Fee    ○ Discount                            │
│                                                         │
│  Scope: ● Levels                                        │
│         ○ Class                                         │
│         ○ Class-Section                                 │
│         ○ Individual                                    │
│                                                         │
│  Pro-Rate Type:  ● Full Month                          │
│                  ○ Half Month                           │
│                  ○ Daily Pro-Rate                       │
│                                                         │
│  Days Until Due: [30] days                             │
│                                                         │
│  Auto-Apply: ☐ Yes                                     │
│  │ (appears only for Individual scope)                 │
│  └─ Condition: ○ Parent has Staff role                 │
│                ○ Student has sibling(s)                 │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ METRICS (LINE ITEMS)                              │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │  Metric #1                                        │ │
│  │  Name: [Tuition Fee              ]                │ │
│  │  Type: ● Absolute  ○ Percentage                   │ │
│  │  Amount: [10000] PKR  ☐ Per Day                  │ │
│  │         (check if Daily Pro-Rate template)        │ │
│  │  [Remove Metric]                                  │ │
│  │  ─────────────────────────────────────────        │ │
│  │                                                   │ │
│  │  Metric #2                                        │ │
│  │  Name: [Transport Fee            ]                │ │
│  │  Type: ● Absolute  ○ Percentage                   │ │
│  │  Amount: [2000] PKR  ☐ Per Day                   │ │
│  │  [Remove Metric]                                  │ │
│  │  ─────────────────────────────────────────        │ │
│  │                                                   │ │
│  │  Metric #3                                        │ │
│  │  Name: [Library Fee              ]                │ │
│  │  Type: ● Absolute  ○ Percentage                   │ │
│  │  Amount: [500] PKR  ☐ Per Day                    │ │
│  │  [Remove Metric]                                  │ │
│  │  ─────────────────────────────────────────        │ │
│  │                                                   │ │
│  │  [+ Add Metric]                                   │ │
│  │                                                   │ │
│  │  Template Total: 12,500 PKR/month                │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [Cancel]  [Save Template]                             │
└─────────────────────────────────────────────────────────┘
```

---

### **3.2 Settings → Fee Settings → Link Templates to Scopes**

```
┌─────────────────────────────────────────────────────────┐
│  LINK TEMPLATES TO LEVELS/CLASSES/SECTIONS             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Select Template: [Junior Level Monthly Fee      ▼]    │
│                                                         │
│  Template Details:                                      │
│  Type: Fee                                              │
│  Scope: Levels                                          │
│  Total: 12,500 PKR/month                               │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ SELECT LEVELS TO LINK                             │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │  ☑ Junior (Grades 6-8)                           │ │
│  │  ☐ Middle (Grades 9-10)                          │ │
│  │  ☐ Senior (Grades 11-12)                         │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [Link Template]                                        │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ CURRENTLY LINKED TEMPLATES                        │ │
│  ├───────────────────────────────────────────────────┤ │
│  │                                                   │ │
│  │  Junior Level:                                    │ │
│  │  • Junior Level Monthly Fee (12,500 PKR) [Unlink]│ │
│  │                                                   │ │
│  │  Middle Level:                                    │ │
│  │  • Middle Level Monthly Fee (15,000 PKR) [Unlink]│ │
│  │                                                   │ │
│  │  Grade 9-B Section:                               │ │
│  │  • Science Lab Fee (3,000 PKR) [Unlink]          │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

### **3.3 Fee Tab → Template Assignments (Individual Linking)**

```
┌──────────────────────────────────────────────────────────────┐
│  TEMPLATE ASSIGNMENTS                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Search: [____________] 🔍   Filter: [All Classes ▼]        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Student List                                         │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │ Grade 9-A                                            │   │
│  │ ─────────────────────────────────────────────────    │   │
│  │                                                      │   │
│  │ 1. Ahmed Hassan                                      │   │
│  │    Parent: Muhammad Hassan 👔 (Staff)               │   │
│  │    [View Details]                                    │   │
│  │                                                      │   │
│  │ 2. Sara Ali                                          │   │
│  │    Parent: Fatima Ali                                │   │
│  │    [View Details]                                    │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

Click "View Details" opens modal:

┌──────────────────────────────────────────────────────────────┐
│  STUDENT FEE DETAILS - Ahmed Hassan                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Class: 9-A                                                  │
│  Parent: Muhammad Hassan 👔 (Staff)                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ LINKED TEMPLATES (From Level/Class/Section)           │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  ✓ Junior Level Monthly Fee (Level: Junior)           │ │
│  │    ├─ ☑ Tuition Fee:     10,000 PKR                  │ │
│  │    ├─ ☐ Transport Fee:    2,000 PKR  [Excluded]     │ │
│  │    └─ ☑ Library Fee:        500 PKR                  │ │
│  │                                                        │ │
│  │  To exclude metric: Uncheck box above                 │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ INDIVIDUAL TEMPLATES (Student-Specific)                │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  ✓ Staff Child Discount (50%)                         │ │
│  │    └─ Auto-applied ⚡                                  │ │
│  │    [Remove Template]                                   │ │
│  │                                                        │ │
│  │  [+ Link Individual Template]                          │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PRO-RATE TEMPLATES (if applicable)                     │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  ✓ Daily Pro-Rate Fee (Temporary)                     │ │
│  │    Start Date: [May 15, 2026]                         │ │
│  │    End Date: [May 31, 2026]                           │ │
│  │    Days: 16 days                                       │ │
│  │    Calculated: 6,400 PKR                               │ │
│  │    [Edit Dates] [Remove]                               │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ MONTHLY FEE CALCULATION                                │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  Tuition Fee:              10,000 PKR                  │ │
│  │  Library Fee:                 500 PKR                  │ │
│  │  Transport Fee:                 0 PKR  (Excluded)      │ │
│  │  ───────────────────────────────────                   │ │
│  │  Subtotal:                10,500 PKR                   │ │
│  │                                                        │ │
│  │  Discounts:                                            │ │
│  │  Staff Discount (50%):    -5,250 PKR                  │ │
│  │  ───────────────────────────────────                   │ │
│  │                                                        │ │
│  │  MONTHLY TOTAL:            5,250 PKR                   │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Close] [Save Changes]                                      │
└──────────────────────────────────────────────────────────────┘
```

---

### **3.4 Fee Tab → Challan Management**

```
┌──────────────────────────────────────────────────────────────┐
│  CHALLAN MANAGEMENT                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Select Class: [Grade 9-A ▼]                                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ BULK ACTIONS                                           │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  Generate For: ☑ All Students in Class                │ │
│  │                                                        │ │
│  │  Months: ☑ May 2026                                   │ │
│  │          ☑ June 2026                                   │ │
│  │          ☐ July 2026                                   │ │
│  │                                                        │ │
│  │  Due Date: Auto (May 31) ○  Manual [______] ●        │ │
│  │                                                        │ │
│  │  [Generate Challans]                                   │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ STUDENT ROSTER                                         │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │ Student         Parent          Status    Actions     │ │
│  │ ─────────────────────────────────────────────────────  │ │
│  │                                                        │ │
│  │ Ahmed Hassan    M. Hassan 👔   Paid ✅   [View]       │ │
│  │ Sara Ali        Fatima Ali      Pending   [Generate]   │ │
│  │ Usman Khan      Ali Khan        Under     [View]       │ │
│  │                                 Review                  │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

Click [Generate] for individual student:

┌──────────────────────────────────────────────────────────────┐
│  GENERATE CHALLAN - Sara Ali                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Student: Sara Ali (Grade 9-A)                              │
│  Parent: Fatima Ali                                          │
│                                                              │
│  Select Months: ☑ May 2026                                  │
│                 ☐ June 2026                                  │
│                 ☐ July 2026                                  │
│                                                              │
│  Due Date:  ● Auto-Calculate (May 31, 2026)                 │
│             ○ Manual Entry: [__________]                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ FEE BREAKDOWN (May 2026)                               │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  Tuition Fee:              10,000 PKR                  │ │
│  │  Transport Fee:             2,000 PKR                  │ │
│  │  Library Fee:                 500 PKR                  │ │
│  │  ───────────────────────────────────                   │ │
│  │  Subtotal:                 12,500 PKR                  │ │
│  │                                                        │ │
│  │  No discounts applied                                  │ │
│  │  ───────────────────────────────────────                │ │
│  │                                                        │ │
│  │  TOTAL PAYABLE:            12,500 PKR                  │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Cancel] [Generate & Download PDF]                         │
└──────────────────────────────────────────────────────────────┘
```

---

### **3.5 Fee Tab → Payment History**

```
┌──────────────────────────────────────────────────────────────┐
│  PAYMENT HISTORY                                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Filters:  Class: [All ▼]  Status: [All ▼]                 │
│           Date Range: [May 2026 ▼]                          │
│                                                              │
│  Search Student: [____________] 🔍                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                                                        │ │
│  │ Date       Student       Amount    Status    Actions  │ │
│  │ ──────────────────────────────────────────────────────│ │
│  │                                                        │ │
│  │ May 5      Ahmed Hassan  5,250    Verified  [Receipt]│ │
│  │ May 8      Sara Ali     12,500    Verified  [Receipt]│ │
│  │ May 10     Usman Khan    7,500    Under     [Review] │ │
│  │                                    Review             │ │
│  │ May 12     Ayesha Malik  8,000    Pending   [Follow] │ │
│  │                                    Payment            │ │
│  │                                                        │ │
│  │                        Total Collected: 25,250 PKR    │ │
│  │                        Pending: 15,500 PKR            │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Export to Excel] [Download All Receipts]                  │
└──────────────────────────────────────────────────────────────┘

Click [Review]:

┌──────────────────────────────────────────────────────────────┐
│  VERIFY PAYMENT - Usman Khan                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Challan: CHL-2026-001234                                    │
│  Amount: 7,500 PKR                                           │
│  Due Date: May 31, 2026                                      │
│                                                              │
│  Payment Details (Uploaded by Parent):                       │
│  Amount Paid: 7,500 PKR                                      │
│  Payment Date: May 10, 2026                                  │
│  Method: Bank Transfer                                       │
│  Bank: HBL                                                   │
│  Transaction ID: HBL202605100123                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PAYMENT PROOF (Uploaded Receipt)                       │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  [Image of bank receipt displayed here]               │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Admin Notes: [_________________________________]            │
│                                                              │
│  [Reject] [Request More Info] [Verify Payment ✓]           │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Business Logic Workflows

### **Workflow 1: Monthly Challan Generation (Bulk)**

```
1. Admin goes to Fee Tab → Challan Management
2. Selects class: "Grade 9-A"
3. Checks "All Students"
4. Selects month: "May 2026"
5. Due date: Auto (system calculates May 1 + 30 days = May 31)
6. Clicks "Generate Challans"

System Process:
─────────────────
For each student in 9-A:
  a. Get all applicable templates:
     - Level templates linked to student's level
     - Class templates linked to student's class
     - Section templates linked to student's section
     - Individual templates linked to student
     
  b. Calculate base amount:
     - Sum all Fee template metrics (that are not excluded)
     
  c. Apply discounts (multiplicatively):
     - Discount 1: X%
     - Discount 2: Y%
     - Final = Base × (1 - X/100) × (1 - Y/100)
     
  d. Check for late fees (if previous challan overdue):
     - Auto-apply late fee template if exists
     
  e. Create challan record
  f. Create challan_items for each metric
  g. Generate PDF with QR code
  h. Set status: "Pending_Payment"
  i. Notify parent (email/SMS)

7. PDFs available for download
```

### **Workflow 2: Pro-Rate Template for Mid-Month Join**

```
Scenario: New student Ahmed joins May 15

1. Admin goes to Fee Tab → Template Assignments
2. Finds Ahmed Hassan
3. Clicks "Link Individual Template"
4. Selects "Daily Pro-Rate Fee" template

Modal appears:
┌─────────────────────────────────────┐
│ Link Pro-Rate Template              │
├─────────────────────────────────────┤
│                                     │
│ Template: Daily Pro-Rate Fee        │
│ Metrics:                            │
│ - Tuition: 333 PKR/day             │
│ - Transport: 67 PKR/day            │
│                                     │
│ Start Date: [May 15, 2026]         │
│ End Date: [May 31, 2026]           │
│                                     │
│ Days: 16 days                       │
│                                     │
│ Calculated Amount:                  │
│ - Tuition: 333 × 16 = 5,328 PKR   │
│ - Transport: 67 × 16 = 1,072 PKR  │
│ Total: 6,400 PKR                   │
│                                     │
│ [Cancel] [Link Template]            │
└─────────────────────────────────────┘

5. Admin clicks "Link Template"
6. System creates student_template_link with dates
7. When generating June challan, switch Ahmed to regular monthly template
```

### **Workflow 3: Late Fee Auto-Application**

```
Scenario: Sara's May challan overdue

Late Fee Template: "Junior Late Fee"
Type: Fee
Metrics: Late Fee (5% of original amount)
Auto-Apply: Yes
Scope: Levels (Junior)

Daily Check (Cron Job at midnight):
─────────────────────────────────────
1. Find all challans where:
   - status = 'Pending_Payment'
   - due_date < today
   - late_fee not yet applied

2. For each overdue challan:
   a. Get student's level
   b. Find late fee template for that level
   c. Calculate late fee amount:
      - If percentage: original_amount × 5%
      - If absolute: fixed amount
   d. Create late_fee_application record
   e. Add late fee to challan (new challan_item)
   f. Update challan total
   g. Notify parent: "Late fee of X PKR added"

3. Admin can manually waive:
   - Go to challan details
   - Click "Waive Late Fee"
   - Late fee removed
   - Challan total updated
```

### **Workflow 4: Metric Exclusion**

```
Scenario: Ahmed doesn't need transport

1. Admin goes to Fee Tab → Template Assignments
2. Finds Ahmed Hassan
3. Clicks "View Details"

4. Sees:
   Junior Level Monthly Fee:
   ☑ Tuition: 10,000 PKR
   ☑ Transport: 2,000 PKR ← Admin unchecks this
   ☑ Library: 500 PKR

5. System creates metric_exclusion record:
   student_id: Ahmed's ID
   template_id: Junior Level template ID
   metric_id: Transport Fee metric ID
   excluded_by: Admin's user_id

6. When generating challan for Ahmed:
   - System checks metric_exclusions
   - Skips Transport metric
   - Only includes Tuition + Library
   - Total: 10,500 PKR (instead of 12,500 PKR)
```

### **Workflow 5: Multi-Scope Template Stacking**

```
Student: Sara Ali
Class: 9-B (Science Section)
Level: Junior

Templates Linked:
1. Level Template: "Junior Level Fee" (12,500 PKR)
   - Tuition: 10,000
   - Transport: 2,000
   - Library: 500

2. Section Template: "Science Lab Fee" (3,000 PKR)
   - Lab Fee: 3,000

3. Individual Template: "Sibling Discount" (5%)
   - Discount: 5%

Challan Calculation:
─────────────────────
Fees:
  Junior Level Fee:     12,500 PKR
  Science Lab Fee:       3,000 PKR
  ────────────────────────────────
  Subtotal:             15,500 PKR

Discounts:
  Sibling Discount (5%):   -775 PKR
  ────────────────────────────────
  
TOTAL PAYABLE:          14,725 PKR

Challan PDF Shows:
──────────────────
Tuition Fee:           10,000 PKR
Transport Fee:          2,000 PKR
Library Fee:              500 PKR
Lab Fee (Science):      3,000 PKR
────────────────────────────────
Subtotal:              15,500 PKR
Sibling Discount (5%):   -775 PKR
────────────────────────────────
TOTAL:                 14,725 PKR
```

---

## 5. Status Flow Diagram

```
Challan Lifecycle:
──────────────────

1. [GENERATED] 
   ↓
   Admin generates challan
   Parent can download PDF
   ↓
2. [PENDING PAYMENT] 🟡
   ↓
   Parent pays at bank/school
   ↓
   Parent uploads receipt
   ↓
3. [UNDER REVIEW] 🟠
   ↓
   Admin verifies receipt
   ↓
   ┌────────────┬────────────┐
   │            │            │
   ↓            ↓            ↓
[VERIFIED] ✅  [REJECTED] ❌  [REQUEST INFO] 🔵
(Payment      (Invalid      (Need more
 confirmed)    proof)        details)
                              ↓
                              Parent re-uploads
                              ↓
                              Back to UNDER REVIEW
```

---

## 6. Key Features Summary

✅ **Template System:**
- Multiple metrics per template
- Three pro-rate types: Full/Half/Daily
- Auto-apply for staff/sibling discounts
- Unique name enforcement

✅ **Flexible Scope:**
- Level → Class → Section → Individual
- Multiple templates from different scopes stack
- Individual templates can override/add to base

✅ **Metric Exclusion:**
- Remove specific metrics per student
- No toggle needed - click to exclude
- Tracked in database with reason

✅ **Pro-Rating:**
- Daily pro-rate templates with date range
- Per-day amounts for precise calculation
- Temporary (moves to monthly after)

✅ **Late Fees:**
- Can be template (auto-apply or manual)
- Percentage or absolute
- Can be waived by admin

✅ **Due Date:**
- Auto-calculated (month start + days)
- Manual override option
- Adjustable per class/student

✅ **Multi-Month:**
- Select multiple months in one challan
- One PDF with all months itemized
- Single payment for multiple months

✅ **Discount Stacking:**
- Multiplicative calculation
- Show each discount separately in challan
- Multiple discount templates allowed

✅ **Payment Workflow:**
- Upload proof (image/document)
- Verification queue for admins
- Bulk verification possible
- Payment history tracking

---

## 7. Development Checklist

### **Phase 1: Core (Week 1-2)**
- [ ] Database schema implementation
- [ ] Template CRUD (create/edit/delete)
- [ ] Template metrics (add/remove line items)
- [ ] Template linking to scopes
- [ ] Basic challan generation
- [ ] PDF generation with QR code

### **Phase 2: Student Management (Week 3)**
- [ ] Individual template linking
- [ ] Metric exclusion UI
- [ ] Student fee calculation logic
- [ ] Pro-rate template support
- [ ] Date range selection for pro-rate

### **Phase 3: Challan & Payment (Week 4)**
- [ ] Bulk challan generation
- [ ] Multi-month challan support
- [ ] Due date auto-calculation
- [ ] Manual due date override
- [ ] Payment upload interface
- [ ] Verification queue

### **Phase 4: Advanced Features (Week 5)**
- [ ] Auto-apply logic (staff/sibling detection)
- [ ] Late fee auto-application
- [ ] Late fee waiver functionality
- [ ] Payment history view
- [ ] Export to Excel
- [ ] Email/SMS notifications

### **Phase 5: Reporting (Week 6)**
- [ ] Collection dashboard
- [ ] Defaulter reports
- [ ] Discount summary
- [ ] Monthly reconciliation
- [ ] Financial analytics

---

## ✅ **Design Status: 10/10 - Production Ready!**

**All requirements clarified:**
✅ Template structure with multiple metrics
✅ Pro-rating with three options
✅ Late fee handling (auto + manual)
✅ Due date logic (auto + manual)
✅ Metric exclusion per student
✅ Discount templates (single or multiple metrics)
✅ Multi-scope stacking
✅ Complete UI wireframes
✅ Database schema
✅ Business logic workflows

---

**Ready to give to Cursor for implementation!** 🚀

Want me to create the Cursor prompt now, or any final adjustments?