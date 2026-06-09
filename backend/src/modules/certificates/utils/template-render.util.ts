import { escapeHtmlPdf } from '../../id-cards/utils/escape-html.util';
import type { CertificateRenderContext } from '../types/certificate.types';

const RAW_HTML_KEYS = new Set([
  'school_logo_url',
  'details_table_rows',
  'remarks_paragraph',
  'citation_html',
]);

function valueForKey(data: CertificateRenderContext, key: string): string {
  const v = data[key];
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'true' : '';
  return String(v);
}

/** {{key}} substitution with optional {{#if flag}} blocks. */
export function renderCertificateTemplate(
  html: string,
  data: CertificateRenderContext,
): string {
  let out = html.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const raw = valueForKey(data, key);
    if (RAW_HTML_KEYS.has(key)) return raw;
    return escapeHtmlPdf(raw);
  });

  const flags = [
    'isRevoked',
    'isLeaving',
    'isCharacter',
    'photoUrl',
    'showDistinctionBadge',
    'showCertificateNumber',
    'signature1_name',
    'signature2_name',
  ] as const;
  for (const flag of flags) {
    if (data[flag]) {
      out = out.replace(
        new RegExp(`\\{\\{#if ${flag}\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}`, 'g'),
        '$1',
      );
    } else {
      out = out.replace(
        new RegExp(`\\{\\{#if ${flag}\\}\\}[\\s\\S]*?\\{\\{/if\\}\\}`, 'g'),
        '',
      );
    }
  }

  return out;
}
