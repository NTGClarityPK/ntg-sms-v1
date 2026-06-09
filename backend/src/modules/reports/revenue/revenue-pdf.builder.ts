import type { RevenueReportDto } from '../dto/revenue-report.dto';
import {
  getPaymentMethodLabel,
  getPersonTypeLabel,
  getReportLabel,
  getRevenueSourceLabel,
  getScopeLabel,
  normalizeRevenueLocale,
} from './revenue-labels.util';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function buildRevenueReportPdfHtml(
  report: RevenueReportDto,
  locale?: string,
): string {
  const loc = normalizeRevenueLocale(locale);
  const L = (key: string) => getReportLabel(key, loc);
  const isRtl = loc === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';

  const logoBlock = report.branding?.logoDataUrl
    ? `<img src="${report.branding.logoDataUrl}" alt="" style="height:48px;width:auto;object-fit:contain;" />`
    : '';

  const headerHtml = `
    <header style="display:flex;align-items:center;gap:20px;padding-bottom:20px;margin-bottom:24px;border-bottom:1px solid #e9ecef;">
      ${logoBlock ? `<div style="flex:0 0 auto;">${logoBlock}</div>` : ''}
      <div style="flex:1 1 auto;">
        <div style="font-size:20px;font-weight:700;color:#212529;line-height:1.3;">${escapeHtml(report.branding?.schoolName ?? L('title'))}</div>
        <div style="font-size:13px;color:#495057;margin-top:4px;">${escapeHtml(report.branding?.branchSubtitle ?? '')}</div>
        <div style="font-size:12px;color:#6c757d;margin-top:8px;">${escapeHtml(L('title'))} · ${escapeHtml(L('period'))}: ${escapeHtml(report.startDate)} – ${escapeHtml(report.endDate)}</div>
      </div>
    </header>`;

  const summaryCard = `
    <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#6c757d;">${escapeHtml(L('grandTotal'))}</div>
      <div style="font-size:28px;font-weight:700;color:#212529;margin-top:4px;">${formatMoney(report.grandTotal)}</div>
      <div style="font-size:12px;color:#6c757d;margin-top:8px;">${escapeHtml(L('scope'))}: ${escapeHtml(getScopeLabel(report.scope, loc))}</div>
    </div>`;

  const sourceRows = report.sources
    .map((s) => {
      const label = getRevenueSourceLabel(s.sourceKey, loc);
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td>${s.enabled ? escapeHtml(L('yes')) : escapeHtml(L('no'))}</td>
        <td style="text-align:right;">${s.enabled ? formatMoney(s.total) : '—'}</td>
        <td style="text-align:right;">${s.transactionCount}</td>
      </tr>`;
    })
    .join('');

  const sourceTable = `
    <h2 style="font-size:14px;font-weight:600;color:#212529;margin:0 0 10px;">${escapeHtml(L('bySource'))}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;">
      <thead>
        <tr style="background:#f1f3f5;">
          <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('source'))}</th>
          <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('enabled'))}</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #dee2e6;">${escapeHtml(L('total'))}</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #dee2e6;">${escapeHtml(L('transactions'))}</th>
        </tr>
      </thead>
      <tbody>${sourceRows}</tbody>
    </table>`;

  const branchRows = report.byBranch
    .map(
      (b) => `<tr>
        <td>${escapeHtml(b.branchName)}</td>
        <td style="text-align:right;">${formatMoney(b.sources.fee_management ?? 0)}</td>
        <td style="text-align:right;">${formatMoney(b.sources.id_card_reprints ?? 0)}</td>
        <td style="text-align:right;font-weight:600;">${formatMoney(b.total)}</td>
      </tr>`,
    )
    .join('');

  const branchTable =
    report.byBranch.length > 0
      ? `
    <h2 style="font-size:14px;font-weight:600;color:#212529;margin:0 0 10px;">${escapeHtml(L('byBranch'))}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;">
      <thead>
        <tr style="background:#f1f3f5;">
          <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('branch'))}</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #dee2e6;">${escapeHtml(L('fees'))}</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #dee2e6;">${escapeHtml(L('idCards'))}</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #dee2e6;">${escapeHtml(L('total'))}</th>
        </tr>
      </thead>
      <tbody>${branchRows}</tbody>
    </table>`
      : '';

  const methodRows = (report.feeManagement?.byPaymentMethod ?? [])
    .map(
      (m) => `<tr>
        <td>${escapeHtml(getPaymentMethodLabel(m.methodKey, loc))}</td>
        <td style="text-align:right;">${formatMoney(m.total)}</td>
      </tr>`,
    )
    .join('');

  const methodTable =
    methodRows.length > 0
      ? `
    <h2 style="font-size:14px;font-weight:600;color:#212529;margin:0 0 10px;">${escapeHtml(L('byPaymentMethod'))}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;">
      <thead>
        <tr style="background:#f1f3f5;">
          <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('paymentMethod'))}</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #dee2e6;">${escapeHtml(L('total'))}</th>
        </tr>
      </thead>
      <tbody>${methodRows}</tbody>
    </table>`
      : '';

  let detailHtml = '';
  if (report.detailMode === 'detailed') {
    const feeLineRows = (report.feeLines ?? [])
      .map((line) => {
        const branchCell =
          report.scope === 'combined'
            ? `<td>${escapeHtml(line.branchName ?? '')}</td>`
            : '';
        return `<tr>
          ${branchCell}
          <td>${escapeHtml(line.personName)}</td>
          <td>${escapeHtml(line.challanNumber ?? '—')}</td>
          <td>${escapeHtml(getPaymentMethodLabel(line.paymentMethodKey, loc))}</td>
          <td>${escapeHtml(line.paymentDate)}</td>
          <td style="text-align:right;">${formatMoney(line.amount)}</td>
        </tr>`;
      })
      .join('');

    if (feeLineRows) {
      const branchTh =
        report.scope === 'combined'
          ? `<th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('branch'))}</th>`
          : '';
      detailHtml += `
        <h2 style="font-size:14px;font-weight:600;color:#212529;margin:24px 0 10px;">${escapeHtml(L('detailedFees'))}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:24px;">
          <thead><tr style="background:#f1f3f5;">
            ${branchTh}
            <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('person'))}</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('challan'))}</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('paymentMethod'))}</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('date'))}</th>
            <th style="padding:8px 10px;text-align:right;border:1px solid #dee2e6;">${escapeHtml(L('amount'))}</th>
          </tr></thead>
          <tbody>${feeLineRows}</tbody>
        </table>`;
    }

    const idRows = (report.idCardLines ?? [])
      .map((line) => {
        const branchCell =
          report.scope === 'combined'
            ? `<td>${escapeHtml(line.branchName ?? '')}</td>`
            : '';
        return `<tr>
          ${branchCell}
          <td>${escapeHtml(line.personName)}</td>
          <td>${escapeHtml(getPersonTypeLabel(line.personType, loc))}</td>
          <td>${escapeHtml(line.cardNumber ?? '—')}</td>
          <td>${escapeHtml(line.eventDate)}</td>
          <td style="text-align:right;">${formatMoney(line.amount)}</td>
        </tr>`;
      })
      .join('');

    if (idRows) {
      const branchTh =
        report.scope === 'combined'
          ? `<th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('branch'))}</th>`
          : '';
      detailHtml += `
        <h2 style="font-size:14px;font-weight:600;color:#212529;margin:24px 0 10px;">${escapeHtml(L('detailedIdCards'))}</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:24px;">
          <thead><tr style="background:#f1f3f5;">
            ${branchTh}
            <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('person'))}</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('personType'))}</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('cardNumber'))}</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #dee2e6;">${escapeHtml(L('date'))}</th>
            <th style="padding:8px 10px;text-align:right;border:1px solid #dee2e6;">${escapeHtml(L('amount'))}</th>
          </tr></thead>
          <tbody>${idRows}</tbody>
        </table>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="${loc === 'ar' ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #212529; margin: 0; padding: 32px 40px; line-height: 1.45; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  </style>
</head>
<body>
  ${headerHtml}
  ${summaryCard}
  ${sourceTable}
  ${branchTable}
  ${methodTable}
  ${detailHtml}
</body>
</html>`;
}
