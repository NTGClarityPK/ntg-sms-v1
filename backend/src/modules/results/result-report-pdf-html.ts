/**
 * Server-side HTML for result report PDFs (Puppeteer).
 * Markup matches `resultmoduleredsign/htmldesignfilesofreports/*.html` class names
 * so extracted <style> blocks from those files apply correctly.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ReportKind } from './dto/report-kind.enum';
import type { ResultType } from './dto/result-type.enum';
import type { DetailedStudentResultDto } from './dto/detailed-student-result.dto';
import type { StudentResultDto } from './dto/student-result.dto';
import { PDF_PRINT_LAYOUT_CSS } from './pdf-theme';

export function escapeHtmlPdf(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

export function ordinalEn(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function resolveDesignTemplatePath(fileName: string): string | null {
  const candidates = [
    join(__dirname, '../../../resultmoduleredsign/htmldesignfilesofreports', fileName),
    join(process.cwd(), 'resultmoduleredsign', 'htmldesignfilesofreports', fileName),
    join(process.cwd(), '..', 'resultmoduleredsign', 'htmldesignfilesofreports', fileName),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function readDesignTemplateStyleBlock(fileName: string): string | null {
  const p = resolveDesignTemplatePath(fileName);
  if (!p) return null;
  const template = readFileSync(p, 'utf-8');
  const styleMatch = template.match(/<style>([\s\S]*?)<\/style>/i);
  return styleMatch ? styleMatch[1] : null;
}

export function composeDesignPdfHtml(
  styleBlock: string,
  bodyInner: string,
  wrapperClass: 'report-card' | 'progress-report',
  themeVariablesCss: string,
): string {
  const pageBreakCss = `.page-break { page-break-before: always; }\n`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>${pageBreakCss}${themeVariablesCss}\n${styleBlock}\n${PDF_PRINT_LAYOUT_CSS}</style></head><body><div class="${wrapperClass}">${bodyInner}</div></body></html>`;
}

export function composeDesignPdfHtmlMultiCard(styleBlock: string, cardInners: string[], themeVariablesCss: string): string {
  const pageBreakCss = `.page-break { page-break-before: always; }\n`;
  const body = cardInners
    .map((inner, i) => `${i > 0 ? '<div class="page-break"></div>' : ''}<div class="report-card">${inner}</div>`)
    .join('\n');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>${pageBreakCss}${themeVariablesCss}\n${styleBlock}\n${PDF_PRINT_LAYOUT_CSS}</style></head><body>${body}</body></html>`;
}

function reportBannerForKind(reportKind: ReportKind, resultType: ResultType): string {
  if (reportKind === 'annual_report') return 'ANNUAL REPORT CARD';
  if (reportKind === 'progress_report') return 'PROGRESS REPORT';
  if (resultType === 'interim') return 'INTERIM REPORT CARD';
  if (resultType === 'mid_term') return 'MID-TERM REPORT CARD';
  return 'FINAL TERM REPORT CARD';
}

function termLabel(resultType: ResultType): string {
  if (resultType === 'interim') return 'Interim';
  if (resultType === 'mid_term') return 'Mid-term';
  return 'Final';
}

/** Build minimal `.report-card` inner for term or annual basic reports. */
export function buildMinimalTermAnnualReportInner(input: {
  reportKind: ReportKind;
  resultType: ResultType;
  schoolLine1: string;
  schoolLine2: string;
  academicYearName: string;
  studentName: string;
  rollNumber: string;
  classLabel: string;
  classRank: number | null;
  reportDate: string;
  result: StudentResultDto;
  classTeacherComment?: string;
}): string {
  const banner = reportBannerForKind(input.reportKind, input.resultType);
  const termOrContext =
    input.reportKind === 'annual_report'
      ? 'Annual summary'
      : input.reportKind === 'progress_report'
        ? 'Progress update'
        : `${termLabel(input.resultType)} term`;
  const line2 = input.schoolLine2.trim()
    ? `<div class="subtitle">${escapeHtmlPdf(input.schoolLine2)}</div>`
    : '';
  const rankCell = input.classRank != null ? `${ordinalEn(input.classRank)} in class` : '—';
  let rows = '';
  for (const s of input.result.subjects) {
    rows += `<tr><td class="subject-name">${escapeHtmlPdf(s.subjectName)}</td><td>${s.marksObtained}</td><td>${s.totalMarks}</td><td>${s.percentage}%</td><td>${escapeHtmlPdf(s.letterGrade ?? '—')}</td></tr>`;
  }
  if (input.result.subjects.length === 0) {
    rows = '<tr><td colspan="5">No grades recorded</td></tr>';
  }
  const overallRow =
    input.result.overallPercentage != null
      ? `<tr class="total-row"><td>TOTAL / OVERALL</td><td colspan="2">—</td><td><strong>${input.result.overallPercentage}%</strong></td><td><strong>${escapeHtmlPdf(input.result.overallLetterGrade ?? '—')}</strong></td></tr>`
      : '';
  const overallGrade = input.result.overallLetterGrade ?? '—';
  const overallPct = input.result.overallPercentage != null ? `${input.result.overallPercentage}%` : '—';
  const remarksTeacher =
    input.classTeacherComment && input.classTeacherComment.trim()
      ? `<div class="remarks-box"><div class="title">Class teacher remarks</div><p>${escapeHtmlPdf(input.classTeacherComment.trim())}</p></div>`
      : '';
  return `
        <div class="header">
            <h1>${escapeHtmlPdf(input.schoolLine1)}</h1>
            ${line2}
            <div class="report-type">${escapeHtmlPdf(banner)}</div>
            <div class="subtitle">${escapeHtmlPdf(input.academicYearName)}</div>
        </div>
        <div class="student-info">
            <table>
                <tr>
                    <td>Student name:</td>
                    <td>${escapeHtmlPdf(input.studentName)}</td>
                    <td>Roll number:</td>
                    <td>${escapeHtmlPdf(input.rollNumber || '—')}</td>
                </tr>
                <tr>
                    <td>Class:</td>
                    <td>${escapeHtmlPdf(input.classLabel)}</td>
                    <td>Class position:</td>
                    <td>${escapeHtmlPdf(rankCell)}</td>
                </tr>
                <tr>
                    <td>Period:</td>
                    <td>${escapeHtmlPdf(termOrContext)}</td>
                    <td>Report date:</td>
                    <td>${escapeHtmlPdf(input.reportDate)}</td>
                </tr>
            </table>
        </div>
        <div class="content">
        <div class="section-heading">Academic performance</div>
        <table class="performance-table">
            <thead>
                <tr>
                    <th>Subject</th>
                    <th>Marks obtained</th>
                    <th>Total marks</th>
                    <th>Percentage</th>
                    <th>Grade</th>
                </tr>
            </thead>
            <tbody>${rows}${overallRow}</tbody>
        </table>
        <div class="section-heading">Summary</div>
        <div class="summary-section">
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="label">Overall grade</div>
                    <div class="value">${escapeHtmlPdf(overallGrade)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Overall %</div>
                    <div class="value">${escapeHtmlPdf(overallPct)}</div>
                </div>
                <div class="summary-item">
                    <div class="label">Conduct</div>
                    <div class="value">—</div>
                    <div style="font-size: 11px; margin-top: 5px;">See term report</div>
                </div>
            </div>
        </div>
        ${remarksTeacher}
        <div class="signatures">
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Class teacher</div>
            </div>
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Parent / guardian</div>
            </div>
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Principal</div>
            </div>
        </div>
        </div>
        <div class="footer">
            <p><strong>This document was generated from the school management system.</strong></p>
            <p>For queries, please contact the school office.</p>
        </div>`;
}

