import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { UniformsService } from '../uniforms/uniforms.service';
import { UniformIssuanceDto } from './dto/uniform-issuance.dto';
import { IssuanceReportRowDto } from './dto/uniform-issuance.dto';
import { CreateDirectIssuanceDto } from './dto/create-direct-issuance.dto';
import { QueryIssuanceReportDto } from './dto/query-issuance-report.dto';

type IssuanceRow = {
  id: string;
  student_id: string;
  uniform_item_id: string;
  size: string;
  quantity: number;
  issued_by: string;
  request_id: string | null;
  notes: string | null;
  branch_id: string;
  issued_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(
    error instanceof Error ? error.message : 'Unknown error',
  );
}

@Injectable()
export class UniformIssuancesService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly uniformsService: UniformsService,
  ) {}

  async getByStudentId(
    studentId: string,
    branchId: string,
  ): Promise<UniformIssuanceDto[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data: rows, error } = await supabase
      .from('uniform_issuances')
      .select(
        'id, student_id, uniform_item_id, size, quantity, issued_by, request_id, notes, branch_id, issued_at',
      )
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .order('issued_at', { ascending: false });

    throwIfDbError(error);
    const issuanceRows = (rows as IssuanceRow[]) ?? [];
    if (issuanceRows.length === 0) return [];

    const itemIds = [...new Set(issuanceRows.map((r) => r.uniform_item_id))];
    const userIds = [...new Set(issuanceRows.map((r) => r.issued_by))];
    const [itemsResult, profilesResult] = await Promise.all([
      supabase.from('uniform_items').select('id, name').in('id', itemIds),
      userIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as { id: string; full_name: string }[] },
    ]);
    const itemNames = new Map<string, string>();
    (itemsResult.data ?? []).forEach((u: { id: string; name: string }) => {
      itemNames.set(u.id, u.name);
    });
    const userNames = new Map<string, string>();
    (profilesResult.data ?? []).forEach((p: { id: string; full_name: string }) => {
      userNames.set(p.id, p.full_name ?? '');
    });

    const { data: studentRow } = await supabase
      .from('students')
      .select('user_id, student_id')
      .eq('id', studentId)
      .single();
    const st = studentRow as { user_id?: string; student_id?: string } | null;
    let studentName: string | undefined;
    if (st?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', st.user_id)
        .maybeSingle();
      studentName = (profile as { full_name?: string } | null)?.full_name ?? st.student_id ?? studentId;
    } else {
      studentName = st?.student_id ?? studentId;
    }

    return issuanceRows.map(
      (r) =>
        new UniformIssuanceDto({
          id: r.id,
          studentId: r.student_id,
          studentName,
          uniformItemId: r.uniform_item_id,
          uniformItemName: itemNames.get(r.uniform_item_id),
          size: r.size,
          quantity: r.quantity,
          issuedBy: r.issued_by,
          issuerName: userNames.get(r.issued_by),
          requestId: r.request_id ?? undefined,
          notes: r.notes ?? undefined,
          branchId: r.branch_id,
          issuedAt: r.issued_at,
        }),
    );
  }

  async createDirectIssuance(
    input: CreateDirectIssuanceDto,
    userId: string,
    branchId: string,
  ): Promise<UniformIssuanceDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', input.studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const item = await this.uniformsService.getById(
      input.uniformItemId,
      branchId,
    );
    const stockEntry = item.stock?.find((s) => s.size === input.size);
    if (!stockEntry) {
      throw new BadRequestException(
        `No stock for item "${item.name}" size ${input.size}`,
      );
    }
    if (stockEntry.quantity < input.quantity) {
      throw new BadRequestException(
        `Insufficient stock: has ${stockEntry.quantity}, requested ${input.quantity}`,
      );
    }

    const newQty = stockEntry.quantity - input.quantity;
    const { error: updateError } = await supabase
      .from('uniform_stock')
      .update({
        quantity: newQty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', stockEntry.id)
      .eq('branch_id', branchId);
    throwIfDbError(updateError);

    const issuedAt = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from('uniform_issuances')
      .insert({
        student_id: input.studentId,
        uniform_item_id: input.uniformItemId,
        size: input.size,
        quantity: input.quantity,
        issued_by: userId,
        notes: input.notes ?? null,
        branch_id: branchId,
        issued_at: issuedAt,
      })
      .select(
        'id, student_id, uniform_item_id, size, quantity, issued_by, request_id, notes, branch_id, issued_at',
      )
      .single();

    throwIfDbError(error);
    if (!inserted) throw new BadRequestException('Failed to create issuance');

    const row = inserted as IssuanceRow;
    return new UniformIssuanceDto({
      id: row.id,
      studentId: row.student_id,
      uniformItemId: row.uniform_item_id,
      uniformItemName: item.name,
      size: row.size,
      quantity: row.quantity,
      issuedBy: row.issued_by,
      requestId: row.request_id ?? undefined,
      notes: row.notes ?? undefined,
      branchId: row.branch_id,
      issuedAt: row.issued_at,
    });
  }

  async getReport(
    query: QueryIssuanceReportDto,
    branchId: string,
  ): Promise<IssuanceReportRowDto[]> {
    const supabase = this.supabaseConfig.getClient();
    let dbQuery = supabase
      .from('uniform_issuances')
      .select(
        'id, student_id, uniform_item_id, size, quantity, issued_by, issued_at',
      )
      .eq('branch_id', branchId)
      .order('issued_at', { ascending: false });

    if (query.studentId) {
      dbQuery = dbQuery.eq('student_id', query.studentId);
    }
    if (query.uniformItemId) {
      dbQuery = dbQuery.eq('uniform_item_id', query.uniformItemId);
    }
    if (query.dateFrom) {
      dbQuery = dbQuery.gte('issued_at', query.dateFrom);
    }
    if (query.dateTo) {
      dbQuery = dbQuery.lte('issued_at', query.dateTo + 'T23:59:59.999Z');
    }

    const { data: rows, error } = await dbQuery;
    throwIfDbError(error);
    const issuanceRows = (rows as IssuanceRow[]) ?? [];
    if (issuanceRows.length === 0) return [];

    const studentIds = [...new Set(issuanceRows.map((r) => r.student_id))];
    const itemIds = [...new Set(issuanceRows.map((r) => r.uniform_item_id))];
    const userIds = [...new Set(issuanceRows.map((r) => r.issued_by))];

    const [studentsResult, itemsResult, profilesResult] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('students').select('id, user_id, student_id').in('id', studentIds)
        : { data: [] as { id: string; user_id: string; student_id: string }[] },
      supabase.from('uniform_items').select('id, name').in('id', itemIds),
      userIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as { id: string; full_name: string }[] },
    ]);

    const studentNames = new Map<string, string>();
    const studentUserIds = (studentsResult.data ?? []) as { id: string; user_id: string; student_id: string }[];
    const profileUserIds = [...new Set(studentUserIds.map((s) => s.user_id).filter(Boolean))];
    const { data: studentProfiles } =
      profileUserIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', profileUserIds)
        : { data: [] as { id: string; full_name: string }[] };
    const profileNameByUserId = new Map<string, string>();
    (studentProfiles ?? []).forEach((p: { id: string; full_name: string }) => {
      profileNameByUserId.set(p.id, p.full_name ?? '');
    });
    studentUserIds.forEach((s) => {
      const name = profileNameByUserId.get(s.user_id) ?? s.student_id ?? s.id;
      studentNames.set(s.id, name);
    });
    const itemNames = new Map<string, string>();
    (itemsResult.data ?? []).forEach((u: { id: string; name: string }) => {
      itemNames.set(u.id, u.name);
    });
    const userNames = new Map<string, string>();
    (profilesResult.data ?? []).forEach((p: { id: string; full_name: string }) => {
      userNames.set(p.id, p.full_name ?? '');
    });

    return issuanceRows.map(
      (r) =>
        new IssuanceReportRowDto({
          studentId: r.student_id,
          studentName: studentNames.get(r.student_id) ?? r.student_id,
          uniformItemId: r.uniform_item_id,
          uniformItemName: itemNames.get(r.uniform_item_id),
          size: r.size,
          quantity: r.quantity,
          issuedAt: r.issued_at,
          issuerName: userNames.get(r.issued_by),
        }),
    );
  }
}
