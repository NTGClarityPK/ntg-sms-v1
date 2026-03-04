import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as XLSX from 'xlsx';
import { BulkStudentRowDto } from './dto/bulk-student-row.dto';

type SupabaseClient = ReturnType<SupabaseConfig['getClient']>;

interface ParsedRow {
  rowNumber: number;
  data: BulkStudentRowDto;
  errors: string[];
  isValid: boolean;
}

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ParsedRow[];
}

export interface ImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ row: number; message: string }>;
}

const COLUMN_MAP: Record<string, string[]> = {
  first_name: ['first_name', 'First Name', 'FirstName', 'first name', 'fname'],
  last_name: ['last_name', 'Last Name', 'LastName', 'last name', 'lname'],
  email: ['email', 'Email', 'Email Address', 'email_address'],
  phone: ['phone', 'Phone', 'Phone Number', 'phone_number', 'mobile'],
  date_of_birth: ['date_of_birth', 'Date of Birth', 'DOB', 'dob', 'birth_date'],
  gender: ['gender', 'Gender', 'sex', 'Sex'],
  student_id: ['student_id', 'Student ID', 'StudentID', 'student_number', 'id'],
  class_name_or_id: [
    'class_name',
    'Class Name',
    'class',
    'Class',
    'Class name or ID (optional)',
    'Class name or ID',
  ],
  section_name_or_id: [
    'section_name',
    'Section Name',
    'section',
    'Section',
    'Section name or ID (optional)',
    'Section name or ID',
  ],
  subject_template_name_or_id: [
    'subject_template',
    'Subject Template',
    'subject_template_name',
    'Subject Template Name',
    'Subject Template name or ID (optional)',
    'Subject Template name or ID',
  ],
  parent_email: [
    'parent_email',
    'Parent Email',
    'Guardian Email',
    'parent email',
  ],
  parent_name: [
    'parent_name',
    'Parent Name',
    'Guardian Name',
    'parent name',
  ],
  parent_phone: [
    'parent_phone',
    'Parent Phone',
    'Guardian Phone',
    'parent phone',
  ],
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_REGEX.test((s || '').trim());
}