export function buildModernTermAnnualReportInner(input: {
  reportKind: ReportKind;
  resultType: ResultType;
  schoolLine1: string;
  schoolLine2: string;
  academicYearName: string;
  studentName: string;
  rollNumber: string;
  classLabel: string;
  classRank: number | null;
  reportDate: string;
  result: StudentResultDto;
  classTeacherComment?: string;
}): string {
  const banner =
    input.reportKind === 'annual_report'
      ? 'Annual report'
      : input.reportKind === 'progress_report'
        ? 'Progress report'
        : input.resultType === 'interim'
          ? 'Interim report'
          : input.resultType === 'mid_term'
            ? 'Mid-term report'
            : 'Final term report';
  const rankStr =
    input.classRank != null ? `${ordinalEn(input.classRank)} / class` : '—';
  let rows = '';
  for (const s of input.result.subjects) {
    const g = (s.letterGrade ?? '—').toUpperCase();
    let badgeClass = 'grade-b';
    if (g.includes('A+') || g === 'A+') badgeClass = 'grade-a-plus';
    else if (g.startsWith('A')) badgeClass = 'grade-a';
    else if (g.startsWith('C')) badgeClass = 'grade-c';
    else if (g.startsWith('D') || g.startsWith('E') || g.startsWith('F')) badgeClass = 'grade-f';
    rows += `<tr>
      <td><strong>${escapeHtmlPdf(s.subjectName)}</strong></td>
      <td>${s.marksObtained}</td>
      <td>${s.totalMarks}</td>
      <td>${s.percentage}%</td>
      <td><span class="grade-badge ${badgeClass}">${escapeHtmlPdf(s.letterGrade ?? '—')}</span></td>
    </tr>`;
  }
  if (input.result.subjects.length === 0) {
    rows = '<tr><td colspan="5">No grades recorded</td></tr>';
  }
  const overallRow =
    input.result.overallPercentage != null
      ? `<tr class="total-row">
      <td><strong>Overall</strong></td>
      <td colspan="2"></td>
      <td><strong>${input.result.overallPercentage}%</strong></td>
      <td><span class="grade-badge grade-a-plus">${escapeHtmlPdf(input.result.overallLetterGrade ?? '—')}</span></td>
    </tr>`
      : '';
  const subLine = input.schoolLine2.trim()
    ? `<p>${escapeHtmlPdf(input.schoolLine2)}</p>`
    : '';
  const remarks =
    input.classTeacherComment && input.classTeacherComment.trim()
      ? `<div class="remarks-section"><h3>Class teacher</h3><p>${escapeHtmlPdf(input.classTeacherComment.trim())}</p></div>`
      : '';
  return `
    <div class="header">
      <div class="school-info">
        <h1>${escapeHtmlPdf(input.schoolLine1)}</h1>
        ${subLine}
      </div>
      <div class="report-title">
        <h2>${escapeHtmlPdf(banner)}</h2>
        <p>${escapeHtmlPdf(input.academicYearName)}</p>
      </div>
    </div>
    <div class="student-section">
      <div class="student-details">
        <div class="detail-item">
          <span class="detail-label">Student name</span>
          <span class="detail-value">${escapeHtmlPdf(input.studentName)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Roll number</span>
          <span class="detail-value">${escapeHtmlPdf(input.rollNumber || '—')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Class</span>
          <span class="detail-value">${escapeHtmlPdf(input.classLabel)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Class position</span>
          <span class="detail-value">${escapeHtmlPdf(rankStr)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Report date</span>
          <span class="detail-value">${escapeHtmlPdf(input.reportDate)}</span>
        </div>
      </div>
    </div>
    <div class="content">
      <div class="section-title">
        <span class="section-icon">&#128218;</span>
        Academic performance
      </div>
      <table class="subjects-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Marks obtained</th>
            <th>Total marks</th>
            <th>Percentage</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>${rows}${overallRow}</tbody>
      </table>
      <div class="summary-cards">
        <div class="summary-card">
          <h3>Overall grade</h3>
          <div class="value">${escapeHtmlPdf(input.result.overallLetterGrade ?? '—')}</div>
        </div>
        <div class="summary-card attendance">
          <h3>Overall %</h3>
          <div class="value">${input.result.overallPercentage != null ? `${input.result.overallPercentage}%` : '—'}</div>
        </div>
        <div class="summary-card conduct">
          <h3>Conduct</h3>
          <div class="value">—</div>
        </div>
      </div>
      ${remarks}
      <div class="signatures">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Class teacher</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Parent / guardian</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Principal</div>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Generated from the school management system. For queries, contact the school office.</p>
    </div>`;
}

