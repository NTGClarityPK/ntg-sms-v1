import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { IdCardRenderData } from './types/id-card-render-data';
import type { IdCardDesignVariant } from './types/id-card-design-variant';
import { normalizeIdCardDesignVariant } from './types/id-card-design-variant';
import { escapeHtmlPdf } from './utils/escape-html.util';
import { resolveIdCardsTemplateFile } from './utils/resolve-template-file.util';
import { buildPdfThemeVariablesCss } from '../results/pdf-theme';

/** Design mockup size in px (all three HTML templates use this canvas). */
const ID_CARD_DESIGN_PX = { width: 480, height: 300 };
/** ISO/IEC 7810 ID-1 / CR80 (standard credit-card / school ID size). */
const ID_CARD_PRINT_MM = { width: 85.6, height: 53.98 };
const MM_TO_CSS_PX = 96 / 25.4;
/** Tiny inset so edges are not clipped by sub-pixel rounding in PDF. */
const ID_CARD_PRINT_SCALE_SAFETY = 0.995;

function idCardPrintZoom(): number {
  const scaleW = (ID_CARD_PRINT_MM.width * MM_TO_CSS_PX) / ID_CARD_DESIGN_PX.width;
  const scaleH = (ID_CARD_PRINT_MM.height * MM_TO_CSS_PX) / ID_CARD_DESIGN_PX.height;
  return Math.min(scaleW, scaleH) * ID_CARD_PRINT_SCALE_SAFETY;
}

@Injectable()
export class IdCardDesignService {
  private readonly cache = new Map<string, { html: string; mtimeMs: number }>();

  private resolveDesignFileKey(variant: IdCardDesignVariant, personType: string): string {
    const isStaff = personType === 'staff' || personType === 'admin';
    if (isStaff) return variant === 'minimal' ? 'staff-minimal' : 'staff-classic';
    return variant;
  }

