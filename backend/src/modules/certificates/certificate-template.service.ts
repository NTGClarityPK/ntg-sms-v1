import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import {
  ADMINISTRATIVE_CERTIFICATE_TYPES,
  AWARD_CERTIFICATE_TYPES,
  type CertificateTemplateId,
  type CertificateRenderContext,
} from './types/certificate.types';
import { renderCertificateTemplate } from './utils/template-render.util';
import { buildCertificateThemeCss } from './utils/certificate-theme.util';
import { resolveCertificateTemplateFile } from './utils/resolve-template-file.util';
import { CertificateDesignDto } from './dto/certificate.dto';

@Injectable()
export class CertificateTemplateService {
  private cache = new Map<CertificateTemplateId, string>();

  loadTemplateHtml(templateId: CertificateTemplateId): string {
    const useCache = process.env.NODE_ENV === 'production';
    const cached = useCache ? this.cache.get(templateId) : undefined;
    if (cached) return cached;
    const fileName =
      templateId === 'award'
        ? 'certificate-award.html'
        : 'certificate-administrative.html';
    const filePath = resolveCertificateTemplateFile(__dirname, fileName);
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`Certificate template not found: ${templateId}`);
    }
    const html = fs.readFileSync(filePath, 'utf8');
    if (useCache) this.cache.set(templateId, html);
    return html;
  }

  renderHtml(
    templateId: CertificateTemplateId,
    context: CertificateRenderContext,
    primaryColor: string | null,
  ): string {
    const raw = this.loadTemplateHtml(templateId);
    const body = renderCertificateTemplate(raw, context);
    const themeCss = buildCertificateThemeCss(primaryColor);
    const styleMatch = body.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const styles = styleMatch?.[1] ?? '';
    const bodyMatch = body.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyInner = bodyMatch?.[1] ?? body;
    // Template CSS includes default :root theme vars; injected theme must come last to override.
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><style>${styles}${themeCss}</style></head><body>${bodyInner}</body></html>`;
  }

  listDesigns(): CertificateDesignDto[] {
    return [
      {
        id: 'award',
        label: 'Award Certificate',
        orientation: 'landscape',
        certificateTypes: [...AWARD_CERTIFICATE_TYPES],
      },
      {
        id: 'administrative',
        label: 'Administrative Certificate',
        orientation: 'portrait',
        certificateTypes: [...ADMINISTRATIVE_CERTIFICATE_TYPES],
      },
    ];
  }
}
