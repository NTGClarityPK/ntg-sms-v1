import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreateSubjectTemplateDto } from './dto/create-subject-template.dto';
import { UpdateSubjectTemplateDto } from './dto/update-subject-template.dto';
import { SubjectTemplateDto } from './dto/subject-template.dto';
import { QuerySubjectTemplatesDto } from './dto/query-subject-templates.dto';

type Meta = { total: number; page: number; limit: number; totalPages: number };

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message || 'Database error');
}

type SubjectTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  branch_id: string;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
};

type SubjectTemplateSubjectRow = {
  subject_template_id: string;
  subject_id: string;
};

type ClassSubjectTemplateAssignmentRow = {
  class_id: string;
  subject_template_id: string;
};

type LevelSubjectTemplateAssignmentRow = {
  level_id: string;
  subject_template_id: string;
};

type StudentSubjectTemplateAssignmentRow = {
  id: string;
  student_id: string;
  subject_template_id: string;
  academic_year_id: string;
  branch_id: string;
  created_at: string;
  updated_at: string;
};

function mapSubjectTemplate(
  row: SubjectTemplateRow,
  subjectIds: string[],
  assignedClassIds: string[],
  assignedLevelIds: string[],
): SubjectTemplateDto {
  return new SubjectTemplateDto({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    branchId: row.branch_id,
    tenantId: row.tenant_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subjectIds,
    assignedClassIds,
    assignedLevelIds,
  });
}

