import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as XLSX from 'xlsx';
import { BulkStudentRowDto } from './dto/bulk-student-row.dto';
import { BulkUserRowDto } from './dto/bulk-user-row.dto';
import {
  StudentsService,
  type DeferredInvitationDelivery,
} from '../students/students.service';
import {
  UsersService,
  type DeferredUserInvitationDelivery,
} from '../users/users.service';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { mapWithConcurrency } from '../../common/utils/map-with-concurrency.util';
import { extractUsernameFromEmail } from '../../common/utils/audit.utils';
import {
  IMPORT_STATUS_COLUMN,
  STUDENT_BULK_COLUMN_DEFS,
  isSkipImportStatus,
} from './student-bulk-columns';
import {
  USER_BULK_COLUMN_DEFS,
  USER_IMPORT_STATUS_COLUMN,
} from './user-bulk-columns';

type SupabaseClient = ReturnType<SupabaseConfig['getClient']>;

interface ParsedRow {
  rowNumber: number;
  data: BulkStudentRowDto;
  errors: string[];
  isValid: boolean;
}

interface ParsedUserRow {
  rowNumber: number;
  data: BulkUserRowDto;
  errors: string[];
  isValid: boolean;
}

type RoleRef = {
  id: string;
  name: string;
  displayName: string;
};

type RoleLookup = {
  byId: Map<string, RoleRef>;
  byKey: Map<string, RoleRef>;
};

export interface UserImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ParsedUserRow[];
}

export interface UserImportRowOutcome {
  row: number;
  fullName: string;
  loginEmail?: string;
  userType?: 'parent' | 'staff';
  roles?: string;
  status: 'added' | 'updated' | 'unchanged' | 'failed_insert' | 'failed_update' | 'skipped';
  reason?: string;
  recipientEmail?: string;
}

export interface UserImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedInsertCount: number;
  failedUpdateCount: number;
  skippedCount: number;
  errors: Array<{ row: number; message: string }>;
  rowOutcomes: UserImportRowOutcome[];
  resultsFile?: {
    fileName: string;
    contentBase64: string;
    mimeType: string;
  };
  created?: Array<{
    row: number;
    fullName: string;
    loginEmail: string;
    recipientEmail: string;
    userType: 'parent' | 'staff';
    roles: string;
  }>;
}

type PlacementRefs = {
  classById: Map<string, { id: string; name: string; displayName: string | null }>;
  classIdByNameLower: Map<string, string>;
  sectionById: Map<string, { id: string; name: string }>;
  sectionIdByNameLower: Map<string, string>;
  templateById: Map<string, { id: string; name: string }>;
  templateIdByNameLower: Map<string, string>;
  classHasAnyTemplates: Set<string>;
  classTemplateLinks: Set<string>; // `${classId}::${templateId}`
};

export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ParsedRow[];
}

export interface ImportRowOutcome {
  row: number;
  username: string;
  studentName: string;
  loginEmail?: string;
  status: 'added' | 'updated' | 'unchanged' | 'failed_insert' | 'failed_update' | 'skipped';
  reason?: string;
  recipientEmail?: string;
  invitationType?: 'parent' | 'student';
  expiresAt?: string;
  parentRecipientEmail?: string;
  parentExpiresAt?: string;
}

type StudentImportSnapshot = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  medicalNotes: string | null;
  admissionDate: string | null;
  googleAccountEmail: string | null;
  classId: string | null;
  sectionId: string | null;
  subjectTemplateId: string | null;
};

export interface ImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedInsertCount: number;
  failedUpdateCount: number;
  skippedCount: number;
  errors: Array<{ row: number; message: string }>;
  rowOutcomes: ImportRowOutcome[];
  /** Present when any row failed — Excel matching import shape + Import Status column. */
  resultsFile?: {
    fileName: string;
    contentBase64: string;
    mimeType: string;
  };
  /** @deprecated Prefer rowOutcomes; kept for older clients. */
  created?: Array<{
    row: number;
    username: string;
    studentName: string;
    loginEmail: string;
    recipientEmail: string;
    invitationType: 'parent' | 'student';
    expiresAt: string;
    parentRecipientEmail?: string;
    parentExpiresAt?: string;
    action: 'created' | 'updated';
  }>;
}

const PARENT_ROLE_NAMES = new Set(['parent', 'guardian', 'father', 'mother']);

/**
 * Spreadsheet headers → BulkUserRowDto field names.
 */
