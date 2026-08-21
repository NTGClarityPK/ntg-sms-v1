/**
 * Built-in PDF layout CSS for Minimal / Modern report cards.
 * Used when external `resultmoduleredsign/` HTML templates are not present.
 * Class names match the inner HTML builders in `result-report-pdf-html.ts`.
 * Colours use `--pdf-*` variables from `buildPdfThemeVariablesCss`.
 */

export const MINIMAL_PDF_TEMPLATE_CSS = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 11.5px;
  line-height: 1.45;
  color: #1a1a1a;
  background: #fff;
}
.report-card, .progress-report { padding: 8px 10px 16px; }
.header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 12px; }
.header h1 { font-size: 18px; font-weight: 700; margin: 0 0 4px; letter-spacing: 0.02em; }
.header .subtitle, .header .note { font-size: 11px; color: #444; margin: 2px 0; }
.header .report-type {
  display: inline-block;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border: 1px solid #222;
  padding: 3px 10px;
}
.student-info table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.student-info td { padding: 4px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
.student-info td:nth-child(odd) { font-weight: 600; width: 18%; color: #333; }
.student-info td:nth-child(even) { width: 32%; }
.section-heading {
  font-size: 12.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 14px 0 6px;
  padding-bottom: 3px;
  border-bottom: 1px solid #222;
}
.performance-table, .assessments-table, .subjects-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}
.performance-table th, .assessments-table th, .subjects-table th,
.performance-table td, .assessments-table td, .subjects-table td {
  border: 1px solid #333;
  padding: 5px 6px;
  text-align: left;
}
.performance-table th, .assessments-table th, .subjects-table th {
  background: #f2f2f2;
  font-weight: 700;
  font-size: 10.5px;
  text-transform: uppercase;
}
.subject-name { font-weight: 600; }
.total-row td { font-weight: 700; background: #f7f7f7; }
.summary-section { margin: 8px 0 12px; }
.summary-grid { display: flex; gap: 10px; }
.summary-item {
  flex: 1;
  border: 1px solid #333;
  padding: 8px 10px;
  text-align: center;
}
.summary-item .label { font-size: 10px; text-transform: uppercase; color: #555; }
.summary-item .value { font-size: 18px; font-weight: 700; margin-top: 2px; }
.remarks-box {
  border: 1px solid #333;
  padding: 8px 10px;
  margin: 8px 0 12px;
  min-height: 48px;
}
.remarks-box .title { font-weight: 700; font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
.remarks-box p { margin: 0; }
.info-box {
  border: 1px solid #555;
  background: #fafafa;
  padding: 8px 10px;
  margin-bottom: 10px;
  font-size: 11px;
}
.signatures { display: flex; gap: 16px; margin-top: 28px; }
.signature-block, .signature-box { flex: 1; text-align: center; }
.signature-line { border-top: 1px solid #222; margin: 28px 8px 6px; }
.signature-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; }
.footer {
  margin-top: 18px;
  padding-top: 8px;
  border-top: 1px solid #ccc;
  font-size: 10px;
  color: #555;
  text-align: center;
}
.footer p { margin: 2px 0; }
`;

export const MODERN_PDF_TEMPLATE_CSS = `
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 11.5px;
  line-height: 1.45;
  color: #1c2430;
  background: #fff;
}
.report-card, .progress-report { padding: 0 4px 12px; }
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  background: var(--pdf-grad-strong, linear-gradient(135deg, #0e7c74 0%, #11998e 50%, #4ecdc4 100%));
  color: #fff;
  padding: 16px 18px;
  border-radius: 10px;
  margin-bottom: 12px;
}
.header .school-info h1, .header h1 { margin: 0; font-size: 18px; font-weight: 700; color: #fff; }
.header .school-info p, .header .subtitle { margin: 4px 0 0; font-size: 11px; color: rgba(255,255,255,0.9); }
.header .report-title { text-align: right; }
.header .report-title h2 { margin: 0; font-size: 15px; font-weight: 700; color: #fff; }
.header .report-title p { margin: 4px 0 0; font-size: 11px; color: rgba(255,255,255,0.9); }
.header .report-type {
  display: inline-block;
  margin-top: 8px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.35);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.header .report-badge {
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.35);
  padding: 8px 12px;
  border-radius: 8px;
  font-weight: 700;
  white-space: nowrap;
}
.student-section, .student-bar {
  background: var(--pdf-grad-panel, linear-gradient(180deg, #e8f7f5 0%, #f6fbfa 100%));
  border: 1px solid var(--pdf-soft, #d5efec);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.student-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.student-name { font-size: 16px; font-weight: 700; color: var(--pdf-dark, #0e7c74); }
.student-meta, .date-info { font-size: 11px; color: #3d4a55; }
.student-details { display: flex; flex-wrap: wrap; gap: 10px 18px; }
.detail-item { min-width: 140px; }
.detail-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #66707a; }
.detail-value { display: block; font-weight: 700; font-size: 12.5px; color: #1c2430; }
.section-title, .section-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--pdf-dark, #0e7c74);
  margin: 14px 0 8px;
}
.section-icon { font-size: 13px; }
.subjects-table, .performance-table, .assessments-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--pdf-soft, #d5efec);
}
.subjects-table th, .performance-table th, .assessments-table th {
  background: var(--pdf-a, #11998e);
  color: #fff;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 7px 8px;
  text-align: left;
}
.subjects-table td, .performance-table td, .assessments-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #e6eef0;
}
.subjects-table tbody tr:nth-child(even),
.performance-table tbody tr:nth-child(even),
.assessments-table tbody tr:nth-child(even) { background: #f7fbfb; }
.total-row td { background: var(--pdf-pale, #f3faf9) !important; font-weight: 700; }
.grade-badge {
  display: inline-block;
  min-width: 28px;
  text-align: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-weight: 700;
  font-size: 11px;
  color: #fff;
}
.grade-a-plus, .grade-a { background: #0f9d58; }
.grade-b { background: #1a73e8; }
.grade-c { background: #f9ab00; color: #1c2430; }
.grade-f { background: #d93025; }
.summary-cards, .performance-grid, .summary-grid {
  display: flex;
  gap: 10px;
  margin: 8px 0 14px;
}
.summary-card, .performance-card, .summary-item {
  flex: 1;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid var(--pdf-soft, #d5efec);
  text-align: center;
}
.summary-card h3, .performance-card h3, .summary-item .label {
  margin: 0;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #66707a;
}
.summary-card .value, .performance-card .value, .summary-item .value {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 800;
  color: var(--pdf-dark, #0e7c74);
}
.summary-card.attendance, .performance-card.good { background: var(--pdf-pale, #f3faf9); }
.summary-card.conduct { background: #fff8e8; border-color: #f3e0a8; }
.remarks-section, .remarks-box {
  background: var(--pdf-pale, #f3faf9);
  border-left: 4px solid var(--pdf-a, #11998e);
  border-radius: 0 8px 8px 0;
  padding: 10px 12px;
  margin: 8px 0 14px;
}
.remarks-section h3, .remarks-box .title { margin: 0 0 4px; font-size: 12px; color: var(--pdf-dark, #0e7c74); }
.remarks-section p, .remarks-box p { margin: 0; }
.alert-banner {
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: #eef6ff;
  border: 1px solid #c9def8;
}
.alert-banner.info { background: var(--pdf-pale, #f3faf9); border-color: var(--pdf-soft, #d5efec); }
.alert-banner h3 { margin: 0 0 4px; font-size: 12px; }
.alert-banner p { margin: 0; }
.recent-assessments { display: flex; flex-direction: column; gap: 8px; }
.assessment-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--pdf-soft, #d5efec);
  border-radius: 8px;
  padding: 8px 12px;
  background: #fff;
}
.assessment-info h4 { margin: 0 0 2px; font-size: 12.5px; }
.assessment-info .meta { font-size: 11px; color: #66707a; }
.assessment-score { text-align: right; }
.score-value { font-size: 18px; font-weight: 800; color: var(--pdf-dark, #0e7c74); }
.score-total { font-size: 10px; text-transform: uppercase; color: #66707a; }
.signatures { display: flex; gap: 14px; margin-top: 22px; }
.signature-box, .signature-block { flex: 1; text-align: center; }
.signature-line { border-top: 2px solid var(--pdf-mid, #4bb8af); margin: 26px 6px 6px; }
.signature-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #3d4a55; }
.footer {
  margin-top: 16px;
  padding: 8px 4px 0;
  border-top: 1px solid var(--pdf-soft, #d5efec);
  font-size: 10px;
  color: #66707a;
  text-align: center;
}
.footer p { margin: 2px 0; }
.continuation-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  background: var(--pdf-a, #11998e);
  color: #fff;
  padding: 8px 12px;
  border-radius: 8px 8px 0 0;
}
.continuation-session { font-weight: 700; }
.continuation-meta, .continuation-school { font-size: 11px; opacity: 0.92; }
.student-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  background: var(--pdf-pale, #f3faf9);
  border: 1px solid var(--pdf-soft, #d5efec);
  border-top: 0;
  border-radius: 0 0 8px 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 11px;
}
.student-info table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
.student-info td { padding: 5px 6px; border-bottom: 1px solid #e6eef0; }
.student-info td:nth-child(odd) { font-weight: 600; color: #3d4a55; width: 18%; }
.info-box {
  background: var(--pdf-pale, #f3faf9);
  border: 1px solid var(--pdf-soft, #d5efec);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
`;

export function getBuiltInPdfTemplateStyles(fileName: string): string | null {
  if (fileName.includes('minimal')) return MINIMAL_PDF_TEMPLATE_CSS;
  if (fileName.includes('modern')) return MODERN_PDF_TEMPLATE_CSS;
  return null;
}