@Injectable()
export class SubjectTemplatesService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createSubjectTemplate(
    input: CreateSubjectTemplateDto,
    branchId: string,
    tenantId: string | null,
    userEmail: string,
  ): Promise<SubjectTemplateDto> {
    const supabase = this.supabaseConfig.getClient();

    // Create template
    const { data: template, error: templateError } = await supabase
      .from('subject_templates')
      .insert({
        name: input.name,
        description: input.description ?? null,
        branch_id: branchId,
        tenant_id: tenantId,
      })
      .select('id, name, description, branch_id, tenant_id, created_at, updated_at')
      .single();
    throwIfDbError(templateError);
    if (!template) throw new BadRequestException('Failed to create subject template');

    const templateRow = template as SubjectTemplateRow;
    this.auditLogService
      .logCreate(
        'subject_templates',
        templateRow.id,
        userEmail,
        { ...templateRow } as Record<string, unknown>,
        { branchId, tenantId },
      )
      .catch(() => {});

    // Create subject associations if provided
    if (input.subjectIds && input.subjectIds.length > 0) {
      const uniqueSubjectIds = Array.from(new Set(input.subjectIds));
      const subjectsToInsert = uniqueSubjectIds.map((subjectId) => ({
        subject_template_id: templateRow.id,
        subject_id: subjectId,
      }));

      const { error: subjectsError } = await supabase.from('subject_template_subjects').insert(subjectsToInsert);
      throwIfDbError(subjectsError);
      for (const row of subjectsToInsert) {
        const recordId = `${row.subject_template_id}_${row.subject_id}`;
        this.auditLogService
          .logCreate('subject_template_subjects', recordId, userEmail, { ...row } as Record<string, unknown>, {
            branchId,
            tenantId,
          })
          .catch(() => {});
      }
    }

    // Fetch related data in parallel for response
    const [subjectsResult, classesResult, levelsResult] = await Promise.all([
      supabase
        .from('subject_template_subjects')
        .select('subject_id')
        .eq('subject_template_id', templateRow.id),
      supabase
        .from('class_subject_template_assignments')
        .select('class_id')
        .eq('subject_template_id', templateRow.id),
      supabase
        .from('level_subject_template_assignments')
        .select('level_id')
        .eq('subject_template_id', templateRow.id),
    ]);

    const subjectIds = ((subjectsResult.data as SubjectTemplateSubjectRow[]) ?? []).map((s) => s.subject_id);
    const assignedClassIds = ((classesResult.data as ClassSubjectTemplateAssignmentRow[]) ?? []).map((c) => c.class_id);
    const assignedLevelIds = ((levelsResult.data as LevelSubjectTemplateAssignmentRow[]) ?? []).map((l) => l.level_id);

    return mapSubjectTemplate(templateRow, subjectIds, assignedClassIds, assignedLevelIds);
  }

  async updateSubjectTemplate(
    id: string,
    input: UpdateSubjectTemplateDto,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<SubjectTemplateDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify template exists and get full row for audit
    const { data: oldRow, error: checkError } = await supabase
      .from('subject_templates')
      .select('id, name, description, branch_id, tenant_id, created_at, updated_at')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(checkError);
    if (!oldRow) throw new NotFoundException('Subject template not found');

    // Update template fields
    const updateData: Partial<SubjectTemplateRow> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description ?? null;

    if (Object.keys(updateData).length > 0) {
      const { data: updated, error: updateError } = await supabase
        .from('subject_templates')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, name, description, branch_id, tenant_id, created_at, updated_at')
        .single();
      throwIfDbError(updateError);
      if (updated) {
        const changedFields = Object.keys(updateData) as string[];
        this.auditLogService
          .logUpdate(
            'subject_templates',
            id,
            userEmail,
            oldRow as Record<string, unknown>,
            updated as Record<string, unknown>,
            changedFields,
            { branchId, tenantId },
          )
          .catch(() => {});
      }
    }

    // Update subjects if provided (delete old + insert new)
    if (input.subjectIds !== undefined) {
      const { error: deleteError } = await supabase
        .from('subject_template_subjects')
        .delete()
        .eq('subject_template_id', id);
      throwIfDbError(deleteError);

      if (input.subjectIds.length > 0) {
        const uniqueSubjectIds = Array.from(new Set(input.subjectIds));
        const subjectsToInsert = uniqueSubjectIds.map((subjectId) => ({
          subject_template_id: id,
          subject_id: subjectId,
        }));

        const { error: insertError } = await supabase.from('subject_template_subjects').insert(subjectsToInsert);
        throwIfDbError(insertError);
      }
    }

    // Fetch updated template with relations in parallel
    const [templateResult, subjectsResult, classesResult, levelsResult] = await Promise.all([
      supabase
        .from('subject_templates')
        .select('id, name, description, branch_id, tenant_id, created_at, updated_at')
        .eq('id', id)
        .single(),
      supabase
        .from('subject_template_subjects')
        .select('subject_id')
        .eq('subject_template_id', id),
      supabase
        .from('class_subject_template_assignments')
        .select('class_id')
        .eq('subject_template_id', id),
      supabase
        .from('level_subject_template_assignments')
        .select('level_id')
        .eq('subject_template_id', id),
    ]);

    throwIfDbError(templateResult.error);
    if (!templateResult.data) throw new NotFoundException('Subject template not found');

    const templateRow = templateResult.data as SubjectTemplateRow;
    const subjectIds = ((subjectsResult.data as SubjectTemplateSubjectRow[]) ?? []).map((s) => s.subject_id);
    const assignedClassIds = ((classesResult.data as ClassSubjectTemplateAssignmentRow[]) ?? []).map((c) => c.class_id);
    const assignedLevelIds = ((levelsResult.data as LevelSubjectTemplateAssignmentRow[]) ?? []).map((l) => l.level_id);

    return mapSubjectTemplate(templateRow, subjectIds, assignedClassIds, assignedLevelIds);
  }

  async deleteSubjectTemplate(
    id: string,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<{ data: { id: string } }> {
    const supabase = this.supabaseConfig.getClient();

    // Verify template exists and get full row for audit
    const { data: oldRow, error: checkError } = await supabase
      .from('subject_templates')
      .select('id, name, description, branch_id, tenant_id, created_at, updated_at')
      .eq('id', id)
      .eq('branch_id', branchId)
      .single();
    throwIfDbError(checkError);
    if (!oldRow) throw new NotFoundException('Subject template not found');

    // Check if template is in use (students or timetable slots) using aggregation
    const [studentsCount, slotsCount] = await Promise.all([
      supabase
        .from('student_subject_template_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('subject_template_id', id),
      supabase
        .from('timetable_slots')
        .select('id', { count: 'exact', head: true })
        .eq('subject_template_id', id),
    ]);

    if (studentsCount.count && studentsCount.count > 0) {
      throw new BadRequestException('Cannot delete template: students are assigned to this template');
    }
    if (slotsCount.count && slotsCount.count > 0) {
      throw new BadRequestException('Cannot delete template: timetable slots reference this template');
    }

    // Delete template (cascade will handle related records)
    const { error: deleteError } = await supabase.from('subject_templates').delete().eq('id', id);
    throwIfDbError(deleteError);

    this.auditLogService
      .logDelete('subject_templates', id, userEmail, oldRow as Record<string, unknown>, {
        branchId,
        tenantId,
      })
      .catch(() => {});

    return { data: { id } };
  }

  async listSubjectTemplates(
    query: QuerySubjectTemplatesDto,
    branchId: string,
  ): Promise<{ data: SubjectTemplateDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('subject_templates')
      .select('id, name, description, branch_id, tenant_id, created_at, updated_at', { count: 'exact' })
      .eq('branch_id', branchId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.search) {
      dbQuery = dbQuery.ilike('name', `%${query.search}%`);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const rows = (data as SubjectTemplateRow[]) ?? [];
    const templateIds = rows.map((t) => t.id);

    // Fetch related data in parallel using aggregation where possible
    const [subjectsResult, classesResult, levelsResult] = await Promise.all([
      templateIds.length > 0
        ? supabase
            .from('subject_template_subjects')
            .select('subject_template_id, subject_id')
            .in('subject_template_id', templateIds)
        : Promise.resolve({ data: [], error: null }),
      templateIds.length > 0
        ? supabase
            .from('class_subject_template_assignments')
            .select('class_id, subject_template_id')
            .in('subject_template_id', templateIds)
        : Promise.resolve({ data: [], error: null }),
      templateIds.length > 0
        ? supabase
            .from('level_subject_template_assignments')
            .select('level_id, subject_template_id')
            .in('subject_template_id', templateIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const subjectsByTemplate = new Map<string, string[]>();
    ((subjectsResult.data as SubjectTemplateSubjectRow[]) ?? []).forEach((s) => {
      const arr = subjectsByTemplate.get(s.subject_template_id) ?? [];
      arr.push(s.subject_id);
      subjectsByTemplate.set(s.subject_template_id, arr);
    });

    const classesByTemplate = new Map<string, string[]>();
    ((classesResult.data as ClassSubjectTemplateAssignmentRow[]) ?? []).forEach((c) => {
      const arr = classesByTemplate.get(c.subject_template_id) ?? [];
      arr.push(c.class_id);
      classesByTemplate.set(c.subject_template_id, arr);
    });

    const levelsByTemplate = new Map<string, string[]>();
    ((levelsResult.data as LevelSubjectTemplateAssignmentRow[]) ?? []).forEach((l) => {
      const arr = levelsByTemplate.get(l.subject_template_id) ?? [];
      arr.push(l.level_id);
      levelsByTemplate.set(l.subject_template_id, arr);
    });

    return {
      data: rows.map((r) =>
        mapSubjectTemplate(
          r,
          subjectsByTemplate.get(r.id) ?? [],
          classesByTemplate.get(r.id) ?? [],
          levelsByTemplate.get(r.id) ?? [],
        ),
      ),
      meta: { total, page, limit, totalPages },
    };
  }

  async getSubjectTemplateById(id: string, branchId: string): Promise<SubjectTemplateDto> {
    const supabase = this.supabaseConfig.getClient();

    // Fetch template and relations in parallel
    const [templateResult, subjectsResult, classesResult, levelsResult] = await Promise.all([
      supabase
        .from('subject_templates')
        .select('id, name, description, branch_id, tenant_id, created_at, updated_at')
        .eq('id', id)
        .eq('branch_id', branchId)
        .single(),
      supabase
        .from('subject_template_subjects')
        .select('subject_id')
        .eq('subject_template_id', id),
      supabase
        .from('class_subject_template_assignments')
        .select('class_id')
        .eq('subject_template_id', id),
      supabase
        .from('level_subject_template_assignments')
        .select('level_id')
        .eq('subject_template_id', id),
    ]);

    throwIfDbError(templateResult.error);
    if (!templateResult.data) throw new NotFoundException('Subject template not found');

    const templateRow = templateResult.data as SubjectTemplateRow;
    const subjectIds = ((subjectsResult.data as SubjectTemplateSubjectRow[]) ?? []).map((s) => s.subject_id);
    const assignedClassIds = ((classesResult.data as ClassSubjectTemplateAssignmentRow[]) ?? []).map((c) => c.class_id);
    const assignedLevelIds = ((levelsResult.data as LevelSubjectTemplateAssignmentRow[]) ?? []).map((l) => l.level_id);

    return mapSubjectTemplate(templateRow, subjectIds, assignedClassIds, assignedLevelIds);
  }

  async assignClassesToTemplate(
    templateId: string,
    classIds: string[],
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<{ data: string[] }> {
    const supabase = this.supabaseConfig.getClient();

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from('subject_templates')
      .select('id')
      .eq('id', templateId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(templateError);
    if (!template) throw new NotFoundException('Subject template not found');

    // Validate all class IDs exist in single query
    const uniqueClassIds = Array.from(new Set(classIds));
    if (uniqueClassIds.length > 0) {
      const { data: validClasses, error: validateError } = await supabase
        .from('classes')
        .select('id')
        .in('id', uniqueClassIds)
        .eq('branch_id', branchId);
      throwIfDbError(validateError);

      const validClassIdsSet = new Set(((validClasses as { id: string }[]) ?? []).map((c) => c.id));
      const invalidIds = uniqueClassIds.filter((id) => !validClassIdsSet.has(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid class IDs: ${invalidIds.join(', ')}`);
      }
    }

    // Fetch existing assignments for audit before delete
    const { data: oldAssignments } = await supabase
      .from('class_subject_template_assignments')
      .select('class_id, subject_template_id, branch_id')
      .eq('subject_template_id', templateId)
      .eq('branch_id', branchId);
    const oldRows = (oldAssignments ?? []) as Array<{
      class_id: string;
      subject_template_id: string;
      branch_id: string;
    }>;

    // Delete existing assignments for THIS template only, then insert new ones
    const { error: deleteError } = await supabase
      .from('class_subject_template_assignments')
      .delete()
      .eq('subject_template_id', templateId)
      .eq('branch_id', branchId);
    throwIfDbError(deleteError);

    for (const row of oldRows) {
      const recordId = `${row.subject_template_id}_${row.class_id}_${row.branch_id}`;
      this.auditLogService
        .logDelete('class_subject_template_assignments', recordId, userEmail, {
          ...row,
        } as Record<string, unknown>, { branchId, tenantId })
        .catch(() => {});
    }

    // Insert new assignments if any classes provided
    if (uniqueClassIds.length > 0) {
      const assignmentsToInsert = uniqueClassIds.map((classId) => ({
        class_id: classId,
        subject_template_id: templateId,
        branch_id: branchId,
      }));

      const { error: insertError } = await supabase.from('class_subject_template_assignments').insert(assignmentsToInsert);
      throwIfDbError(insertError);
      for (const row of assignmentsToInsert) {
        const recordId = `${row.subject_template_id}_${row.class_id}_${row.branch_id}`;
        this.auditLogService
          .logCreate('class_subject_template_assignments', recordId, userEmail, {
            ...row,
          } as Record<string, unknown>, { branchId, tenantId })
          .catch(() => {});
      }
    }

    return { data: uniqueClassIds };
  }

  async assignLevelsToTemplate(
    templateId: string,
    levelIds: string[],
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<{ data: string[] }> {
    const supabase = this.supabaseConfig.getClient();

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from('subject_templates')
      .select('id')
      .eq('id', templateId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(templateError);
    if (!template) throw new NotFoundException('Subject template not found');

    // Validate all level IDs exist in single query
    const uniqueLevelIds = Array.from(new Set(levelIds));
    if (uniqueLevelIds.length > 0) {
      const { data: validLevels, error: validateError } = await supabase
        .from('levels')
        .select('id')
        .in('id', uniqueLevelIds)
        .eq('branch_id', branchId);
      throwIfDbError(validateError);

      const validLevelIdsSet = new Set(((validLevels as { id: string }[]) ?? []).map((l) => l.id));
      const invalidIds = uniqueLevelIds.filter((id) => !validLevelIdsSet.has(id));
      if (invalidIds.length > 0) {
        throw new BadRequestException(`Invalid level IDs: ${invalidIds.join(', ')}`);
      }
    }

    // Fetch existing assignments for audit before delete
    const { data: oldAssignments } = await supabase
      .from('level_subject_template_assignments')
      .select('level_id, subject_template_id, branch_id')
      .eq('subject_template_id', templateId)
      .eq('branch_id', branchId);
    const oldRows = (oldAssignments ?? []) as Array<{
      level_id: string;
      subject_template_id: string;
      branch_id: string;
    }>;

    // Delete existing assignments for THIS template only, then insert new ones
    const { error: deleteError } = await supabase
      .from('level_subject_template_assignments')
      .delete()
      .eq('subject_template_id', templateId)
      .eq('branch_id', branchId);
    throwIfDbError(deleteError);

    for (const row of oldRows) {
      const recordId = `${row.subject_template_id}_${row.level_id}_${row.branch_id}`;
      this.auditLogService
        .logDelete('level_subject_template_assignments', recordId, userEmail, {
          ...row,
        } as Record<string, unknown>, { branchId, tenantId })
        .catch(() => {});
    }

    // Insert new assignments if any levels provided
    if (uniqueLevelIds.length > 0) {
      const assignmentsToInsert = uniqueLevelIds.map((levelId) => ({
        level_id: levelId,
        subject_template_id: templateId,
        branch_id: branchId,
      }));

      const { error: insertError } = await supabase.from('level_subject_template_assignments').insert(assignmentsToInsert);
      throwIfDbError(insertError);
      for (const row of assignmentsToInsert) {
        const recordId = `${row.subject_template_id}_${row.level_id}_${row.branch_id}`;
        this.auditLogService
          .logCreate('level_subject_template_assignments', recordId, userEmail, {
            ...row,
          } as Record<string, unknown>, { branchId, tenantId })
          .catch(() => {});
      }
    }

    return { data: uniqueLevelIds };
  }

  async getClassIdsWithTemplates(branchId: string): Promise<{ data: string[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('class_subject_template_assignments')
      .select('class_id')
      .eq('branch_id', branchId);
    throwIfDbError(error);
    const rows = (data as { class_id: string }[]) ?? [];
    const classIds = Array.from(new Set(rows.map((r) => r.class_id)));
    return { data: classIds };
  }

  async getTemplatesForClass(classId: string, branchId: string): Promise<{ data: SubjectTemplateDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    // Get class to find its level
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(classError);
    if (!classData) throw new NotFoundException('Class not found');

    // Get level for this class
    const { data: levelClass, error: levelClassError } = await supabase
      .from('level_classes')
      .select('level_id')
      .eq('class_id', classId)
      .maybeSingle();
    throwIfDbError(levelClassError);

    // Fetch templates assigned directly to class OR via level in parallel
    const [classTemplatesResult, levelTemplatesResult] = await Promise.all([
      supabase
        .from('class_subject_template_assignments')
        .select('subject_template_id')
        .eq('class_id', classId)
        .eq('branch_id', branchId),
      levelClass
        ? supabase
            .from('level_subject_template_assignments')
            .select('subject_template_id')
            .eq('level_id', levelClass.level_id)
            .eq('branch_id', branchId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const classTemplateIds = ((classTemplatesResult.data as { subject_template_id: string }[]) ?? []).map(
      (t) => t.subject_template_id,
    );
    const levelTemplateIds = ((levelTemplatesResult.data as { subject_template_id: string }[]) ?? []).map(
      (t) => t.subject_template_id,
    );

    // Merge and deduplicate
    const allTemplateIds = Array.from(new Set([...classTemplateIds, ...levelTemplateIds]));

    if (allTemplateIds.length === 0) {
      return { data: [] };
    }

    // Fetch full template data
    const { data: templates, error: templatesError } = await supabase
      .from('subject_templates')
      .select('id, name, description, branch_id, tenant_id, created_at, updated_at')
      .in('id', allTemplateIds)
      .eq('branch_id', branchId);
    throwIfDbError(templatesError);

    const templateRows = (templates as SubjectTemplateRow[]) ?? [];

    // Fetch relations in parallel
    const [subjectsResult, classesResult, levelsResult] = await Promise.all([
      supabase
        .from('subject_template_subjects')
        .select('subject_template_id, subject_id')
        .in('subject_template_id', allTemplateIds),
      supabase
        .from('class_subject_template_assignments')
        .select('class_id, subject_template_id')
        .in('subject_template_id', allTemplateIds),
      supabase
        .from('level_subject_template_assignments')
        .select('level_id, subject_template_id')
        .in('subject_template_id', allTemplateIds),
    ]);

    const subjectsByTemplate = new Map<string, string[]>();
    ((subjectsResult.data as SubjectTemplateSubjectRow[]) ?? []).forEach((s) => {
      const arr = subjectsByTemplate.get(s.subject_template_id) ?? [];
      arr.push(s.subject_id);
      subjectsByTemplate.set(s.subject_template_id, arr);
    });

    const classesByTemplate = new Map<string, string[]>();
    ((classesResult.data as ClassSubjectTemplateAssignmentRow[]) ?? []).forEach((c) => {
      const arr = classesByTemplate.get(c.subject_template_id) ?? [];
      arr.push(c.class_id);
      classesByTemplate.set(c.subject_template_id, arr);
    });

    const levelsByTemplate = new Map<string, string[]>();
    ((levelsResult.data as LevelSubjectTemplateAssignmentRow[]) ?? []).forEach((l) => {
      const arr = levelsByTemplate.get(l.subject_template_id) ?? [];
      arr.push(l.level_id);
      levelsByTemplate.set(l.subject_template_id, arr);
    });

    return {
      data: templateRows.map((r) =>
        mapSubjectTemplate(
          r,
          subjectsByTemplate.get(r.id) ?? [],
          classesByTemplate.get(r.id) ?? [],
          levelsByTemplate.get(r.id) ?? [],
        ),
      ),
    };
  }

  async getTemplatesForLevel(levelId: string, branchId: string): Promise<{ data: SubjectTemplateDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    // Fetch templates assigned to level
    const { data: assignments, error: assignmentsError } = await supabase
      .from('level_subject_template_assignments')
      .select('subject_template_id')
      .eq('level_id', levelId)
      .eq('branch_id', branchId);
    throwIfDbError(assignmentsError);

    const templateIds = ((assignments as { subject_template_id: string }[]) ?? []).map((a) => a.subject_template_id);

    if (templateIds.length === 0) {
      return { data: [] };
    }

    // Fetch full template data and relations in parallel
    const [templatesResult, subjectsResult, classesResult, levelsResult] = await Promise.all([
      supabase
        .from('subject_templates')
        .select('id, name, description, branch_id, tenant_id, created_at, updated_at')
        .in('id', templateIds)
        .eq('branch_id', branchId),
      supabase
        .from('subject_template_subjects')
        .select('subject_template_id, subject_id')
        .in('subject_template_id', templateIds),
      supabase
        .from('class_subject_template_assignments')
        .select('class_id, subject_template_id')
        .in('subject_template_id', templateIds),
      supabase
        .from('level_subject_template_assignments')
        .select('level_id, subject_template_id')
        .in('subject_template_id', templateIds),
    ]);

    throwIfDbError(templatesResult.error);
    const templateRows = (templatesResult.data as SubjectTemplateRow[]) ?? [];

    const subjectsByTemplate = new Map<string, string[]>();
    ((subjectsResult.data as SubjectTemplateSubjectRow[]) ?? []).forEach((s) => {
      const arr = subjectsByTemplate.get(s.subject_template_id) ?? [];
      arr.push(s.subject_id);
      subjectsByTemplate.set(s.subject_template_id, arr);
    });

    const classesByTemplate = new Map<string, string[]>();
    ((classesResult.data as ClassSubjectTemplateAssignmentRow[]) ?? []).forEach((c) => {
      const arr = classesByTemplate.get(c.subject_template_id) ?? [];
      arr.push(c.class_id);
      classesByTemplate.set(c.subject_template_id, arr);
    });

    const levelsByTemplate = new Map<string, string[]>();
    ((levelsResult.data as LevelSubjectTemplateAssignmentRow[]) ?? []).forEach((l) => {
      const arr = levelsByTemplate.get(l.subject_template_id) ?? [];
      arr.push(l.level_id);
      levelsByTemplate.set(l.subject_template_id, arr);
    });

    return {
      data: templateRows.map((r) =>
        mapSubjectTemplate(
          r,
          subjectsByTemplate.get(r.id) ?? [],
          classesByTemplate.get(r.id) ?? [],
          levelsByTemplate.get(r.id) ?? [],
        ),
      ),
    };
  }

  async assignStudentToTemplate(
    studentId: string,
    subjectTemplateId: string,
    academicYearId: string,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<{ data: SubjectTemplateDto }> {
    const supabase = this.supabaseConfig.getClient();

    // Verify student exists
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, class_id, section_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(studentError);
    if (!student) throw new NotFoundException('Student not found');

    // Verify template exists
    const { data: template, error: templateError } = await supabase
      .from('subject_templates')
      .select('id')
      .eq('id', subjectTemplateId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(templateError);
    if (!template) throw new NotFoundException('Subject template not found');

    // Verify template is available for student's class/level
    const { data: classData } = await supabase
      .from('classes')
      .select('id')
      .eq('id', student.class_id)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (classData) {
      const templatesForClass = await this.getTemplatesForClass(classData.id, branchId);
      const isAvailable = templatesForClass.data.some((t) => t.id === subjectTemplateId);
      if (!isAvailable) {
        throw new BadRequestException('Template is not available for this student\'s class/level');
      }
    }

    // Upsert assignment using ON CONFLICT (more efficient than DELETE + INSERT)
    const { data: assignment, error: upsertError } = await supabase
      .from('student_subject_template_assignments')
      .upsert(
        {
          student_id: studentId,
          subject_template_id: subjectTemplateId,
          academic_year_id: academicYearId,
          branch_id: branchId,
        },
        {
          onConflict: 'student_id,academic_year_id',
        },
      )
      .select('id, student_id, subject_template_id, academic_year_id, branch_id, created_at, updated_at')
      .single();
    throwIfDbError(upsertError);

    if (assignment) {
      const row = assignment as StudentSubjectTemplateAssignmentRow;
      this.auditLogService
        .logCreate(
          'student_subject_template_assignments',
          row.id,
          userEmail,
          { ...row } as Record<string, unknown>,
          { branchId, tenantId },
        )
        .catch(() => {});
    }

    // Return full template
    return { data: await this.getSubjectTemplateById(subjectTemplateId, branchId) };
  }

  async getStudentTemplate(
    studentId: string,
    academicYearId: string,
    branchId: string,
  ): Promise<{ data: SubjectTemplateDto | null }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: assignment, error: assignmentError } = await supabase
      .from('student_subject_template_assignments')
      .select('subject_template_id')
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(assignmentError);

    if (!assignment) {
      return { data: null };
    }

    const template = await this.getSubjectTemplateById(assignment.subject_template_id, branchId);
    return { data: template };
  }

  async removeStudentTemplate(
    studentId: string,
    academicYearId: string,
    branchId: string,
    userEmail: string,
    tenantId?: string | null,
  ): Promise<{ data: { studentId: string; academicYearId: string } }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: oldRow, error: fetchError } = await supabase
      .from('student_subject_template_assignments')
      .select('id, student_id, subject_template_id, academic_year_id, branch_id, created_at, updated_at')
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(fetchError);

    const { error: deleteError } = await supabase
      .from('student_subject_template_assignments')
      .delete()
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)
      .eq('branch_id', branchId);
    throwIfDbError(deleteError);

    if (oldRow) {
      this.auditLogService
        .logDelete(
          'student_subject_template_assignments',
          (oldRow as { id: string }).id,
          userEmail,
          oldRow as Record<string, unknown>,
          { branchId, tenantId },
        )
        .catch(() => {});
    }

    return { data: { studentId, academicYearId } };
  }
}