const USER_COLUMN_MAP: Record<string, string[]> = {
  full_name: [
    'full_name',
    'Full Name',
    'full name',
    'Name',
    'name',
    'Display Name',
    'display_name',
  ],
  roles: [
    'roles',
    'Roles',
    'role',
    'Role',
    'Role Name',
    'role_name',
    'Role Names',
  ],
  username: [
    'username',
    'Username',
    'Username (staff)',
    'Portal Username',
    'portal_username',
    'School Username',
    'Login Username',
    'login username',
  ],
  invitation_email: [
    'invitation_email',
    'Invitation Email',
    'Invitation Email (staff)',
    'Invitation Email (staff, optional)',
    'Correspondence Email',
    'correspondence_email',
    'Invite Email',
    'invite email',
  ],
  email: [
    'email',
    'Email',
    'Email (parent)',
    'Email Address',
    'email_address',
    'Parent Email',
    'Login Email',
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
    'Date Of Birth',
    'DOB',
    'dob',
    'birth_date',
    'Birth Date',
  ],
  gender: ['gender', 'Gender', 'Gender (optional)', 'sex', 'Sex'],
  address: ['address', 'Address', 'Address (optional)'],
  import_status: [
    'import_status',
    'Import Status',
    'import status',
    'Status',
    'Import result',
    'Import Result',
  ],
};

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
    'Parent Relationship (optional)',
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
  address: [
    'address',
    'Address',
    'Address (optional)',
    'home_address',
    'Home Address',
  ],
  date_of_birth: [
    'date_of_birth',
    'Date of Birth',
    'Date of Birth (optional)',
    'Date Of Birth',
    'DOB',
    'dob',
    'DOB (optional)',
    'birth_date',
    'Birth Date',
    'Birthdate',
    'BirthDate',
  ],
  gender: ['gender', 'Gender', 'Gender (optional)', 'sex', 'Sex'],
  student_id: [
    'student_id',
    'Student ID',
    'Student ID (optional, leave blank for auto e.g. 00001)',
    'StudentID',
    'student_number',
    'Roll Number',
    'id',
  ],
  blood_group: [
    'blood_group',
    'Blood Group',
    'Blood Group (optional)',
    'blood group',
    'BloodType',
    'blood_type',
  ],
  medical_notes: [
    'medical_notes',
    'Medical Notes',
    'Medical Notes (optional)',
    'medical notes',
    'Medical Notes / Allergies',
    'allergies',
  ],
  admission_date: [
    'admission_date',
    'Admission Date',
    'Admission Date (optional)',
    'admission date',
    'Date of Admission',
  ],
  google_account_email: [
    'google_account_email',
    'Google Account Email',
    'Google Account Email (optional)',
    'Google Classroom Email',
    'Google Classroom Email (optional)',
    'gmail',
    'Gmail',
    'Gmail (optional)',
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
  import_status: [
    'import_status',
    'Import Status',
    'import status',
    'Status',
    'Import result',
    'Import Result',
  ],
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PARENT_INVITE_EMAIL =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUuid(s: string): boolean {
  return UUID_REGEX.test((s || '').trim());
}

function normalizeSpreadsheetString(value: string): string {
  return String(value ?? '')
    // Strip common invisible characters (often introduced by Excel copy/paste)
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    // Normalise NBSP to regular spaces
    .replace(/\u00A0/g, ' ');
}

function normalizeLookupValue(value: string): string {
  return normalizeSpreadsheetString(value)
    .trim();
}

@Injectable()
export class BulkImportService {
  private readonly classIdCache = new Map<string, string | null>();
  private readonly sectionIdCache = new Map<string, string | null>();
  private readonly templateIdCache = new Map<string, string | null>();
  private readonly classTemplateLinkCache = new Map<string, boolean>();
  private readonly classLevelIdsCache = new Map<string, string[]>(); // key: `${branchId}::${classId}`

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly studentsService: StudentsService,
    private readonly usersService: UsersService,
  ) {}

  private getClient(): SupabaseClient {
    return this.supabaseConfig.getClient();
  }

  private async loadPlacementRefs(
    supabase: SupabaseClient,
    branchId: string,
  ): Promise<PlacementRefs> {
    const [classesRes, sectionsRes, templatesRes, assignmentsRes, levelClassesRes] = await Promise.all([
      supabase
        .from('classes')
        .select('id, name, display_name')
        .eq('branch_id', branchId),
      supabase.from('sections').select('id, name').eq('branch_id', branchId),
      supabase
        .from('subject_templates')
        .select('id, name')
        .eq('branch_id', branchId),
      supabase
        .from('class_subject_template_assignments')
        .select('class_id, subject_template_id')
        .eq('branch_id', branchId),
      // Note: `level_classes` is used elsewhere without `branch_id` filtering.
      supabase.from('level_classes').select('class_id, level_id'),
    ]);

    const classes = (classesRes.data ?? []) as Array<{
      id: string;
      name: string;
      display_name?: string | null;
    }>;
    const sections = (sectionsRes.data ?? []) as Array<{ id: string; name: string }>;
    const templates = (templatesRes.data ?? []) as Array<{ id: string; name: string }>;
    const assignments = (assignmentsRes.data ?? []) as Array<{
      class_id: string;
      subject_template_id: string;
    }>;
    const levelClasses = (levelClassesRes.data ?? []) as Array<{
      class_id: string;
      level_id: string;
    }>;

    const classById = new Map<string, { id: string; name: string; displayName: string | null }>();
    const classIdByNameLower = new Map<string, string>();
    for (const c of classes) {
      const displayName = c.display_name ?? null;
      classById.set(c.id, { id: c.id, name: c.name, displayName });
      classIdByNameLower.set(c.name.toLowerCase(), c.id);
      if (displayName) classIdByNameLower.set(displayName.toLowerCase(), c.id);
    }

    const sectionById = new Map<string, { id: string; name: string }>();
    const sectionIdByNameLower = new Map<string, string>();
    for (const s of sections) {
      sectionById.set(s.id, { id: s.id, name: s.name });
      sectionIdByNameLower.set(s.name.toLowerCase(), s.id);
    }

    const templateById = new Map<string, { id: string; name: string }>();
    const templateIdByNameLower = new Map<string, string>();
    for (const t of templates) {
      templateById.set(t.id, { id: t.id, name: t.name });
      templateIdByNameLower.set(t.name.toLowerCase(), t.id);
    }

    const classHasAnyTemplates = new Set<string>();
    const classTemplateLinks = new Set<string>();
    for (const a of assignments) {
      classHasAnyTemplates.add(a.class_id);
      classTemplateLinks.add(`${a.class_id}::${a.subject_template_id}`);
    }

    // Expand links via level assignments:
    // level_subject_template_assignments + level_classes => treat as linked to all classes in those levels.
    const levelIds = Array.from(new Set(levelClasses.map((lc) => lc.level_id).filter(Boolean)));
    if (levelIds.length > 0) {
      const { data: levelAssignments } = await supabase
        .from('level_subject_template_assignments')
        .select('level_id, subject_template_id')
        .in('level_id', levelIds)
        .eq('branch_id', branchId);

      const templateIdsByLevelId = new Map<string, string[]>();
      for (const la of (levelAssignments ?? []) as Array<{ level_id: string; subject_template_id: string }>) {
        const list = templateIdsByLevelId.get(la.level_id) ?? [];
        list.push(la.subject_template_id);
        templateIdsByLevelId.set(la.level_id, list);
      }

      for (const lc of levelClasses) {
        const templateIds = templateIdsByLevelId.get(lc.level_id) ?? [];
        if (templateIds.length === 0) continue;
        classHasAnyTemplates.add(lc.class_id);
        for (const tid of templateIds) {
          classTemplateLinks.add(`${lc.class_id}::${tid}`);
        }
      }
    }

    return {
      classById,
      classIdByNameLower,
      sectionById,
      sectionIdByNameLower,
      templateById,
      templateIdByNameLower,
      classHasAnyTemplates,
      classTemplateLinks,
    };
  }

  private async getLevelIdsForClass(
    supabase: SupabaseClient,
    classId: string,
    branchId: string,
  ): Promise<string[]> {
    const cacheKey = `${branchId}::${classId}`;
    const cached = this.classLevelIdsCache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from('level_classes')
      .select('level_id')
      .eq('class_id', classId);
    if (error) return [];

    const ids = Array.from(
      new Set(
        ((data ?? []) as Array<{ level_id: string }>)
          .map((r) => r.level_id)
          .filter(Boolean),
      ),
    );
    this.classLevelIdsCache.set(cacheKey, ids);
    return ids;
  }

  private resolvePlacementForRowFromRefs(
    row: BulkStudentRowDto,
    refs: PlacementRefs,
  ): {
    classId: string | null;
    sectionId: string | null;
    subjectTemplateId: string | null;
    warnings: string[];
  } {
    const warnings: string[] = [];

    const classRaw = normalizeLookupValue(row.class_name_or_id ?? '');
    const sectionRaw = normalizeLookupValue(row.section_name_or_id ?? '');
    const templateRaw = normalizeLookupValue(row.subject_template_name_or_id ?? '');

    const hasClass = classRaw.length > 0;
    const hasSection = sectionRaw.length > 0;
    const hasTemplate = templateRaw.length > 0;

    let resolvedClassId: string | null = null;
    let resolvedSectionId: string | null = null;
    let resolvedTemplateId: string | null = null;

    if (hasClass) {
      if (isUuid(classRaw)) {
        resolvedClassId = refs.classById.has(classRaw) ? classRaw : null;
      } else {
        resolvedClassId = refs.classIdByNameLower.get(classRaw.toLowerCase()) ?? null;
      }
      if (!resolvedClassId) warnings.push(`Class '${row.class_name_or_id}' not found.`);
    }

    if (hasSection) {
      if (isUuid(sectionRaw)) {
        resolvedSectionId = refs.sectionById.has(sectionRaw) ? sectionRaw : null;
      } else {
        resolvedSectionId = refs.sectionIdByNameLower.get(sectionRaw.toLowerCase()) ?? null;
      }
      if (!resolvedSectionId) warnings.push(`Section '${row.section_name_or_id}' not found.`);
    }

    if (hasTemplate) {
      if (isUuid(templateRaw)) {
        resolvedTemplateId = refs.templateById.has(templateRaw) ? templateRaw : null;
      } else {
        resolvedTemplateId = refs.templateIdByNameLower.get(templateRaw.toLowerCase()) ?? null;
      }
      if (!resolvedTemplateId) {
        warnings.push(`Subject template '${row.subject_template_name_or_id}' not found.`);
      }
    }

    if (resolvedClassId) {
      const requiresTemplate = refs.classHasAnyTemplates.has(resolvedClassId);
      if (requiresTemplate && !hasTemplate) {
        warnings.push(`Subject template is required for class '${row.class_name_or_id}'.`);
      }
    }

    if (resolvedTemplateId && resolvedClassId) {
      const linked = refs.classTemplateLinks.has(`${resolvedClassId}::${resolvedTemplateId}`);
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

    if ((hasClass && !resolvedClassId) || (hasSection && !resolvedSectionId)) {
      return {
        classId: null,
        sectionId: null,
        subjectTemplateId: null,
        warnings,
      };
    }

    return {
      classId: resolvedClassId,
      sectionId: resolvedSectionId,
      subjectTemplateId: resolvedTemplateId,
      warnings,
    };
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
    const v = normalizeLookupValue(value);
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
    const v = normalizeLookupValue(value);
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
    const v = normalizeLookupValue(value);
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
    let linked = !!data;

    // Accept level-based assignment (level_subject_template_assignments + level_classes).
    if (!linked) {
      const levelIds = await this.getLevelIdsForClass(supabase, classId, branchId);
      if (levelIds.length > 0) {
        const { data: levelLink } = await supabase
          .from('level_subject_template_assignments')
          .select('level_id')
          .in('level_id', levelIds)
          .eq('subject_template_id', subjectTemplateId)
          .eq('branch_id', branchId)
          .limit(1)
          .maybeSingle();
        linked = !!levelLink;
      }
    }
    this.classTemplateLinkCache.set(cacheKey, linked);
    return linked;
  }

  /** Check if a class has any subject template assignments for branch. */
  private async classHasAnySubjectTemplates(
    supabase: SupabaseClient,
    classId: string,
    branchId: string,
  ): Promise<boolean> {
    const { data } = await supabase
      .from('class_subject_template_assignments')
      .select('id')
      .eq('class_id', classId)
      .eq('branch_id', branchId)
      .limit(1);
    if ((data ?? []).length > 0) return true;

    const levelIds = await this.getLevelIdsForClass(supabase, classId, branchId);
    if (levelIds.length === 0) return false;

    const { data: levelAssignments } = await supabase
      .from('level_subject_template_assignments')
      .select('id')
      .in('level_id', levelIds)
      .eq('branch_id', branchId)
      .limit(1);
    return (levelAssignments ?? []).length > 0;
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

    // If class has any templates configured, template becomes mandatory.
    if (resolvedClassId) {
      const requiresTemplate = await this.classHasAnySubjectTemplates(
        supabase,
        resolvedClassId,
        branchId,
      );
      if (requiresTemplate && !hasTemplate) {
        warnings.push(
          `Subject template is required for class '${row.class_name_or_id}'.`,
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

  async getSubjectTemplateHelp(
    branchId: string,
  ): Promise<{
    data: {
      templates: Array<{
        id: string;
        name: string;
        classes: Array<{ id: string; name: string; displayName?: string | null }>;
      }>;
    };
    meta: { branchId: string; branchName?: string | null; tenantName?: string | null };
  }> {
    const supabase = this.getClient();
    const { data: branchRow } = await supabase
      .from('branches')
      .select('id, name, tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    const branch = branchRow as { id: string; name?: string | null; tenant_id?: string | null } | null;
    const tenantId = branch?.tenant_id ?? null;
    const { data: tenantRow } = tenantId
      ? await supabase
          .from('tenants')
          .select('id, name')
          .eq('id', tenantId)
          .maybeSingle()
      : { data: null };
    const tenant = tenantRow as { id: string; name?: string | null } | null;

    const { data: templates, error: templatesError } = await supabase
      .from('subject_templates')
      .select('id, name')
      .eq('branch_id', branchId)
      .order('name', { ascending: true });
    if (templatesError) throw new BadRequestException(templatesError.message);

    const templateIds = (templates ?? []).map((t) => (t as { id: string }).id);
    if (templateIds.length === 0) {
      return {
        data: { templates: [] },
        meta: {
          branchId,
          branchName: branch?.name ?? null,
          tenantName: tenant?.name ?? null,
        },
      };
    }

    const { data: links, error: linksError } = await supabase
      .from('class_subject_template_assignments')
      .select('subject_template_id, class_id')
      .eq('branch_id', branchId)
      .in('subject_template_id', templateIds);
    if (linksError) throw new BadRequestException(linksError.message);

    const classIds = Array.from(
      new Set((links ?? []).map((l) => (l as { class_id: string }).class_id)),
    );

    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name, display_name')
      .eq('branch_id', branchId)
      .in('id', classIds);
    if (classesError) throw new BadRequestException(classesError.message);

    const classById = new Map(
      (classes ?? []).map((c) => {
        const row = c as { id: string; name: string; display_name?: string | null };
        return [row.id, { id: row.id, name: row.name, displayName: row.display_name ?? null }] as const;
      }),
    );

    const classesByTemplate = new Map<string, Array<{ id: string; name: string; displayName?: string | null }>>();
    for (const l of links ?? []) {
      const row = l as { subject_template_id: string; class_id: string };
      const cls = classById.get(row.class_id);
      if (!cls) continue;
      const list = classesByTemplate.get(row.subject_template_id) ?? [];
      list.push(cls);
      classesByTemplate.set(row.subject_template_id, list);
    }

    return {
      meta: {
        branchId,
        branchName: branch?.name ?? null,
        tenantName: tenant?.name ?? null,
      },
      data: {
        templates: (templates ?? []).map((t) => {
          const row = t as { id: string; name: string };
          const linkedClasses = classesByTemplate.get(row.id) ?? [];
          linkedClasses.sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name));
          return { id: row.id, name: row.name, classes: linkedClasses };
        }),
      },
    };
  }

  async parseStudentsFile(
    file: Express.Multer.File,
    branchId: string,
  ): Promise<{ data: ImportPreview }> {
    const supabase = this.getClient();
    const refs = await this.loadPlacementRefs(supabase, branchId);
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

      // Validate subject template existence/linking at preview time so users don't find out at commit.
      // Only run placement/template checks if row passed basic shape validation (avoids noisy follow-on errors).
      if (allErrors.length === 0) {
        try {
          const hasTemplate = !!dto.subject_template_name_or_id?.trim();
          const hasClass = !!dto.class_name_or_id?.trim();
          const hasSection = !!dto.section_name_or_id?.trim();
          const hasAnyPlacement =
            hasClass ||
            hasSection ||
            hasTemplate;

          if (hasAnyPlacement) {
            const placement = this.resolvePlacementForRowFromRefs(dto, refs);

            if (hasClass && !placement.classId) {
              const classIssues = (placement.warnings ?? []).filter((w) => {
                const s = String(w).toLowerCase();
                return s.startsWith('class ') && s.includes('not found');
              });
              if (classIssues.length > 0) {
                allErrors.push(...classIssues);
              }
            }

            if (hasSection && !placement.sectionId) {
              const sectionIssues = (placement.warnings ?? []).filter((w) => {
                const s = String(w).toLowerCase();
                return s.startsWith('section ') && s.includes('not found');
              });
              if (sectionIssues.length > 0) {
                allErrors.push(...sectionIssues);
              }
            }

            if (hasTemplate) {
              // If user provided a template but it can't be resolved or applied, mark row invalid.
              const templateIssues = (placement.warnings ?? []).filter((w) =>
                String(w).toLowerCase().includes('subject template'),
              );
              if (templateIssues.length > 0) {
                allErrors.push(...templateIssues);
              } else if (!placement.subjectTemplateId) {
                // Safety: no warning but still no template id (shouldn't happen).
                allErrors.push(`Subject template '${dto.subject_template_name_or_id}' not found.`);
              }
            }
          }
        } catch {
          // Non-blocking: preview should still work even if lookup fails unexpectedly.
        }
      }

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

  async validateStudentsRows(
    rows: BulkStudentRowDto[],
    branchId: string,
  ): Promise<{ data: ImportPreview }> {
    const supabase = this.getClient();
    const refs = await this.loadPlacementRefs(supabase, branchId);
    const parsedRows: ParsedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const incoming = rows[i]!;
      const rowNumber = incoming.row_number ?? i + 2;

      // Rebuild DTO to ensure transforms run consistently (and to avoid trusting client shape).
      const dto = plainToInstance(BulkStudentRowDto, {
        ...incoming,
        create_parent_account: incoming.create_parent_account ?? false,
        invitation_type: incoming.invitation_type ?? 'student',
      });

      const errors = await validate(dto);
      const fieldErrors = errors.flatMap((err) =>
        err.constraints ? Object.values(err.constraints) : [],
      );
      const extraErrors = this.appendExtraRowValidation(dto);
      const allErrors = [...fieldErrors, ...extraErrors];

      if (allErrors.length === 0) {
        const placement = this.resolvePlacementForRowFromRefs(dto, refs);

        const hasClass = !!dto.class_name_or_id?.trim();
        const hasSection = !!dto.section_name_or_id?.trim();
        const hasTemplate = !!dto.subject_template_name_or_id?.trim();

        if (hasClass && !placement.classId) {
          const classIssues = (placement.warnings ?? []).filter((w) => {
            const s = String(w).toLowerCase();
            return s.startsWith('class ') && s.includes('not found');
          });
          if (classIssues.length > 0) allErrors.push(...classIssues);
        }

        if (hasSection && !placement.sectionId) {
          const sectionIssues = (placement.warnings ?? []).filter((w) => {
            const s = String(w).toLowerCase();
            return s.startsWith('section ') && s.includes('not found');
          });
          if (sectionIssues.length > 0) allErrors.push(...sectionIssues);
        }

        if (hasTemplate) {
          const templateIssues = (placement.warnings ?? []).filter((w) =>
            String(w).toLowerCase().includes('subject template'),
          );
          if (templateIssues.length > 0) {
            allErrors.push(...templateIssues);
          } else if (!placement.subjectTemplateId) {
            allErrors.push(
              `Subject template '${dto.subject_template_name_or_id}' not found.`,
            );
          }
        } else {
          const requiredTemplateIssues = (placement.warnings ?? []).filter((w) =>
            String(w).toLowerCase().includes('subject template is required'),
          );
          if (requiredTemplateIssues.length > 0) {
            allErrors.push(...requiredTemplateIssues);
          }
        }
      }

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
        totalRows: parsedRows.length,
        validRows,
        invalidRows: parsedRows.length - validRows,
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
          if (typeof val === 'string') {
            val = normalizeSpreadsheetString(val);
          }
          if (targetField === 'date_of_birth' || targetField === 'admission_date') {
            val = this.normalizeDate(val) ?? undefined;
          }
          if (val !== undefined && val !== '') {
            mapped[targetField] = val;
          }
          break;
        }
      }
    }

    // Support combined Class–Section column in templates and hand-made sheets.
    // Accept patterns like:
    // - "Grade 1 - A"
    // - "Grade 1 / A"
    // - "Grade 1::A"
    // If the sheet also includes separate class/section columns, those take precedence.
    if (
      (mapped.class_name_or_id == null || String(mapped.class_name_or_id).trim() === '') &&
      (mapped.section_name_or_id == null || String(mapped.section_name_or_id).trim() === '')
    ) {
      const combinedRaw =
        lookup.get('class-section (optional)') ??
        lookup.get('class-section') ??
        lookup.get('class section') ??
        lookup.get('class_section') ??
        lookup.get('classsection');
      if (combinedRaw != null && String(combinedRaw).trim() !== '') {
        const cleaned = String(combinedRaw).trim();
        const parts = cleaned.split(/\s*(?:-+|\/|::)\s*/).filter(Boolean);
        if (parts.length >= 2) {
          mapped.class_name_or_id = parts[0]!;
          mapped.section_name_or_id = parts[1]!;
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
    if (val instanceof Date) {
      if (!Number.isNaN(val.getTime())) {
        return val.toISOString().slice(0, 10);
      }
      return undefined;
    }
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
    if (rows.length === 0) {
      throw new BadRequestException('No rows to import');
    }

    const supabase = this.getClient();
    const refs = await this.loadPlacementRefs(supabase, branchId);

    const prepared = rows.map((incoming, i) => {
      const rowLabel = incoming.row_number ?? i + 2;
      const dto = plainToInstance(BulkStudentRowDto, {
        ...incoming,
        create_parent_account: incoming.create_parent_account ?? false,
        invitation_type: incoming.invitation_type ?? 'student',
      });
      return { rowLabel, dto, originalIndex: i };
    });

    const rowOutcomes: ImportRowOutcome[] = [];
    const deferredDeliveries: DeferredInvitationDelivery[] = [];
    const sheetStatusByIndex = new Map<number, string>();

    // Skip rows already marked added/updated/unchanged from a prior results sheet
    const actionable: typeof prepared = [];
    for (const item of prepared) {
      if (isSkipImportStatus(item.dto.import_status)) {
        const statusLabel = String(item.dto.import_status ?? '').trim() || 'skipped';
        sheetStatusByIndex.set(item.originalIndex, statusLabel);
        rowOutcomes.push({
          row: item.rowLabel,
          username: (item.dto.username ?? '').trim(),
          studentName: `${(item.dto.first_name ?? '').trim()} ${(item.dto.last_name ?? '').trim()}`.trim(),
          status: 'skipped',
          reason: `Skipped (prior status: ${statusLabel})`,
        });
      } else {
        actionable.push(item);
      }
    }

    // Validate actionable rows (do not abort whole import — invalid → failed outcome)
    type ActionableValid = {
      rowLabel: number;
      dto: BulkStudentRowDto;
      originalIndex: number;
      loginEmail: string;
      classId?: string;
      sectionId?: string;
      subjectTemplateId?: string;
      existingStudentId?: string;
    };
    const validActionable: ActionableValid[] = [];

    for (const item of actionable) {
      const errors = await validate(item.dto);
      const fieldErrors = errors.flatMap((err) =>
        err.constraints ? Object.values(err.constraints) : [],
      );
      const allErrors = [...fieldErrors, ...this.appendExtraRowValidation(item.dto)];

      if (allErrors.length === 0) {
        const placement = this.resolvePlacementForRowFromRefs(item.dto, refs);
        const hasClass = !!item.dto.class_name_or_id?.trim();
        const hasSection = !!item.dto.section_name_or_id?.trim();
        const hasTemplate = !!item.dto.subject_template_name_or_id?.trim();

        if (hasClass && !placement.classId) {
          const classIssues = (placement.warnings ?? []).filter((w) => {
            const s = String(w).toLowerCase();
            return s.startsWith('class ') && s.includes('not found');
          });
          if (classIssues.length > 0) allErrors.push(...classIssues);
        }
        if (hasSection && !placement.sectionId) {
          const sectionIssues = (placement.warnings ?? []).filter((w) => {
            const s = String(w).toLowerCase();
            return s.startsWith('section ') && s.includes('not found');
          });
          if (sectionIssues.length > 0) allErrors.push(...sectionIssues);
        }
        if (hasTemplate) {
          const templateIssues = (placement.warnings ?? []).filter((w) =>
            String(w).toLowerCase().includes('subject template'),
          );
          if (templateIssues.length > 0) allErrors.push(...templateIssues);
          else if (!placement.subjectTemplateId) {
            allErrors.push(
              `Subject template '${item.dto.subject_template_name_or_id}' not found.`,
            );
          }
        } else {
          const requiredTemplateIssues = (placement.warnings ?? []).filter((w) =>
            String(w).toLowerCase().includes('subject template is required'),
          );
          if (requiredTemplateIssues.length > 0) allErrors.push(...requiredTemplateIssues);
        }

        if (allErrors.length === 0) {
          const loginEmail = await this.studentsService.resolveLoginEmailForUsername(
            item.dto.username,
            branchId,
          );
          validActionable.push({
            rowLabel: item.rowLabel,
            dto: item.dto,
            originalIndex: item.originalIndex,
            loginEmail,
            classId: placement.classId ?? undefined,
            sectionId: placement.sectionId ?? undefined,
            subjectTemplateId: placement.subjectTemplateId ?? undefined,
          });
          continue;
        }
      }

      const reason = allErrors.join(' ');
      // Classify as insert vs update failure after we know existence — provisional failed_insert
      rowOutcomes.push({
        row: item.rowLabel,
        username: (item.dto.username ?? '').trim(),
        studentName: `${(item.dto.first_name ?? '').trim()} ${(item.dto.last_name ?? '').trim()}`.trim(),
        status: 'failed_insert',
        reason,
      });
      sheetStatusByIndex.set(item.originalIndex, `failed: ${reason}`);
    }

    // Duplicate usernames among valid actionable only
    const usernameCounts = new Map<string, number[]>();
    for (const item of validActionable) {
      const key = item.dto.username.trim().toLowerCase();
      const list = usernameCounts.get(key) ?? [];
      list.push(item.rowLabel);
      usernameCounts.set(key, list);
    }
    const dupeUsernames = new Set(
      [...usernameCounts.entries()].filter(([, labels]) => labels.length > 1).map(([u]) => u),
    );
    const afterDupeCheck: ActionableValid[] = [];
    for (const item of validActionable) {
      const key = item.dto.username.trim().toLowerCase();
      if (dupeUsernames.has(key)) {
        const reason = `Duplicate username '${item.dto.username.trim()}' in this import sheet`;
        rowOutcomes.push({
          row: item.rowLabel,
          username: item.dto.username.trim(),
          studentName: `${item.dto.first_name.trim()} ${item.dto.last_name.trim()}`.trim(),
          loginEmail: item.loginEmail,
          status: 'failed_insert',
          reason,
        });
        sheetStatusByIndex.set(item.originalIndex, `failed: ${reason}`);
      } else {
        afterDupeCheck.push(item);
      }
    }

    const existingByEmail = await this.studentsService.findStudentsByLoginEmails(
      branchId,
      afterDupeCheck.map((i) => i.loginEmail),
    );
    const nonStudentConflicts = await this.studentsService.findNonStudentLoginEmailConflicts(
      branchId,
      afterDupeCheck.map((i) => i.loginEmail),
    );

    const toUpdate: ActionableValid[] = [];
    const toInsert: ActionableValid[] = [];

    for (const item of afterDupeCheck) {
      if (nonStudentConflicts.has(item.loginEmail)) {
        const reason =
          'Username already registered but not as a student in this branch';
        rowOutcomes.push({
          row: item.rowLabel,
          username: item.dto.username.trim(),
          studentName: `${item.dto.first_name.trim()} ${item.dto.last_name.trim()}`.trim(),
          loginEmail: item.loginEmail,
          status: 'failed_insert',
          reason,
        });
        sheetStatusByIndex.set(item.originalIndex, `failed: ${reason}`);
        continue;
      }
      const existing = existingByEmail.get(item.loginEmail);
      if (existing) {
        item.existingStudentId = existing.studentId;
        toUpdate.push(item);
      } else {
        toInsert.push(item);
      }
    }

    // Reclassify validation-failed rows that match existing students as failed_update
    const failedForClassify = rowOutcomes.filter(
      (o) => o.status === 'failed_insert' && o.username.trim() !== '',
    );
    if (failedForClassify.length > 0) {
      const emails = await Promise.all(
        failedForClassify.map(async (o) => {
          try {
            return await this.studentsService.resolveLoginEmailForUsername(
              o.username,
              branchId,
            );
          } catch {
            return null;
          }
        }),
      );
      const existingFailed = await this.studentsService.findStudentsByLoginEmails(
        branchId,
        emails.filter((e): e is string => !!e),
      );
      for (let i = 0; i < failedForClassify.length; i++) {
        const email = emails[i];
        if (email && existingFailed.has(email)) {
          failedForClassify[i]!.status = 'failed_update';
        }
      }
    }

    // Load snapshots for unchanged detection
    const snapshots = await this.loadStudentImportSnapshots(
      branchId,
      academicYearId,
      toUpdate.map((u) => u.existingStudentId!).filter(Boolean),
    );

    const UPDATE_CONCURRENCY = 4;
    type UpdateOutcome =
      | { ok: true; item: ActionableValid; unchanged: boolean }
      | { ok: false; item: ActionableValid; error: unknown };

    const updateOutcomes = await mapWithConcurrency(
      toUpdate,
      UPDATE_CONCURRENCY,
      async (item): Promise<UpdateOutcome> => {
        try {
          const snap = snapshots.get(item.existingStudentId!);
          if (snap && this.isStudentRowUnchanged(item, snap)) {
            return { ok: true, item, unchanged: true };
          }
          await this.studentsService.updateStudent(
            item.existingStudentId!,
            {
              firstName: item.dto.first_name.trim(),
              lastName: item.dto.last_name.trim(),
              phone: item.dto.phone,
              address: item.dto.address,
              dateOfBirth: item.dto.date_of_birth,
              gender: item.dto.gender as 'male' | 'female',
              classId: item.classId,
              sectionId: item.sectionId,
              bloodGroup: item.dto.blood_group,
              medicalNotes: item.dto.medical_notes,
              admissionDate: item.dto.admission_date,
              googleAccountEmail: item.dto.google_account_email,
              academicYearId,
              subjectTemplateId: item.subjectTemplateId,
            },
            branchId,
            adminUser.email,
          );
          return { ok: true, item, unchanged: false };
        } catch (error: unknown) {
          return { ok: false, item, error };
        }
      },
    );

    for (const outcome of updateOutcomes) {
      const name = `${outcome.item.dto.first_name.trim()} ${outcome.item.dto.last_name.trim()}`.trim();
      if (!outcome.ok) {
        const reason =
          outcome.error instanceof Error ? outcome.error.message : 'Unknown error during update';
        rowOutcomes.push({
          row: outcome.item.rowLabel,
          username: outcome.item.dto.username.trim(),
          studentName: name,
          loginEmail: outcome.item.loginEmail,
          status: 'failed_update',
          reason,
        });
        sheetStatusByIndex.set(outcome.item.originalIndex, `failed: ${reason}`);
        continue;
      }
      if (outcome.unchanged) {
        rowOutcomes.push({
          row: outcome.item.rowLabel,
          username: outcome.item.dto.username.trim(),
          studentName: name,
          loginEmail: outcome.item.loginEmail,
          status: 'unchanged',
        });
        sheetStatusByIndex.set(outcome.item.originalIndex, 'unchanged');
      } else {
        rowOutcomes.push({
          row: outcome.item.rowLabel,
          username: outcome.item.dto.username.trim(),
          studentName: name,
          loginEmail: outcome.item.loginEmail,
          status: 'updated',
        });
        sheetStatusByIndex.set(outcome.item.originalIndex, 'updated');
      }
    }

    const INSERT_CONCURRENCY = 3;
    type InsertOutcome =
      | {
          ok: true;
          item: ActionableValid;
          created: Awaited<ReturnType<StudentsService['createStudentWithInvitation']>>;
        }
      | { ok: false; item: ActionableValid; error: unknown };

    const insertOutcomes = await mapWithConcurrency(
      toInsert,
      INSERT_CONCURRENCY,
      async (item): Promise<InsertOutcome> => {
        try {
          const created = await this.studentsService.createStudentWithInvitation(
            {
              username: item.dto.username.trim(),
              firstName: item.dto.first_name.trim(),
              lastName: item.dto.last_name.trim(),
              classId: item.classId,
              sectionId: item.sectionId,
              phone: item.dto.phone,
              address: item.dto.address,
              dateOfBirth: item.dto.date_of_birth,
              gender: item.dto.gender,
              bloodGroup: item.dto.blood_group,
              medicalNotes: item.dto.medical_notes,
              admissionDate: item.dto.admission_date,
              googleAccountEmail: item.dto.google_account_email,
              academicYearId,
              subjectTemplateId: item.subjectTemplateId,
              invitationType: item.dto.invitation_type,
              invitationRecipientEmail: this.sanitizeSingleEmail(
                item.dto.invitation_recipient_email,
              ),
              createParentAccount: item.dto.create_parent_account,
              parentEmail: item.dto.parent_email,
              parentName: item.dto.parent_name,
              parentPhone: item.dto.parent_phone,
              parentRelationship: item.dto.parent_relationship,
            },
            branchId,
            adminUser,
            { deferInvitationDelivery: true, inviteOnlyWhenRecipientProvided: true },
          );
          return { ok: true, item, created };
        } catch (error: unknown) {
          return { ok: false, item, error };
        }
      },
    );

    for (const outcome of insertOutcomes) {
      const name = `${outcome.item.dto.first_name.trim()} ${outcome.item.dto.last_name.trim()}`.trim();
      if (!outcome.ok) {
        const reason =
          outcome.error instanceof Error ? outcome.error.message : 'Unknown error during create';
        rowOutcomes.push({
          row: outcome.item.rowLabel,
          username: outcome.item.dto.username.trim(),
          studentName: name,
          loginEmail: outcome.item.loginEmail,
          status: 'failed_insert',
          reason,
        });
        sheetStatusByIndex.set(outcome.item.originalIndex, `failed: ${reason}`);
        continue;
      }
      if (outcome.created.deferredDeliveries?.length) {
        deferredDeliveries.push(...outcome.created.deferredDeliveries);
      }
      rowOutcomes.push({
        row: outcome.item.rowLabel,
        username: outcome.item.dto.username.trim(),
        studentName: name,
        loginEmail: outcome.created.student.email ?? outcome.item.loginEmail,
        status: 'added',
        recipientEmail: outcome.created.studentInvitation?.recipientEmail,
        invitationType: outcome.created.studentInvitation?.invitationType,
        expiresAt: outcome.created.studentInvitation?.expiresAt,
        parentRecipientEmail: outcome.created.parentInvitation?.recipientEmail,
        parentExpiresAt: outcome.created.parentInvitation?.expiresAt,
      });
      sheetStatusByIndex.set(outcome.item.originalIndex, 'added');
    }

    if (deferredDeliveries.length > 0) {
      try {
        await this.studentsService.deliverDeferredInvitationEmails(
          deferredDeliveries,
          adminUser,
          branchId,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to send invitation emails';
        rowOutcomes.push({
          row: 0,
          username: '',
          studentName: '',
          status: 'failed_insert',
          reason: `Invitation emails failed after save: ${message}. Use Resend invitation if needed.`,
        });
      }
    }

    rowOutcomes.sort((a, b) => a.row - b.row);

    const added = rowOutcomes.filter((o) => o.status === 'added');
    const updated = rowOutcomes.filter((o) => o.status === 'updated');
    const unchanged = rowOutcomes.filter((o) => o.status === 'unchanged');
    const failedInserts = rowOutcomes.filter((o) => o.status === 'failed_insert');
    const failedUpdates = rowOutcomes.filter((o) => o.status === 'failed_update');
    const skipped = rowOutcomes.filter((o) => o.status === 'skipped');

    const results: ImportResult = {
      totalProcessed: prepared.length,
      createdCount: added.length,
      updatedCount: updated.length,
      unchangedCount: unchanged.length,
      failedInsertCount: failedInserts.length,
      failedUpdateCount: failedUpdates.length,
      skippedCount: skipped.length,
      successCount: added.length + updated.length + unchanged.length,
      failureCount: failedInserts.length + failedUpdates.length,
      errors: [...failedInserts, ...failedUpdates].map((o) => ({
        row: o.row,
        message: o.reason ?? 'Failed',
      })),
      rowOutcomes,
      created: [
        ...added.map((o) => ({
          row: o.row,
          username: o.username,
          studentName: o.studentName,
          loginEmail: o.loginEmail ?? '',
          recipientEmail: o.recipientEmail ?? '',
          invitationType: o.invitationType ?? 'student',
          expiresAt: o.expiresAt ?? '',
          parentRecipientEmail: o.parentRecipientEmail,
          parentExpiresAt: o.parentExpiresAt,
          action: 'created' as const,
        })),
        ...updated.map((o) => ({
          row: o.row,
          username: o.username,
          studentName: o.studentName,
          loginEmail: o.loginEmail ?? '',
          recipientEmail: '',
          invitationType: 'student' as const,
          expiresAt: '',
          action: 'updated' as const,
        })),
      ],
    };

    if (results.failureCount > 0) {
      results.resultsFile = await this.buildImportResultsWorkbook(prepared, sheetStatusByIndex);
    }

    return { data: results };
  }

  async exportStudentsForImport(
    branchId: string,
    academicYearId?: string,
  ): Promise<{
    data: {
      fileName: string;
      contentBase64: string;
      mimeType: string;
      rowCount: number;
    };
  }> {
    const rows = await this.loadStudentsAsImportRows(branchId, academicYearId);
    const ExcelJS = require('exceljs') as typeof import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');
    const headers = STUDENT_BULK_COLUMN_DEFS.map((c) => c.label);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow(
        STUDENT_BULK_COLUMN_DEFS.map((c) => {
          const v = row[c.key];
          return v == null ? '' : String(v);
        }),
      );
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      data: {
        fileName: `students-export-${stamp}.xlsx`,
        contentBase64: buffer.toString('base64'),
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        rowCount: rows.length,
      },
    };
  }

  private async buildImportResultsWorkbook(
    prepared: Array<{ rowLabel: number; dto: BulkStudentRowDto; originalIndex: number }>,
    sheetStatusByIndex: Map<number, string>,
  ): Promise<{ fileName: string; contentBase64: string; mimeType: string }> {
    const ExcelJS = require('exceljs') as typeof import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');
    const headers = [
      ...STUDENT_BULK_COLUMN_DEFS.map((c) => c.label),
      IMPORT_STATUS_COLUMN.label,
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };

    const failFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFFFC7CE' },
    };

    for (const item of prepared) {
      const status = sheetStatusByIndex.get(item.originalIndex) ?? '';
      const classSection = this.formatClassSectionForSheet(item.dto);
      const values = STUDENT_BULK_COLUMN_DEFS.map((c) => {
        if (c.key === 'class_section') return classSection;
        if (c.key === 'create_parent_account') {
          return item.dto.create_parent_account ? 'yes' : 'no';
        }
        const raw = (item.dto as unknown as Record<string, unknown>)[c.key];
        return raw == null ? '' : String(raw);
      });
      values.push(status);
      const excelRow = sheet.addRow(values);
      if (status.toLowerCase().startsWith('failed')) {
        excelRow.eachCell((cell) => {
          cell.fill = failFill;
        });
      }
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      fileName: `students-import-results-${stamp}.xlsx`,
      contentBase64: buffer.toString('base64'),
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private formatClassSectionForSheet(dto: BulkStudentRowDto): string {
    const cls = (dto.class_name_or_id ?? '').trim();
    const sec = (dto.section_name_or_id ?? '').trim();
    if (cls && sec) return `${cls} - ${sec}`;
    return cls || sec || '';
  }

  private normCmp(v: string | null | undefined): string {
    return String(v ?? '')
      .trim()
      .toLowerCase();
  }

  private isStudentRowUnchanged(
    item: {
      dto: BulkStudentRowDto;
      classId?: string;
      sectionId?: string;
      subjectTemplateId?: string;
    },
    snap: StudentImportSnapshot,
  ): boolean {
    const d = item.dto;
    return (
      this.normCmp(d.first_name) === this.normCmp(snap.firstName) &&
      this.normCmp(d.last_name) === this.normCmp(snap.lastName) &&
      this.normCmp(d.phone) === this.normCmp(snap.phone) &&
      this.normCmp(d.address) === this.normCmp(snap.address) &&
      this.normCmp(d.date_of_birth) === this.normCmp(snap.dateOfBirth) &&
      this.normCmp(d.gender) === this.normCmp(snap.gender) &&
      this.normCmp(d.blood_group) === this.normCmp(snap.bloodGroup) &&
      this.normCmp(d.medical_notes) === this.normCmp(snap.medicalNotes) &&
      this.normCmp(d.admission_date) === this.normCmp(snap.admissionDate) &&
      this.normCmp(d.google_account_email) === this.normCmp(snap.googleAccountEmail) &&
      (item.classId ?? null) === (snap.classId ?? null) &&
      (item.sectionId ?? null) === (snap.sectionId ?? null) &&
      (item.subjectTemplateId ?? null) === (snap.subjectTemplateId ?? null)
    );
  }

  private async loadStudentImportSnapshots(
    branchId: string,
    academicYearId: string,
    studentIds: string[],
  ): Promise<Map<string, StudentImportSnapshot>> {
    const map = new Map<string, StudentImportSnapshot>();
    const ids = [...new Set(studentIds.filter(Boolean))];
    if (ids.length === 0) return map;

    const supabase = this.getClient();
    const CHUNK = 100;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data: students, error } = await supabase
        .from('students')
        .select(
          'id, user_id, first_name, last_name, class_id, section_id, blood_group, medical_notes, admission_date, google_account_email',
        )
        .eq('branch_id', branchId)
        .in('id', chunk);
      if (error) throw new BadRequestException(error.message);
      const rows = (students ?? []) as Array<{
        id: string;
        user_id: string | null;
        first_name: string | null;
        last_name: string | null;
        class_id: string | null;
        section_id: string | null;
        blood_group: string | null;
        medical_notes: string | null;
        admission_date: string | null;
        google_account_email: string | null;
      }>;
      const userIds = rows.map((r) => r.user_id).filter((id): id is string => !!id);
      const profileByUser = new Map<
        string,
        { phone: string | null; address: string | null; date_of_birth: string | null; gender: string | null }
      >();
      if (userIds.length > 0) {
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('id, phone, address, date_of_birth, gender')
          .in('id', userIds);
        if (pErr) throw new BadRequestException(pErr.message);
        for (const p of (profiles ?? []) as Array<{
          id: string;
          phone: string | null;
          address: string | null;
          date_of_birth: string | null;
          gender: string | null;
        }>) {
          profileByUser.set(p.id, p);
        }
      }

      const { data: templates, error: tErr } = await supabase
        .from('student_subject_template_assignments')
        .select('student_id, subject_template_id')
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId)
        .in('student_id', chunk);
      if (tErr) throw new BadRequestException(tErr.message);
      const templateByStudent = new Map<string, string>();
      for (const t of (templates ?? []) as Array<{
        student_id: string;
        subject_template_id: string;
      }>) {
        templateByStudent.set(t.student_id, t.subject_template_id);
      }

      for (const r of rows) {
        const profile = r.user_id ? profileByUser.get(r.user_id) : undefined;
        map.set(r.id, {
          firstName: r.first_name,
          lastName: r.last_name,
          phone: profile?.phone ?? null,
          address: profile?.address ?? null,
          dateOfBirth: profile?.date_of_birth ?? null,
          gender: profile?.gender ?? null,
          bloodGroup: r.blood_group,
          medicalNotes: r.medical_notes,
          admissionDate: r.admission_date,
          googleAccountEmail: r.google_account_email,
          classId: r.class_id,
          sectionId: r.section_id,
          subjectTemplateId: templateByStudent.get(r.id) ?? null,
        });
      }
    }
    return map;
  }

  private async loadStudentsAsImportRows(
    branchId: string,
    academicYearId?: string,
  ): Promise<Record<string, string>[]> {
    const supabase = this.getClient();
    let yearId = academicYearId ?? null;
    if (!yearId) {
      const { data: active } = await supabase
        .from('academic_years')
        .select('id')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .maybeSingle();
      yearId = (active as { id: string } | null)?.id ?? null;
    }

    const { data: students, error } = await supabase
      .from('students')
      .select(
        'id, user_id, first_name, last_name, class_id, section_id, blood_group, medical_notes, admission_date, google_account_email, classes:class_id(name, display_name), sections:section_id(name)',
      )
      .eq('branch_id', branchId)
      .order('first_name', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    const rows = (students ?? []) as unknown as Array<{
      id: string;
      user_id: string | null;
      first_name: string | null;
      last_name: string | null;
      class_id: string | null;
      section_id: string | null;
      blood_group: string | null;
      medical_notes: string | null;
      admission_date: string | null;
      google_account_email: string | null;
      classes: { name: string; display_name: string | null } | null;
      sections: { name: string } | null;
    }>;

    if (rows.length === 0) return [];

    const userIds = rows.map((r) => r.user_id).filter((id): id is string => !!id);
    const profileByUser = new Map<
      string,
      {
        email: string | null;
        phone: string | null;
        address: string | null;
        date_of_birth: string | null;
        gender: string | null;
      }
    >();
    const CHUNK = 100;
    for (let i = 0; i < userIds.length; i += CHUNK) {
      const chunk = userIds.slice(i, i + CHUNK);
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, email, phone, address, date_of_birth, gender')
        .in('id', chunk);
      if (pErr) throw new BadRequestException(pErr.message);
      for (const p of (profiles ?? []) as Array<{
        id: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        date_of_birth: string | null;
        gender: string | null;
      }>) {
        profileByUser.set(p.id, p);
      }
    }

    const templateNameByStudent = new Map<string, string>();
    if (yearId) {
      const studentIds = rows.map((r) => r.id);
      for (let i = 0; i < studentIds.length; i += CHUNK) {
        const chunk = studentIds.slice(i, i + CHUNK);
        const { data: assignments, error: aErr } = await supabase
          .from('student_subject_template_assignments')
          .select('student_id, subject_template_id, subject_templates:subject_template_id(name)')
          .eq('branch_id', branchId)
          .eq('academic_year_id', yearId)
          .in('student_id', chunk);
        if (aErr) throw new BadRequestException(aErr.message);
        for (const a of (assignments ?? []) as unknown as Array<{
          student_id: string;
          subject_templates: { name: string } | { name: string }[] | null;
        }>) {
          const tpl = a.subject_templates;
          const name = Array.isArray(tpl) ? tpl[0]?.name : tpl?.name;
          if (name) templateNameByStudent.set(a.student_id, name);
        }
      }
    }

    return rows.map((r) => {
      const profile = r.user_id ? profileByUser.get(r.user_id) : undefined;
      const username = profile?.email
        ? extractUsernameFromEmail(profile.email)
        : '';
      const className =
        (r.classes?.display_name || r.classes?.name || '').trim();
      const sectionName = (r.sections?.name || '').trim();
      const classSection =
        className && sectionName
          ? `${className} - ${sectionName}`
          : className || sectionName;

      return {
        username,
        first_name: r.first_name ?? '',
        last_name: r.last_name ?? '',
        gender: profile?.gender ?? '',
        invitation_type: 'student',
        invitation_recipient_email: '',
        phone: profile?.phone ?? '',
        address: profile?.address ?? '',
        date_of_birth: profile?.date_of_birth ?? '',
        blood_group: r.blood_group ?? '',
        medical_notes: r.medical_notes ?? '',
        admission_date: r.admission_date ?? '',
        google_account_email: r.google_account_email ?? '',
        class_section: classSection,
        subject_template_name_or_id: templateNameByStudent.get(r.id) ?? '',
        create_parent_account: 'no',
        parent_email: '',
        parent_name: '',
        parent_phone: '',
        parent_relationship: '',
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Users bulk import
  // ---------------------------------------------------------------------------

  private roleLookupKey(value: string): string {
    return normalizeLookupValue(value)
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private roleCompactKey(value: string): string {
    return this.roleLookupKey(value).replace(/\s+/g, '');
  }

  private levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix: number[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => 0),
    );
    for (let i = 0; i < rows; i++) matrix[i]![0] = i;
    for (let j = 0; j < cols; j++) matrix[0]![j] = j;
    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          (matrix[i - 1]![j] ?? 0) + 1,
          (matrix[i]![j - 1] ?? 0) + 1,
          (matrix[i - 1]![j - 1] ?? 0) + cost,
        );
      }
    }
    return matrix[a.length]![b.length] ?? Math.max(a.length, b.length);
  }

  private async loadRoleLookup(supabase: SupabaseClient): Promise<RoleLookup> {
    const { data, error } = await supabase
      .from('roles')
      .select('id, name, display_name');
    if (error) throw new BadRequestException(error.message);

    const byId = new Map<string, RoleRef>();
    const byKey = new Map<string, RoleRef>();

    for (const row of (data ?? []) as Array<{
      id: string;
      name: string;
      display_name: string | null;
    }>) {
      const ref: RoleRef = {
        id: row.id,
        name: (row.name || '').trim(),
        displayName: (row.display_name || row.name || '').trim(),
      };
      byId.set(ref.id, ref);
      const keys = [ref.name, ref.displayName]
        .map((k) => this.roleLookupKey(k))
        .filter(Boolean);
      for (const key of keys) {
        if (!byKey.has(key)) byKey.set(key, ref);
      }
      // Also index compacted forms (ignore spaces) e.g. "SubjectTeacher"
      for (const key of keys) {
        const compact = key.replace(/\s+/g, '');
        if (compact && !byKey.has(compact)) byKey.set(compact, ref);
      }
    }

    return { byId, byKey };
  }

  private resolveRoleToken(
    token: string,
    roles: RoleLookup,
  ): { ref?: RoleRef; suggestion?: string } {
    const trimmed = token.trim();
    if (!trimmed) return {};

    if (isUuid(trimmed)) {
      const byUuid = roles.byId.get(trimmed);
      if (byUuid) return { ref: byUuid };
    }

    const key = this.roleLookupKey(trimmed);
    const compact = this.roleCompactKey(trimmed);
    const exact = roles.byKey.get(key) ?? roles.byKey.get(compact);
    if (exact) return { ref: exact };

    // Unique fuzzy match (typos / abbreviations) against compact keys.
    let best: RoleRef | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    let tie = false;
    for (const ref of roles.byId.values()) {
      const candidates = [
        this.roleCompactKey(ref.name),
        this.roleCompactKey(ref.displayName),
      ].filter(Boolean);
      for (const candidate of candidates) {
        const distance = this.levenshtein(compact, candidate);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = ref;
          tie = false;
        } else if (distance === bestDistance && best && best.id !== ref.id) {
          tie = true;
        }
      }
    }

    // Auto-accept only very close unique typos (e.g. extra/missing letter).
    const maxAuto =
      compact.length <= 6 ? 1 : compact.length <= 12 ? 2 : 3;
    if (best && !tie && bestDistance > 0 && bestDistance <= maxAuto) {
      return { ref: best };
    }

    const suggestion =
      best && !tie && bestDistance <= Math.max(maxAuto + 2, 4)
        ? best.displayName || best.name
        : undefined;
    return { suggestion };
  }

  private splitRoleTokens(raw: string): string[] {
    return String(raw ?? '')
      .split(/[,;|]/)
      .map((t) => normalizeLookupValue(t))
      .filter(Boolean);
  }

  private resolveRolesForRow(
    dto: BulkUserRowDto,
    roles: RoleLookup,
  ): { roleIds: string[]; roleLabels: string[]; errors: string[]; userType?: 'parent' | 'staff' } {
    const tokens = this.splitRoleTokens(dto.roles);
    if (tokens.length === 0) {
      return { roleIds: [], roleLabels: [], errors: ['At least one role is required.'] };
    }

    const roleIds: string[] = [];
    const roleLabels: string[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      const { ref, suggestion } = this.resolveRoleToken(token, roles);
      if (!ref) {
        errors.push(
          suggestion
            ? `Role '${token}' not found. Did you mean '${suggestion}'?`
            : `Role '${token}' not found. Pick a role from the list in the preview.`,
        );
        continue;
      }
      if ((ref.name || '').trim().toLowerCase() === 'student') {
        errors.push(
          `Role 'student' cannot be imported here. Use Students → Bulk Import for student accounts.`,
        );
        continue;
      }
      if (seen.has(ref.id)) continue;
      seen.add(ref.id);
      roleIds.push(ref.id);
      roleLabels.push(ref.displayName || ref.name);
    }

    if (errors.length > 0) {
      return { roleIds, roleLabels, errors };
    }

    const selectedNames = roleIds
      .map((id) => roles.byId.get(id)?.name?.trim().toLowerCase() ?? '')
      .filter(Boolean);
    const isParent = selectedNames.some((n) => PARENT_ROLE_NAMES.has(n));
    const isStaff = selectedNames.some((n) => !PARENT_ROLE_NAMES.has(n));

    if (isParent && isStaff) {
      errors.push(
        'Parent roles cannot be combined with staff roles. Please choose either parent roles or staff roles.',
      );
      return { roleIds, roleLabels, errors };
    }

    const userType: 'parent' | 'staff' = isParent ? 'parent' : 'staff';

    if (userType === 'parent') {
      if (!dto.email?.trim()) {
        errors.push('Email is required for parent users.');
      }
    } else {
      if (!dto.username?.trim()) {
        errors.push('Username is required for staff users.');
      }
      // Invitation email is optional for staff — blank defaults to school login email on create.
    }

    return { roleIds, roleLabels, errors, userType };
  }

  private mapUserColumnNames(row: Record<string, unknown>): Record<string, unknown> {
    const lookup = this.buildHeaderLookup(row);
    const mapped: Record<string, unknown> = {};
    for (const [targetField, possibleNames] of Object.entries(USER_COLUMN_MAP)) {
      for (const name of possibleNames) {
        let val = lookup.get(name.toLowerCase());
        if (val !== undefined && val !== '') {
          if (targetField === 'phone' && typeof val === 'number') {
            val = String(val);
          }
          if (typeof val === 'string') {
            val = normalizeSpreadsheetString(val);
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

    // Staff sheets often label the invitation destination simply as "Email".
    // If username is present and invitation_email is blank, reuse email as invitation_email.
    const hasUsername =
      mapped.username != null && String(mapped.username).trim() !== '';
    const hasInvitation =
      mapped.invitation_email != null && String(mapped.invitation_email).trim() !== '';
    const hasEmail = mapped.email != null && String(mapped.email).trim() !== '';
    if (hasUsername && !hasInvitation && hasEmail) {
      mapped.invitation_email = mapped.email;
      delete mapped.email;
    }

    return mapped;
  }

  private async validateUserDto(
    dto: BulkUserRowDto,
    roles: RoleLookup,
  ): Promise<{ dto: BulkUserRowDto; errors: string[] }> {
    const errors = await validate(dto);
    const fieldErrors = errors.flatMap((err) =>
      err.constraints ? Object.values(err.constraints) : [],
    );
    const roleResult = this.resolveRolesForRow(dto, roles);
    return { dto, errors: [...fieldErrors, ...roleResult.errors] };
  }

  async parseUsersFile(
    file: Express.Multer.File,
    _branchId: string,
  ): Promise<{ data: UserImportPreview }> {
    const supabase = this.getClient();
    const roles = await this.loadRoleLookup(supabase);
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
    });

    if (rawData.length === 0) {
      throw new BadRequestException('File is empty');
    }
    if (rawData.length > 5000) {
      throw new BadRequestException('File exceeds maximum 5000 rows');
    }

    const parsedRows: ParsedUserRow[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const rowNumber = i + 2;
      const mappedRow = this.mapUserColumnNames(rawData[i]!);
      const dto = plainToInstance(BulkUserRowDto, mappedRow);
      const { errors: allErrors } = await this.validateUserDto(dto, roles);

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

  async validateUsersRows(
    rows: BulkUserRowDto[],
    _branchId: string,
  ): Promise<{ data: UserImportPreview }> {
    const supabase = this.getClient();
    const roles = await this.loadRoleLookup(supabase);
    const parsedRows: ParsedUserRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const incoming = rows[i]!;
      const rowNumber = incoming.row_number ?? i + 2;
      const dto = plainToInstance(BulkUserRowDto, { ...incoming });
      const { errors: allErrors } = await this.validateUserDto(dto, roles);

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
        totalRows: parsedRows.length,
        validRows,
        invalidRows: parsedRows.length - validRows,
        rows: parsedRows,
      },
    };
  }

  async importUsers(
    rows: BulkUserRowDto[],
    branchId: string,
    adminUser: CurrentUserPayload,
    tenantId?: string | null,
  ): Promise<{ data: UserImportResult }> {
    if (rows.length === 0) {
      throw new BadRequestException('No rows to import');
    }

    const supabase = this.getClient();
    const roles = await this.loadRoleLookup(supabase);

    const prepared = rows.map((incoming, i) => {
      const rowLabel = incoming.row_number ?? i + 2;
      const dto = plainToInstance(BulkUserRowDto, { ...incoming });
      return { rowLabel, dto, originalIndex: i };
    });

    const rowOutcomes: UserImportRowOutcome[] = [];
    const deferredDeliveries: DeferredUserInvitationDelivery[] = [];
    const sheetStatusByIndex = new Map<number, string>();

    const actionable: typeof prepared = [];
    for (const item of prepared) {
      if (isSkipImportStatus(item.dto.import_status)) {
        const statusLabel = String(item.dto.import_status ?? '').trim() || 'skipped';
        sheetStatusByIndex.set(item.originalIndex, statusLabel);
        rowOutcomes.push({
          row: item.rowLabel,
          fullName: (item.dto.full_name ?? '').trim(),
          status: 'skipped',
          reason: `Skipped (prior status: ${statusLabel})`,
        });
      } else {
        actionable.push(item);
      }
    }

    type ActionableValid = {
      rowLabel: number;
      dto: BulkUserRowDto;
      originalIndex: number;
      loginEmail: string;
      userType: 'parent' | 'staff';
      roleIds: string[];
      roleLabels: string[];
      existingUserId?: string;
    };
    const validActionable: ActionableValid[] = [];

    for (const item of actionable) {
      const { errors: validationErrors } = await this.validateUserDto(item.dto, roles);
      if (validationErrors.length > 0) {
        const reason = validationErrors.join(' ');
        rowOutcomes.push({
          row: item.rowLabel,
          fullName: (item.dto.full_name ?? '').trim(),
          status: 'failed_insert',
          reason,
        });
        sheetStatusByIndex.set(item.originalIndex, `failed: ${reason}`);
        continue;
      }

      const resolved = this.resolveRolesForRow(item.dto, roles);
      if (!resolved.userType || resolved.roleIds.length === 0) {
        const reason = resolved.errors.join(' ') || 'Unable to resolve roles.';
        rowOutcomes.push({
          row: item.rowLabel,
          fullName: (item.dto.full_name ?? '').trim(),
          status: 'failed_insert',
          reason,
        });
        sheetStatusByIndex.set(item.originalIndex, `failed: ${reason}`);
        continue;
      }

      let loginEmail = '';
      try {
        if (resolved.userType === 'parent') {
          loginEmail = String(item.dto.email ?? '')
            .trim()
            .toLowerCase();
          if (!loginEmail) {
            throw new BadRequestException('Email is required for parent users');
          }
        } else {
          loginEmail = await this.usersService.resolveStaffLoginEmail(
            item.dto.username ?? '',
            branchId,
          );
        }
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : 'Unable to resolve login email';
        rowOutcomes.push({
          row: item.rowLabel,
          fullName: (item.dto.full_name ?? '').trim(),
          status: 'failed_insert',
          reason,
        });
        sheetStatusByIndex.set(item.originalIndex, `failed: ${reason}`);
        continue;
      }

      validActionable.push({
        rowLabel: item.rowLabel,
        dto: item.dto,
        originalIndex: item.originalIndex,
        loginEmail,
        userType: resolved.userType,
        roleIds: resolved.roleIds,
        roleLabels: resolved.roleLabels,
      });
    }

    const emailCounts = new Map<string, number[]>();
    for (const item of validActionable) {
      const list = emailCounts.get(item.loginEmail) ?? [];
      list.push(item.rowLabel);
      emailCounts.set(item.loginEmail, list);
    }
    const dupeEmails = new Set(
      [...emailCounts.entries()].filter(([, labels]) => labels.length > 1).map(([e]) => e),
    );
    const afterDupe: ActionableValid[] = [];
    for (const item of validActionable) {
      if (dupeEmails.has(item.loginEmail)) {
        const reason = `Duplicate login identity '${item.loginEmail}' in this import sheet`;
        rowOutcomes.push({
          row: item.rowLabel,
          fullName: item.dto.full_name.trim(),
          loginEmail: item.loginEmail,
          userType: item.userType,
          roles: item.roleLabels.join(', '),
          status: 'failed_insert',
          reason,
        });
        sheetStatusByIndex.set(item.originalIndex, `failed: ${reason}`);
      } else {
        afterDupe.push(item);
      }
    }

    const existingByEmail = await this.usersService.findUsersByLoginEmails(
      branchId,
      afterDupe.map((i) => i.loginEmail),
    );

    const toUpdate: ActionableValid[] = [];
    const toInsert: ActionableValid[] = [];
    for (const item of afterDupe) {
      const existing = existingByEmail.get(item.loginEmail);
      if (existing) {
        item.existingUserId = existing.userId;
        toUpdate.push(item);
      } else {
        toInsert.push(item);
      }
    }

    const UPDATE_CONCURRENCY = 4;
    type UpdateOutcome =
      | { ok: true; item: ActionableValid; unchanged: boolean }
      | { ok: false; item: ActionableValid; error: unknown };

    const updateOutcomes = await mapWithConcurrency(
      toUpdate,
      UPDATE_CONCURRENCY,
      async (item): Promise<UpdateOutcome> => {
        try {
          const existing = existingByEmail.get(item.loginEmail)!;
          const rolesSame =
            [...existing.roleIds].sort().join(',') ===
            [...item.roleIds].sort().join(',');
          const norm = (v: string | null | undefined) =>
            String(v ?? '')
              .trim()
              .toLowerCase();
          const unchanged =
            norm(existing.fullName) === norm(item.dto.full_name) &&
            norm(existing.phone) === norm(item.dto.phone) &&
            norm(existing.address) === norm(item.dto.address) &&
            norm(existing.dateOfBirth) === norm(item.dto.date_of_birth) &&
            norm(existing.gender) === norm(item.dto.gender) &&
            rolesSame;

          if (unchanged) {
            return { ok: true, item, unchanged: true };
          }

          await this.usersService.updateUser(
            item.existingUserId!,
            {
              fullName: item.dto.full_name.trim(),
              phone: item.dto.phone,
              address: item.dto.address,
              dateOfBirth: item.dto.date_of_birth,
              gender: item.dto.gender,
              invitationRecipientEmail: item.dto.invitation_email,
            },
            branchId,
            adminUser.email,
            tenantId,
          );
          if (!rolesSame) {
            await this.usersService.updateUserRoles(
              item.existingUserId!,
              { roleIds: item.roleIds },
              branchId,
              adminUser.email,
              tenantId,
            );
          }
          return { ok: true, item, unchanged: false };
        } catch (error: unknown) {
          return { ok: false, item, error };
        }
      },
    );

    for (const outcome of updateOutcomes) {
      if (!outcome.ok) {
        const reason =
          outcome.error instanceof Error ? outcome.error.message : 'Unknown error during update';
        rowOutcomes.push({
          row: outcome.item.rowLabel,
          fullName: outcome.item.dto.full_name.trim(),
          loginEmail: outcome.item.loginEmail,
          userType: outcome.item.userType,
          roles: outcome.item.roleLabels.join(', '),
          status: 'failed_update',
          reason,
        });
        sheetStatusByIndex.set(outcome.item.originalIndex, `failed: ${reason}`);
        continue;
      }
      if (outcome.unchanged) {
        rowOutcomes.push({
          row: outcome.item.rowLabel,
          fullName: outcome.item.dto.full_name.trim(),
          loginEmail: outcome.item.loginEmail,
          userType: outcome.item.userType,
          roles: outcome.item.roleLabels.join(', '),
          status: 'unchanged',
        });
        sheetStatusByIndex.set(outcome.item.originalIndex, 'unchanged');
      } else {
        rowOutcomes.push({
          row: outcome.item.rowLabel,
          fullName: outcome.item.dto.full_name.trim(),
          loginEmail: outcome.item.loginEmail,
          userType: outcome.item.userType,
          roles: outcome.item.roleLabels.join(', '),
          status: 'updated',
        });
        sheetStatusByIndex.set(outcome.item.originalIndex, 'updated');
      }
    }

    const INSERT_CONCURRENCY = 3;
    type InsertOutcome =
      | {
          ok: true;
          item: ActionableValid;
          created: Awaited<ReturnType<UsersService['createUser']>>;
        }
      | { ok: false; item: ActionableValid; error: unknown };

    const insertOutcomes = await mapWithConcurrency(
      toInsert,
      INSERT_CONCURRENCY,
      async (item): Promise<InsertOutcome> => {
        try {
          const created = await this.usersService.createUser(
            {
              fullName: item.dto.full_name.trim(),
              roleIds: item.roleIds,
              phone: item.dto.phone,
              address: item.dto.address,
              dateOfBirth: item.dto.date_of_birth,
              gender: item.dto.gender,
              email: item.userType === 'parent' ? item.dto.email : undefined,
              username: item.userType === 'staff' ? item.dto.username : undefined,
              invitationEmail:
                item.userType === 'staff' ? item.dto.invitation_email : undefined,
            },
            branchId,
            adminUser,
            tenantId,
            {
              deferInvitationDelivery: true,
              inviteOnlyWhenRecipientProvided: true,
            },
          );
          return { ok: true, item, created };
        } catch (error: unknown) {
          return { ok: false, item, error };
        }
      },
    );

    for (const outcome of insertOutcomes) {
      if (!outcome.ok) {
        const reason =
          outcome.error instanceof Error ? outcome.error.message : 'Unknown error during create';
        rowOutcomes.push({
          row: outcome.item.rowLabel,
          fullName: outcome.item.dto.full_name.trim(),
          loginEmail: outcome.item.loginEmail,
          userType: outcome.item.userType,
          roles: outcome.item.roleLabels.join(', '),
          status: 'failed_insert',
          reason,
        });
        sheetStatusByIndex.set(outcome.item.originalIndex, `failed: ${reason}`);
        continue;
      }
      if (outcome.created.deferredDeliveries?.length) {
        deferredDeliveries.push(...outcome.created.deferredDeliveries);
      }
      rowOutcomes.push({
        row: outcome.item.rowLabel,
        fullName: outcome.item.dto.full_name.trim(),
        loginEmail: outcome.created.email ?? outcome.item.loginEmail,
        userType: outcome.item.userType,
        roles: outcome.item.roleLabels.join(', '),
        status: 'added',
        recipientEmail:
          outcome.item.userType === 'staff'
            ? outcome.item.dto.invitation_email
            : outcome.item.dto.email,
      });
      sheetStatusByIndex.set(outcome.item.originalIndex, 'added');
    }

    if (deferredDeliveries.length > 0) {
      try {
        await this.usersService.deliverDeferredInvitationEmails(
          deferredDeliveries,
          adminUser,
          branchId,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to send invitation emails';
        rowOutcomes.push({
          row: 0,
          fullName: '',
          status: 'failed_insert',
          reason: `Invitation emails failed after save: ${message}. Use Resend invitation if needed.`,
        });
      }
    }

    rowOutcomes.sort((a, b) => a.row - b.row);

    const added = rowOutcomes.filter((o) => o.status === 'added');
    const updated = rowOutcomes.filter((o) => o.status === 'updated');
    const unchanged = rowOutcomes.filter((o) => o.status === 'unchanged');
    const failedInserts = rowOutcomes.filter((o) => o.status === 'failed_insert');
    const failedUpdates = rowOutcomes.filter((o) => o.status === 'failed_update');
    const skipped = rowOutcomes.filter((o) => o.status === 'skipped');

    const results: UserImportResult = {
      totalProcessed: prepared.length,
      createdCount: added.length,
      updatedCount: updated.length,
      unchangedCount: unchanged.length,
      failedInsertCount: failedInserts.length,
      failedUpdateCount: failedUpdates.length,
      skippedCount: skipped.length,
      successCount: added.length + updated.length + unchanged.length,
      failureCount: failedInserts.length + failedUpdates.length,
      errors: [...failedInserts, ...failedUpdates].map((o) => ({
        row: o.row,
        message: o.reason ?? 'Failed',
      })),
      rowOutcomes,
      created: added.map((o) => ({
        row: o.row,
        fullName: o.fullName,
        loginEmail: o.loginEmail ?? '',
        recipientEmail: o.recipientEmail ?? '',
        userType: o.userType ?? 'staff',
        roles: o.roles ?? '',
      })),
    };

    if (results.failureCount > 0) {
      results.resultsFile = await this.buildUserImportResultsWorkbook(
        prepared,
        sheetStatusByIndex,
      );
    }

    return { data: results };
  }

  async exportUsersForImport(branchId: string): Promise<{
    data: {
      fileName: string;
      contentBase64: string;
      mimeType: string;
      rowCount: number;
    };
  }> {
    const rows = await this.loadUsersAsImportRows(branchId);
    const ExcelJS = require('exceljs') as typeof import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');
    const headers = USER_BULK_COLUMN_DEFS.map((c) => c.label);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow(
        USER_BULK_COLUMN_DEFS.map((c) => {
          const v = row[c.key];
          return v == null ? '' : String(v);
        }),
      );
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      data: {
        fileName: `users-export-${stamp}.xlsx`,
        contentBase64: buffer.toString('base64'),
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        rowCount: rows.length,
      },
    };
  }

  private async buildUserImportResultsWorkbook(
    prepared: Array<{ rowLabel: number; dto: BulkUserRowDto; originalIndex: number }>,
    sheetStatusByIndex: Map<number, string>,
  ): Promise<{ fileName: string; contentBase64: string; mimeType: string }> {
    const ExcelJS = require('exceljs') as typeof import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');
    const headers = [
      ...USER_BULK_COLUMN_DEFS.map((c) => c.label),
      USER_IMPORT_STATUS_COLUMN.label,
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };

    const failFill = {
      type: 'pattern' as const,
      pattern: 'solid' as const,
      fgColor: { argb: 'FFFFC7CE' },
    };

    for (const item of prepared) {
      const status = sheetStatusByIndex.get(item.originalIndex) ?? '';
      const values = USER_BULK_COLUMN_DEFS.map((c) => {
        const raw = (item.dto as unknown as Record<string, unknown>)[c.key];
        return raw == null ? '' : String(raw);
      });
      values.push(status);
      const excelRow = sheet.addRow(values);
      if (status.toLowerCase().startsWith('failed')) {
        excelRow.eachCell((cell) => {
          cell.fill = failFill;
        });
      }
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      fileName: `users-import-results-${stamp}.xlsx`,
      contentBase64: buffer.toString('base64'),
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private async loadUsersAsImportRows(
    branchId: string,
  ): Promise<Record<string, string>[]> {
    const supabase = this.getClient();
    const { data: branchUsers, error: bErr } = await supabase
      .from('user_branches')
      .select('user_id')
      .eq('branch_id', branchId);
    if (bErr) throw new BadRequestException(bErr.message);
    const userIds = [
      ...new Set(
        ((branchUsers ?? []) as Array<{ user_id: string }>).map((b) => b.user_id),
      ),
    ];
    if (userIds.length === 0) return [];

    const rolesLookup = await this.loadRoleLookup(supabase);
    const CHUNK = 100;
    const out: Record<string, string>[] = [];

    for (let i = 0; i < userIds.length; i += CHUNK) {
      const chunk = userIds.slice(i, i + CHUNK);
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select(
          'id, email, full_name, phone, address, date_of_birth, gender, invitation_recipient_email',
        )
        .in('id', chunk);
      if (pErr) throw new BadRequestException(pErr.message);

      const { data: userRoles, error: rErr } = await supabase
        .from('user_roles')
        .select('user_id, role_id')
        .eq('branch_id', branchId)
        .in('user_id', chunk);
      if (rErr) throw new BadRequestException(rErr.message);

      const { data: students, error: sErr } = await supabase
        .from('students')
        .select('user_id')
        .eq('branch_id', branchId)
        .in('user_id', chunk);
      if (sErr) throw new BadRequestException(sErr.message);
      const studentUserIds = new Set(
        ((students ?? []) as Array<{ user_id: string | null }>)
          .map((s) => s.user_id)
          .filter((id): id is string => !!id),
      );

      const roleIdsByUser = new Map<string, string[]>();
      for (const ur of (userRoles ?? []) as Array<{ user_id: string; role_id: string }>) {
        const list = roleIdsByUser.get(ur.user_id) ?? [];
        list.push(ur.role_id);
        roleIdsByUser.set(ur.user_id, list);
      }

      for (const p of (profiles ?? []) as Array<{
        id: string;
        email: string | null;
        full_name: string;
        phone: string | null;
        address: string | null;
        date_of_birth: string | null;
        gender: string | null;
        invitation_recipient_email: string | null;
      }>) {
        if (studentUserIds.has(p.id)) continue;
        const roleIds = roleIdsByUser.get(p.id) ?? [];
        if (roleIds.length === 0) continue;
        const roleNames = roleIds
          .map((id) => rolesLookup.byId.get(id)?.name ?? '')
          .map((n) => n.toLowerCase());
        if (roleNames.includes('student')) continue;
        const parentUser = roleNames.some((n) => PARENT_ROLE_NAMES.has(n));
        const roleLabels = roleIds.map(
          (id) =>
            rolesLookup.byId.get(id)?.displayName ||
            rolesLookup.byId.get(id)?.name ||
            id,
        );

        const email = (p.email ?? '').trim().toLowerCase();
        const username = parentUser ? '' : email ? extractUsernameFromEmail(email) : '';
        const invite =
          !parentUser && p.invitation_recipient_email
            ? p.invitation_recipient_email
            : '';

        out.push({
          full_name: p.full_name ?? '',
          roles: roleLabels.join(', '),
          username: parentUser ? '' : username,
          invitation_email: invite,
          email: parentUser ? email : '',
          phone: p.phone ?? '',
          gender: p.gender ?? '',
          date_of_birth: p.date_of_birth ?? '',
          address: p.address ?? '',
        });
      }
    }

    out.sort((a, b) => a.full_name.localeCompare(b.full_name));
    return out;
  }
}
