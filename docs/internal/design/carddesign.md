# ID Card Templates Design Specification

## Card Dimensions
- **Standard Size:** 85.6mm × 54mm (CR80 - credit card size)
- **Safe Area:** 81.6mm × 50mm (2mm bleed margin)
- **Corner Radius:** 3mm (rounded corners)
- **Orientation:** Horizontal (landscape)

---

# Template 1: MODERN CARD DESIGN

## 🎨 FRONT SIDE - MODERN

```
┌──────────────────────────────────────────────────────────────┐
│ 🏫 ALMA SCHOOL                    [School Logo]              │ Header: School brand color gradient
│ Academic Year 2024-25             ✓ VERIFIED                 │ bg-gradient(primary → primary-dark)
├──────────────────────────────────────────────────────────────┤
│                                                               │
│    ┌─────────┐                                               │
│    │         │     ANAM FATIMA                               │ Name: 18pt Bold
│    │  PHOTO  │     Student • Class 10-A                      │ Role + Class: 12pt Regular
│    │         │     Roll No: 1002                             │ Roll: 11pt Medium
│    │ (round) │                                               │ Photo: 25mm × 30mm rounded
│    └─────────┘     📧 anam.fatima@alma.edu                   │ Email: 10pt, icon + text
│                    📱 +92 300 1234567                         │ Contact: 10pt, icon + text
│                                                               │
│    ID: STU-2024-001002                        [QR Code]      │ ID: 11pt, QR: 15mm × 15mm
│                                               ▪▪▪▪▪▪          │
│    Valid: Aug 2024 - Jun 2025                ▪▪▪▪▪▪          │ Validity: 9pt, badge style
└──────────────────────────────────────────────────────────────┘

DESIGN ELEMENTS:
├─ Header: Gradient background (School's primary color → darker shade)
├─ Photo: Circular mask with white border (2px)
├─ Icons: Lucide icons next to each info field
├─ QR Code: Bottom right, scannable for digital verification
├─ Typography: Inter font family (modern, clean)
├─ Colors: School brand colors (primary for accents)
└─ Security: Hologram area placeholder (top right)
```

## 🎨 BACK SIDE - MODERN

```
┌──────────────────────────────────────────────────────────────┐
│ EMERGENCY CONTACT INFORMATION                                │ Header: Same gradient as front
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ 👤 Guardian: Sajjan Jamali (Father)                          │
│ 📱 Primary: +92 300 1234567                                  │
│ 📱 Secondary: +92 321 7654321                                │
│ 🏠 Address: House 123, Block B, DHA Phase 2, Karachi        │
│                                                               │
│ 🩸 Blood Group: B+        🎂 DOB: 04-Feb-2010                │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│ SCHOOL GUIDELINES                                            │
│ • Carry this card at all times on campus                    │
│ • Report lost cards immediately to admin office             │
│ • Non-transferable - misuse will result in action          │
│                                                               │
│ 📞 School Office: +92-21-1234567                             │
│ 🌐 www.almaschool.edu.pk                                     │
│                                                               │
│ ________________________    ________________________         │
│   Cardholder Signature          Authorized Signature         │
│                                                               │
│ Issue Date: 30-Aug-2024                      [Barcode]       │
└──────────────────────────────────────────────────────────────┘

DESIGN ELEMENTS:
├─ Section Headers: Bold with icon, colored dividers
├─ Info Grid: Two-column layout for space efficiency
├─ Guidelines: Bullet points, concise rules
├─ Signatures: Dashed lines for clarity
├─ Barcode: Bottom right, alternative to QR
├─ Footer: Issue date and school contact
└─ Security: Microtext around border (optional)
```

---

# Template 2: MINIMAL CARD DESIGN (Printer-Friendly)

## 🖨️ FRONT SIDE - MINIMAL

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  ╔═══════════════════════════════════════════════════╗       │
│  ║  ALMA SCHOOL                      [School Logo]   ║       │
│  ║  Sector I-7/2, Islamabad                          ║       │
│  ╚═══════════════════════════════════════════════════╝       │
│                                                               │
│   ┌─────────┐                                                │
│   │         │    NAME: ANAM FATIMA                           │
│   │  PHOTO  │    CLASS: 10-A          ROLL NO: 1002         │
│   │         │    FATHER: Sajjan Jamali                       │
│   │(square) │    CONTACT: +92 300 1234567                    │
│   └─────────┘                                                │
│                                                               │
│   STUDENT ID: STU-2024-001002                                │
│                                                               │
│   VALID FROM: 01-AUG-2024      TO: 30-JUN-2025              │
│                                                               │
│   ┌─────────┐                                                │
│   │  [QR]   │    This card is property of Alma School.      │
│   │  CODE   │    Report if found: admin@alma.edu.pk         │
│   └─────────┘                                                │
└──────────────────────────────────────────────────────────────┘

