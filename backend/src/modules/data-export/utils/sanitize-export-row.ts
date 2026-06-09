import { DENYLIST_COLUMN_NAMES, STRIPE_FIELD_DENYLIST } from '../constants/export-denylist';

export function sanitizeExportRow(
  row: Record<string, unknown>,
  options?: { isSubscriptionTable?: boolean },
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const lower = key.toLowerCase();
    if (DENYLIST_COLUMN_NAMES.has(lower)) continue;
    if (options?.isSubscriptionTable && STRIPE_FIELD_DENYLIST.has(lower)) continue;
    out[key] = value;
  }
  return out;
}
