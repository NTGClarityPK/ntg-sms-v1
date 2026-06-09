import type { SupabaseClient } from '@supabase/supabase-js';
import type { RevenueFeeLineDto, RevenueIdCardLineDto } from '../dto/revenue-report.dto';

function formatPersonName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim() || '—';
}

function eventDateFromReprint(printedAt: string | null, createdAt: string): string {
  return (printedAt ?? createdAt ?? '').slice(0, 10);
}

export async function loadFeePaymentDetails(
  supabase: SupabaseClient,
  branchIds: readonly string[],
  startDate: string,
  endDate: string,
  branchNameById: Map<string, string>,
): Promise<RevenueFeeLineDto[]> {
  if (branchIds.length === 0) return [];

  const { data, error } = await supabase
    .from('fee_payments')
    .select(
      'id, branch_id, student_id, amount_paid, payment_date, payment_method, fee_challans:challan_id(challan_number)',
    )
    .in('branch_id', [...branchIds])
    .eq('status', 'Verified')
    .gte('payment_date', startDate)
    .lte('payment_date', endDate)
    .order('payment_date', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    branch_id: string;
    student_id: string;
    amount_paid: number;
    payment_date: string;
    payment_method: string;
    fee_challans: { challan_number: string } | { challan_number: string }[] | null;
  }>;

  const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
  const studentNameById = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .in('id', studentIds);
    if (sErr) throw sErr;
    for (const s of (students ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
    }>) {
      studentNameById.set(s.id, formatPersonName(s.first_name, s.last_name));
    }
  }

  return rows
    .filter((r) => Number(r.amount_paid || 0) > 0)
    .map((r) => {
      const challanRel = r.fee_challans;
      const challan = Array.isArray(challanRel) ? challanRel[0] : challanRel;
      return {
        id: r.id,
        branchId: r.branch_id,
        branchName: branchNameById.get(r.branch_id),
        studentId: r.student_id,
        personName: studentNameById.get(r.student_id) ?? '—',
        amount: Math.round(Number(r.amount_paid) * 100) / 100,
        paymentDate: r.payment_date,
        paymentMethodKey: r.payment_method || 'Unknown',
        challanNumber: challan?.challan_number,
      };
    });
}

export async function loadIdCardReprintDetails(
  supabase: SupabaseClient,
  branchIds: readonly string[],
  startDate: string,
  endDate: string,
  branchNameById: Map<string, string>,
): Promise<RevenueIdCardLineDto[]> {
  if (branchIds.length === 0) return [];

  const { data, error } = await supabase
    .from('id_card_reprints')
    .select(
      'id, branch_id, fee_charged, printed_at, created_at, reason, id_cards:card_id(person_id, person_type, card_number)',
    )
    .in('branch_id', [...branchIds])
    .not('fee_charged', 'is', null)
    .gt('fee_charged', 0);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    branch_id: string;
    fee_charged: number;
    printed_at: string | null;
    created_at: string;
    reason: string;
    id_cards: {
      person_id: string;
      person_type: string;
      card_number: string;
    } | {
      person_id: string;
      person_type: string;
      card_number: string;
    }[] | null;
  }>;

  const inRange = rows.filter((r) => {
    const d = eventDateFromReprint(r.printed_at, r.created_at);
    return d && d >= startDate && d <= endDate;
  });

  const cardsByReprint = inRange.map((r) => {
    const card = Array.isArray(r.id_cards) ? r.id_cards[0] : r.id_cards;
    return { reprint: r, card };
  });

  const studentIds = cardsByReprint
    .filter((x) => x.card?.person_type === 'student')
    .map((x) => x.card!.person_id);
  const staffIds = cardsByReprint
    .filter((x) => x.card?.person_type === 'staff' || x.card?.person_type === 'admin')
    .map((x) => x.card!.person_id);

  const studentNameById = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .in('id', Array.from(new Set(studentIds)));
    if (sErr) throw sErr;
    for (const s of (students ?? []) as Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
    }>) {
      studentNameById.set(s.id, formatPersonName(s.first_name, s.last_name));
    }
  }

  const staffNameById = new Map<string, string>();
  if (staffIds.length > 0) {
    const uniqueStaffIds = Array.from(new Set(staffIds));
    const { data: staffRows, error: stErr } = await supabase
      .from('staff')
      .select('id, user_id')
      .in('id', uniqueStaffIds);
    if (stErr) throw stErr;
    const userIds = (staffRows ?? []).map((s) => (s as { user_id: string }).user_id);
    const staffIdByUser = new Map(
      (staffRows ?? []).map((s) => {
        const row = s as { id: string; user_id: string };
        return [row.user_id, row.id] as const;
      }),
    );
    const { data: profiles } =
      userIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] };
    for (const p of profiles ?? []) {
      const row = p as { id: string; full_name: string | null };
      const staffId = staffIdByUser.get(row.id);
      if (staffId) staffNameById.set(staffId, row.full_name?.trim() || '—');
    }
  }

  return cardsByReprint.map(({ reprint: r, card }) => {
    const personType = card?.person_type ?? 'student';
    const personId = card?.person_id ?? '';
    let personName = '—';
    if (personType === 'student') {
      personName = studentNameById.get(personId) ?? '—';
    } else if (personType === 'staff' || personType === 'admin') {
      personName = staffNameById.get(personId) ?? '—';
    }
    return {
      id: r.id,
      branchId: r.branch_id,
      branchName: branchNameById.get(r.branch_id),
      personName,
      personType,
      amount: Math.round(Number(r.fee_charged) * 100) / 100,
      eventDate: eventDateFromReprint(r.printed_at, r.created_at),
      cardNumber: card?.card_number,
      reason: r.reason,
    };
  });
}