export function buildMinimalProgressInner(input: {
  schoolLine1: string;
  schoolLine2: string;
  academicYearName: string;
  studentName: string;
  rollNumber: string;
  classLabel: string;
  reportDate: string;
  result: StudentResultDto;
  classTeacherComment?: string;
}): string {
  const line2 = input.schoolLine2.trim()
    ? `<div class="subtitle">${escapeHtmlPdf(input.schoolLine2)}</div>`
    : '';
  let assessRows = '';
  for (const s of input.result.subjects) {
    assessRows += `<tr>
      <td>${escapeHtmlPdf(input.reportDate)}</td>
      <td>${escapeHtmlPdf(s.subjectName)}</td>
      <td>Subject average</td>
      <td>Summary</td>
      <td>${s.marksObtained}/${s.totalMarks}</td>
    </tr>`;
  }
  if (input.result.subjects.length === 0) {
    assessRows = '<tr><td colspan="5">No recent marks recorded</td></tr>';
  }
  const avg = input.result.overallPercentage != null ? `${input.result.overallPercentage}%` : '—';
  const remarks =
    input.classTeacherComment && input.classTeacherComment.trim()
      ? `<div class="section-heading">Teacher comments</div><div class="remarks-box"><p>${escapeHtmlPdf(input.classTeacherComment.trim())}</p></div>`
      : '';
  return `
        <div class="header">
            <h1>${escapeHtmlPdf(input.schoolLine1)}</h1>
            ${line2}
            <div class="report-type">PROGRESS REPORT</div>
            <div class="note">(Informal update — not a formal term report card)</div>
        </div>
        <div class="student-info">
            <table>
                <tr>
                    <td>Student name:</td>
                    <td>${escapeHtmlPdf(input.studentName)}</td>
                    <td>Roll number:</td>
                    <td>${escapeHtmlPdf(input.rollNumber || '—')}</td>
                </tr>
                <tr>
                    <td>Class:</td>
                    <td colspan="3">${escapeHtmlPdf(input.classLabel)}</td>
                </tr>
                <tr>
                    <td>Report date:</td>
                    <td>${escapeHtmlPdf(input.reportDate)}</td>
                    <td>Academic year:</td>
                    <td>${escapeHtmlPdf(input.academicYearName)}</td>
                </tr>
            </table>
        </div>
        <div class="content">
        <div class="info-box">
            <strong>Note:</strong> This progress summary reflects current recorded marks. It does not replace the official term report card.
        </div>
        <div class="section-heading">Current performance summary</div>
        <table class="performance-table">
            <thead>
                <tr>
                    <th>Current average</th>
                    <th>Overall %</th>
                    <th>Letter grade</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>${escapeHtmlPdf(avg)}</strong></td>
                    <td><strong>${escapeHtmlPdf(avg)}</strong></td>
                    <td><strong>${escapeHtmlPdf(input.result.overallLetterGrade ?? '—')}</strong></td>
                </tr>
            </tbody>
        </table>
        <div class="section-heading">Subjects (snapshot)</div>
        <table class="assessments-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Subject</th>
                    <th>Assessment</th>
                    <th>Type</th>
                    <th>Marks</th>
                </tr>
            </thead>
            <tbody>${assessRows}</tbody>
        </table>
        ${remarks}
        </div>
        <div class="footer">
            <p>Generated from the school management system.</p>
        </div>`;
}

