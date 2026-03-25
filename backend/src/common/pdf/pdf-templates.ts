const DEFAULT_GENERATED_MESSAGE =
  'This is an electronically generated document and does not require a signature.';

function escapeHtml(value: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(value).replace(/[&<>"']/g, (m) => map[m] ?? m);
}

export type PdfHeaderTemplateInput = {
  ntgLogoDataUrl: string;
  branchName: string;
  tenantLogoDataUrl?: string;
  reportTitle?: string;
  academicYearLabel?: string;
};

export function buildPdfHeaderTemplate(input: PdfHeaderTemplateInput): string {
  const ntgLogo = input.ntgLogoDataUrl;
  const schoolLogo = input.tenantLogoDataUrl;
  const branchName = escapeHtml(input.branchName || '—');
  const reportTitle = input.reportTitle ? escapeHtml(input.reportTitle) : '';
  const academicYearLabel = input.academicYearLabel ? escapeHtml(input.academicYearLabel) : '';

  const metaLine = [reportTitle, academicYearLabel].filter(Boolean).join(' • ');

  // Puppeteer header/footer templates are HTML fragments. Keep styling inline + minimal.
  return `
<div style="width:100%; box-sizing:border-box; padding:12px 24px; background:#f8f9fa; border-bottom:1px solid #dee2e6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
    <div style="flex:0 0 auto; display:flex; align-items:center; min-width:80px;">
      <img src="${ntgLogo}" style="height:32px; width:auto; object-fit:contain;" />
    </div>

    <div style="flex:1 1 auto; text-align:center; padding:0 16px; line-height:1.2;">
      <div style="font-size:16px; font-weight:700; color:#212529; margin:0; padding:0; word-break:break-word;">
        ${branchName}
      </div>
      ${
        metaLine
          ? `<div style="font-size:11px; font-weight:500; color:#6c757d; margin-top:2px;">${metaLine}</div>`
          : `<div style="font-size:11px; font-weight:500; color:#6c757d; margin-top:2px;">&nbsp;</div>`
      }
    </div>

    <div style="flex:0 0 auto; display:flex; align-items:center; justify-content:flex-end; min-width:80px;">
      ${
        schoolLogo
          ? `<img src="${schoolLogo}" style="height:32px; width:auto; object-fit:contain;" />`
          : ''
      }
    </div>
  </div>
</div>
`.trim();
}

export type PdfFooterTemplateInput = {
  generatedMessage?: string;
};

export function buildPdfFooterTemplate(input?: PdfFooterTemplateInput): string {
  const message = escapeHtml(input?.generatedMessage || DEFAULT_GENERATED_MESSAGE);
  return `
<div style="width:100%; box-sizing:border-box; padding:8px 24px; background:#ffffff; border-top:1px solid #dee2e6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size:9px; color:#6c757d;">
  <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
    <div style="flex:1 1 auto; padding-right:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
      ${message}
    </div>
    <div style="flex:0 0 auto; white-space:nowrap;">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>
  </div>
</div>
`.trim();
}

