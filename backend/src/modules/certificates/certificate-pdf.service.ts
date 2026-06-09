import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import type { CertificateTemplateId } from './types/certificate.types';

function getPuppeteerExecutablePath(): string | undefined {
  return (
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    undefined
  );
}

/** A4 portrait at 96 CSS px per inch (297mm height). */
const A4_PORTRAIT_HEIGHT_PX = 1123;
const A4_PORTRAIT_WIDTH_PX = 794;
const A4_LANDSCAPE_HEIGHT_PX = 794;
const A4_LANDSCAPE_WIDTH_PX = 1123;

@Injectable()
export class CertificatePdfService {
  async renderHtmlToPdf(
    html: string,
    templateId: CertificateTemplateId,
  ): Promise<Buffer> {
    const isLandscape = templateId === 'award';
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({
        width: isLandscape ? A4_LANDSCAPE_WIDTH_PX : A4_PORTRAIT_WIDTH_PX,
        height: isLandscape ? A4_LANDSCAPE_HEIGHT_PX : A4_PORTRAIT_HEIGHT_PX,
        deviceScaleFactor: 1,
      });
      await page.emulateMediaType('print');
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60_000 });
      await page.evaluate(() => document.fonts?.ready);

      const scale = await page.evaluate((maxHeight) => {
        const root = document.querySelector('.cert') as HTMLElement | null;
        const contentHeight = Math.ceil(
          root?.scrollHeight ?? document.documentElement.scrollHeight,
        );
        if (contentHeight <= maxHeight) return 1;
        return Math.min(1, (maxHeight - 4) / contentHeight);
      }, isLandscape ? A4_LANDSCAPE_HEIGHT_PX : A4_PORTRAIT_HEIGHT_PX);

      const pdf = await page.pdf({
        landscape: isLandscape,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        scale,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
