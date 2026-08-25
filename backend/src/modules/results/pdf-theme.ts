/**
 * PDF report accent colours: tenant primary (when set) or default teal reference palette.
 * Injected before template CSS so `var(--pdf-*)` in design HTML resolves correctly.
 */

/** Fallback when tenant theme is unset (matches `buildPdfThemeVariablesCss`). */
export const PDF_DEFAULT_PRIMARY = '#11998e';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace('#', '');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  const x = clamp(t, 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * x),
    g: Math.round(a.g + (b.g - a.g) * x),
    b: Math.round(a.b + (b.b - a.b) * x),
  };
}

function rgbToHex(c: { r: number; g: number; b: number }): string {
  return `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Valid #RRGGBB or null → use default reference primary. */
export function buildPdfThemeVariablesCss(primaryHex: string | null | undefined): string {
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const raw =
    primaryHex && typeof primaryHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(primaryHex.trim())
      ? primaryHex.trim()
      : PDF_DEFAULT_PRIMARY;
  const anchor = hexToRgb(raw) ?? hexToRgb(PDF_DEFAULT_PRIMARY)!;
  const pdfA = rgbToHex(anchor);
  const pdfB = rgbToHex(mixRgb(anchor, white, 0.42));
  const pdfDark = rgbToHex(mixRgb(anchor, black, 0.2));
  const pdfMid = rgbToHex(mixRgb(anchor, white, 0.28));
  const pdfSoft = rgbToHex(mixRgb(anchor, white, 0.82));
  const pdfPale = rgbToHex(mixRgb(anchor, white, 0.92));
  return `:root {
  --pdf-a: ${pdfA};
  --pdf-b: ${pdfB};
  --pdf-dark: ${pdfDark};
  --pdf-mid: ${pdfMid};
  --pdf-soft: ${pdfSoft};
  --pdf-pale: ${pdfPale};
  --pdf-grad-strong: linear-gradient(135deg, var(--pdf-dark) 0%, var(--pdf-a) 50%, var(--pdf-b) 100%);
  --pdf-grad-mid: linear-gradient(135deg, var(--pdf-a) 0%, var(--pdf-b) 100%);
  --pdf-grad-panel: linear-gradient(180deg, var(--pdf-soft) 0%, var(--pdf-pale) 100%);
}`;
}

/** Shared print rules: sticky footer within page, table header repeat, fewer broken rows. */
export const PDF_PRINT_LAYOUT_CSS = `
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
.subjects-table tbody tr,
.performance-table tbody tr,
.assessments-table tbody tr {
  break-inside: avoid;
  page-break-inside: avoid;
}
.report-card,
.progress-report {
  min-height: 280mm;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.report-card .content,
.progress-report .content {
  flex: 1 1 auto;
}
.report-card > .footer,
.progress-report > .footer {
  margin-top: auto;
  flex-shrink: 0;
}
.report-card > .header,
.report-card > .student-section,
.report-card > .student-info,
.report-card > .continuation-header,
.report-card > .student-strip,
.progress-report > .header,
.progress-report > .student-bar {
  flex-shrink: 0;
}
.section-title,
.section-heading {
  break-after: avoid;
  page-break-after: avoid;
}
/* Detailed compact: avoid orphan footer page from forced card height */
.report-card--detailed-compact {
  min-height: 0 !important;
  height: auto !important;
  display: block !important;
  font-size: 11px;
}
.report-card--detailed-compact .content {
  flex: none !important;
}
.report-card--detailed-compact .footer {
  margin-top: 8px !important;
  page-break-before: avoid;
  break-before: avoid;
}
.report-card--detailed-compact .header h1,
.report-card--detailed-compact .report-title h2 {
  font-size: 16px !important;
  margin: 0 0 4px !important;
}
.report-card--detailed-compact .section-title,
.report-card--detailed-compact .section-heading {
  margin: 8px 0 4px !important;
  font-size: 12px !important;
}
.report-card--detailed-compact .subjects-table th,
.report-card--detailed-compact .subjects-table td,
.report-card--detailed-compact .performance-table th,
.report-card--detailed-compact .performance-table td {
  padding: 3px 6px !important;
  font-size: 10px !important;
}
.report-card--detailed-compact .signatures {
  margin-top: 10px !important;
}
.report-card--detailed-compact .remarks-box,
.report-card--detailed-compact .remarks-section {
  margin: 6px 0 !important;
}
/*
 * Screen-style flex + min-height pins the footer to the bottom of one "card", which is
 * correct for short single-page PDFs. When the same card spans multiple printed pages,
 * flex-grow on .content creates a huge empty band on continuation pages (footer at column end).
 * For print/PDF, use normal block flow so fragments read naturally.
 */
@media print {
  .report-card,
  .progress-report {
    min-height: auto !important;
    display: block !important;
  }
  .report-card .content,
  .progress-report .content {
    flex: none !important;
  }
  .report-card > .footer,
  .progress-report > .footer {
    margin-top: 8px !important;
  }
  .report-card--detailed-compact {
    min-height: 0 !important;
  }
}
`;