export function buildModernProgressInner(input: {
  schoolLine1: string;
  schoolLine2: string;
  academicYearName: string;
  studentName: string;
  rollNumber: string;
  classLabel: string;
  reportDate: string;
  result: StudentResultDto;
  classTeacherComment?: string;
}): string {
  const sub = input.schoolLine2.trim()
    ? `<p>${escapeHtmlPdf(input.schoolLine2)}</p>`
    : '';
  const avg = input.result.overallPercentage != null ? `${input.result.overallPercentage}%` : '—';
  let cards = '';
  for (const s of input.result.subjects) {
    cards += `<div class="assessment-card">
      <div class="assessment-info">
        <h4>${escapeHtmlPdf(s.subjectName)} — subject snapshot</h4>
        <div class="meta">Recorded average: ${s.percentage}% (${s.marksObtained}/${s.totalMarks})</div>
      </div>
      <div class="assessment-score">
        <div class="score-value">${escapeHtmlPdf(s.letterGrade ?? '—')}</div>
        <div class="score-total">grade</div>
      </div>
    </div>`;
  }
  if (!cards) {
    cards =
      '<div class="alert-banner info"><p>No subject marks recorded for this snapshot.</p></div>';
  }
  const remarks =
    input.classTeacherComment && input.classTeacherComment.trim()
      ? `<div class="remarks-section"><h3>Class teacher</h3><p>${escapeHtmlPdf(input.classTeacherComment.trim())}</p></div>`
      : '';
  return `
    <div class="header">
      <div class="school-info">
        <h1>${escapeHtmlPdf(input.schoolLine1)}</h1>
        ${sub}
      </div>
      <div class="report-badge">Progress report</div>
    </div>
    <div class="student-bar">
      <div>
        <div class="student-name">${escapeHtmlPdf(input.studentName)}</div>
        <div class="student-meta">${escapeHtmlPdf(input.classLabel)} | Roll: ${escapeHtmlPdf(input.rollNumber || '—')}</div>
      </div>
      <div class="date-info">
        <strong>Report date</strong>
        ${escapeHtmlPdf(input.reportDate)}
        <div style="font-size:12px;margin-top:6px;">${escapeHtmlPdf(input.academicYearName)}</div>
      </div>
    </div>
    <div class="content">
      <div class="alert-banner info">
        <h3>About this report</h3>
        <p>This is an informal progress update from recorded marks. It is not an official term report card.</p>
      </div>
      <div class="section-title">
        <span class="section-icon">&#128200;</span>
        Current performance
      </div>
      <div class="performance-grid">
        <div class="performance-card good">
          <h3>Current average</h3>
          <div class="value">${escapeHtmlPdf(avg)}</div>
        </div>
        <div class="performance-card">
          <h3>Letter grade</h3>
          <div class="value">${escapeHtmlPdf(input.result.overallLetterGrade ?? '—')}</div>
        </div>
        <div class="performance-card">
          <h3>Subjects</h3>
          <div class="value">${input.result.subjects.length}</div>
        </div>
      </div>
      <div class="section-title">
        <span class="section-icon">&#128221;</span>
        Subject snapshot
      </div>
      <div class="recent-assessments">${cards}</div>
      ${remarks}
    </div>
    <div class="footer">
      <p>Generated from the school management system.</p>
    </div>`;
}

