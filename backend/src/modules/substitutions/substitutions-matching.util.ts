import { storedTimetableSlotRangesOverlap } from '../timetable/timetable-slot-time.util';
import { SuggestedSubstituteDto } from './dto/suggested-substitute.dto';

export type AffectedSlotForMatching = {
  id: string;
  subjectId: string | null;
  startTime: string;
  endTime: string;
  storedEndTime: string;
};

export type CandidateBusySlot = {
  staffId: string;
  startTime: string;
  storedEndTime: string;
};

export type CandidateMeta = {
  staffId: string;
  fullName: string;
  primarySubject?: string;
  monthlyCount: number;
  /** Dates in the requested range when this teacher is marked absent */
  absentDates: Set<string>;
  subjectIdsFromAssignments: Set<string>;
};

export type SlotDatePair = {
  date: string;
  slot: AffectedSlotForMatching;
};

function stableHash(staffId: string): number {
  let h = 0;
  for (let i = 0; i < staffId.length; i++) {
    h = (h * 31 + staffId.charCodeAt(i)) >>> 0;
  }
  return h;
}

function isFreeForSlot(
  candidateId: string,
  affected: AffectedSlotForMatching,
  busyByStaff: Map<string, CandidateBusySlot[]>,
): boolean {
  const busy = busyByStaff.get(candidateId) ?? [];
  return !busy.some((b) =>
    storedTimetableSlotRangesOverlap(
      affected.startTime,
      affected.storedEndTime,
      b.startTime,
      b.storedEndTime,
    ),
  );
}

export function rankSubstituteCandidates(
  pairs: SlotDatePair[],
  candidates: CandidateMeta[],
  busyByStaff: Map<string, CandidateBusySlot[]>,
): SuggestedSubstituteDto[] {
  const totalAffected = pairs.length;
  if (totalAffected === 0) return [];

  const ranked = candidates
    .map((c) => {
      let freeCount = 0;
      let matchesSubject = false;
      for (const { date, slot } of pairs) {
        if (c.absentDates.has(date)) continue;
        if (isFreeForSlot(c.staffId, slot, busyByStaff)) {
          freeCount++;
          if (slot.subjectId && c.subjectIdsFromAssignments.has(slot.subjectId)) {
            matchesSubject = true;
          }
        }
      }
      const availabilityStatus: 'available' | 'partial' | 'unavailable' =
        freeCount === 0 ? 'unavailable' : freeCount === totalAffected ? 'available' : 'partial';

      return {
        staffId: c.staffId,
        fullName: c.fullName,
        primarySubject: c.primarySubject,
        freePeriods: freeCount,
        totalAffectedPeriods: totalAffected,
        substitutionsThisMonth: c.monthlyCount,
        availabilityStatus,
        isBestMatch: false,
        hasHighLoadWarning: c.monthlyCount > 8,
        matchesSubject,
        _hash: stableHash(c.staffId),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null && row.freePeriods > 0)
    .sort((a, b) => {
      if (a.matchesSubject !== b.matchesSubject) {
        return a.matchesSubject ? -1 : 1;
      }
      if (a.substitutionsThisMonth !== b.substitutionsThisMonth) {
        return a.substitutionsThisMonth - b.substitutionsThisMonth;
      }
      if (a.freePeriods !== b.freePeriods) {
        return b.freePeriods - a.freePeriods;
      }
      return a._hash - b._hash;
    });

  return ranked.map((row, index) => {
    const { _hash: _unused, ...rest } = row;
    void _unused;
    return new SuggestedSubstituteDto({
      ...rest,
      isBestMatch: index === 0,
    });
  });
}

export function splitSuggestedAndOthers(
  ranked: SuggestedSubstituteDto[],
): { suggested: SuggestedSubstituteDto[]; others: SuggestedSubstituteDto[] } {
  return {
    suggested: ranked.slice(0, 5),
    others: ranked.slice(5),
  };
}
