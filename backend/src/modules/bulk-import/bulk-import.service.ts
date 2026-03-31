import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as XLSX from 'xlsx';
import { BulkStudentRowDto } from './dto/bulk-student-row.dto';
import { StudentsService } from '../students/students.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

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

/**
 * Maps spreadsheet headers → DTO field names. Keys are matched case-insensitively after BOM/trim.
 * Include template column labels exactly as downloaded so user files map without manual fixes.
 */
const COLUMN_MAP: Record<string, string[]> = {
  username: [
    'username',
    'Username',
    'Portal Username',
    'portal_username',
    'Student Username',
    'Login Username',
    'login username',
  ],
  /** Legacy sheets: full email or school email — local part becomes portal username when Username column is blank. */
  legacy_import_email: [
    'email',
    'Email',
    'Email Address',
    'email_address',
    'School Email',
    'Login Email',
    'login email',
  ],
  first_name: ['first_name', 'First Name', 'FirstName', 'first name', 'fname', 'Given Name'],
  last_name: ['last_name', 'Last Name', 'LastName', 'last name', 'lname', 'Surname', 'Family Name'],
  invitation_type: [
    'invitation_type',
    'Invitation Type',
    'invitation type',
    'Invite Type',
    'invite_type',
  ],
  invitation_recipient_email: [
    'invitation_recipient_email',
    'Invitation Recipient Email',
    'Invitation Recipient Email (optional)',
    'Invitation Email',
    'invite email',
    'Personal Email',
    'personal email',
    'Student Invitation Email',
    'Parent Invitation Email',
  ],
  create_parent_account: [
    'create_parent_account',
    'Create Parent Account',
    'create parent account',
    'Create parent account?',
    'Create Parent?',
  ],
  parent_relationship: [
    'parent_relationship',
    'Parent Relationship',
    'parent relationship',
    'Relationship',
    'relationship',
  ],
  phone: [
    'phone',
    'Phone',
    'Phone (optional)',
    'Phone Number',
    'phone_number',
    'mobile',
    'Mobile',
  ],
  date_of_birth: [
    'date_of_birth',
    'Date of Birth',
    'Date of Birth (optional)',
    'DOB',
    'dob',
    'birth_date',
    'Birth Date',
  ],
  gender: ['gender', 'Gender', 'sex', 'Sex'],
  student_id: [
    'student_id',
    'Student ID',
    'Student ID (optional, leave blank for auto e.g. 0001)',
    'StudentID',
    'student_number',
    'Roll Number',
    'id',
  ],
  class_name_or_id: [
    'class_name',
    'Class Name',
    'class',
    'Class',
    'Class (optional)',
    'Class name or ID (optional)',
    'Class name or ID',
    'Grade',
    'grade',
  ],
  section_name_or_id: [
    'section_name',
    'Section Name',
    'section',
    'Section',
    'Section (optional)',
    'Section name or ID (optional)',
    'Section name or ID',
  ],
  subject_template_name_or_id: [
    'subject_template',
    'Subject Template',
    'subject_template_name',
    'Subject Template Name',
    'Subject Template (optional)',
    'Subject Template name or ID (optional)',
    'Subject Template name or ID',
    'template',
    'Template',
    'Curriculum',
  ],
  parent_email: [
    'parent_email',
    'Parent Email (for new parent account)',
    'Parent Email',
    'Guardian Email',
    'parent email',
  ],
  parent_name: [
    'parent_name',
    'Parent Name',
    'Parent Name (optional)',
    'Guardian Name',
    'parent name',
  ],
  parent_phone: [
    'parent_phone',
    'Parent Phone',
    'Parent Phone (optional)',
    'Guardian Phone',
    'parent phone',
  ],
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PARENT_INVITE_EMAIL =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUuid(s: string): boolean {
  return UUID_REGEX.test((s || '').trim());
}

@Injectable()
export class BulkImportService {
  private readonly classIdCache = new Map<string, string | null>();
  private readonly sectionIdCache = new Map<string, string | null>();
  private readonly templateIdCache = new Map<string, string | null>();
  private readonly classTemplateLinkCache = new Map<string, boolean>();

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly studentsService: StudentsService,
  ) {}

  private getClient(): SupabaseClient {
    return this.supabaseConfig.getClient();
  }

  /** Case-insensitive header lookup (trim + strip BOM). */
  private buildHeaderLookup(row: Record<string, unknown>): Map<string, unknown> {
    const lookup = new Map<string, unknown>();
    for (const [k, v] of Object.entries(row)) {
      const key = k.replace(/^\ufeff/, '').trim().toLowerCase();
      lookup.set(key, v);
    }
    return lookup;
  }

  private deriveUsernameFromLegacyEmail(legacy: string): string | undefined {
    const trimmed = legacy.trim();
    if (!trimmed) return undefined;
    const at = trimmed.indexOf('@');
    if (at < 0) {
      if (/^[a-z0-9]+$/i.test(trimmed)) return trimmed.toLowerCase();
      return undefined;
    }
    const local = trimmed.slice(0, at).replace(/[^a-z0-9]/gi, '');
    return local.length > 0 ? local.toLowerCase() : undefined;
  }

  private applyUsernameDerivation(mapped: Record<string, unknown>): void {
    const existing = mapped.username;
    if (existing != null && String(existing).trim() !== '') return;
    const legacy = mapped.legacy_import_email;
    if (legacy == null || legacy === '') return;
    const derived = this.deriveUsernameFromLegacyEmail(String(legacy));
    if (derived) mapped.username = derived;
  }

  private sanitizeSingleEmail(value: string | undefined | null): string {
    if (value == null) return '';
    // Remove common invisible characters and normalise whitespace.
    const cleaned = String(value)
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .trim();
    if (!cleaned) return '';

    // If multiple lines/emails are pasted, take the first token and let validation fail if needed.
    const first = cleaned.split(/[\r\n,; ]+/).filter(Boolean)[0] ?? '';
    return first.trim();
  }

  private appendExtraRowValidation(dto: BulkStudentRowDto): string[] {
    const extra: string[] = [];
    if (dto.invitation_type === 'parent') {
      const raw = this.sanitizeSingleEmail(dto.invitation_recipient_email);
      if (!PARENT_INVITE_EMAIL.test(raw)) {
        extra.push(
          'Invitation recipient must be a valid email when invitation type is parent.',
        );
      }
    }
    return extra;
  }

  /** Resolve class by UUID or name (from Settings) for branch. Uses exact match on name/display_name so "Class I" does not match "Class II" or "Class III". */
  private async resolveClassId(
    supabase: SupabaseClient,
    value: string,
    branchId: string,
  ): Promise<string | null> {
    const v = (value || '').trim();
    if (!v) return null;
    const cacheKey = `${branchId}::${v.toLowerCase()}`;
    if (this.classIdCache.has(cacheKey)) return this.classIdCache.get(cacheKey) ?? null;
    if (isUuid(v)) {
      const { data } = await supabase
        .from('classes')
        .select('id')
        .eq('id', v)
        .eq('branch_id', branchId)
        .maybeSingle();
      const id = (data as { id: string } | null)?.id ?? null;
      this.classIdCache.set(cacheKey, id);
      return id;
    }
    const { data: byName } = await supabase
      .from('classes')
      .select('id')
      .eq('branch_id', branchId)
      .ilike('name', v)
      .limit(1)
      .maybeSingle();
    if ((byName as { id: string } | null)?.id) {
      const id = (byName as { id: string }).id;
      this.classIdCache.set(cacheKey, id);
      return id;
    }
    const { data: byDisplay } = await supabase
      .from('classes')
      .select('id')
      .eq('branch_id', branchId)
      .ilike('display_name', v)
      .limit(1)
      .maybeSingle();
    const id = (byDisplay as { id: string } | null)?.id ?? null;
    this.classIdCache.set(cacheKey, id);
    return id;
  }

  /** Resolve section by UUID or name (from Settings) for branch. */
  private async resolveSectionId(
    supabase: SupabaseClient,
    value: string,
    branchId: string,
  ): Promise<string | null> {
    const v = (value || '').trim();
    if (!v) return null;
    const cacheKey = `${branchId}::${v.toLowerCase()}`;
    if (this.sectionIdCache.has(cacheKey)) return this.sectionIdCache.get(cacheKey) ?? null;
    if (isUuid(v)) {
      const { data } = await supabase
        .from('sections')
        .select('id')
        .eq('id', v)
        .eq('branch_id', branchId)
        .maybeSingle();
      const id = (data as { id: string } | null)?.id ?? null;
      this.sectionIdCache.set(cacheKey, id);
      return id;
    }
    const { data } = await supabase
      .from('sections')
      .select('id')
      .eq('branch_id', branchId)
      .ilike('name', v)
      .limit(1)
      .maybeSingle();
    const id = (data as { id: string } | null)?.id ?? null;
    this.sectionIdCache.set(cacheKey, id);
    return id;
  }

  /** Resolve subject template by UUID or name (from Settings) for branch. */
  private async resolveSubjectTemplateId(
    supabase: SupabaseClient,
    value: string,
    branchId: string,
  ): Promise<string | null> {
    const v = (value || '').trim();
    if (!v) return null;
    const cacheKey = `${branchId}::${v.toLowerCase()}`;
    if (this.templateIdCache.has(cacheKey)) return this.templateIdCache.get(cacheKey) ?? null;
    if (isUuid(v)) {
      const { data } = await supabase
        .from('subject_templates')
        .select('id')
        .eq('id', v)
        .eq('branch_id', branchId)
        .maybeSingle();
      const id = (data as { id: string } | null)?.id ?? null;
      this.templateIdCache.set(cacheKey, id);
      return id;
    }
    const { data } = await supabase
      .from('subject_templates')
      .select('id')
      .eq('branch_id', branchId)
      .ilike('name', v)
      .limit(1)
      .maybeSingle();
    const id = (data as { id: string } | null)?.id ?? null;
    this.templateIdCache.set(cacheKey, id);
    return id;
  }

  /** Check if subject template is linked to class (class_subject_template_assignments) for branch. */
  private async isClassLinkedToSubjectTemplate(
    supabase: SupabaseClient,
    classId: string,
    subjectTemplateId: string,
    branchId: string,
  ): Promise<boolean> {
    const cacheKey = `${branchId}::${classId}::${subjectTemplateId}`;
    const cached = this.classTemplateLinkCache.get(cacheKey);
    if (cached != null) return cached;
    const { data } = await supabase
      .from('class_subject_template_assignments')
      .select('class_id')
      .eq('class_id', classId)
      .eq('subject_template_id', subjectTemplateId)
      .eq('branch_id', branchId)
      .limit(1)
      .maybeSingle();
    const linked = !!data;
    this.classTemplateLinkCache.set(cacheKey, linked);
    return linked;
  }

  private async resolvePlacementForRow(
    supabase: SupabaseClient,
    row: BulkStudentRowDto,
    branchId: string,
  ): Promise<{
    classId: string | null;
    sectionId: string | null;
    subjectTemplateId: string | null;
    warnings: string[];
  }> {
    let classId: string | null = null;
    let sectionId: string | null = null;
    let subjectTemplateId: string | null = null;
    const warnings: string[] = [];

    const hasClass = !!row.class_name_or_id?.trim();
    const hasSection = !!row.section_name_or_id?.trim();
    const hasTemplate = !!row.subject_template_name_or_id?.trim();
    if (!hasClass && !hasSection && !hasTemplate) {
      return { classId, sectionId, subjectTemplateId, warnings };
    }

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
        warnings.push(
          `Subject template '${row.subject_template_name_or_id}' not found.`,
        );
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
        warnings.push(
          `Subject template '${row.subject_template_name_or_id}' is not linked to class '${row.class_name_or_id}'.`,
        );
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

    return { classId, sectionId, subjectTemplateId, warnings };
  }

  async parseStudentsFile(
    file: Express.Multer.File,
    _branchId: string,
  ): Promise<{ data: ImportPreview }> {
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
      this.applyUsernameDerivation(mappedRow);
      delete mappedRow.legacy_import_email;
      const rawInviteType = mappedRow.invitation_type;
      const invitationTypeDefaulted =
        rawInviteType != null && String(rawInviteType).trim() !== ''
          ? rawInviteType
          : 'student';
      const dto = plainToInstance(BulkStudentRowDto, {
        ...mappedRow,
        create_parent_account: mappedRow.create_parent_account ?? false,
        invitation_type: invitationTypeDefaulted,
      });
      const errors = await validate(dto);
      const fieldErrors = errors.flatMap((err) =>
        err.constraints ? Object.values(err.constraints) : [],
      );
      const extraErrors = this.appendExtraRowValidation(dto);
      const allErrors = [...fieldErrors, ...extraErrors];
      parsedRows.push({
        rowNumber,
        data: dto,
        errors: allErrors,
        isValid: allErrors.length === 0,
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

  private mapColumnNames(row: Record<string, unknown>): Record<string, unknown> {
    const lookup = this.buildHeaderLookup(row);
    const mapped: Record<string, unknown> = {};
    for (const [targetField, possibleNames] of Object.entries(COLUMN_MAP)) {
      for (const name of possibleNames) {
        let val = lookup.get(name.toLowerCase());
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

  /**
   * Convert Excel serial, ISO, DD/MM/YYYY, and ambiguous numeric slashed dates to ISO 8601 (yyyy-mm-dd).
   * Ambiguous 01/02/2000 is treated as D/M/Y (British).
   */
  private normalizeDate(val: unknown): string | undefined {
    if (val == null || val === '') return undefined;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return undefined;
      const iso = /^\d{4}-\d{2}-\d{2}/.exec(trimmed);
      if (iso) return trimmed.substring(0, 10);
      const slash = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
      if (slash) {
        const a = Number(slash[1]);
        const b = Number(slash[2]);
        let y = slash[3]!;
        const year = y.length === 2 ? `20${y}` : y;
        let day: number;
        let month: number;
        if (a > 12) {
          day = a;
          month = b;
        } else if (b > 12) {
          month = a;
          day = b;
        } else {
          day = a;
          month = b;
        }
        if (
          month >= 1 &&
          month <= 12 &&
          day >= 1 &&
          day <= 31
        ) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
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
    adminUser: CurrentUserPayload,
  ): Promise<{ data: ImportResult }> {
    const supabase = this.getClient();
    const results: ImportResult = {
      totalProcessed: rows.length,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    if (rows.length === 0) {
      throw new BadRequestException('No rows to import');
    }

    // Small concurrency to reduce total wall time without overwhelming Auth/Email providers.
    const CONCURRENCY = 4;
    const indices = rows.map((_, i) => i);
    let cursor = 0;

    const worker = async () => {
      while (cursor < indices.length) {
        const idx = indices[cursor]!;
        cursor += 1;
        const row = rows[idx]!;
        const rowLabel = row.row_number ?? idx + 2;

        const hasCore =
          row.first_name?.trim() &&
          row.last_name?.trim() &&
          row.username?.trim() &&
          row.gender;
        if (!hasCore) {
          results.failureCount += 1;
          results.errors.push({
            row: rowLabel,
            message:
              'Missing required fields: username, first name, last name, and gender are required.',
          });
          continue;
        }

        try {
          const placement = await this.resolvePlacementForRow(
            supabase,
            row,
            branchId,
          );

          await this.studentsService.createStudentWithInvitation(
            {
              username: row.username.trim(),
              firstName: row.first_name.trim(),
              lastName: row.last_name.trim(),
              classId: placement.classId ?? undefined,
              sectionId: placement.sectionId ?? undefined,
              phone: row.phone,
              dateOfBirth: row.date_of_birth,
              gender: row.gender,
              academicYearId,
              subjectTemplateId: placement.subjectTemplateId ?? undefined,
              invitationType: row.invitation_type,
              invitationRecipientEmail: this.sanitizeSingleEmail(
                row.invitation_recipient_email,
              ),
              createParentAccount: row.create_parent_account,
              parentEmail: row.parent_email,
              parentName: row.parent_name,
              parentPhone: row.parent_phone,
              parentRelationship: row.parent_relationship,
            },
            branchId,
            adminUser,
          );

          results.successCount += 1;
          if (placement.warnings.length > 0) {
            results.errors.push({
              row: rowLabel,
              message: `Student imported but: ${placement.warnings.join(' ')}`,
            });
          }
        } catch (err: unknown) {
          results.failureCount += 1;
          const message =
            err instanceof Error ? err.message : 'Unknown error during import';
          results.errors.push({ row: rowLabel, message });
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    return { data: results };
  }
}