export function buildDetailedMinimalPageInner(
  d: DetailedStudentResultDto,
  resultTypeLabel: string,
  classLabel: string,
  schoolLine1: string,
  schoolLine2: string,
  academicYearName: string,
  reportDate: string,
): string {
  const line2 = schoolLine2.trim() ? `<div class="subtitle">${escapeHtmlPdf(schoolLine2)}</div>` : '';
  const classRankStr =
    d.classRank != null
      ? `${ordinalEn(d.classRank)} in class${d.classRank === 1 ? ' (top)' : ''}`
      : '—';
  const schoolRankStr =
    d.schoolRank != null
      ? `${ordinalEn(d.schoolRank)} in school${d.schoolRank === 1 ? ' (top)' : ''}`
      : '—';
  let subjectRows = '';
  for (const s of d.subjects) {
    subjectRows += `<tr><td class="subject-name">${escapeHtmlPdf(s.subjectName)}</td><td>${s.marksObtained}</td><td>${s.totalMarks}</td><td>${s.percentage}%</td><td>${escapeHtmlPdf(s.letterGrade ?? '—')}</td></tr>`;
  }
  if (d.subjects.length === 0) {
    subjectRows = '<tr><td colspan="5">No grades recorded</td></tr>';
  }
  const overallRow =
    d.overallPercentage != null
      ? `<tr class="total-row"><td>Overall</td><td colspan="2">—</td><td><strong>${d.overallPercentage}%</strong></td><td><strong>${escapeHtmlPdf(d.overallLetterGrade ?? '—')}</strong></td></tr>`
      : '';
  let assessRows = '';
  for (const e of d.assessmentWiseEntries) {
    assessRows += `<tr>
      <td>${escapeHtmlPdf(e.assessmentTitle)}</td>
      <td>${escapeHtmlPdf(e.subjectName)}</td>
      <td>${e.marksObtained}</td>
      <td>${e.totalMarks}</td>
      <td>${e.percentage}%</td>
    </tr>`;
  }
  if (d.assessmentWiseEntries.length === 0) {
    assessRows = '<tr><td colspan="5">No assessment-wise data</td></tr>';
  }
  const commentBlock = d.classTeacherComment
    ? `<div class="remarks-box"><div class="title">Class teacher remarks</div><p>${escapeHtmlPdf(d.classTeacherComment)}</p></div>`
    : '';
  return `
        <div class="header">
            <h1>${escapeHtmlPdf(schoolLine1)}</h1>
            ${line2}
            <div class="report-type">${escapeHtmlPdf(resultTypeLabel.toUpperCase())}</div>
            <div class="subtitle">${escapeHtmlPdf(academicYearName)}</div>
        </div>
        <div class="student-info">
            <table>
                <tr>
                    <td>Student name:</td>
                    <td>${escapeHtmlPdf(d.studentName)}</td>
                    <td>Student ID:</td>
                    <td>${escapeHtmlPdf(d.studentStudentId ?? '—')}</td>
                </tr>
                <tr>
                    <td>Class:</td>
                    <td>${escapeHtmlPdf(classLabel)}</td>
                    <td>Class position:</td>
                    <td>${escapeHtmlPdf(classRankStr)}</td>
                </tr>
                <tr>
                    <td>School position:</td>
                    <td>${escapeHtmlPdf(schoolRankStr)}</td>
                    <td>Report date:</td>
                    <td>${escapeHtmlPdf(reportDate)}</td>
                </tr>
            </table>
        </div>
        <div class="content">
        <div class="section-heading">Subject summary</div>
        <table class="performance-table">
            <thead>
                <tr>
                    <th>Subject</th>
                    <th>Marks</th>
                    <th>Total</th>
                    <th>%</th>
                    <th>Grade</th>
                </tr>
            </thead>
            <tbody>${subjectRows}${overallRow}</tbody>
        </table>
        <div class="section-heading">Assessment-wise breakdown</div>
        <table class="performance-table">
            <thead>
                <tr>
                    <th>Assessment</th>
                    <th>Subject</th>
                    <th>Marks</th>
                    <th>Total</th>
                    <th>%</th>
                </tr>
            </thead>
            <tbody>${assessRows}</tbody>
        </table>
        <div class="section-heading">Remarks</div>
        <div class="remarks-box"><p>${escapeHtmlPdf(d.generatedParagraph)}</p></div>
        ${commentBlock}
        <div class="signatures">
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Class teacher</div>
            </div>
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Parent / guardian</div>
            </div>
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Principal</div>
            </div>
        </div>
        </div>
        <div class="footer">
            <p>Detailed report — generated from the school management system.</p>
        </div>`;
}