DESIGN ELEMENTS:
├─ Border: Double-line black border (high contrast)
├─ Layout: Left-aligned, grid-based for clarity
├─ Photo: Square with single border (easy to print)
├─ Typography: Arial/Times New Roman (universal fonts)
├─ Colors: Black text on white (photocopier-friendly)
├─ Labels: Uppercase labels for clarity (NAME:, CLASS:)
├─ QR Code: Bottom left, functional even in B&W
└─ Print-optimized: High contrast, clear spacing
```

## 🖨️ BACK SIDE - MINIMAL

```
┌──────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════╗   │
│  ║           EMERGENCY CONTACT DETAILS                   ║   │
│  ╚═══════════════════════════════════════════════════════╝   │
│                                                               │
│   GUARDIAN NAME:    Sajjan Jamali                            │
│   RELATION:         Father                                   │
│   PRIMARY PHONE:    +92 300 1234567                          │
│   ALTERNATE PHONE:  +92 321 7654321                          │
│   EMAIL:            sajjan.jamali@email.com                  │
│                                                               │
│   RESIDENTIAL ADDRESS:                                       │
│   House 123, Block B, DHA Phase 2                           │
│   Karachi, Sindh - 75500                                    │
│                                                               │
│  ────────────────────────────────────────────────────────   │
│                                                               │
│   BLOOD GROUP:   B+          DATE OF BIRTH:  04-Feb-2010    │
│   ADMISSION:     30-Aug-2021                                │
│                                                               │
│  ╔═══════════════════════════════════════════════════════╗   │
│  ║                IMPORTANT NOTES                        ║   │
│  ╚═══════════════════════════════════════════════════════╝   │
│   1. Carry this card on campus at all times.                │
│   2. This card is non-transferable.                         │
│   3. Report loss immediately to admin office.               │
│   4. Replacement fee: PKR 500                               │
│                                                               │
│   SCHOOL CONTACT: +92-21-1234567                            │
│                                                               │
│   _________________           _____________________________  │
│   Student Signature          Principal Signature & Stamp    │
│                                                               │
│   ISSUE DATE: 30-Aug-2024           CARD NO: ALM-001002     │
└──────────────────────────────────────────────────────────────┘

DESIGN ELEMENTS:
├─ Sections: Clear boxes with headers
├─ Labels: Left-aligned, colon-separated
├─ Spacing: Generous whitespace for readability
├─ Rules: Simple horizontal lines as dividers
├─ Signatures: Clear labeled signature areas
├─ Footer: Issue metadata (date, card number)
└─ Notes: Numbered list, concise instructions
```

---

# 👤 ROLE-SPECIFIC VARIATIONS

## STUDENT CARD (As above)
**Front shows:**
- Class & Section
- Roll Number
- Student email (if assigned)
- Parent contact

**Back shows:**
- Guardian details
- Blood group
- DOB
- Admission date

## FACULTY CARD

**Front shows:**
```
Name: MUHAMMAD AHMED
Role: Mathematics Teacher
Department: Senior Secondary
Employee ID: FAC-2024-056
Subjects: Math, Statistics
Contact: +92 300 9876543
```

**Back shows:**
```
Emergency Contact: (Wife) Ayesha Ahmed - +92 321 1234567
Blood Group: O+
Department Office: +92-21-1234567 Ext: 234
Valid: Jan 2024 - Dec 2025

Note: This card grants access to:
• Staff Room • Department Office • Library
• Computer Lab • Faculty Parking
```

## ADMIN/STAFF CARD

**Front shows:**
```
Name: SARAH KHAN
Role: School Administrator
Department: Administration
Employee ID: ADM-2024-012
Office: Ground Floor, Admin Block
Contact: +92 300 5555555
```

**Back shows:**
```
Emergency Contact: (Husband) Ali Khan - +92 321 9999999
Blood Group: A+
Direct Line: +92-21-1234567 Ext: 101

Access Level: ALL AREAS
Including: Admin Office, Finance, Principal Office,
Server Room, Storage, All Classrooms

Report lost card immediately.
Unauthorized use is strictly prohibited.
```

## VISITOR CARD

**Front shows:**
```
[Large "VISITOR" badge]
Name: ABDUL REHMAN
Company: XYZ Supplies
Purpose: Delivery
Valid: 17-May-2026 (Today Only)
Escorted By: Muhammad Ahmed (Staff)
```

**Back shows:**
```
VISITOR POLICY:
• Must be accompanied by staff at all times
• Access limited to designated areas only
• Return card to security desk before exit
• Photos/videos prohibited without permission

Check-In: 09:30 AM
Expected Checkout: 11:00 AM

