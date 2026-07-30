# Cursor Prompt: ID Card Generation Module

```markdown
You are building a competitive ID Card Generation module for Alma SMS that will BEAT the competitor shown in the reference images. This must be the most intuitive, efficient, and feature-rich ID card system schools have ever used.

## CONTEXT
Alma is a Next.js/NestJS school management system. We're adding ID card generation for students and faculty. Our competitor has a basic system (see screenshots) - we need to build something 10x better that makes schools choose us.

## CORE USER FLOWS (Think from school admin perspective)

### Flow 1: Initial Setup (One-time)
1. Admin uploads school logo/seal
2. Chooses card template (or creates custom)
3. Configures which fields appear on cards (name, roll no, class, photo, QR code, emergency contact, blood group, etc.)
4. Sets card dimensions (standard 85.6mm × 54mm)
5. Saves as school's default template

### Flow 2: Bulk Card Generation (Most Common - OPTIMIZE THIS)
1. Navigate to ID Cards module
2. Select: "All Class 10-A students" or "All faculty" or "Custom selection"
3. System shows grid preview of all cards
4. Highlights issues: 23 students missing photos, 5 missing addresses
5. Admin uploads missing photos in bulk (drag-drop folder)
6. One-click: "Generate All Cards"
7. Downloads print-ready PDF (9 cards per A4 sheet, properly spaced)

### Flow 3: Individual Card (Quick)
1. Search student name
2. Live preview shows their card
3. Edit details inline
4. Download or mark for batch print

### Flow 4: Reprint Management
1. Student lost card → Admin marks "Reprint requested"
2. System logs: Date, reason, charged fee
3. Reprinted cards have "REISSUED" watermark
4. Track reprint history per student

## KEY DIFFERENTIATORS (Why schools choose us over competitor)

1. **Bulk Operations**: Generate 500 cards in one click (competitor: one-by-one)
2. **Photo Intelligence**: Auto-crop faces, background removal, proper card ratio
3. **Print Optimization**: Multiple cards per sheet, cut marks, bleed area
4. **Digital Cards**: Students download to phone (Apple Wallet/Google Pay format)
5. **QR Verification**: Scan to verify authenticity + view digital profile
6. **Two-Sided Design**: Front has photo/details, back has emergency contacts/rules
7. **Role Templates**: Different designs for students/teachers/admin/visitors
8. **Academic Year Auto-Expiry**: Cards show valid period
9. **Approval Workflow**: Bulk review before printing (catch errors early)
10. **Branding Consistency**: School colors, fonts, logo placement enforced

## TECHNICAL ARCHITECTURE

### Backend (NestJS)
```
backend/src/modules/id-cards/
├── id-cards.module.ts
├── id-cards.controller.ts
├── id-cards.service.ts
├── templates.controller.ts
├── templates.service.ts
├── photo-processing.service.ts (sharp for cropping/compression)
├── pdf-generation.service.ts (puppeteer for print-ready PDFs)
├── qr-generator.service.ts
└── dto/
    ├── card-template.dto.ts
    ├── generate-cards.dto.ts
    └── card-config.dto.ts
```

### Database Schema
```sql
-- Card templates (customizable per school)
CREATE TABLE id_card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(100), -- "Student Modern", "Faculty Classic"
  role_type VARCHAR(20), -- 'student' | 'faculty' | 'admin' | 'visitor'
  card_side VARCHAR(10), -- 'front' | 'back'
  dimensions JSONB, -- {width: 85.6, height: 54, unit: 'mm'}
  layout JSONB, -- {fields: [{name: 'photo', x: 10, y: 10, width: 30, height: 40}]}
  styles JSONB, -- {primaryColor: '#1e40af', font: 'Inter', logoUrl: '...'}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated cards (track who has what)
CREATE TABLE id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  person_id UUID, -- student_id or user_id
  person_type VARCHAR(20), -- 'student' | 'faculty'
  card_number VARCHAR(50) UNIQUE, -- "ALM-2024-STU-001002"
  template_id UUID REFERENCES id_card_templates(id),
  photo_url TEXT,
  qr_code_url TEXT,
  front_pdf_url TEXT,
  back_pdf_url TEXT,
  status VARCHAR(20), -- 'draft' | 'approved' | 'printed' | 'issued' | 'revoked'
  valid_from DATE,
  valid_until DATE,
  print_count INTEGER DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  issued_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reprint log (audit trail)