export function buildModernDetailedPageInner(
  d: DetailedStudentResultDto,
  resultTypeLabel: string,
  classLabel: string,
  schoolLine1: string,
  schoolLine2: string,
  academicYearName: string,
  reportDate: string,
  options?: { headerMode?: 'full' | 'continuation' },
): string {
  const headerMode = options?.headerMode ?? 'full';
  const sub = schoolLine2.trim() ? `<p>${escapeHtmlPdf(schoolLine2)}</p>` : '';
  const classRankStr =
    d.classRank != null
      ? `${ordinalEn(d.classRank)} in class${d.classRank === 1 ? ' (top)' : ''}`
      : '—';
  const schoolRankStr =
    d.schoolRank != null
      ? `${ordinalEn(d.schoolRank)} in school${d.schoolRank === 1 ? ' (top)' : ''}`
      : '—';
  let subjectRows = '';
  for (const s of d.subjects) {
    subjectRows += `<tr>
      <td><strong>${escapeHtmlPdf(s.subjectName)}</strong></td>
      <td>${s.marksObtained}</td>
      <td>${s.totalMarks}</td>
      <td>${s.percentage}%</td>
      <td>${escapeHtmlPdf(s.letterGrade ?? '—')}</td>
    </tr>`;
  }
  if (d.subjects.length === 0) {
    subjectRows = '<tr><td colspan="5">No grades recorded</td></tr>';
  }
  const overallRow =
    d.overallPercentage != null
      ? `<tr class="total-row">
      <td><strong>Overall</strong></td>
      <td colspan="2"></td>
      <td><strong>${d.overallPercentage}%</strong></td>
      <td><strong>${escapeHtmlPdf(d.overallLetterGrade ?? '—')}</strong></td>
    </tr>`
      : '';
  let assessRows = '';
  for (const e of d.assessmentWiseEntries) {
    assessRows += `<tr>
      <td>${escapeHtmlPdf(e.assessmentTitle)}</td>
      <td>${escapeHtmlPdf(e.subjectName)}</td>
      <td>${e.marksObtained}</td>
      <td>${e.totalMarks}</td>
      <td>${e.percentage}%</td>
    </tr>`;
  }
  if (d.assessmentWiseEntries.length === 0) {
    assessRows = '<tr><td colspan="5">No assessment-wise data</td></tr>';
  }
  const commentBlock = d.classTeacherComment
    ? `<div class="remarks-section"><h3>Class teacher</h3><p>${escapeHtmlPdf(d.classTeacherComment)}</p></div>`
    : '';
  const fullHeader = `
    <div class="header">
      <div class="school-info">
        <h1>${escapeHtmlPdf(schoolLine1)}</h1>
        ${sub}
      </div>
      <div class="report-title">
        <h2>${escapeHtmlPdf(resultTypeLabel)}</h2>
        <p>${escapeHtmlPdf(academicYearName)}</p>
      </div>
    </div>
    <div class="student-section">
      <div class="student-details">
        <div class="detail-item">
          <span class="detail-label">Student name</span>
          <span class="detail-value">${escapeHtmlPdf(d.studentName)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Student ID</span>
          <span class="detail-value">${escapeHtmlPdf(d.studentStudentId ?? '—')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Class</span>
          <span class="detail-value">${escapeHtmlPdf(classLabel)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Class position</span>
          <span class="detail-value">${escapeHtmlPdf(classRankStr)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">School position</span>
          <span class="detail-value">${escapeHtmlPdf(schoolRankStr)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Report date</span>
          <span class="detail-value">${escapeHtmlPdf(reportDate)}</span>
        </div>
      </div>
    </div>`;
  const continuationHeader = `
    <div class="continuation-header">
      <div class="continuation-session">${escapeHtmlPdf(resultTypeLabel)}</div>
      <div class="continuation-meta">${escapeHtmlPdf(academicYearName)} · ${escapeHtmlPdf(reportDate)}</div>
      <div class="continuation-school">${escapeHtmlPdf(schoolLine1)}</div>
    </div>
    <div class="student-strip">
      <span><strong>Student</strong> ${escapeHtmlPdf(d.studentName)}</span>
      <span><strong>ID</strong> ${escapeHtmlPdf(d.studentStudentId ?? '—')}</span>
      <span><strong>Class</strong> ${escapeHtmlPdf(classLabel)}</span>
      <span><strong>Class position</strong> ${escapeHtmlPdf(classRankStr)}</span>
      <span><strong>School position</strong> ${escapeHtmlPdf(schoolRankStr)}</span>
    </div>`;
  const topPart = headerMode === 'continuation' ? continuationHeader : fullHeader;
  return `${topPart}
    <div class="content">
      <div class="section-title">
        <span class="section-icon">&#128218;</span>
        Subject summary
      </div>
      <table class="subjects-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Marks</th>
            <th>Total</th>
            <th>%</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>${subjectRows}${overallRow}</tbody>
      </table>
      <div class="section-title">
        <span class="section-icon">&#128203;</span>
        Assessment-wise breakdown
      </div>
      <table class="subjects-table">
        <thead>
          <tr>
            <th>Assessment</th>
            <th>Subject</th>
            <th>Marks</th>
            <th>Total</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>${assessRows}</tbody>
      </table>
      <div class="section-title">
        <span class="section-icon">&#128172;</span>
        Remarks
      </div>
      <div class="remarks-section">
        <p>${escapeHtmlPdf(d.generatedParagraph)}</p>
      </div>
      ${commentBlock}
      <div class="signatures">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Class teacher</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Parent / guardian</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Principal</div>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Detailed report — generated from the school management system.</p>
    </div>`;
}
