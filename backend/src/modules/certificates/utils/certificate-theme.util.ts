function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace('#', '');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shadeHex(hex: string, percent: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  const f = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((f - r) * p + r);
  g = Math.round((f - g) * p + g);
  b = Math.round((f - b) * p + b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Injects :root theme overrides matching CertificateDesigns shade logic. */
export function buildCertificateThemeCss(primaryHex: string | null | undefined): string {
  const theme = primaryHex?.trim() && /^#[0-9A-Fa-f]{6}$/.test(primaryHex.trim())
    ? primaryHex.trim()
    : '#537D5D';
  const themeDeep = shadeHex(theme, -30);
  const themeSoft = shadeHex(theme, 85);
  return `:root{--theme:${theme};--theme-deep:${themeDeep};--theme-soft:${themeSoft};}`;
}