CREATE TABLE id_card_reprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES id_cards(id),
  reason VARCHAR(255), -- "Lost", "Damaged", "Photo update"
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  fee_charged DECIMAL(10,2),
  printed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photo storage
CREATE TABLE id_card_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  person_id UUID,
  person_type VARCHAR(20),
  original_url TEXT,
  processed_url TEXT, -- Cropped, compressed for card
  face_detected BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Frontend (Next.js + Mantine)
```
frontend/src/app/(portal)/id-cards/
├── page.tsx (Main dashboard)
├── templates/
│   └── page.tsx (Template editor)
├── generate/
│   └── page.tsx (Bulk generation wizard)
└── [id]/
    └── page.tsx (Single card editor)

frontend/src/components/id-cards/
├── CardPreview.tsx (Live preview component)
├── BulkPhotoUpload.tsx (Drag-drop multiple photos)
├── TemplateDesigner.tsx (Visual card designer)
├── CardGrid.tsx (Grid of cards with filters)
├── PrintLayoutPreview.tsx (A4 sheet preview)
└── QRScanner.tsx (Verify scanned cards)
```

## UI/UX SPECIFICATIONS

### Main Dashboard (/id-cards)
```tsx
Layout:
┌─────────────────────────────────────────────────┐
│ [ID Cards]                    [+ Generate Cards] │
├─────────────────────────────────────────────────┤
│ Tabs: [ Students ] [ Faculty ] [ Templates ]    │
├─────────────────────────────────────────────────┤
│ Filters: [Class ▼] [Status ▼] [Search...]       │
│ View: [Grid ⊞] [List ≡]   [⚙️ Bulk Actions ▼]  │
├─────────────────────────────────────────────────┤
│ Cards Stats:                                     │
│ ✓ 450 Issued  ⏱ 23 Pending  ❌ 12 Missing Photos│
├─────────────────────────────────────────────────┤
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐            │
│  │Card │  │Card │  │Card │  │Card │  (Grid view)│
│  │ 👤  │  │ 👤  │  │ 👤  │  │ ⚠️  │            │
│  │Name │  │Name │  │Name │  │No   │            │
│  │1002 │  │1003 │  │1004 │  │Photo│            │
│  └─────┘  └─────┘  └─────┘  └─────┘            │
└─────────────────────────────────────────────────┘
```

### Card Preview Component
- Live rendering (changes reflect immediately)
- Both sides (Front/Back) toggle
- Actual size indicator (shows real 85.6mm × 54mm)
- Print preview (9 cards per A4 sheet with cut marks)

### Bulk Generation Wizard
Step 1: Select recipients (class, section, or custom)
Step 2: Upload photos (if missing) - drag folder, auto-match by name/roll no
Step 3: Review & fix issues (red flags for missing data)
Step 4: Generate (progress bar, estimated time)
Step 5: Download (Single PDF or ZIP with individual files)

## CRITICAL FEATURES (Must have before launch)

### Backend
1. ✅ Template CRUD (create, read, update, delete templates)
2. ✅ Bulk card generation (batch process, queue for large sets)
3. ✅ Photo processing (auto-crop face, compress, standard size)
4. ✅ QR code generation (unique per card, verification API)
5. ✅ PDF generation (print-ready with proper dimensions)
6. ✅ Reprint tracking (log all reprints with reason)
7. ✅ Approval workflow (draft → approved → printed)

### Frontend
1. ✅ Responsive grid/list view
2. ✅ Bulk photo upload with preview
3. ✅ Live card preview (both sides)
4. ✅ Template designer (drag-drop fields, color picker)
5. ✅ Print layout preview (A4 sheet with multiple cards)
6. ✅ Filter & search (by class, status, name)
7. ✅ Bulk actions (select multiple → approve/print/delete)

## IMPLEMENTATION PHASES

### Phase 1: MVP (Week 1) - Ship this first
- Database schema + migrations
- Basic template (fixed design, no customization yet)
- Single card generation (student/faculty)
- Photo upload & display
- PDF download (one card)
- Grid view with filters

### Phase 2: Bulk Operations (Week 2)
- Bulk generation (select class → generate all)
- Bulk photo upload (match by name/roll)
- Print layout (9 cards per A4)
- Approval workflow
- Missing data detection

