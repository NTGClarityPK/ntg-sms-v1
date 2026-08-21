import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import QRCode from 'qrcode';

function getPuppeteerExecutablePath(): string | undefined {
  return (
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    undefined
  );
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMonthLabel(ym: string): string {
  const m = ym.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const y = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const d = new Date(y, monthIndex, 1);
  if (Number.isNaN(d.getTime())) return ym;
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
}

function ordinalSuffix(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function formatDueDateLabel(isoDate: string): string {
  const m = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const y = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, monthIndex, day);
  if (Number.isNaN(d.getTime())) return isoDate;
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d);
  const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
  return `${weekday}, ${day}${ordinalSuffix(day)} ${monthYear}`;
}

function formatShortDateLabel(isoDate: string): string {
  const m = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const y = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, monthIndex, day);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function formatReceiptMoney(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPaymentMethodReceipt(method: string): string {
  const s = (method ?? '').toLowerCase();
  if (s === 'bank_transfer') return 'BANK TRANSFER';
  if (s === 'cash') return 'CASH';
  return (method ?? '—').replace(/_/g, ' ').toUpperCase();
}

function formatPaymentDateReceipt(isoDate: string): string {
  const m = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function formatVerifiedAtReceipt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}-${mo}-${day} AT ${h}:${mi}:${s}`;
}

@Injectable()
export class FeePdfService {
  async generateReceiptPdf(input: {
    businessInfo: { branchName: string; schoolName: string; address: string; phone: string; email: string };
    receiptNumber: string;
    challanNumber: string;
    studentName: string;
    verifiedAt: string;
    paymentMethod: string;
    paymentDate: string;
    amountPaid: number;
    items: Array<{ billingMonth?: string | null; description: string; amount: number; isDiscount: boolean }>;
    totalPayable: number;
    currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
    footerText?: string | null;
  }): Promise<Buffer> {
    const amountHeader = `AMOUNT (${input.currencyCode})`;
    const addressHtml = (input.businessInfo.address || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => escapeHtml(line))
      .join('<br>');

    const phoneLine = input.businessInfo.phone?.trim()
      ? `TEL: ${escapeHtml(input.businessInfo.phone)}`
      : '';
    const emailLine = input.businessInfo.email?.trim()
      ? `EMAIL: ${escapeHtml(input.businessInfo.email).toUpperCase()}`
      : '';

    const footerMain =
      input.footerText?.trim() ||
      'THIS IS AN OFFICIAL RECEIPT. PAYMENT VERIFIED AND CONFIRMED.';
    const footerContact = [input.businessInfo.email?.trim(), input.businessInfo.phone?.trim()]
      .filter(Boolean)
      .join(' | ');
    const footerEndRaw = footerContact ? `${footerContact} | THANK YOU` : 'THANK YOU';

    const rows =
      input.items.length === 0
        ? '<tr><td colspan="3">—</td></tr>'
        : input.items
            .map((it) => {
              const raw = Number(it.amount ?? 0);
              const abs = Math.abs(raw);
              const formatted = formatReceiptMoney(abs);
              const display = it.isDiscount ? `-${formatted}` : formatted;
              const rowClass = it.isDiscount ? ' class="discount"' : '';
              const month = it.billingMonth ?? '';
              return `<tr${rowClass}>
  <td>${escapeHtml(month)}</td>
  <td>${escapeHtml(it.description)}</td>
  <td>${escapeHtml(display)}</td>
</tr>`;
            })
            .join('');

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Receipt</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4;margin:0}
body{font-family:'Courier New',Courier,monospace;background:white;padding:0}
.receipt{max-width:210mm;margin:0 auto;background:white}
.perforated-edge{height:8px;background:repeating-linear-gradient(90deg,#e0e0e0 0,#e0e0e0 8px,white 8px,white 16px)}
.header{padding:20px 30px 16px;background:#fff;border-bottom:2px dashed #999;display:flex;justify-content:space-between;align-items:flex-start}
.company-info{flex:1}
.company-name{font-size:20px;font-weight:bold;margin-bottom:3px;letter-spacing:1px}
.company-tagline{font-size:10px;color:#666;margin-bottom:8px}
.company-address{font-size:9px;line-height:1.4;color:#333}
.receipt-badge{border:2px double #2d862d;padding:10px 16px;text-align:center;min-width:140px;background:#f0fdf4}
.receipt-title{font-size:16px;font-weight:bold;letter-spacing:1px;margin-bottom:4px;color:#2d862d}
.receipt-number{font-size:9px;color:#666;margin-bottom:2px}
.receipt-date{font-size:9px;color:#2d862d;font-weight:bold}
.details-section{padding:16px 30px;background:#fafafa}
.details-table{width:100%}
.details-table td{padding:4px 0;font-size:10px}
.details-table td:first-child{font-weight:bold;width:120px;color:#000}
.details-table td:last-child{color:#333}
.items-section{padding:16px 30px;position:relative}
.items-header{font-size:11px;font-weight:bold;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #000;letter-spacing:.5px}
.items-table{width:100%;margin-bottom:12px}
.items-table thead{border-bottom:1px solid #000}
.items-table th{text-align:left;padding:6px 4px;font-size:9px;font-weight:bold;letter-spacing:.5px}
.items-table th:last-child{text-align:right}
.items-table td{padding:8px 4px;font-size:10px;border-bottom:1px dotted #ccc}
.items-table td:last-child{text-align:right;font-weight:bold}
.items-table tr:last-child td{border-bottom:none}
.items-table tr.discount td{font-style:italic;color:#2d862d}
.summary-section{padding:0 30px 16px;display:flex;justify-content:flex-end}
.summary-box{width:240px;border:2px solid #000}
.summary-row{display:flex;justify-content:space-between;padding:8px 12px;font-size:10px;border-bottom:1px dotted #ccc}
.summary-row:last-child{border-bottom:none}
.summary-row.paid{background:#2d862d;color:white;font-weight:bold;font-size:12px;padding:10px 12px;border-bottom:none}
.summary-row.paid .amount{font-size:14px}
.footer-section{padding:12px 30px;background:#f5f5f5;text-align:center;border-top:1px solid #ddd}
.footer-text{font-size:8px;line-height:1.6;color:#666}
.watermark{position:relative;overflow:hidden}
.watermark::before{content:'PAID';position:absolute;top:40%;left:55%;transform:translate(-50%,-50%) rotate(-45deg);font-size:80px;font-weight:bold;color:rgba(45,134,45,.06);letter-spacing:20px;pointer-events:none}
</style></head>
<body>
<div class="receipt">
<div class="perforated-edge"></div>
<div class="header">
  <div class="company-info">
    <div class="company-name">${escapeHtml(input.businessInfo.schoolName.toUpperCase())}</div>
    <div class="company-tagline">${escapeHtml(input.businessInfo.branchName.toUpperCase())}</div>
    <div class="company-address">
      ${addressHtml}${phoneLine ? `<br>${phoneLine}` : ''}${emailLine ? `<br>${emailLine}` : ''}
    </div>
  </div>
  <div class="receipt-badge">
    <div class="receipt-title">RECEIPT</div>
    <div class="receipt-number">${escapeHtml(input.receiptNumber)}</div>
    <div class="receipt-date">✓ VERIFIED</div>
  </div>
</div>
<div class="details-section">
  <table class="details-table">
    <tr><td>RECEIPT NO:</td><td>${escapeHtml(input.receiptNumber)}</td></tr>
    <tr><td>CHALLAN NO:</td><td>${escapeHtml(input.challanNumber)}</td></tr>
    <tr><td>STUDENT:</td><td>${escapeHtml(input.studentName.toUpperCase())}</td></tr>
    <tr><td>VERIFIED:</td><td>${escapeHtml(formatVerifiedAtReceipt(input.verifiedAt))}</td></tr>
    <tr><td>PAYMENT:</td><td>${escapeHtml(formatPaymentMethodReceipt(input.paymentMethod))} ON ${escapeHtml(formatPaymentDateReceipt(input.paymentDate))}</td></tr>
  </table>
</div>
<div class="items-section watermark">
  <div class="items-header">PAYMENT BREAKDOWN</div>
  <table class="items-table">
    <thead>
      <tr>
        <th>MONTH</th>
        <th>DESCRIPTION</th>
        <th>${escapeHtml(amountHeader)}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<div class="summary-section">
  <div class="summary-box">
    <div class="summary-row">
      <span>AMOUNT PAID:</span>
      <span>${escapeHtml(input.currencyCode)} ${escapeHtml(formatReceiptMoney(input.amountPaid))}</span>
    </div>
    <div class="summary-row">
      <span>TOTAL PAYABLE:</span>
      <span>${escapeHtml(input.currencyCode)} ${escapeHtml(formatReceiptMoney(input.totalPayable))}</span>
    </div>
    <div class="summary-row paid">
      <span>STATUS:</span>
      <span class="amount">PAID IN FULL</span>
    </div>
  </div>
</div>
<div class="footer-section">
  <div class="footer-text">
    ${escapeHtml(footerMain).replace(/\n/g, '<br>')}<br>
    ${escapeHtml(`FOR QUERIES: ${footerEndRaw}`)}
  </div>
</div>
<div class="perforated-edge"></div>
</div>
</body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '10px', right: '10px', bottom: '10px', left: '10px' },
        printBackground: true,
        scale: 0.98,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async generateChallanPdf(input: {
    branchName: string;
    businessInfo: { branchName: string; schoolName: string; address: string; phone: string; email: string };
    challanSettings: {
      challanTemplate: 'Minimal' | 'Modern';
      bankName: string | null;
      accountTitle: string | null;
      accountNumber: string | null;
      bankBranchCode: string | null;
      paymentInstructions: string | null;
      footerText: string | null;
    };
    currencyCode: 'PKR' | 'IQD' | 'SAR' | 'USD';
    studentName: string;
    studentStudentId?: string | null;
    challanNumber: string;
    months: string[];
    dueDate: string;
    billingStartDate?: string | null;
    billingEndDate?: string | null;
    issuedAt: string;
    items: Array<{ billingMonth?: string | null; description: string; amount: number; isDiscount: boolean }>;
    totals: { subtotal: number; totalDiscount: number; payableAmount: number };
    qrPayload: string;
  }): Promise<Buffer> {
    const qrDataUrl = await QRCode.toDataURL(input.qrPayload, { margin: 1, width: 160 });

    const monthLabel = formatMonthLabel(input.months[0] ?? '');
    const dueDateLabel = formatDueDateLabel(input.dueDate);
    // Always show the fee month (e.g. "August 2026"), not a date range.
    const monthDisplayLabel =
      input.months.length > 1
        ? input.months.map((ym) => formatMonthLabel(ym)).filter(Boolean).join(', ')
        : monthLabel;
    const issuedLabel = (() => {
      // input.issuedAt is ISO date (YYYY-MM-DD) in our flow
      const m = input.issuedAt.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return input.issuedAt;
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d).toUpperCase();
    })();

    const rows = input.items
      .map((it) => {
        const amt = (it.amount ?? 0).toFixed(2);
        const sign = it.isDiscount ? '-' : '';
        const month = it.billingMonth ?? '';
        return `<tr>
  <td>${escapeHtml(month)}</td>
  <td>${escapeHtml(it.description)}</td>
  <td style="text-align:right">${escapeHtml(sign + amt)}</td>
</tr>`;
      })
      .join('');

    const showPaymentSection =
      Boolean(input.challanSettings.paymentInstructions?.trim()) ||
      Boolean(input.challanSettings.bankName?.trim()) ||
      Boolean(input.challanSettings.accountTitle?.trim()) ||
      Boolean(input.challanSettings.accountNumber?.trim()) ||
      Boolean(input.challanSettings.bankBranchCode?.trim());

    const paymentInstructions =
      input.challanSettings.paymentInstructions?.trim() ||
      'Please pay the above amount before the due date to avoid late fees. After payment, upload your receipt through the parent portal.';

    const footerText = input.challanSettings.footerText?.trim() || 'This is a computer-generated document.';

    const amountHeader = `Amount (${input.currencyCode})`;

    const html = input.challanSettings.challanTemplate === 'Modern'
      ? `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Challan - Modern</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f5f7fa;padding:18px 12px}
