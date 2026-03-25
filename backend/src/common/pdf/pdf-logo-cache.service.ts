import { Injectable } from '@nestjs/common';

type CachedLogo = {
  dataUrl: string;
  fetchedAtMs: number;
};

function buildInlineFallbackNtgAlmaLogoDataUrl(): string {
  // Fallback mark (in case the real logo URL isn't reachable).
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="64" viewBox="0 0 220 64" role="img" aria-label="NTG Alma">
  <rect width="220" height="64" fill="none" />
  <g transform="translate(0,0)">
    <rect x="0" y="8" width="48" height="48" rx="12" fill="#212529" />
    <text x="24" y="40" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff">A</text>
  </g>
  <text x="62" y="40" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="26" font-weight="700" fill="#212529">NTG Alma</text>
</svg>`.trim();
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

function safeContentTypeToDataPrefix(contentType: string | null): string {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('image/png')) return 'data:image/png;base64,';
  if (ct.includes('image/jpeg')) return 'data:image/jpeg;base64,';
  if (ct.includes('image/webp')) return 'data:image/webp;base64,';
  if (ct.includes('image/svg+xml')) return 'data:image/svg+xml;base64,';
  // Fallback: most tenants will upload png/jpg; default to png
  return 'data:image/png;base64,';
}

@Injectable()
export class PdfLogoCacheService {
  private readonly fallbackNtgLogoDataUrl = buildInlineFallbackNtgAlmaLogoDataUrl();
  private ntgLogoCache: CachedLogo | null = null;
  private readonly tenantLogoCache = new Map<string, CachedLogo>();

  // Keep small + safe; logos should be tiny.
  private readonly ttlMs = 60 * 60 * 1000; // 1 hour
  private readonly maxBytes = 1_500_000; // 1.5MB

  async getNtgLogoDataUrl(): Promise<string> {
    const now = Date.now();
    if (this.ntgLogoCache && now - this.ntgLogoCache.fetchedAtMs < this.ttlMs) {
      return this.ntgLogoCache.dataUrl;
    }

    const baseUrl = process.env.NTG_ALMA_LOGO_URL || process.env.FRONTEND_URL || '';
    const trimmed = baseUrl.trim().replace(/\/$/, '');
    const logoUrl =
      process.env.NTG_ALMA_LOGO_URL?.trim() ||
      (trimmed ? `${trimmed}/NTGTempLogo.svg` : '');

    if (!logoUrl) return this.fallbackNtgLogoDataUrl;

    try {
      const res = await fetch(logoUrl);
      if (!res.ok) return this.fallbackNtgLogoDataUrl;
      const arrayBuffer = await res.arrayBuffer();
      const bytes = arrayBuffer.byteLength;
      if (bytes <= 0 || bytes > this.maxBytes) return this.fallbackNtgLogoDataUrl;

      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const prefix = safeContentTypeToDataPrefix(res.headers.get('content-type'));
      const dataUrl = `${prefix}${base64}`;
      this.ntgLogoCache = { dataUrl, fetchedAtMs: now };
      return dataUrl;
    } catch {
      return this.fallbackNtgLogoDataUrl;
    }
  }

  clearTenantLogoCache(tenantId?: string): void {
    if (!tenantId) {
      this.tenantLogoCache.clear();
      return;
    }
    this.tenantLogoCache.delete(tenantId);
  }

  async getTenantLogoDataUrl(
    tenantId: string,
    logoUrl: string | null | undefined,
  ): Promise<string | undefined> {
    if (!tenantId || !logoUrl) return undefined;

    const cached = this.tenantLogoCache.get(tenantId);
    const now = Date.now();
    if (cached && now - cached.fetchedAtMs < this.ttlMs) return cached.dataUrl;

    try {
      const res = await fetch(logoUrl);
      if (!res.ok) return undefined;
      const arrayBuffer = await res.arrayBuffer();
      const bytes = arrayBuffer.byteLength;
      if (bytes <= 0 || bytes > this.maxBytes) return undefined;

      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const prefix = safeContentTypeToDataPrefix(res.headers.get('content-type'));
      const dataUrl = `${prefix}${base64}`;
      this.tenantLogoCache.set(tenantId, { dataUrl, fetchedAtMs: now });
      return dataUrl;
    } catch {
      return undefined;
    }
  }
}