Security Desk: Gate 1, +92-21-1234567
```

---

# 🎯 DESIGN RATIONALE (Why these choices?)

## From SECURITY GUARD Perspective:
✅ **Large photo** (25-30mm) - Easy identification from distance
✅ **Role badge prominent** - Instant visual categorization (Student/Teacher/Visitor)
✅ **Color coding** - Modern card uses different header colors per role
✅ **Validity dates large** - Quick expiry check
✅ **Emergency contact on back** - Critical for incidents
✅ **Visitor cards** - Time-limited, escort required

## From TEACHER Perspective:
✅ **Roll number visible** - Quick attendance marking
✅ **Class/Section clear** - Identify which class student belongs to
✅ **Contact info** - Reach parent if needed
✅ **Photo quality** - Recognize students easily

## From STUDENT Perspective:
✅ **Professional look** - Proud to carry (modern design)
✅ **Not childish** - Age-appropriate for high school
✅ **Durable info** - Won't fade with handling
✅ **Emergency details private** - On back side, not exposed

## From PARENT Perspective:
✅ **Clear emergency contacts** - Multiple numbers
✅ **Blood group visible** - Medical emergency preparedness
✅ **School contact easy** - Report lost card quickly
✅ **Replacement fee mentioned** - Know consequences

## From ADMIN Perspective:
✅ **Unique ID number** - Database tracking
✅ **QR code** - Digital verification, attendance integration
✅ **Issue date** - Track card generations
✅ **Barcode backup** - Redundant scanning option

---

# 🖨️ PRINTING SPECIFICATIONS

## Modern Card:
- **Material:** PVC plastic card (0.76mm thick)
- **Finish:** Glossy lamination
- **Print:** Full color (CMYK)
- **Technology:** Dye-sublimation printing
- **Cost:** ~₨50-80 per card
- **Durability:** 2-3 years with normal use

## Minimal Card:
- **Material:** 300gsm cardstock OR laminated paper
- **Finish:** Matte lamination
- **Print:** Black & white or 2-color
- **Technology:** Laser printer compatible
- **Cost:** ~₨10-20 per card
- **Durability:** 1 year (best for annual renewal)

## Print Layout (A4 Sheet):
```
┌─────────────────────────────┐
│  Card 1    Card 2    Card 3 │
│                              │
│  Card 4    Card 5    Card 6 │  9 cards per sheet
│                              │  with 3mm gutters
│  Card 7    Card 8    Card 9 │  and cut marks
└─────────────────────────────┘
```

---

# 📊 IMPLEMENTATION IN ALMA

## Template Configuration (Database):

```json
{
  "id": "template-modern-student",
  "name": "Modern Student Card",
  "role_type": "student",
  "dimensions": {
    "width": 85.6,
    "height": 54,
    "unit": "mm"
  },
  "front": {
    "layout": [
      {
        "field": "school_logo",
        "x": 70,
        "y": 4,
        "width": 12,
        "height": 12
      },
      {
        "field": "photo",
        "x": 5,
        "y": 15,
        "width": 25,
        "height": 30,
        "style": "rounded"
      },
      {
        "field": "name",
        "x": 32,
        "y": 18,
        "fontSize": 18,
        "fontWeight": "bold"
      },
      {
        "field": "role_class",
        "x": 32,
        "y": 26,
        "fontSize": 12
      },
      {
        "field": "qr_code",
        "x": 68,
        "y": 32,
        "width": 15,
        "height": 15
      }
    ],
    "styles": {
      "headerBg": "linear-gradient(135deg, #4F46E5, #3730A3)",
      "headerColor": "#FFFFFF",
      "bodyBg": "#FFFFFF",
      "textColor": "#1F2937",
      "accentColor": "#4F46E5"
    }
  },
  "back": {
    "layout": [
      {
        "field": "emergency_section",
        "x": 5,
        "y": 8,
        "width": 75,
        "height": 20
      },
      {
        "field": "guidelines_section",
        "x": 5,
        "y": 30,
        "width": 75,
        "height": 15
      }
    ]
  }
}
```

## UI Features:
1. **Template Selector:** Dropdown with preview thumbnails
2. **Live Preview:** Real-time rendering as data changes
3. **Bulk Generation:** "Generate for Class 10-A (45 students)"
4. **Print Layout:** Show 9-up layout before printing
5. **Download Options:** Individual PDFs or single multi-page PDF

---

# 🚀 COMPETITIVE ADVANTAGES

vs Competitor (AL NOOR ACADEMY):

| Feature | Competitor | Alma (Our System) |
|---------|-----------|-------------------|
| Design Quality | Dated, cluttered | Modern, professional |
| Printer Options | Glossy only | Both glossy + B&W friendly |
| Bulk Generation | One-by-one | Entire class in 1 click |
| Emergency Info | Not visible | Prominent on back |
| Security Features | Basic | QR + Barcode + Holograms |
| Role Variations | One size fits all | Student/Faculty/Visitor specific |
| Digital Verification | Manual only | QR scannable |
| Print Layout | Wasteful | 9 cards per A4 optimized |

**Result:** Schools see immediate value - professional cards at lower cost with better security. 🎯