### Phase 3: Customization (Week 3)
- Template designer (visual editor)
- School branding (logo, colors, fonts)
- Two-sided cards (front + back)
- QR code generation
- Digital card export (Apple/Google Wallet)

### Phase 4: Advanced (Week 4)
- Reprint management + fee tracking
- Photo auto-crop (face detection with sharp)
- Batch approval UI
- Analytics (cards printed, reprint rate)
- QR verification scanner

## DESIGN SYSTEM (Match Alma's existing UI)

### Colors
- Primary: Indigo (Mantine theme)
- Success: Green (approved/issued)
- Warning: Yellow (pending approval)
- Error: Red (missing photo/data)

### Components
- Use Mantine DataTable for grid
- Mantine Modal for editors
- Mantine FileInput with drag-drop
- Mantine Tabs for Students/Faculty
- Mantine Badge for status
- Mantine ActionIcon for quick actions

### Responsive
- Mobile: Stack cards vertically, hide bulk actions
- Tablet: 2-column grid
- Desktop: 4-column grid with sidebar filters

## CODE QUALITY STANDARDS

1. **Reuse existing patterns**: Check how RMS handles similar features
2. **Type safety**: Strict TypeScript, no `any`
3. **Error handling**: User-friendly messages ("Photo too large" not "Error 500")
4. **Performance**: Lazy load cards, virtual scrolling for 1000+ items
5. **Accessibility**: Keyboard navigation, screen reader labels
6. **Testing**: Unit tests for PDF generation, photo processing
7. **Security**: RLS policies, only school_admin can generate cards
8. **i18n**: All text in en-GB.json (British English)

## PSYCHOLOGICAL TRICKS FOR BETTER UX

1. **Progress visibility**: Show "Generating 450 cards... 32% done" not loading spinner
2. **Error prevention**: "23 students missing photos - upload now?" before generation
3. **Batch confirmation**: "Generate 450 cards? This will take ~2 minutes" (set expectations)
4. **Success feedback**: "✓ 450 cards generated! Ready to print" with confetti animation
5. **Quick wins**: Default template works immediately (customize later)
6. **Undo safety**: "Card deleted. [Undo]" toast for 5 seconds
7. **Smart defaults**: Auto-fill today's date for valid_from, academic year end for valid_until
8. **Contextual help**: "💡 Tip: Upload photos in bulk by matching filenames to roll numbers"

## COMPETITIVE ADVANTAGES (Marketing points)

vs Competitor:
- ⚡ 10x faster: Bulk generation vs one-by-one
- 🎨 Modern designs: Actually looks professional
- 📱 Digital cards: Download to phone
- 🔍 Smart photo matching: Auto-match photos by name
- 📄 Print optimization: 9 cards per A4 vs wasteful layouts
- ✅ Approval workflow: Catch errors before printing
- 📊 Analytics: Track reprint rate, identify lost cards
- 🔐 QR verification: Scan to verify authenticity
- 💾 Templates: Reuse designs across years
- 🌐 Two-sided cards: Utilize both sides effectively

## FINAL INSTRUCTIONS

1. Start with Phase 1 MVP - get something working first
2. Match existing Alma patterns (check similar modules)
3. Mobile-first responsive (school admins use phones)
4. British English (Alma's target market)
5. RLS policies on all tables (tenant isolation)
6. Explicit column selection (never SELECT *)
7. Optimistic UI updates (show success immediately)
8. Comprehensive error messages (tell user how to fix)

Build this like you're competing for a $1M contract. Every detail matters. Make it so good that schools switch from competitor to Alma just for this feature.

Now: Start with Phase 1 database schema and migrations. Show me the SQL.
```

---

**Usage in Cursor:**

1. Save as `.cursor/commands/build-id-cards.md`
2. Open Cursor
3. Cmd/Ctrl + Shift + P → type `build-id-cards`
4. Cursor will follow this prompt to build the module

The prompt includes:
- ✅ Competitive analysis
- ✅ User flow thinking
- ✅ Technical architecture
- ✅ Phased implementation
- ✅ Psychological UX tricks
- ✅ Clear success criteria
- ✅ Marketing differentiation

This will guide Cursor to build a feature that makes clients choose Alma over competitors! 🚀