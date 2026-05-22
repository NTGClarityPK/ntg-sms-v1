import { Injectable, BadRequestException } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import QRCode from 'qrcode';
import type { IdCardRenderData } from './types/id-card-render-data';
import { renderIdCardTemplate } from './utils/template-render.util';
import { buildPdfThemeVariablesCss } from '../results/pdf-theme';
import { resolveIdCardsTemplateFile } from './utils/resolve-template-file.util';

/** CSS px for ISO CR80 at 96dpi — matches id-card-design print @page size. */
const ID_CARD_PDF_VIEWPORT_PX = {
  width: Math.round((85.6 * 96) / 25.4),
  height: Math.round((53.98 * 96) / 25.4),
};

function getPuppeteerExecutablePath(): string | undefined {
  return (
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    undefined
  );
}

@Injectable()
export class IdCardPdfService {
  private templateCache = new Map<string, string>();

  loadTemplateHtml(templateKey: string): string {
    const cached = this.templateCache.get(templateKey);
    if (cached) return cached;
    const filePath = resolveIdCardsTemplateFile(__dirname, `${templateKey}.html`);
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`ID card template not found: ${templateKey}`);
    }
    const html = fs.readFileSync(filePath, 'utf8');
    this.templateCache.set(templateKey, html);
    return html;
  }

  async buildQrDataUrl(payload: string): Promise<string> {
    return QRCode.toDataURL(payload, { margin: 1, width: 120 });
  }

  private wrapWithTheme(html: string, primaryColor: string | null): string {
    const themeCss = buildPdfThemeVariablesCss(primaryColor);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${themeCss}</style></head><body>${html.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '') || html}</body></html>`;
  }

  private extractBodyInner(html: string): string {
    const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return match?.[1] ?? html;
  }

  async renderHtmlDocumentToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({
        width: ID_CARD_PDF_VIEWPORT_PX.width,
        height: ID_CARD_PDF_VIEWPORT_PX.height * 2,
        deviceScaleFactor: 3,
      });
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      await page.evaluate(() => document.fonts?.ready);
      return Buffer.from(
        await page.pdf({
          printBackground: true,
          preferCSSPageSize: true,
          width: '85.6mm',
          height: '53.98mm',
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          scale: 1,
        }),
      );
    } finally {
      await browser.close();
    }
  }

  async renderSideToPdf(
    templateKey: string,
    data: IdCardRenderData,
    primaryColor: string | null,
  ): Promise<Buffer> {
    const raw = this.loadTemplateHtml(templateKey);
    const rendered = renderIdCardTemplate(raw, data);
    const bodyInner = this.extractBodyInner(rendered);
    const styleMatch = rendered.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const styles = styleMatch?.[1] ?? '';
    const themeCss = buildPdfThemeVariablesCss(primaryColor);
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${themeCss}${styles}</style></head><body>${bodyInner}</body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        width: '85.6mm',
        height: '54mm',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async renderMergedCardPdf(
    frontKey: string,
    backKey: string,
    data: IdCardRenderData,
    primaryColor: string | null,
  ): Promise<Buffer> {
    const frontBuf = await this.renderSideToPdf(frontKey, data, primaryColor);
    const backBuf = await this.renderSideToPdf(backKey, data, primaryColor);
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      const frontB64 = frontBuf.toString('base64');
      const backB64 = backBuf.toString('base64');
      const html = `<!DOCTYPE html><html><head><style>@page{size:85.6mm 54mm;margin:0}body{margin:0}img{width:85.6mm;height:54mm;display:block;page-break-after:always}</style></head><body><img src="data:application/pdf;base64,${frontB64}" /><img src="data:application/pdf;base64,${backB64}" /></body></html>`;
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      await page.evaluate(() => document.fonts?.ready);
      return Buffer.from(
        await page.pdf({
          width: '85.6mm',
          height: '108mm',
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        }),
      );
    } finally {
      await browser.close();
    }
  }

  /** Front and back as two pages in one PDF (simpler merge). */
  async renderCardPdfTwoPages(
    frontKey: string,
    backKey: string,
    data: IdCardRenderData,
    primaryColor: string | null,
  ): Promise<Buffer> {
    const frontRaw = this.loadTemplateHtml(frontKey);
    const backRaw = this.loadTemplateHtml(backKey);
    const frontHtml = renderIdCardTemplate(frontRaw, data);
    const backHtml = renderIdCardTemplate(backRaw, data);
    const themeCss = buildPdfThemeVariablesCss(primaryColor);
    const combined = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${themeCss} .page{page-break-after:always;width:85.6mm;height:54mm;overflow:hidden}</style></head><body><div class="page">${this.extractBodyInner(frontHtml)}</div><div class="page">${this.extractBodyInner(backHtml)}</div></body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(combined, { waitUntil: 'networkidle0' });
      return Buffer.from(
        await page.pdf({
          width: '85.6mm',
          height: '54mm',
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        }),
      );
    } finally {
      await browser.close();
    }
  }

  async renderA4NineUp(sidesHtml: string[]): Promise<Buffer> {
    const padded: string[] = [...sidesHtml.slice(0, 9)];
    while (padded.length < 9) padded.push('<div style="width:85.6mm;height:54mm"></div>');
    const slotHtml = padded.map((h) => `<div class="slot">${h}</div>`).join('');

    const wrapper = this.loadTemplateHtml('placeholder-a4-9up').replace('{{CARD_SLOTS}}', slotHtml);
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(wrapper, { waitUntil: 'networkidle0' });
      return Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
        }),
      );
    } finally {
      await browser.close();
    }
  }
}