@Injectable()
export class BulkImportService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  private getClient(): SupabaseClient {
    return this.supabaseConfig.getClient();
  }

  /** Resolve class by UUID or name (from Settings) for branch. Uses exact match on name/display_name so "Class I" does not match "Class II" or "Class III". */
  private async resolveClassId(
    supabase: SupabaseClient,
    value: string,
    branchId: string,
  ): Promise<string | null> {
    const v = (value || '').trim();
    if (!v) return null;
    if (isUuid(v)) {
      const { data } = await supabase
        .from('classes')
        .select('id')
        .eq('id', v)
        .eq('branch_id', branchId)
        .maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    }
    const { data: byName } = await supabase
      .from('classes')
      .select('id')
      .eq('branch_id', branchId)
      .ilike('name', v)
      .limit(1)
      .maybeSingle();
    if ((byName as { id: string } | null)?.id) return (byName as { id: string }).id;
    const { data: byDisplay } = await supabase
      .from('classes')
      .select('id')
      .eq('branch_id', branchId)
      .ilike('display_name', v)
      .limit(1)
      .maybeSingle();
    return (byDisplay as { id: string } | null)?.id ?? null;
  }

  /** Resolve section by UUID or name (from Settings) for branch. */
  private async resolveSectionId(
    supabase: SupabaseClient,
    value: string,
    branchId: string,
  ): Promise<string | null> {
    const v = (value || '').trim();
    if (!v) return null;
    if (isUuid(v)) {
      const { data } = await supabase
        .from('sections')
        .select('id')
        .eq('id', v)
        .eq('branch_id', branchId)
        .maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    }
    const { data } = await supabase
      .from('sections')
      .select('id')
      .eq('branch_id', branchId)
      .ilike('name', v)
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }

  /** Resolve subject template by UUID or name (from Settings) for branch. */
  private async resolveSubjectTemplateId(
    supabase: SupabaseClient,
    value: string,
    branchId: string,
  ): Promise<string | null> {
    const v = (value || '').trim();
    if (!v) return null;
    if (isUuid(v)) {
      const { data } = await supabase
        .from('subject_templates')
        .select('id')
        .eq('id', v)
        .eq('branch_id', branchId)
        .maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    }
    const { data } = await supabase
      .from('subject_templates')
      .select('id')
      .eq('branch_id', branchId)
      .ilike('name', v)
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }

  /** Check if subject template is linked to class (class_subject_template_assignments) for branch. */
  private async isClassLinkedToSubjectTemplate(
    supabase: SupabaseClient,
    classId: string,
    subjectTemplateId: string,
    branchId: string,
  ): Promise<boolean> {
    const { data } = await supabase
      .from('class_subject_template_assignments')
      .select('class_id')
      .eq('class_id', classId)
      .eq('subject_template_id', subjectTemplateId)
      .eq('branch_id', branchId)
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  async parseStudentsFile(
    file: Express.Multer.File,
    branchId: string,
  ): Promise<{ data: ImportPreview }> {
    const supabase = this.getClient();
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
      worksheet,
      { defval: '' },
    );

    if (rawData.length === 0) {
      throw new BadRequestException('File is empty');
    }

    if (rawData.length > 5000) {
      throw new BadRequestException('File exceeds maximum 5000 rows');
    }

    const parsedRows: ParsedRow[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const rowNumber = i + 2;
      const rawRow = rawData[i];
      const mappedRow = this.mapColumnNames(rawRow);
      const dto = plainToInstance(BulkStudentRowDto, mappedRow);
      const errors = await validate(dto);
      parsedRows.push({
        rowNumber,
        data: dto,
        errors: errors.flatMap((err) =>
          err.constraints ? Object.values(err.constraints) : [],
        ),
        isValid: errors.length === 0,
      });
    }

    const validRows = parsedRows.filter((r) => r.isValid).length;

    return {
      data: {
        totalRows: rawData.length,
        validRows,
        invalidRows: rawData.length - validRows,
        rows: parsedRows,
      },
    };
  }

  private mapColumnNames(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    for (const [targetField, possibleNames] of Object.entries(COLUMN_MAP)) {
      for (const name of possibleNames) {
        let val = row[name];
        if (val !== undefined && val !== '') {
          if (targetField === 'phone' && typeof val === 'number') {
            val = String(val);
          }
          if (targetField === 'date_of_birth') {
            val = this.normalizeDate(val) ?? undefined;
          }
          if (val !== undefined && val !== '') {
            mapped[targetField] = val;
          }
          break;
        }
      }
    }
    return mapped;
  }

  /** Convert Excel serial, DD/MM/YYYY, etc. to ISO 8601 date string. */
  private normalizeDate(val: unknown): string | undefined {
    if (val == null || val === '') return undefined;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return undefined;
      const iso = /^\d{4}-\d{2}-\d{2}/.exec(trimmed);
      if (iso) return trimmed.substring(0, 10);
      const ddmmyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (ddmmyy) {
        const [, d, m, y] = ddmmyy;
        const year = y!.length === 2 ? `20${y}` : y!;
        return `${year}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
      }
    }
    if (typeof val === 'number' && !Number.isNaN(val)) {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + val * 86400 * 1000);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
    return undefined;
  }

  async importStudents(
    rows: BulkStudentRowDto[],
    branchId: string,
    academicYearId: string,
  ): Promise<{ data: ImportResult }> {
    const supabase = this.getClient();
    const results: ImportResult = {
      totalProcessed: rows.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    const validRows = rows.filter(
      (row) => row.first_name && row.last_name && row.email,
    );

    if (validRows.length === 0) {
      throw new BadRequestException('No valid rows to import');
    }

    const BATCH_SIZE = 500;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const baseRowNumber = i + 2;

      try {
        const authResults = await this.createAuthUsersAndProfiles(
          supabase,
          batch,
          branchId,
        );

        const studentRecords: Array<{
          user_id: string;
          branch_id: string;
          first_name: string;
          last_name: string;
          class_id: string | null;
          section_id: string | null;
          blood_group: null;
          medical_notes: null;
          admission_date: string | null;
          academic_year_id: string;
          is_active: boolean;
          created_by: string;
          updated_by: string;
        }> = [];
        const subjectTemplateIdsForRecords: Array<string | null> = [];
        const authFailedIndices: number[] = [];
        const rowWarnings: string[] = new Array(batch.length).fill('').map(() => '');

        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const userId = authResults[j]?.userId ?? null;
          if (!userId) {
            authFailedIndices.push(j);
            continue;
          }
          let classId: string | null = null;
          let sectionId: string | null = null;
          let subjectTemplateId: string | null = null;
          const warnings: string[] = [];

          const hasClass = !!row.class_name_or_id?.trim();
          const hasSection = !!row.section_name_or_id?.trim();
          const hasTemplate = !!row.subject_template_name_or_id?.trim();
          if (hasClass || hasSection || hasTemplate) {
            let resolvedClassId: string | null = null;
            let resolvedSectionId: string | null = null;
            let resolvedTemplateId: string | null = null;
            if (hasClass) {
              resolvedClassId = await this.resolveClassId(
                supabase,
                row.class_name_or_id!,
                branchId,
              );
              if (!resolvedClassId) {
                warnings.push(`Class '${row.class_name_or_id}' not found.`);
              }
            }
            if (hasSection) {
              resolvedSectionId = await this.resolveSectionId(
                supabase,
                row.section_name_or_id!,
                branchId,
              );
              if (!resolvedSectionId) {
                warnings.push(`Section '${row.section_name_or_id}' not found.`);
              }
            }
            if (hasTemplate) {
              resolvedTemplateId = await this.resolveSubjectTemplateId(
                supabase,
                row.subject_template_name_or_id!,
                branchId,
              );
              if (!resolvedTemplateId) {
                warnings.push(`Subject template '${row.subject_template_name_or_id}' not found.`);
              }
            }
            if (resolvedTemplateId && resolvedClassId) {
              const linked = await this.isClassLinkedToSubjectTemplate(
                supabase,
                resolvedClassId,
                resolvedTemplateId,
                branchId,
              );
              if (!linked) {
                warnings.push(`Subject template '${row.subject_template_name_or_id}' is not linked to class '${row.class_name_or_id}'.`);
                resolvedClassId = null;
                resolvedSectionId = null;
                resolvedTemplateId = null;
              }
            } else if (resolvedTemplateId) {
              warnings.push(`Subject template requires a valid class.`);
              resolvedTemplateId = null;
            }
            if (
              (hasClass && !resolvedClassId) ||
              (hasSection && !resolvedSectionId)
            ) {
              classId = null;
              sectionId = null;
              subjectTemplateId = null;
            } else {
              classId = resolvedClassId;
              sectionId = resolvedSectionId;
              subjectTemplateId = resolvedTemplateId;
            }
          }
          if (warnings.length > 0) {
            rowWarnings[j] = `Student imported but: ${warnings.join(' ')}`;
          }

          subjectTemplateIdsForRecords.push(subjectTemplateId);
          studentRecords.push({
            user_id: userId,
            branch_id: branchId,
            first_name: row.first_name,
            last_name: row.last_name,
            class_id: classId,
            section_id: sectionId,
            blood_group: null,
            medical_notes: null,
            admission_date: row.date_of_birth
              ? row.date_of_birth.substring(0, 10)
              : null,
            academic_year_id: academicYearId,
            is_active: true,
            created_by: 'bulk-import',
            updated_by: 'bulk-import',
          });
        }

        for (const j of authFailedIndices) {
          const authError = authResults[j]?.errorMessage;
          results.errors.push({
            row: baseRowNumber + j,
            message: authError
              ? `Failed to create auth user for ${batch[j].email}: ${authError}`
              : `Failed to create auth user for ${batch[j].email}`,
          });
        }
        results.failureCount += authFailedIndices.length;

        if (studentRecords.length === 0) {
          continue;
        }

        const { data: inserted, error } = await supabase
          .from('students')
          .insert(studentRecords)
          .select('id');

        if (error) {
          results.failureCount += batch.length;
          results.errors.push({ row: baseRowNumber, message: error.message });
        } else {
          results.successCount += inserted?.length ?? 0;
          for (let j = 0; j < batch.length; j++) {
            if (!authFailedIndices.includes(j) && rowWarnings[j]) {
              results.errors.push({
                row: baseRowNumber + j,
                message: rowWarnings[j],
              });
            }
          }
          await this.createParentLinks(
            supabase,
            inserted ?? [],
            batch.filter((_, j) => !authFailedIndices.includes(j)),
          );
          const username = 'bulk-import';
          for (let k = 0; k < (inserted?.length ?? 0); k++) {
            const templateId = subjectTemplateIdsForRecords[k];
            const studentId = inserted![k].id;
            if (templateId) {
              await supabase
                .from('student_subject_template_assignments')
                .upsert(
                  {
                    student_id: studentId,
                    subject_template_id: templateId,
                    academic_year_id: academicYearId,
                    branch_id: branchId,
                    created_by: username,
                    updated_by: username,
                  },
                  { onConflict: 'student_id,academic_year_id' },
                );
            }
          }
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        results.failureCount += batch.length;
        results.errors.push({ row: baseRowNumber, message });
      }
    }

    return { data: results };
  }

  private async createAuthUsersAndProfiles(
    supabase: SupabaseClient,
    rows: BulkStudentRowDto[],
    branchId: string,
  ): Promise<Array<{ userId: string | null; email: string; errorMessage?: string }>> {
    const results: Array<{ userId: string | null; email: string; errorMessage?: string }> = [];
    const username = 'bulk-import';

    for (const row of rows) {
      try {
        const email = (row.email || '').trim().toLowerCase();
        if (!email) {
          results.push({
            userId: null,
            email: row.email,
            errorMessage: 'Email is required',
          });
          continue;
        }

        const { data: exists } = await supabase.rpc('student_exists_by_email', {
          p_email: email,
          p_branch_id: branchId,
        });
        if (exists === true) {
          results.push({
            userId: null,
            email: row.email,
            errorMessage: 'A student with this email already exists in this branch.',
          });
          continue;
        }

        const tempPassword = this.generateTempPassword();
        const { data, error } = await supabase.auth.admin.createUser({
          email: row.email,
          password: tempPassword,
          email_confirm: true,
        });

        if (error || !data?.user) {
          results.push({
            userId: null,
            email: row.email,
            errorMessage: error?.message ?? 'Could not create user',
          });
          continue;
        }

        const displayName = `${row.first_name.trim()} ${row.last_name.trim()}`.trim();
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: displayName,
          phone: row.phone ?? null,
          date_of_birth: row.date_of_birth ?? null,
          gender: row.gender ?? null,
          is_active: true,
          created_by: username,
          updated_by: username,
        });

        await supabase.from('user_branches').insert({
          user_id: data.user.id,
          branch_id: branchId,
          is_primary: false,
          created_by: username,
        });

        const { data: studentRole } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'student')
          .single();
        if (studentRole) {
          await supabase.from('user_roles').insert({
            user_id: data.user.id,
            role_id: studentRole.id,
            branch_id: branchId,
            created_by: username,
          });
        }

        results.push({ userId: data.user.id, email: row.email });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ userId: null, email: row.email, errorMessage: msg });
      }
    }

    return results;
  }

  private async createParentLinks(
    supabase: SupabaseClient,
    students: Array<{ id: string }>,
    rows: BulkStudentRowDto[],
  ): Promise<void> {
    const username = 'bulk-import';
    const links: Array<{
      parent_user_id: string;
      student_id: string;
      relationship: 'guardian';
      is_primary: boolean;
      can_approve: boolean;
      created_by: string;
      updated_by: string;
    }> = [];

    for (let i = 0; i < students.length; i++) {
      const row = rows[i];
      if (!row?.parent_email?.trim()) continue;
      const parentUserId = await this.findOrCreateParentUser(supabase, row);
      if (parentUserId) {
        links.push({
          parent_user_id: parentUserId,
          student_id: students[i].id,
          relationship: 'guardian',
          is_primary: true,
          can_approve: true,
          created_by: username,
          updated_by: username,
        });
      }
    }

    if (links.length > 0) {
      await supabase.from('parent_students').insert(links);
    }
  }

  private async findOrCreateParentUser(
    supabase: SupabaseClient,
    row: BulkStudentRowDto,
  ): Promise<string | null> {
    const tempPassword = this.generateTempPassword();
    const { data, error } = await supabase.auth.admin.createUser({
      email: row.parent_email!,
      password: tempPassword,
      email_confirm: true,
    });
    if (error || !data?.user) return null;
    await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: row.parent_name ?? 'Parent',
      created_by: 'bulk-import',
      updated_by: 'bulk-import',
    });
    return data.user.id;
  }

  private generateTempPassword(): string {
    return (
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8)
    );
  }
}
