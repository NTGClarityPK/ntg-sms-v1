import type { IdCardRenderData } from '../types/id-card-render-data';
import { escapeHtmlPdf } from './escape-html.util';

function valueForKey(data: IdCardRenderData, key: string): string {
  const v = data[key as keyof IdCardRenderData];
  if (v === undefined || v === null) return '';
  return String(v);
}

/** Simple {{key}} substitution for placeholder HTML templates. */
export function renderIdCardTemplate(html: string, data: IdCardRenderData): string {
  let out = html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const raw = valueForKey(data, key);
    if (key === 'qrCodeDataUrl' || key === 'photoUrl' || key === 'schoolLogoUrl') {
      return raw;
    }
    return escapeHtmlPdf(raw);
  });
  const photoUrl = data.photoUrl?.trim() ?? '';
  if (photoUrl) {
    out = out.replace(/\{\{#if photoUrl\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
  } else {
    out = out.replace(/\{\{#if photoUrl\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }
  if (data.isReissued) {
    out = out.replace(/\{\{#if isReissued\}\}([\s\S]*?)\{\{\/if\}\}/g, '$1');
  } else {
    out = out.replace(/\{\{#if isReissued\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }
  return out;
}
