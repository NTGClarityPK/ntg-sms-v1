import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { UniformsService } from '../uniforms/uniforms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UniformRequestDto } from './dto/uniform-request.dto';
import { UniformRequestItemDto } from './dto/uniform-request-item.dto';
import { CreateUniformRequestDto } from './dto/create-uniform-request.dto';
import { QueryUniformRequestsDto } from './dto/query-uniform-requests.dto';
import { ApproveRejectDto } from './dto/approve-reject.dto';
import type { UniformRequestStatus } from './dto/uniform-request-status.type';

type UniformRequestRow = {
  id: string;
  student_id: string;
  requested_by: string;
  status: UniformRequestStatus;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  issued_by: string | null;
  issued_at: string | null;
  branch_id: string;
  created_at: string;
  updated_at: string;
};

type UniformRequestItemRow = {
  id: string;
  request_id: string;
  uniform_item_id: string;
  size: string;
  quantity: number;
  created_at: string;
};

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(
    error instanceof Error ? error.message : 'Unknown error',
  );
}

@Injectable()
export class UniformRequestsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly uniformsService: UniformsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Get user IDs to notify when a uniform request is raised: users with inventory edit permission for this branch. Excludes requester.
   */
  private async getUniformRequestRaisedRecipients(
    branchId: string,
    requestedByUserId: string,
  ): Promise<string[]> {
    const supabase = this.supabaseConfig.getClient();
    const recipientIds = new Set<string>();

    const { data: featureData, error: featureError } = await supabase
      .from('features')
      .select('id')
      .eq('code', 'inventory')
      .maybeSingle();
    if (featureError || !featureData) return [];

    const featureId = (featureData as { id: string }).id;
    const { data: permRows } = await supabase
      .from('role_permissions')
      .select('role_id')
      .eq('branch_id', branchId)
      .eq('feature_id', featureId)
      .eq('permission', 'edit');
    const roleIds = [...new Set((permRows ?? []).map((r: { role_id: string }) => r.role_id))];
    if (roleIds.length === 0) return [];

    const { data: userRolesData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('branch_id', branchId)
      .in('role_id', roleIds);
    (userRolesData ?? []).forEach((ur: { user_id: string }) => {
      if (ur.user_id !== requestedByUserId) recipientIds.add(ur.user_id);
    });
    return [...recipientIds];
  }

  async list(
    query: QueryUniformRequestsDto,
    userId: string,
    branchId: string,
    isParent: boolean,
  ): Promise<{ data: UniformRequestDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('uniform_requests')
      .select(
        'id, student_id, requested_by, status, notes, reviewed_by, reviewed_at, issued_by, issued_at, branch_id, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (isParent) {
      dbQuery = dbQuery.eq('requested_by', userId);
    }
    if (query.studentId) {
      dbQuery = dbQuery.eq('student_id', query.studentId);
    }
    if (query.status && query.status.length > 0) {
      dbQuery = dbQuery.in('status', query.status);
    }

    const { data: rows, error, count } = await dbQuery;
    throwIfDbError(error);
    const requestRows = (rows as UniformRequestRow[]) ?? [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    if (requestRows.length === 0) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages },
      };
    }

    const requestIds = requestRows.map((r) => r.id);
    const { data: itemsData, error: itemsError } = await supabase
      .from('uniform_request_items')
      .select('id, request_id, uniform_item_id, size, quantity, created_at')
      .in('request_id', requestIds);

    throwIfDbError(itemsError);
    const itemRows = (itemsData as UniformRequestItemRow[]) ?? [];
    const itemsByRequest = new Map<string, UniformRequestItemRow[]>();
    for (const i of itemRows) {
      const list = itemsByRequest.get(i.request_id) ?? [];
      list.push(i);
      itemsByRequest.set(i.request_id, list);
    }

    const studentIds = [...new Set(requestRows.map((r) => r.student_id))];
    const userIds = [
      ...new Set(
        requestRows.flatMap((r) =>
          [r.requested_by, r.reviewed_by, r.issued_by].filter(
            (x): x is string => x != null,
          ),
        ),
      ),
    ];
    const uniformItemIds = [
      ...new Set(itemRows.map((i) => i.uniform_item_id)),
    ];

    const [studentsResult, profilesResult, uniformItemsResult] = await Promise.all([
      studentIds.length > 0
        ? supabase
            .from('students')
            .select('id, user_id')
            .in('id', studentIds)
        : { data: [] as { id: string; user_id: string }[] },
      userIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds)
        : { data: [] as { id: string; full_name: string }[] },
      uniformItemIds.length > 0
        ? supabase
            .from('uniform_items')
            .select('id, name')
            .in('id', uniformItemIds)
        : { data: [] as { id: string; name: string }[] },
    ]);

    const studentUserIds = (studentsResult.data ?? []) as { id: string; user_id: string }[];
    const profileIdsForStudents = [...new Set(studentUserIds.map((s) => s.user_id))];
    const { data: studentProfilesData } =
      profileIdsForStudents.length > 0
        ? await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', profileIdsForStudents)
        : { data: [] as { id: string; full_name: string }[] };
    const profileNames = new Map<string, string>();
    (studentProfilesData ?? []).forEach((p: { id: string; full_name: string }) => {
      profileNames.set(p.id, p.full_name ?? '');
    });
    const studentNames = new Map<string, string>();
    studentUserIds.forEach((s) => {
      studentNames.set(s.id, profileNames.get(s.user_id) ?? '');
    });

    const userNames = new Map<string, string>();
    (profilesResult.data ?? []).forEach((p: { id: string; full_name: string }) => {
      userNames.set(p.id, p.full_name ?? '');
    });

    const uniformItemNames = new Map<string, string>();
    ((uniformItemsResult.data ?? []) as { id: string; name: string }[]).forEach(
      (u) => {
        uniformItemNames.set(u.id, u.name ?? '');
      },
    );

    const data = requestRows.map((r) => {
      const items = (itemsByRequest.get(r.id) ?? []).map(
        (i) =>
          new UniformRequestItemDto({
            id: i.id,
            requestId: i.request_id,
            uniformItemId: i.uniform_item_id,
            uniformItemName: uniformItemNames.get(i.uniform_item_id),
            size: i.size,
            quantity: i.quantity,
            createdAt: i.created_at,
          }),
      );
      return new UniformRequestDto({
        id: r.id,
        studentId: r.student_id,
        studentName: studentNames.get(r.student_id),
        requestedBy: r.requested_by,
        requesterName: userNames.get(r.requested_by),
        status: r.status,
        notes: r.notes ?? undefined,
        reviewedBy: r.reviewed_by ?? undefined,
        reviewerName: r.reviewed_by ? userNames.get(r.reviewed_by) : undefined,
        reviewedAt: r.reviewed_at ?? undefined,
        issuedBy: r.issued_by ?? undefined,
        issuedAt: r.issued_at ?? undefined,
        branchId: r.branch_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        items,
      });
    });

    return { data, meta: { total, page, limit, totalPages } };
  }

  async getById(
    id: string,
    branchId: string,
  ): Promise<UniformRequestDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data: req, error: reqError } = await supabase
      .from('uniform_requests')
      .select(
        'id, student_id, requested_by, status, notes, reviewed_by, reviewed_at, issued_by, issued_at, branch_id, created_at, updated_at',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(reqError);
    if (!req) {
      throw new NotFoundException('Uniform request not found');
    }

    const { data: itemRows, error: itemsError } = await supabase
      .from('uniform_request_items')
      .select('id, request_id, uniform_item_id, size, quantity, created_at')
      .eq('request_id', id);

    throwIfDbError(itemsError);
    const items = (itemRows as UniformRequestItemRow[]) ?? [];
    const itemIds = [...new Set(items.map((i) => i.uniform_item_id))];
    const { data: uniformItems } = await supabase
      .from('uniform_items')
      .select('id, name')
      .in('id', itemIds);
    const nameMap = new Map<string, string>();
    (uniformItems ?? []).forEach((u: { id: string; name: string }) => {
      nameMap.set(u.id, u.name);
    });

    const studentIds = [req.student_id];
    const userIds = [
      req.requested_by,
      req.reviewed_by,
      req.issued_by,
    ].filter((x): x is string => x != null);
    const [studentsResult, profilesResult] = await Promise.all([
      supabase.from('students').select('id, user_id, student_id').in('id', studentIds),
      userIds.length > 0
        ? supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as { id: string; full_name: string }[] },
    ]);
    let studentName = '';
    const studentRow = (studentsResult.data as { id: string; user_id: string; student_id: string }[])?.[0];
    if (studentRow?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', studentRow.user_id)
        .maybeSingle();
      studentName = (profile as { full_name?: string } | null)?.full_name ?? studentRow.student_id ?? studentRow.id;
    } else if (studentRow) {
      studentName = studentRow.student_id ?? studentRow.id;
    }
    const userNames = new Map<string, string>();
    (profilesResult.data ?? []).forEach((p: { id: string; full_name: string }) => {
      userNames.set(p.id, p.full_name ?? '');
    });

    return new UniformRequestDto({
      id: req.id,
      studentId: req.student_id,
      studentName,
      requestedBy: req.requested_by,
      requesterName: userNames.get(req.requested_by),
      status: req.status,
      notes: req.notes ?? undefined,
      reviewedBy: req.reviewed_by ?? undefined,
      reviewerName: req.reviewed_by ? userNames.get(req.reviewed_by) : undefined,
      reviewedAt: req.reviewed_at ?? undefined,
      issuedBy: req.issued_by ?? undefined,
      issuedAt: req.issued_at ?? undefined,
      branchId: req.branch_id,
      createdAt: req.created_at,
      updatedAt: req.updated_at,
      items: items.map(
        (i) =>
          new UniformRequestItemDto({
            id: i.id,
            requestId: i.request_id,
            uniformItemId: i.uniform_item_id,
            uniformItemName: nameMap.get(i.uniform_item_id),
            size: i.size,
            quantity: i.quantity,
            createdAt: i.created_at,
          }),
      ),
    });
  }

  async create(
    input: CreateUniformRequestDto,
    userId: string,
    branchId: string,
  ): Promise<UniformRequestDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('id', input.studentId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();
    if (!student) {
      throw new BadRequestException('Student not found or not in this branch');
    }

    for (const item of input.items) {
      const uniformItem = await this.uniformsService.getById(
        item.uniformItemId,
        branchId,
      );
      const stockEntry = uniformItem.stock?.find(
        (s) => s.size === item.size,
      );
      if (!stockEntry) {
        throw new BadRequestException(
          `No stock for item "${uniformItem.name}" size ${item.size}`,
        );
      }
      if (stockEntry.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${uniformItem.name}" size ${item.size}: has ${stockEntry.quantity}, requested ${item.quantity}`,
        );
      }
    }

    const { data: request, error: requestError } = await supabase
      .from('uniform_requests')
      .insert({
        student_id: input.studentId,
        requested_by: userId,
        status: 'pending',
        notes: input.notes ?? null,
        branch_id: branchId,
      })
      .select(
        'id, student_id, requested_by, status, notes, reviewed_by, reviewed_at, issued_by, issued_at, branch_id, created_at, updated_at',
      )
      .single();

    throwIfDbError(requestError);
    if (!request) {
      throw new BadRequestException('Failed to create request');
    }

    const requestItems = input.items.map((i) => ({
      request_id: request.id,
      uniform_item_id: i.uniformItemId,
      size: i.size,
      quantity: i.quantity,
    }));
    const { error: itemsError } = await supabase
      .from('uniform_request_items')
      .insert(requestItems);
    throwIfDbError(itemsError);

    const dto = await this.getById(request.id, branchId);
    try {
      const recipientUserIds = await this.getUniformRequestRaisedRecipients(
        branchId,
        userId,
      );
      if (recipientUserIds.length > 0 && dto.studentName) {
        await this.notificationsService.createUniformRequestRaisedNotifications({
          recipientUserIds,
          studentName: dto.studentName,
          requestId: dto.id,
        });
      }
    } catch {
      // ignore notification errors
    }
    return dto;
  }

  async approve(
    id: string,
    body: ApproveRejectDto,
    userId: string,
    branchId: string,
  ): Promise<UniformRequestDto> {
    const supabase = this.supabaseConfig.getClient();
    const existing = await this.getById(id, branchId);
    if (existing.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be approved');
    }

    const { error } = await supabase
      .from('uniform_requests')
      .update({
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        notes: body.notes ?? existing.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('branch_id', branchId);
    throwIfDbError(error);
    const updated = await this.getById(id, branchId);
    try {
      if (updated.studentName) {
        await this.notificationsService.createUniformRequestStatusNotification({
          userId: updated.requestedBy,
          studentName: updated.studentName,
          status: 'approved',
          requestId: updated.id,
        });
      }
    } catch {
      // ignore notification errors
    }
    return updated;
  }

  async reject(
    id: string,
    body: ApproveRejectDto,
    userId: string,
    branchId: string,
  ): Promise<UniformRequestDto> {
    const supabase = this.supabaseConfig.getClient();
    const existing = await this.getById(id, branchId);
    if (existing.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const { error } = await supabase
      .from('uniform_requests')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        notes: body.notes ?? existing.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('branch_id', branchId);
    throwIfDbError(error);
    const updated = await this.getById(id, branchId);
    try {
      if (updated.studentName) {
        await this.notificationsService.createUniformRequestStatusNotification({
          userId: updated.requestedBy,
          studentName: updated.studentName,
          status: 'rejected',
          requestId: updated.id,
        });
      }
    } catch {
      // ignore notification errors
    }
    return updated;
  }

  async issue(
    id: string,
    userId: string,
    branchId: string,
  ): Promise<UniformRequestDto> {
    const existing = await this.getById(id, branchId);
    if (existing.status !== 'approved') {
      throw new BadRequestException(
        'Only approved requests can be marked as issued',
      );
    }

    const supabase = this.supabaseConfig.getClient();
    for (const item of existing.items) {
      const { data: stockRows } = await supabase
        .from('uniform_stock')
        .select('id, quantity')
        .eq('uniform_item_id', item.uniformItemId)
        .eq('size', item.size)
        .eq('branch_id', branchId);
      const row = (stockRows as { id: string; quantity: number }[])?.[0];
      if (!row) {
        throw new BadRequestException(
          `Stock not found for item ${item.uniformItemId} size ${item.size}`,
        );
      }
      if (row.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock to issue: ${item.uniformItemName ?? item.uniformItemId} size ${item.size}`,
        );
      }
      const newQty = row.quantity - item.quantity;
      const { error: updateError } = await supabase
        .from('uniform_stock')
        .update({
          quantity: newQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('branch_id', branchId);
      throwIfDbError(updateError);
    }

    const issuedAt = new Date().toISOString();
    const issuanceRows = existing.items.map((item) => ({
      student_id: existing.studentId,
      uniform_item_id: item.uniformItemId,
      size: item.size,
      quantity: item.quantity,
      issued_by: userId,
      request_id: id,
      branch_id: branchId,
      issued_at: issuedAt,
    }));
    const { error: issuanceError } = await supabase
      .from('uniform_issuances')
      .insert(issuanceRows);
    throwIfDbError(issuanceError);

    const { error } = await supabase
      .from('uniform_requests')
      .update({
        status: 'issued',
        issued_by: userId,
        issued_at: issuedAt,
        updated_at: issuedAt,
      })
      .eq('id', id)
      .eq('branch_id', branchId);
    throwIfDbError(error);
    const updated = await this.getById(id, branchId);
    try {
      if (updated.studentName) {
        await this.notificationsService.createUniformRequestStatusNotification({
          userId: updated.requestedBy,
          studentName: updated.studentName,
          status: 'issued',
          requestId: updated.id,
        });
      }
    } catch {
      // ignore notification errors
    }
    return updated;
  }

  async cancel(
    id: string,
    userId: string,
    branchId: string,
  ): Promise<UniformRequestDto> {
    const supabase = this.supabaseConfig.getClient();
    const existing = await this.getById(id, branchId);
    if (existing.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }
    if (existing.requestedBy !== userId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    const { error } = await supabase
      .from('uniform_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('branch_id', branchId);
    throwIfDbError(error);
    return this.getById(id, branchId);
  }
}
