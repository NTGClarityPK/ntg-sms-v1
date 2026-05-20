import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import {
  formatCentsToDisplay,
  type InvoiceLineItem,
} from './plan-pricing';

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

@Injectable()
export class SubscriptionInvoicePdfService {
  async generateInvoicePdf(input: {
    invoiceNumber: string;
    tenantName: string;
    planLabel: string;
    billingCycle: string;
    periodStart: string;
    periodEnd: string;
    issuedAt: string;
    dueAt?: string;
    status: string;
    amountCents: number;
    currency: string;
    lineItems: InvoiceLineItem[];
  }): Promise<Buffer> {
    const totalDisplay = formatCentsToDisplay(input.amountCents, input.currency);
    const rows =
      input.lineItems.length === 0
        ? `<tr><td colspan="4">No line items</td></tr>`
        : input.lineItems
            .map(
              (it) => `<tr>
  <td>${escapeHtml(it.description)}</td>
  <td style="text-align:right">${it.quantity}</td>
  <td style="text-align:right">${formatCentsToDisplay(it.unitAmountCents, input.currency)}</td>
  <td style="text-align:right">${formatCentsToDisplay(it.amountCents, input.currency)}</td>
</tr>`,
            )
            .join('');

    const dueLine = input.dueAt
      ? `<br><strong>Due:</strong> ${formatDate(input.dueAt)}`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Invoice ${escapeHtml(input.invoiceNumber)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #222; margin: 0; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 8px; color: #c92a2a; }
  .meta { font-size: 12px; color: #555; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border-bottom: 1px solid #ddd; padding: 10px 8px; font-size: 12px; }
  th { text-align: left; background: #f8f8f8; }
  .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 16px; }
  .status { display: inline-block; padding: 4px 10px; border-radius: 12px; background: #fff4e6; color: #c92a2a; font-size: 11px; font-weight: bold; }
  .footer { margin-top: 40px; font-size: 11px; color: #888; }
</style></head><body>
  <h1>Subscription Invoice</h1>
  <div class="meta">
    <strong>Invoice #:</strong> ${escapeHtml(input.invoiceNumber)}<br>
    <strong>School:</strong> ${escapeHtml(input.tenantName)}<br>
    <strong>Plan:</strong> ${escapeHtml(input.planLabel)} (${escapeHtml(input.billingCycle)})<br>
    <strong>Period:</strong> ${formatDate(input.periodStart)} – ${formatDate(input.periodEnd)}<br>
    <strong>Issued:</strong> ${formatDate(input.issuedAt)}${dueLine}<br>
    <strong>Status:</strong> <span class="status">${escapeHtml(input.status.toUpperCase())}</span>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total: ${escapeHtml(totalDisplay)}</div>
  <div class="footer">Payment is processed offline unless online billing is enabled. Thank you for using Alma.</div>
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
        margin: { top: '24px', right: '24px', bottom: '24px', left: '24px' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
