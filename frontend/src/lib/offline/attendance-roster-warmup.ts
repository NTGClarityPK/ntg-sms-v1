import { apiClient } from '@/lib/api-client';
import type { Attendance } from '@/types/attendance';
import { cacheRoster, getCachedRoster, isAttendanceDbAvailable } from './attendance-outbox';

/** Hard cap so a misconfigured account cannot flood the device. */
export const MAX_WARMUP_SECTIONS = 20;

/** Parallel attendance fetches during warmup. */
export const WARMUP_CONCURRENCY = 2;

export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface WarmAttendanceRostersInput {
  classSectionIds: string[];
  date?: string;
  concurrency?: number;
  maxSections?: number;
  signal?: AbortSignal;
}

export interface WarmAttendanceRostersResult {
  warmed: number;
  skippedFresh: number;
  failed: number;
  truncated: boolean;
}

async function fetchAndCacheOne(
  classSectionId: string,
  date: string,
  signal?: AbortSignal,
): Promise<'warmed' | 'skipped' | 'failed'> {
  if (signal?.aborted) return 'failed';

  const existing = await getCachedRoster(classSectionId, date);
  if (existing) return 'skipped';

  try {
    const response = await apiClient.get<Attendance[]>(
      `/api/v1/attendance/class/${classSectionId}/date/${date}`,
      signal ? { signal } : undefined,
    );
    const records = response.data ?? [];
    await cacheRoster(classSectionId, date, records);
    return 'warmed';
  } catch {
    return 'failed';
  }
}

/**
 * Prefetch today's (or given) attendance rosters into IndexedDB.
 * Skips sections that already have a fresh cache. Never throws.
 */
export async function warmAttendanceRosters(
  input: WarmAttendanceRostersInput,
): Promise<WarmAttendanceRostersResult> {
  const empty: WarmAttendanceRostersResult = {
    warmed: 0,
    skippedFresh: 0,
    failed: 0,
    truncated: false,
  };

  if (typeof window === 'undefined') return empty;
  if (!navigator.onLine) return empty;

  const dbOk = await isAttendanceDbAvailable();
  if (!dbOk) return empty;

  const date = input.date ?? localDateString();
  const concurrency = Math.max(1, input.concurrency ?? WARMUP_CONCURRENCY);
  const maxSections = input.maxSections ?? MAX_WARMUP_SECTIONS;

  const uniqueIds = Array.from(new Set(input.classSectionIds.filter(Boolean)));
  const truncated = uniqueIds.length > maxSections;
  const ids = uniqueIds.slice(0, maxSections);

  let warmed = 0;
  let skippedFresh = 0;
  let failed = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      if (input.signal?.aborted) return;
      const index = cursor;
      cursor += 1;
      const id = ids[index];
      if (!id) continue;
      const outcome = await fetchAndCacheOne(id, date, input.signal);
      if (outcome === 'warmed') warmed += 1;
      else if (outcome === 'skipped') skippedFresh += 1;
      else failed += 1;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
  await Promise.all(workers);

  return { warmed, skippedFresh, failed, truncated };
}