.challan{max-width:800px;margin:0 auto;background:#fff;box-shadow:0 2px 20px rgba(0,0,0,.08);border-radius:12px;overflow:hidden}
.header{background:#4A7C59;color:#fff;padding:22px 26px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.header-left{padding-left:14px;overflow:visible}
.header-left h1{font-size:26px;margin-bottom:6px;font-weight:800;letter-spacing:.2px}
.header-left p{font-size:12px;opacity:.95;line-height:1.45}
.qr-code{background:#fff;padding:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.12);text-align:center}
.qr-code img{display:block;width:80px;height:80px}
.qr-text{margin-top:8px;font-size:11px;color:#667eea;font-weight:600}
.qr-text{margin-top:6px;font-size:10px;color:#4A7C59;font-weight:700}
.content{padding:22px 26px;padding-bottom:56px}
.info-section{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
.info-card{background:#f8f9fc;padding:12px 14px;border-radius:8px;border-left:4px solid #4A7C59}
.info-label{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:600}
.info-label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.55px;margin-bottom:4px;font-weight:700}
.info-value{font-size:14px;color:#1e293b;font-weight:700}
.section-title{font-size:16px;color:#1e293b;margin-bottom:12px;font-weight:800;padding-bottom:10px;border-bottom:2px solid #e2e8f0}
.fee-table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:14px}
.fee-table thead{background:#f8f9fc}
.fee-table th{padding:12px 12px;text-align:left;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.55px;border-bottom:2px solid #e2e8f0}
.fee-table th:last-child{text-align:right}
.fee-table td{padding:11px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-size:13px}
.fee-table td:last-child{text-align:right;font-weight:600}
.fee-table tr.discount td{color:#10b981;font-weight:600}
.summary{background:#f8f9fc;padding:14px 16px;border-radius:8px;margin-top:10px}
.summary-row{display:flex;justify-content:space-between;padding:8px 0;font-size:13px}
.summary-row.total{border-top:2px solid #cbd5e1;margin-top:8px;padding-top:16px}
.summary-row.total{border-top:2px solid #cbd5e1;margin-top:6px;padding-top:12px}
.summary-row.total .label{font-size:15px;font-weight:800;color:#1e293b}
.summary-row.total .value{font-size:18px;font-weight:900;color:#4A7C59}
.payment-info{background:#fef3c7;border:2px solid #fbbf24;padding:14px 16px;border-radius:8px;margin-top:12px}
.payment-info h3{color:#92400e;font-size:14px;margin-bottom:8px;font-weight:800}
.payment-info p{color:#78350f;font-size:12px;line-height:1.5;margin-bottom:6px}
.bank-details{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px}
.bank-detail{background:#fff;padding:12px;border-radius:6px}
.bank-detail strong{display:block;font-size:11px;color:#92400e;margin-bottom:4px;text-transform:uppercase}
.bank-detail span{font-size:14px;color:#78350f;font-weight:600}
.footer{position:fixed;left:50%;transform:translateX(-50%);bottom:12px;width:min(800px, calc(100% - 24px));background:#f8f9fc;padding:10px 18px;text-align:center;color:#64748b;font-size:10px;line-height:1.35;border-radius:10px}
.footer .footer-text{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.footer strong{display:block;color:#1e293b;margin-bottom:8px}
</style></head>
<body>
<div class="challan">
  <div class="header">
    <div class="header-left">
      <h1>${escapeHtml(input.businessInfo.schoolName)}</h1>
      <p>${escapeHtml(input.businessInfo.branchName)}<br>
      ${escapeHtml(input.businessInfo.address).replace(/\\n/g,'<br>')}${input.businessInfo.phone ? `<br>Phone: ${escapeHtml(input.businessInfo.phone)}` : ''}${input.businessInfo.email ? `<br>Email: ${escapeHtml(input.businessInfo.email)}` : ''}</p>
    </div>
    <div class="qr-code">
      <img src="${qrDataUrl}" alt="QR" />
      <div class="qr-text">Scan to pay</div>
    </div>
  </div>

  <div class="content">
    <div class="info-section">
      <div class="info-card"><div class="info-label">Challan Number</div><div class="info-value">${escapeHtml(input.challanNumber)}</div></div>
      <div class="info-card"><div class="info-label">Due Date</div><div class="info-value">${escapeHtml(dueDateLabel)}</div></div>
      <div class="info-card"><div class="info-label">Student</div><div class="info-value">${escapeHtml(input.studentName)}${input.studentStudentId ? ` (${escapeHtml(input.studentStudentId)})` : ''}</div></div>
      <div class="info-card"><div class="info-label">Month</div><div class="info-value">${escapeHtml(monthLabel)}</div></div>
    </div>

    <h2 class="section-title">Fee Breakdown</h2>
    <table class="fee-table">
      <thead><tr><th>Month</th><th>Description</th><th>${escapeHtml(amountHeader)}</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">—</td></tr>'}</tbody>
    </table>

    <div class="summary">
      <div class="summary-row"><span class="label">Subtotal:</span><span class="value">${escapeHtml(input.totals.subtotal.toFixed(2))} ${escapeHtml(input.currencyCode)}</span></div>
      <div class="summary-row"><span class="label">Discounts:</span><span class="value" style="color:#10b981;">-${escapeHtml(input.totals.totalDiscount.toFixed(2))} ${escapeHtml(input.currencyCode)}</span></div>
      <div class="summary-row total"><span class="label">Total Payable:</span><span class="value">${escapeHtml(input.totals.payableAmount.toFixed(2))} ${escapeHtml(input.currencyCode)}</span></div>
    </div>

    ${showPaymentSection ? `<div class="payment-info">
      <h3>Payment Instructions</h3>
      <p>${escapeHtml(paymentInstructions)}</p>
      <div class="bank-details">
        <div class="bank-detail"><strong>Bank Name</strong><span>${escapeHtml(input.challanSettings.bankName ?? '—')}</span></div>
        <div class="bank-detail"><strong>Account Title</strong><span>${escapeHtml(input.challanSettings.accountTitle ?? '—')}</span></div>
        <div class="bank-detail"><strong>Account Number</strong><span>${escapeHtml(input.challanSettings.accountNumber ?? '—')}</span></div>
        <div class="bank-detail"><strong>Branch Code</strong><span>${escapeHtml(input.challanSettings.bankBranchCode ?? '—')}</span></div>
      </div>
    </div>` : ''}
  </div>

  <div class="footer">
    <div class="footer-text">${escapeHtml(footerText)}</div>
  </div>
</div>
</body></html>`
      : `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Challan - Minimal</title>
<style>
@page{size:A4;margin:12mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;background:#fff;padding:0}
.challan{max-width:750px;margin:0 auto;background:#fff;box-shadow:0 0 20px rgba(0,0,0,.1)}
.perforated-edge{height:12px;background:repeating-linear-gradient(90deg,#e0e0e0 0,#e0e0e0 10px,#fff 10px,#fff 20px)}
.header{padding:18px 22px;border-bottom:2px dashed #999;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.company-name{font-size:28px;font-weight:bold;margin-bottom:4px;letter-spacing:2px}
.company-tagline{font-size:11px;color:#666;margin-bottom:12px;letter-spacing:1px}
.company-address{font-size:11px;line-height:1.6;color:#333}
.invoice-badge{border:1.5px solid #000;padding:16px 20px;text-align:center;min-width:180px}
.invoice-title{font-size:20px;font-weight:bold;letter-spacing:2px;margin-bottom:8px}
.invoice-number{font-size:13px;color:#666;margin-bottom:4px}
.invoice-date{font-size:11px;color:#999}
.details-section{padding:16px 22px;background:#fafafa;border-bottom:1px solid #ddd}
.details-table{width:100%}
.details-table td{padding:8px 0;font-size:13px}
.details-table td:first-child{font-weight:bold;width:140px;color:#000}
.items-section{padding:16px 22px}
.items-header{font-size:14px;font-weight:bold;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #000;letter-spacing:1px}
.items-table{width:100%;margin-bottom:20px}
.items-table th{text-align:left;padding:10px 8px;font-size:11px;font-weight:bold;letter-spacing:1px}
.items-table th:last-child{text-align:right}
.items-table td{padding:12px 8px;font-size:13px;border-bottom:1px dotted #ccc}
.items-table td:last-child{text-align:right;font-weight:bold}
.items-table tr.discount td{font-style:italic;color:#2d862d}
.summary-section{padding:0 22px 16px;display:flex;justify-content:flex-end}
.summary-box{width:300px;border:0;box-shadow:inset 0 0 0 2px #000;overflow:hidden}
.summary-row{display:flex;justify-content:space-between;padding:12px 16px;font-size:13px;border-bottom:1px dotted #ccc}
.summary-row.total{background:#f1f3f5;color:#000;font-weight:bold;font-size:16px;padding:16px;border-bottom:none}
.summary-row.total .amount{font-size:20px;letter-spacing:1px}
.payment-section{padding:16px 22px;background:#f9f9f9;border-top:2px dashed #999}
.payment-title{font-size:14px;font-weight:bold;margin-bottom:16px;letter-spacing:1px}
.payment-instructions{font-size:12px;line-height:1.8;margin-bottom:20px;color:#333}
.bank-details-box{border:1px solid #000;padding:20px;background:#fff}
.bank-details-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.bank-field{font-size:11px}
.bank-field-label{font-weight:bold;margin-bottom:4px;color:#000}
.bank-field-value{color:#333}
.signatures-section{padding:12px 22px 10px;background:#fafafa;display:flex;justify-content:space-around;border-top:1px dashed #999}
.signature-box{text-align:center;width:200px;padding-top:36px}
.signature-line{border-top:1px solid #000;margin:0 0 6px 0}
.signature-label{font-size:11px;color:#666;margin-top:4px}
.footer-section{position:fixed;left:50%;transform:translateX(-50%);bottom:6px;width:min(750px, calc(100% - 24px));padding:8px 18px;background:#f1f3f5;color:#000;text-align:center;border-radius:0;border:1px solid #dee2e6}
.footer-title{font-size:12px;font-weight:bold;margin-bottom:8px;letter-spacing:1px}
.footer-text{font-size:10px;line-height:1.35;opacity:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
</style></head>
<body><div class="challan">
<div class="perforated-edge"></div>
<div class="header">
  <div class="company-info">
    <div class="company-name">${escapeHtml(input.businessInfo.schoolName).toUpperCase()}</div>
    <div class="company-tagline">${escapeHtml(input.businessInfo.branchName).toUpperCase()}</div>
    <div class="company-address">
      ${escapeHtml(input.businessInfo.address).replace(/\\n/g,'<br>')}${input.businessInfo.phone ? `<br>TEL: ${escapeHtml(input.businessInfo.phone)}` : ''}${input.businessInfo.email ? `<br>EMAIL: ${escapeHtml(input.businessInfo.email).toUpperCase()}` : ''}
    </div>
  </div>
  <div class="invoice-badge">
    <div class="invoice-title">CHALLAN</div>
    <div class="invoice-number">NO: ${escapeHtml(input.challanNumber)}</div>
    <div class="invoice-date">ISSUED: ${escapeHtml(issuedLabel)}</div>
  </div>
</div>
<div class="details-section">
  <table class="details-table">
    <tr><td>STUDENT NAME:</td><td>${escapeHtml(input.studentName).toUpperCase()}</td></tr>
    <tr><td>STUDENT ID:</td><td>${escapeHtml(input.studentStudentId ?? '—')}</td></tr>
    <tr><td>MONTH:</td><td>${escapeHtml(monthDisplayLabel).toUpperCase()}</td></tr>
    <tr><td>DUE DATE:</td><td>${escapeHtml(dueDateLabel).toUpperCase()}</td></tr>
  </table>
</div>
<div class="items-section">
  <div class="items-header">ITEMS & CHARGES</div>
  <table class="items-table">
    <thead><tr><th>MONTH</th><th>DESCRIPTION</th><th>${escapeHtml(amountHeader).toUpperCase()}</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3">—</td></tr>'}</tbody>
  </table>
</div>
<div class="summary-section">
  <div class="summary-box">
    <div class="summary-row"><span>SUBTOTAL:</span><span>${escapeHtml(input.currencyCode)} ${escapeHtml(input.totals.subtotal.toFixed(2))}</span></div>
    ${input.totals.totalDiscount > 0.009 ? `<div class="summary-row"><span>DISCOUNTS:</span><span>${escapeHtml(input.currencyCode)} ${escapeHtml(input.totals.totalDiscount.toFixed(2))}</span></div>` : ''}
    <div class="summary-row total"><span>TOTAL DUE:</span><span class="amount">${escapeHtml(input.currencyCode)} ${escapeHtml(input.totals.payableAmount.toFixed(2))}</span></div>
  </div>
</div>
${showPaymentSection ? `<div class="payment-section">
  <div class="payment-title">PAYMENT INFORMATION</div>
  <div class="payment-instructions">${escapeHtml(paymentInstructions).toUpperCase()}</div>
  <div class="bank-details-box">
    <div class="bank-details-grid">
      <div class="bank-field"><div class="bank-field-label">BANK NAME:</div><div class="bank-field-value">${escapeHtml(input.challanSettings.bankName ?? '—')}</div></div>
      <div class="bank-field"><div class="bank-field-label">ACCOUNT NUMBER:</div><div class="bank-field-value">${escapeHtml(input.challanSettings.accountNumber ?? '—')}</div></div>
      <div class="bank-field"><div class="bank-field-label">ACCOUNT TITLE:</div><div class="bank-field-value">${escapeHtml(input.challanSettings.accountTitle ?? '—')}</div></div>
      <div class="bank-field"><div class="bank-field-label">BRANCH CODE:</div><div class="bank-field-value">${escapeHtml(input.challanSettings.bankBranchCode ?? '—')}</div></div>
    </div>
  </div>
</div>` : ''}
<div class="signatures-section">
  <div class="signature-box"><div class="signature-line"></div><div class="signature-label">PARENT / GUARDIAN SIGNATURE</div></div>
  <div class="signature-box"><div class="signature-line"></div><div class="signature-label">CASHIER SIGNATURE</div></div>
</div>
<div class="footer-section">
  <div class="footer-text">${escapeHtml(footerText).replace(/\\n/g,'<br>')}</div>
</div>
</div></body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const isMinimal = input.challanSettings.challanTemplate === 'Minimal';
      const isModern = input.challanSettings.challanTemplate === 'Modern';
      const pdf = await page.pdf({
        format: 'A4',
        // Minimal layout is dense; reduce margins and scale slightly to keep it on one page.
        margin: isMinimal
          ? { top: '12px', right: '12px', bottom: '12px', left: '12px' }
          : isModern
            ? { top: '14px', right: '14px', bottom: '14px', left: '14px' }
            : { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        // Modern sometimes spills to page 2 when payment instructions are long; keep it slightly tighter.
        scale: isMinimal ? 0.9 : isModern ? 0.94 : 1,
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

