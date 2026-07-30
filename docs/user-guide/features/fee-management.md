# Fee Management

## Guide

### There are two main sections:

1. **Fee Settings** - Configure challan appearance and create templates
2. **Fees** - Generate challans and track payments

***

### Part 1: Fee Settings

**Location:** Settings → Fee Settings tab

#### Section A: Challan Settings

Configure what appears on printed challans:

* **Bank Details** - Bank name, account number, branch
* **Payment Instructions** - How parents should pay
* **Footer Text** - Additional notes or terms

**Example:**

```
Bank: Meezan Bank
Account: 01234567890
Payment Instructions: Pay before due date to avoid late fees
Footer: For queries, contact accounts@school.edu.pk
```

***

#### Section B: Fee Templates

Templates define the fees you charge (tuition, transport, library, etc.) and who they apply to.

**Creating a Template**

**Template Name**\
Give it a clear, descriptive name\
*Example:* "Class II Monthly Fees" or "Transport Fee - Senior Level"

**Type**

* **Fee** - Charges to collect (tuition, transport, library)
* **Discount** - Reductions to apply (sibling discount, scholarship)

**Scope** (Who this applies to)

* **Level** - All students in Primary/Junior/Senior level
* **Class** - All students in Class II (all sections)
* **Class-Section** - Only students in Class II-C
* **Individual** - Specific students only

**Currency**\
Select PKR, USD, SAR, or IQD (displays on challan)

**Metrics (The actual fees)**

**Name:** What you're charging\
*Examples:* Tuition Fee, Transport Fee, Library Fee, Lab Fee

**Type:**

* **Absolute** - Fixed amount (e.g., 10,000 PKR)
* **Percentage** - % of other fees (e.g., 5% processing fee)

**Amount:** Enter the value

***

#### Template Specificity (How they apply)

When multiple templates could apply to a student, **the most specific one wins:**

```
Individual Template (highest priority)
    ↓
Class-Section Template
    ↓
Class Template
    ↓
Level Template (lowest priority)
```

**Example:**

* **Level Template:** "Junior Level Fee" = 15,000 PKR tuition
* **Class Template:** "Class II Fee" = 12,000 PKR tuition
* Student in Class II-C gets 12,000 (Class overrides Level)

**Discount Templates:** Auto-apply alongside fee templates

* Marked as "AUTO" in the system
* Apply to all students matching the scope
* Can be excluded individually when needed

***

### Part 2: Generating Challans

**Location:** Fees → Challan management tab

#### Step 1: Select Class & Month

1. Choose **Class** from dropdown (e.g., Class II-C)
2. Select **Month** (e.g., May 2026)
3. The system loads all students with their applicable templates

***

#### Step 2: Generate Challans

**Bulk Generation (Most Common)**

1. Click **"Generate challans"** (top right)
2. System shows template selection:
   * Most specific template is **pre-selected**
   * Auto-discounts are highlighted
   * Preview metrics and amounts
3. Click **"Confirm & generate"**
4. Challans created for all students at once

**Status after generation:**

* ✅ **VERIFIED** - Ready to collect payment
* 🟡 **PENDING PAYMENT** - Challan generated, awaiting payment

***

**Individual Generation (For special cases)**

Use this when a student needs different amounts:

**Example:** Student joined mid-month (May 15th)

1. Click **"Generate"** button next to student name
2. Modal opens showing:
   * **Start date (optional)** - Leave blank or set to May 15
   * **Due date** - Override class due date if needed
   * **Individual template** - Link student-specific template if they have one
   * **Adjust for this challan (one-time)** section
3. In "Adjust for this challan" section:
   * ✅ **Exclude** checkbox - Remove a fee entirely (e.g., no transport this month)
   * 📝 **Override amount** - Change amount (e.g., 12,000 → 6,000 for half month)
4. View **Fee breakdown** at bottom (shows calculation)
5. Click **"Generate challan"**

**Important:** These adjustments are **one-time only**. Next month, the student gets the full template amounts like everyone else.

***

#### Step 3: Download & Distribute

**Per Student:**

* Click **"Download PDF"** next to any student
* Challan PDF downloads with all details
* Share with parents (email, print, WhatsApp)

**Bulk Download:**

* Click **"Download all (ZIP)"** (coming soon)
* Gets PDFs for entire class

***

### Part 3: Payment Tracking

**Location:** Fees → Payment history tab

#### Recording Payments

**Manual Entry:**

1. Go to student's challan
2. Click **"Mark as Paid"** or update status
3. System records payment date and amount

**From Receipt:**

* Click **"Receipt"** button
* Generate official receipt PDF
* Prints with payment details

#### Payment Dashboard

**Filters:**

* **Class** - View specific class payments
* **Status** - VERIFIED / PENDING PAYMENT / OVERDUE
* **Date range** - Filter by month/term
* **Search** - Find specific student

**Summary Cards:**

* 💰 **Collected** - Total received (e.g., 12,600 PKR)
* ⏳ **Pending** - Total outstanding (e.g., 0 PKR)

**Export:**

* Click **"Export"** for Excel/CSV report
* Contains all payment records with dates and amounts

***

### Common Scenarios

#### Scenario 1: Setting Up Monthly Fees

```
1. Settings → Fee Settings → Create Template
   - Name: "Class II Monthly Fees"
   - Scope: Class → Class II
   - Metrics:
     • Tuition Fee: 12,000 PKR
     • Transport Fee: 3,000 PKR
     • Library Fee: 500 PKR

2. Fees → Generate challans
   - Select Class II-C, Month: May 2026
   - Click "Generate challans" → All students get same fees
```

#### Scenario 2: Student Joins Mid-Month

```
Student joins May 15th (half month remaining)

1. Fees → Click "Generate" for that student
2. Leave "Start date" blank (or set May 15 for records)
3. In "Adjust for this challan" section:
   - Tuition Fee: Override 12,000 → 6,000
   - (Other fees keep original amount or adjust as needed)
4. Generate → This student gets 6,000
5. Next month → Student gets full 12,000 like everyone else
```

#### Scenario 3: Sibling Discount

```
1. Settings → Create Discount Template
   - Name: "Sibling Discount"
   - Type: Discount
   - Scope: Individual
   - Metric: "Sibling Discount" → 10% or 1,000 PKR

2. Link to specific students:
   - When generating challan, use "Individual template" field
   - Link discount template
   - Discount auto-applies to that student's challans
```

#### Scenario 4: Student Doesn't Use Transport This Month

```
1. Click "Generate" for student
2. In "Adjust for this challan" section:
   - Check ✅ "Exclude" next to Transport Fee
3. Generate → Challan without transport fee
4. Next month → Generate normally, transport fee returns
```

***

### Quick Reference

| Task                      | Location                                         |
| ------------------------- | ------------------------------------------------ |
| Set up bank details       | Settings → Fee Settings → Challan Settings       |
| Create fee template       | Settings → Fee Settings → Fee Templates          |
| Generate monthly challans | Fees → Challan management → Generate challans    |
| Adjust individual student | Fees → Generate (per student) → Override amounts |
| Track payments            | Fees → Payment history                           |
| Export payment report     | Payment history → Export                         |

***

### Tips

✅ **Create templates once** - Use them for all students in that scope\
✅ **Bulk generate** - Saves time for 30+ students per class\
✅ **Individual adjustments** - Only for special cases (mid-month, temporary changes)\
✅ **Discounts auto-apply** - No need to manually add each month\
✅ **Download PDFs early** - Share with parents before due date

***

**Need Help?**\
Contact: <support@ntgclarity.com>