  private loadDesignFile(variant: IdCardDesignVariant, personType = 'student'): string {
    const fileKey = this.resolveDesignFileKey(variant, personType);
    const filePath = resolveIdCardsTemplateFile(__dirname, 'designs', `${fileKey}.html`);
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`ID card design file not found: ${variant}`);
    }
    const mtimeMs = fs.statSync(filePath).mtimeMs;
    const cacheKey = `${personType}:${fileKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.mtimeMs === mtimeMs) {
      return cached.html;
    }
    const html = fs.readFileSync(filePath, 'utf8');
    this.cache.set(cacheKey, { html, mtimeMs });
    return html;
  }

  private buildSchoolContactHtml(data: IdCardRenderData): string {
    return [
      `Phone: ${escapeHtmlPdf(data.schoolPhone)}`,
      data.schoolEmail ? `Email: ${escapeHtmlPdf(data.schoolEmail)}` : '',
      data.schoolWebsite ? `Web: ${escapeHtmlPdf(data.schoolWebsite)}` : '',
    ]
      .filter(Boolean)
      .join('<br>\n                            ');
  }

  private buildTextReplacements(data: IdCardRenderData): Array<[string, string]> {
    const schoolName = escapeHtmlPdf(data.schoolName);
    const fullName = escapeHtmlPdf(data.fullName);
    const schoolLocation = escapeHtmlPdf(data.schoolLocation || '');
    const guardianLine = escapeHtmlPdf(
      data.guardianName
        ? `${data.guardianName}${data.guardianRelation ? ` (${data.guardianRelation})` : ''}`
        : '',
    );
    const cardIdPlain = escapeHtmlPdf(data.cardNumber.replace(/^ID:\s*/i, ''));
    const cardIdLabel = escapeHtmlPdf(
      data.cardNumber.startsWith('ID:') ? data.cardNumber : `ID: ${data.cardNumber}`,
    );
    const pairs: Array<[string, string]> = [
      ['Property of Al Noor Academy - non-transferable', `Property of ${schoolName} - non-transferable`],
      ['Sajjan Jamali (Parent/Guardian)', guardianLine],
      ['Sajjan Jamali (Father)', guardianLine],
      ['AL NOOR ACADEMY', schoolName],
      ['Al Noor Academy', schoolName],
      ['ANAM FATIMA', fullName],
      ['Anam Fatima', fullName],
      ['Sector F-7/2, Islamabad', schoolLocation],
      ['Academic Year 2024-2025', `Academic Year ${escapeHtmlPdf(data.academicYearLabel)}`],
      ['ID: 1775394833478', cardIdLabel],
      ['1775394833478', cardIdPlain],
      ['VIIth', escapeHtmlPdf(data.classSection)],
      ['1002', escapeHtmlPdf(data.rollOrEmployeeId)],
      ['Sajjan Jamali', escapeHtmlPdf(data.guardianName)],
      ['2024-25', escapeHtmlPdf(data.academicYearLabel)],
      ['B+', escapeHtmlPdf(data.bloodGroup || '—')],
      ['+92 300 1234567', escapeHtmlPdf(data.guardianPhone || data.phone)],
      ['+92-51-2345678', escapeHtmlPdf(data.schoolPhone)],
      ['info@alnoor.edu.pk', escapeHtmlPdf(data.schoolEmail || data.schoolWebsite)],
      ['www.alnoor.edu.pk', escapeHtmlPdf(data.schoolWebsite)],
    ];

    if (data.personType === 'staff' || data.personType === 'admin') {
      const dept = escapeHtmlPdf(data.staffDepartment ?? data.classSection);
      const position = escapeHtmlPdf(data.staffPosition ?? data.roleLabel);
      const joinDate = escapeHtmlPdf(data.staffJoinDate ?? data.admissionDate);
      const employeeId = escapeHtmlPdf(data.rollOrEmployeeId);
      pairs.push(
        ['Ayesha Tarar', fullName],
        ['Anam Fatima', fullName],
        ['ANAM FATIMA', fullName],
        ['Mathematics', dept],
        ['Subject Teacher', position],
        ['STF-2024-0045', employeeId],
        ['January 2024', joinDate],
        ['ID: STF-2024-0045', cardIdLabel],
        ['Property of Credo School - non-transferable', `Property of ${schoolName} - non-transferable`],
        ['STAFF IDENTITY CARD', 'STAFF IDENTITY CARD'],
        ['STAFF IDENTITY', 'STAFF IDENTITY'],
        ['Card Guidelines', 'Card Guidelines'],
      );
    }

    return pairs.sort((a, b) => b[0].length - a[0].length);
  }

  /** Staff classic back: contact-footer has no child divs (QR is on the strip). */
  private replaceStaffClassicContactFooter(html: string, contactBlock: string): string {
    const marker = '<div class="contact-footer">';
    const idx = html.indexOf(marker);
    if (idx < 0) return html;
    try {
      const fullDiv = this.extractBalancedDiv(html, idx);
      if (/<div\s/i.test(fullDiv.slice(marker.length))) return html;
      const openTag = fullDiv.match(/^<div[^>]*>/)?.[0] ?? '';
      const newDiv = `${openTag}${contactBlock}</div>`;
      return html.slice(0, idx) + newDiv + html.slice(idx + fullDiv.length);
    } catch {
      return html;
    }
  }

  /** Replace inner HTML of a div (handles nested child divs — non-greedy regex breaks QR wrappers). */
  private replaceDivContent(html: string, className: string, innerHtml: string): string {
    const marker = `<div class="${className}"`;
    let result = html;
    let searchFrom = 0;
    while (true) {
      const start = result.indexOf(marker, searchFrom);
      if (start < 0) return result;
      try {
        const fullDiv = this.extractBalancedDiv(result, start);
        const openTag = fullDiv.match(/^<div[^>]*>/)?.[0] ?? '';
        const newDiv = `${openTag}${innerHtml}</div>`;
        result = result.slice(0, start) + newDiv + result.slice(start + fullDiv.length);
        searchFrom = start + newDiv.length;
      } catch {
        return result;
      }
    }
  }

  injectRenderData(html: string, data: IdCardRenderData): string {
    let out = html;
    const photoImg = data.photoUrl
      ? `<img src="${data.photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" />`
      : '👤';
    const logoImg = data.schoolLogoUrl
      ? `<img src="${data.schoolLogoUrl}" alt="" style="width:100%;height:100%;object-fit:contain" />`
      : 'A';
    const qrImg = data.qrCodeDataUrl
      ? `<img src="${data.qrCodeDataUrl}" alt="QR" style="width:100%;height:100%;object-fit:contain" />`
      : 'QR';

    for (const [from, to] of this.buildTextReplacements(data)) {
      out = out.split(from).join(to);
    }

    const contactBlock = this.buildSchoolContactHtml(data);
    if (contactBlock) {
      out = this.replaceDivContent(out, 'contact-data', contactBlock);
      out = this.replaceStaffClassicContactFooter(out, contactBlock);
      const modernContact = [
        data.schoolPhone ? `📞 ${escapeHtmlPdf(data.schoolPhone)}` : '',
        data.schoolEmail ? `📧 ${escapeHtmlPdf(data.schoolEmail)}` : '',
        data.schoolWebsite ? `🌐 ${escapeHtmlPdf(data.schoolWebsite)}` : '',
      ]
        .filter(Boolean)
        .join('<br>\n                        ');
      if (modernContact) {
        out = out.replace(/<div class="contact-info">[\s\S]*?<\/div>/gi, `<div class="contact-info">${modernContact}</div>`);
      }
    }

    const photoClasses = ['photo-strip', 'photo-box', 'photo', 'photo-frame'];
    for (const cls of photoClasses) {
      out = this.replaceDivContent(out, cls, photoImg);
    }
    out = out.replace(
      /<div class="photo-container">\s*<div class="photo">[\s\S]*?<\/div>\s*<\/div>/gi,
      `<div class="photo-container"><div class="photo">${photoImg}</div></div>`,
    );

    const logoClasses = ['school-logo', 'header-logo', 'strip-logo', 'logo-box', 'school-logo-small'];
    for (const cls of logoClasses) {
      out = this.replaceDivContent(out, cls, logoImg);
    }

    const qrClasses = ['qr-box', 'qr-code', 'back-qr', 'qr-box-minimal', 'qr-mini', 'qr-big', 'back-qr-large'];
    for (const cls of qrClasses) {
      out = this.replaceDivContent(out, cls, qrImg);
    }

    const bloodRaw = (data.bloodGroup ?? '—').trim();
    const hasBloodGroup =
      bloodRaw.length > 0 &&
      bloodRaw !== '—' &&
      bloodRaw !== '-' &&
      bloodRaw.toLowerCase() !== 'n/a' &&
      bloodRaw.toLowerCase() !== 'na';
    const bloodHtml = hasBloodGroup
      ? `<span class="blood-badge">${escapeHtmlPdf(bloodRaw)}</span>`
      : escapeHtmlPdf('—');
    const bloodRowClassic = `<div class="detail-label">Blood:</div><div class="detail-value">${bloodHtml}</div>`;
    const bloodRowMinimal = `<div class="info-key">Blood:</div><div class="info-val">${bloodHtml}</div>`;
    out = out.replace(
      /<div class="detail-label">Blood:<\/div>\s*<div class="detail-value">[\s\S]*?<\/div>/gi,
      bloodRowClassic,
    );
    out = out.replace(
      /<div class="info-key">Blood:<\/div>\s*<div class="info-val">[\s\S]*?<\/div>/gi,
      bloodRowMinimal,
    );

    if (data.staffRoleBadgeHtml) {
      out = this.replaceDivContent(out, 'role-badge', data.staffRoleBadgeHtml);
      out = this.replaceDivContent(out, 'role-badge-box', data.staffRoleBadgeHtml);
    }

    const cardIdLabel = escapeHtmlPdf(
      data.cardNumber.startsWith('ID:') ? data.cardNumber : `ID: ${data.cardNumber}`,
    );
    const validityHtml = escapeHtmlPdf(
      data.academicYearLabel ? `VALID ${data.academicYearLabel}` : 'VALID',
    );
    out = out.replace(/<div class="validity">[\s\S]*?<\/div>/gi, `<div class="validity">${validityHtml}</div>`);
    out = out.replace(/<div class="year-box">[\s\S]*?<\/div>/gi, `<div class="year-box">${escapeHtmlPdf(data.academicYearLabel)}</div>`);
    out = out.replace(
      /<div class="id-display">[\s\S]*?<\/div>/gi,
      `<div class="id-display">${cardIdLabel}</div>`,
    );
    out = out.replace(
      /<div class="employee-id">[\s\S]*?<\/div>/gi,
      `<div class="employee-id">${cardIdLabel}</div>`,
    );

    return out;
  }

  private extractCardWrapper(html: string): string {
    const start = html.indexOf('<div class="card-wrapper">');
    const bodyEnd = html.indexOf('</body>');
    if (start < 0 || bodyEnd < 0) return html;
    return html.slice(start, bodyEnd).trim();
  }

  private extractStyles(html: string): string {
    return html.match(/<style>[\s\S]*?<\/style>/i)?.[0] ?? '';
  }

  /** Design files include A4 @page + preview flex; strip so PDF layout stays CR80. */
  private sanitizeDesignStylesForPrint(stylesBlock: string): string {
    return stylesBlock
      .replace(/@page\s*\{[\s\S]*?\}/gi, '')
      .replace(/@media\s+print\s*\{[\s\S]*?\}/gi, '')
      .replace(/page-break-[^;{}]+;/gi, '');
  }

  private extractBalancedDiv(html: string, startIndex: number): string {
    const tagRe = /<(\/?)div\b[^>]*>/gi;
    tagRe.lastIndex = startIndex;
    let depth = 0;
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(html)) !== null) {
      if (match[1] !== '/') {
        depth += 1;
      } else {
        depth -= 1;
        if (depth === 0) {
          return html.slice(startIndex, tagRe.lastIndex);
        }
      }
    }
    throw new BadRequestException('Could not parse card markup in design template');
  }

  private extractCardFace(html: string, face: 'front' | 'back'): string {
    const frontComment = '<!-- FRONT SIDE -->';
    const backComment = '<!-- BACK SIDE -->';
    const marker = face === 'front' ? '<div class="card front">' : '<div class="card back">';
    const searchFrom = face === 'front' ? html.indexOf(frontComment) : html.indexOf(backComment);
    if (searchFrom < 0) {
      throw new BadRequestException('Design HTML is missing front/back section markers');
    }
    const start = html.indexOf(marker, searchFrom);
    if (start < 0) {
      throw new BadRequestException(`Could not extract ${face} from design`);
    }
    return this.extractBalancedDiv(html, start);
  }

  singleCardPageSizeMm(): { width: number; height: number } {
    return {
      width: ID_CARD_PRINT_MM.width,
      height: ID_CARD_PRINT_MM.height,
    };
  }

  buildPreviewHtml(variant: IdCardDesignVariant, data: IdCardRenderData): string {
    const raw = this.loadDesignFile(variant, data.personType);
    const injected = this.injectRenderData(raw, data);
    const styles = this.extractStyles(injected);
    const wrapper = this.extractCardWrapper(injected);
    const themeCss = buildPdfThemeVariablesCss(data.primaryColor);
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>${styles}
<style>
  ${themeCss}
  body { margin: 0; padding: 12px; background: #e9ecef; }
  body > h1, body > p { display: none !important; }
  .id-card-preview-scale { transform: scale(0.72); transform-origin: top center; width: max-content; margin: 0 auto; }
</style></head><body>
<div class="id-card-preview-scale">${wrapper}</div>
</body></html>`;
  }

  private printLayoutCss(sheetLayout: 'single' | 'both'): string {
    const w = ID_CARD_PRINT_MM.width;
    const h = ID_CARD_PRINT_MM.height;
    const zoom = idCardPrintZoom();
    const zoomCss = zoom.toFixed(6);
    const scaledW = ID_CARD_DESIGN_PX.width * zoom;
    const scaledH = ID_CARD_DESIGN_PX.height * zoom;
    const sheetCss =
      sheetLayout === 'both'
        ? `
  .id-card-print-page {
    width: ${w}mm;
    height: ${h}mm;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    break-after: page;
    box-sizing: border-box;
  }
  .id-card-print-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }`
        : '';
    return `
  html, body {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
  }
  .card-wrapper, .card-side, .card-label {
    display: none !important;
  }
  .id-card-print-frame {
    width: ${w}mm;
    height: ${h}mm;
    overflow: hidden;
    position: relative;
    background: white;
    contain: layout paint;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .id-card-print-scale {
    width: ${scaledW}px;
    height: ${scaledH}px;
    overflow: hidden;
    flex-shrink: 0;
    position: relative;
  }
  .id-card-print-scale > .card {
    width: ${ID_CARD_DESIGN_PX.width}px !important;
    height: ${ID_CARD_DESIGN_PX.height}px !important;
    max-width: none !important;
    max-height: none !important;
    min-width: ${ID_CARD_DESIGN_PX.width}px !important;
    min-height: ${ID_CARD_DESIGN_PX.height}px !important;
    transform: scale(${zoomCss});
    transform-origin: top left;
    border-radius: 3mm;
    box-shadow: none !important;
    overflow: hidden !important;
    flex-shrink: 0 !important;
    box-sizing: border-box !important;
    margin: 0 !important;
  }
  .id-card-print-scale > .card.front,
  .id-card-print-scale > .card.back {
    display: block !important;
  }
  .id-card-print-scale > .card.front:has(.vertical-strip),
  .id-card-print-scale > .card.back:has(.back-strip) {
    display: flex !important;
    flex-wrap: nowrap !important;
  }
  .id-card-print-scale .front-wrapper,
  .id-card-print-scale .back-wrapper {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
  }
  .id-card-print-scale .back-header,
  .id-card-print-scale .back-footer {
    width: 100% !important;
    box-sizing: border-box !important;
  }${sheetCss}`;
  }

  private wrapForPrint(cardFaceHtml: string): string {
    return `<div class="id-card-print-frame"><div class="id-card-print-scale">${cardFaceHtml}</div></div>`;
  }

  private pageBoxCss(pageSizeMm: { width: number; height: number }, multiPage = false): string {
    const w = pageSizeMm.width;
    const h = pageSizeMm.height;
    if (multiPage) {
      return `
  @page { size: ${w}mm ${h}mm; margin: 0; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: ${w}mm !important;
    background: white !important;
  }`;
    }
    return `
  @page { size: ${w}mm ${h}mm; margin: 0; }
  html, body {
    width: ${w}mm !important;
    height: ${h}mm !important;
    max-width: ${w}mm !important;
    max-height: ${h}mm !important;
    overflow: hidden !important;
    page-break-before: avoid !important;
    page-break-after: avoid !important;
  }`;
  }

  private buildPrintHtml(
    styles: string,
    bodyInner: string,
    pageSizeMm: { width: number; height: number },
    sheetLayout: 'single' | 'both',
    primaryColor: string | null | undefined,
  ): string {
    const safeStyles = this.sanitizeDesignStylesForPrint(styles);
    const multiPage = sheetLayout === 'both';
    const themeCss = buildPdfThemeVariablesCss(primaryColor);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${safeStyles}
<style>
  ${themeCss}
  ${this.pageBoxCss(pageSizeMm, multiPage)}
  ${this.printLayoutCss(sheetLayout)}
</style></head><body>${bodyInner}</body></html>`;
  }

  buildPrintSideHtml(variant: IdCardDesignVariant, side: 'front' | 'back', data: IdCardRenderData): string {
    const raw = this.loadDesignFile(variant, data.personType);
    const injected = this.injectRenderData(raw, data);
    const styles = this.extractStyles(injected);
    const face = side === 'front' ? 'front' : 'back';
    const cardFace = this.extractCardFace(injected, face);
    return this.buildPrintHtml(
      styles,
      this.wrapForPrint(cardFace),
      { width: ID_CARD_PRINT_MM.width, height: ID_CARD_PRINT_MM.height },
      'single',
      data.primaryColor,
    );
  }

  /** Front on page 1, back on page 2 (CR80 each). */
  buildPrintBothSidesHtml(variant: IdCardDesignVariant, data: IdCardRenderData): string {
    const raw = this.loadDesignFile(variant, data.personType);
    const injected = this.injectRenderData(raw, data);
    const styles = this.extractStyles(injected);
    const front = this.extractCardFace(injected, 'front');
    const back = this.extractCardFace(injected, 'back');
    const body = `<div class="id-card-print-page">${this.wrapForPrint(front)}</div><div class="id-card-print-page">${this.wrapForPrint(back)}</div>`;
    return this.buildPrintHtml(styles, body, this.singleCardPageSizeMm(), 'both', data.primaryColor);
  }

  parseVariant(value: string | undefined): IdCardDesignVariant {
    const v = (value ?? 'classic').toLowerCase();
    if (v && v !== 'classic' && v !== 'minimal' && v !== 'modern') {
      throw new BadRequestException('designVariant must be classic or minimal');
    }
    return normalizeIdCardDesignVariant(v);
  }
}
