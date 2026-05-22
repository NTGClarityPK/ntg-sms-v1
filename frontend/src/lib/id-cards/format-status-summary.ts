import type { IdCardStatus } from '@/types/id-cards';

const STATUS_ORDER: IdCardStatus[] = ['draft', 'approved', 'printed', 'issued', 'revoked'];

export function buildIdCardStatusSummaryParts(
  statusCounts: Partial<Record<IdCardStatus, number>>,
  statusLabel: (status: IdCardStatus) => string,
  partLabel: (count: number, status: string) => string,
): string[] {
  return STATUS_ORDER.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) =>
    partLabel(statusCounts[s] ?? 0, statusLabel(s)),
  );
}
