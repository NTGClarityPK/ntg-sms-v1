/** Default sage green used in certificate HTML templates. */
export const DEFAULT_CERTIFICATE_PRIMARY = '#537D5D';

/** Preset swatches for certificate branding (matches app theme picker pattern). */
export const CERTIFICATE_COLOR_SWATCHES = [
  DEFAULT_CERTIFICATE_PRIMARY,
  '#4A7C59',
  '#2B4728',
  '#1565C0',
  '#6A1B9A',
  '#C62828',
  '#E65100',
  '#00838F',
  '#5D4037',
  '#37474F',
];

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

export function normalizeCertificatePrimary(hex: string | null | undefined): string {
  const trimmed = hex?.trim();
  if (trimmed && /^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  return DEFAULT_CERTIFICATE_PRIMARY;
}

/** Mirrors backend `buildCertificateThemeCss` shade logic for UI preview. */
export function getCertificateThemeShades(hex: string | null | undefined): {
  primary: string;
  deep: string;
  soft: string;
} {
  const primary = normalizeCertificatePrimary(hex);
  return {
    primary,
    deep: shadeHex(primary, -30),
    soft: shadeHex(primary, 85),
  };
}
