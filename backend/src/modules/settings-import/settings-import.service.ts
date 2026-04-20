import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { CoreLookupsService } from '../core-lookups/core-lookups.service';
import { AssessmentService } from '../assessment/assessment.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { TenantsService } from '../tenants/tenants.service';
import { BranchesService } from '../branches/branches.service';
import type { PostgrestError } from '@supabase/supabase-js';

type WorkbookRow = Record<string, unknown>;

type ValidationError = {
  sheet: string;
  rowNumber: number;
  message: string;
};

type SheetSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
};

type PreparedImport = {
  token: string;
  branchId: string;
  tenantId: string | null;
  actorEmail: string;
  expiresAt: number;
  schoolInfo: {
    schoolName?: string;
    domain?: string;
    email?: string;
    phone?: string;
    timezone?: string;
    fiscalYearStart?: string;
    vatNumber?: string;
    branchName?: string;
    branchAddress?: string;
    branchPhone?: string;
    branchEmail?: string;
  };
  academicYears: Array<{
    name: string;
    startDate: string;
    endDate: string;
    setActive: boolean;
  }>;
  subjects: Array<{ name: string; nameAr?: string; code?: string }>;
  classes: Array<{ name: string; displayName: string; sortOrder: number }>;
  sections: Array<{ name: string; sortOrder: number }>;
  levels: Array<{ name: string; classNames: string[] }>;
  assessmentTypes: Array<{ name: string; nameAr?: string; sortOrder: number }>;
  leaveQuota?: { annualQuota: number };
  categories: {
    library: string[];
    inventory: string[];
  };
  summaryBySheet: Record<string, SheetSummary>;
  warnings: string[];
};

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ROWS_PER_SHEET = 5000;
const TOKEN_TTL_MS = 30 * 60 * 1000;

/** Values that must not be committed as real tenant names (template samples). */
const DISALLOWED_SCHOOL_NAME_PLACEHOLDERS = new Set(
  ['ntg international school', 'your school name', 'your school name here', 'example school'].map((s) =>
    s.toLowerCase(),
  ),
);

function isPlaceholderSchoolName(value: string | undefined): boolean {
  const n = value?.trim().toLowerCase();
  return Boolean(n && DISALLOWED_SCHOOL_NAME_PLACEHOLDERS.has(n));
}

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

const SHEET_NAMES = {
  schoolInfo: 'school_info',
  subjects: 'subjects',
  classes: 'classes',
  sections: 'sections',
  levels: 'levels',
  assessmentTypes: 'assessment_types',
  leaveQuota: 'leave_quota',
  libraryCategories: 'library_categories',
  inventoryCategories: 'inventory_categories',
} as const;

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = asString(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(asString(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateParts(year: number, month: number, day: number): string {
  const mo = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${mo}-${d}`;
}

function isValidYMD(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(year, month - 1, day);
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

/** Excel serial day (sheet cell number) → YYYY-MM-DD (UTC). */
function excelSerialToIsoDate(serial: number): string | undefined {
  if (!Number.isFinite(serial)) return undefined;
  const whole = Math.floor(serial);
  if (whole < 1 || whole > 2958465) return undefined;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return undefined;
  return formatDateParts(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
  );
}

/**
 * Workbook / Excel cell value → YYYY-MM-DD. Handles:
 * - Excel serial numbers (number or numeric string)
 * - Date objects (with cellDates in sheet_to_json)
 * - ISO dates and ISO datetimes
 * - DD/MM/YYYY, MM/DD/YYYY when unambiguous, YYYY/MM/DD, dotted forms
 * - 2-digit years
 * - Strings Date.parse accepts (e.g. locale month names)
 */
function parseFlexibleDateToIso(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return undefined;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return excelSerialToIsoDate(value);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const raw = typeof value === 'string' ? value.trim() : String(value).trim();
  if (!raw) return undefined;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n < 1000000) {
      const fromSerial = excelSerialToIsoDate(n);
      if (fromSerial) return fromSerial;
    }
  }

  let s = raw;
  if (s.includes('T')) {
    const head = s.split('T')[0];
    if (head && /^\d{4}-\d{2}-\d{2}$/.test(head)) {
      s = head;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}\s/.test(s)) {
    s = s.slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
    return isValidYMD(y, m, d) ? s : undefined;
  }

  let m = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    return isValidYMD(year, month, day) ? formatDateParts(year, month, day) : undefined;
  }

  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (a > 12) {
      return isValidYMD(year, b, a) ? formatDateParts(year, b, a) : undefined;
    }
    if (b > 12) {
      return isValidYMD(year, a, b) ? formatDateParts(year, a, b) : undefined;
    }
    if (isValidYMD(year, b, a)) return formatDateParts(year, b, a);
    if (isValidYMD(year, a, b)) return formatDateParts(year, a, b);
    return undefined;
  }

  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2})$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const yy = parseInt(m[3], 10);
    const year = yy + (yy >= 70 ? 1900 : 2000);
    if (a > 12) {
      return isValidYMD(year, b, a) ? formatDateParts(year, b, a) : undefined;
    }
    if (b > 12) {
      return isValidYMD(year, a, b) ? formatDateParts(year, a, b) : undefined;
    }
    if (isValidYMD(year, b, a)) return formatDateParts(year, b, a);
    if (isValidYMD(year, a, b)) return formatDateParts(year, a, b);
    return undefined;
  }

  const parsedMs = Date.parse(raw);
  if (!Number.isNaN(parsedMs)) {
    const d = new Date(parsedMs);
    return formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  return undefined;
}

function normalizeDate(value: unknown): string {
  return parseFlexibleDateToIso(value) ?? '';
}

@Injectable()
export class SettingsImportService {
  private readonly preparedImports = new Map<string, PreparedImport>();

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly coreLookupsService: CoreLookupsService,
    private readonly assessmentService: AssessmentService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly tenantsService: TenantsService,
    private readonly branchesService: BranchesService,
  ) {}

  async getTemplateDefinition() {
    return {
      data: {
        workbookName: 'settings-onboarding-template.xlsx',
        sheets: [
          { name: SHEET_NAMES.subjects, columns: ['name_en', 'name_ar', 'code'], sample: { name_en: 'Mathematics', name_ar: 'رياضيات', code: 'MATH' } },
          { name: SHEET_NAMES.classes, columns: ['name', 'display_name', 'sort_order'], sample: { name: 'Grade 1', display_name: 'Grade 1', sort_order: '1' } },
          { name: SHEET_NAMES.sections, columns: ['name', 'sort_order'], sample: { name: 'A', sort_order: '1' } },
          { name: SHEET_NAMES.levels, columns: ['name', 'class_names'], sample: { name: 'Primary', class_names: 'Grade 1,Grade 2,Grade 3' } },
          { name: SHEET_NAMES.assessmentTypes, columns: ['name_en', 'name_ar', 'sort_order'], sample: { name_en: 'Quiz', name_ar: 'اختبار قصير', sort_order: '1' } },
          { name: SHEET_NAMES.leaveQuota, columns: ['annual_quota'], sample: { annual_quota: '10' } },
          { name: SHEET_NAMES.libraryCategories, columns: ['category'], sample: { category: 'General Knowledge' } },
          { name: SHEET_NAMES.inventoryCategories, columns: ['category'], sample: { category: 'Uniforms' } },
        ],
      },
    };
  }

  async validateWorkbook(
    file: Express.Multer.File,
    branchId: string,
    tenantId: string | null,
    actorEmail: string,
  ) {
    this.ensureValidUpload(file);
    this.cleanupExpiredTokens();

    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
      cellDates: true,
    });
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const summaryBySheet: Record<string, SheetSummary> = {};

    const schoolInfoRows = this.readSheet(workbook, SHEET_NAMES.schoolInfo);
    const subjectRows = this.readSheet(workbook, SHEET_NAMES.subjects);
    const classRows = this.readSheet(workbook, SHEET_NAMES.classes);
    const sectionRows = this.readSheet(workbook, SHEET_NAMES.sections);
    const levelRows = this.readSheet(workbook, SHEET_NAMES.levels);
    const assessmentTypeRows = this.readSheet(workbook, SHEET_NAMES.assessmentTypes);
    const leaveQuotaRows = this.readSheet(workbook, SHEET_NAMES.leaveQuota);
    const libraryCategoryRows = this.readSheet(workbook, SHEET_NAMES.libraryCategories);
    const inventoryCategoryRows = this.readSheet(workbook, SHEET_NAMES.inventoryCategories);

    this.validateRowCap(workbook, errors);

    const prepared: PreparedImport = {
      token: randomUUID(),
      branchId,
      tenantId,
      actorEmail,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      schoolInfo: this.parseSchoolInfoRows(schoolInfoRows, errors),
      academicYears: [],
      subjects: this.parseSubjects(subjectRows, errors),
      classes: this.parseClasses(classRows, errors),
      sections: this.parseSections(sectionRows, errors),
      levels: this.parseLevels(levelRows, errors),
      assessmentTypes: this.parseAssessmentTypes(assessmentTypeRows, errors),
      leaveQuota: this.parseLeaveQuota(leaveQuotaRows, errors),
      categories: {
        library: this.parseSimpleCategories(libraryCategoryRows),
        inventory: this.parseSimpleCategories(inventoryCategoryRows),
      },
      summaryBySheet,
      warnings,
    };

    summaryBySheet[SHEET_NAMES.schoolInfo] = this.computeSheetSummary(
      schoolInfoRows.length,
      errors,
      SHEET_NAMES.schoolInfo,
    );
    summaryBySheet[SHEET_NAMES.subjects] = this.computeSheetSummary(
      subjectRows.length,
      errors,
      SHEET_NAMES.subjects,
    );
    summaryBySheet[SHEET_NAMES.classes] = this.computeSheetSummary(
      classRows.length,
      errors,
      SHEET_NAMES.classes,
    );
    summaryBySheet[SHEET_NAMES.sections] = this.computeSheetSummary(
      sectionRows.length,
      errors,
      SHEET_NAMES.sections,
    );
    summaryBySheet[SHEET_NAMES.levels] = this.computeSheetSummary(
      levelRows.length,
      errors,
      SHEET_NAMES.levels,
    );
    summaryBySheet[SHEET_NAMES.assessmentTypes] = this.computeSheetSummary(
      assessmentTypeRows.length,
      errors,
      SHEET_NAMES.assessmentTypes,
    );
    summaryBySheet[SHEET_NAMES.leaveQuota] = this.computeSheetSummary(
      leaveQuotaRows.length,
      errors,
      SHEET_NAMES.leaveQuota,
    );
    summaryBySheet[SHEET_NAMES.libraryCategories] = this.computeSheetSummary(
      libraryCategoryRows.length,
      errors,
      SHEET_NAMES.libraryCategories,
    );
    summaryBySheet[SHEET_NAMES.inventoryCategories] = this.computeSheetSummary(
      inventoryCategoryRows.length,
      errors,
      SHEET_NAMES.inventoryCategories,
    );

    if (errors.length > 0) {
      return {
        data: {
          isValid: false,
          validationToken: null,
          errors,
          warnings,
          summaryBySheet,
        },
      };
    }

    this.preparedImports.set(prepared.token, prepared);
    return {
      data: {
        isValid: true,
        validationToken: prepared.token,
        errors: [],
        warnings,
        summaryBySheet,
      },
    };
  }

  async applyValidatedImport(validationToken: string) {
    this.cleanupExpiredTokens();
    const prepared = this.preparedImports.get(validationToken);
    if (!prepared) {
      throw new NotFoundException('Validation token is invalid or expired');
    }

    const supabase = this.supabaseConfig.getClient();
    const initKey = `settings_initialized:${prepared.branchId}`;
    const { data: existingInitFlag, error: initFlagError } = await supabase
      .from('system_settings')
      .select('key')
      .eq('key', initKey)
      .maybeSingle();
    if (initFlagError) {
      throw new BadRequestException(initFlagError.message);
    }
    if (existingInitFlag) {
      throw new BadRequestException(
        'Bulk setup has already been completed for this branch. Use Settings tabs for further changes.',
      );
    }

    const created: Record<string, number> = {
      academicYears: 0,
      subjects: 0,
      classes: 0,
      sections: 0,
      levels: 0,
      assessmentTypes: 0,
      libraryCategories: prepared.categories.library.length,
      inventoryCategories: prepared.categories.inventory.length,
    };

    if (Object.keys(prepared.schoolInfo).length > 0) {
      await this.tenantsService.updateMe(
        prepared.tenantId,
        {
          ...(isPlaceholderSchoolName(prepared.schoolInfo.schoolName)
            ? {}
            : { name: prepared.schoolInfo.schoolName }),
          domain: prepared.schoolInfo.domain,
          email: prepared.schoolInfo.email,
          phone: prepared.schoolInfo.phone,
          timezone: prepared.schoolInfo.timezone,
          fiscalYearStart: prepared.schoolInfo.fiscalYearStart,
          vatNumber: prepared.schoolInfo.vatNumber,
        },
        prepared.actorEmail,
      );

      if (
        prepared.schoolInfo.branchName ||
        prepared.schoolInfo.branchAddress ||
        prepared.schoolInfo.branchPhone ||
        prepared.schoolInfo.branchEmail
      ) {
        await this.branchesService.update(
          prepared.branchId,
          {
            name: prepared.schoolInfo.branchName,
            address: prepared.schoolInfo.branchAddress,
            phone: prepared.schoolInfo.branchPhone,
            email: prepared.schoolInfo.branchEmail,
          },
          prepared.actorEmail,
        );
      }
    }

    let activeAcademicYearId: string | null = null;
    for (const row of prepared.academicYears) {
      const createdYear = await this.academicYearsService.create(
        {
          name: row.name,
          startDate: row.startDate,
          endDate: row.endDate,
        },
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.academicYears += 1;
      if (row.setActive) {
        const active = await this.academicYearsService.activate(
          createdYear.id,
          prepared.tenantId,
          prepared.actorEmail,
        );
        activeAcademicYearId = active.id;
      }
    }

    const classIdByName = new Map<string, string>();
    for (const row of prepared.subjects) {
      await this.coreLookupsService.createSubject(
        {
          name: row.name,
          nameAr: row.nameAr,
          code: row.code,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.subjects += 1;
    }

    for (const row of prepared.classes) {
      const createdClass = await this.coreLookupsService.createClass(
        {
          name: row.name,
          displayName: row.displayName,
          sortOrder: row.sortOrder,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.classes += 1;
      classIdByName.set(row.name.toLowerCase(), createdClass.id);
      classIdByName.set(row.displayName.toLowerCase(), createdClass.id);
    }

    for (const row of prepared.sections) {
      await this.coreLookupsService.createSection(
        {
          name: row.name,
          sortOrder: row.sortOrder,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.sections += 1;
    }

    for (const row of prepared.levels) {
      const classIds = row.classNames
        .map((n) => classIdByName.get(n.toLowerCase()))
        .filter((v): v is string => !!v);
      await this.coreLookupsService.createLevel(
        {
          name: row.name,
          classIds,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.levels += 1;
    }

    for (const row of prepared.assessmentTypes) {
      await this.assessmentService.createAssessmentType(
        {
          name: row.name,
          nameAr: row.nameAr,
          sortOrder: row.sortOrder,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.assessmentTypes += 1;
    }

    if (prepared.leaveQuota) {
      if (!activeAcademicYearId) {
        const activeYear = await this.academicYearsService.getActive(prepared.tenantId);
        activeAcademicYearId = activeYear?.id ?? null;
      }
      if (!activeAcademicYearId) {
        throw new BadRequestException('Leave quota requires an active academic year');
      }
      await this.assessmentService.setLeaveQuota(
        activeAcademicYearId,
        prepared.leaveQuota.annualQuota,
        prepared.actorEmail,
        prepared.branchId,
        prepared.tenantId,
      );
    }

    if (prepared.categories.library.length > 0) {
      await this.systemSettingsService.upsert('library_categories', prepared.categories.library);
    }
    if (prepared.categories.inventory.length > 0) {
      await this.systemSettingsService.upsert('inventory_categories', prepared.categories.inventory);
    }

    // Seed default permissions so Settings → Permissions matrix is populated after bulk setup.
    // Must match Setup Wizard behaviour (view/edit/none matrix per role + school_admin edit-all).
    await this.seedWizardDefaultPermissionsIfMissing(prepared.branchId, prepared.actorEmail);

    // Mark setup as completed for this branch so Settings opens full tabbed view
    // even when optional domains (e.g. schedule/permissions) are intentionally deferred.
    await this.systemSettingsService.upsert(
      initKey,
      { source: 'settings-import', completedAt: new Date().toISOString() },
    );

    this.preparedImports.delete(validationToken);
    return {
      data: {
        applied: true,
        created,
      },
    };
  }

  private async seedWizardDefaultPermissionsIfMissing(branchId: string, userEmail: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('role_permissions')
      .select('id')
      .eq('branch_id', branchId)
      .limit(1);
    throwIfDbError(existingError);
    if ((existing?.length ?? 0) > 0) return;

    const { error } = await supabase.rpc('seed_default_role_permissions', {
      p_branch_id: branchId,
      p_user_email: userEmail,
    });
    throwIfDbError(error);
  }

  private ensureValidUpload(file: Express.Multer.File | undefined): void {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only Excel (.xlsx, .xls) files are allowed');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }
  }

  private readSheet(workbook: XLSX.WorkBook, sheetName: string): WorkbookRow[] {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' }) as WorkbookRow[];
  }

  private validateRowCap(workbook: XLSX.WorkBook, errors: ValidationError[]) {
    for (const sheetName of workbook.SheetNames) {
      const rows = this.readSheet(workbook, sheetName);
      if (rows.length > MAX_ROWS_PER_SHEET) {
        errors.push({
          sheet: sheetName,
          rowNumber: 1,
          message: `Sheet exceeds ${MAX_ROWS_PER_SHEET} rows`,
        });
      }
    }
  }

  private parseSchoolInfoRows(rows: WorkbookRow[], errors: ValidationError[]) {
    if (rows.length === 0) return {};
    const row = rows[0];
    const schoolName = asString(row.school_name);
    // School / tenant details are captured during signup. This sheet is optional and only used
    // to override fields intentionally during bulk setup.
    if (schoolName && isPlaceholderSchoolName(schoolName)) {
      errors.push({
        sheet: SHEET_NAMES.schoolInfo,
        rowNumber: 2,
        message:
          'school_name must be your real organisation name. Replace the template example before importing.',
      });
    }
    return {
      schoolName: schoolName || undefined,
      domain: asString(row.domain) || undefined,
      email: asString(row.email) || undefined,
      phone: asString(row.phone) || undefined,
      timezone: asString(row.timezone) || undefined,
      fiscalYearStart: normalizeDate(row.fiscal_year_start) || undefined,
      vatNumber: asString(row.vat_number) || undefined,
      branchName: asString(row.branch_name) || undefined,
      branchAddress: asString(row.branch_address) || undefined,
      branchPhone: asString(row.branch_phone) || undefined,
      branchEmail: asString(row.branch_email) || undefined,
    };
  }

  private parseAcademicYears(rows: WorkbookRow[], errors: ValidationError[]) {
    // Academic years are managed elsewhere in the setup flow.
    // We keep this parser only for backwards compatibility if someone uploads an older template.
    // When the sheet is absent (new template), caller should pass an empty array.
    const parsed: PreparedImport['academicYears'] = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name);
      const startDate = normalizeDate(row.start_date);
      const endDate = normalizeDate(row.end_date);
      if (!name || !startDate || !endDate) {
        errors.push({
          sheet: 'academic_years',
          rowNumber,
          message: 'name, start_date and end_date are required',
        });
        return;
      }
      parsed.push({
        name,
        startDate,
        endDate,
        setActive: asBoolean(row.set_active),
      });
    });
    return parsed;
  }

  private parseSubjects(rows: WorkbookRow[], errors: ValidationError[]) {
    const seenCodes = new Set<string>();
    const parsed: PreparedImport['subjects'] = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name_en) || asString(row.name_ar);
      const code = asString(row.code);
      if (!name) {
        errors.push({
          sheet: SHEET_NAMES.subjects,
          rowNumber,
          message: 'name_en or name_ar is required',
        });
        return;
      }
      if (code && seenCodes.has(code.toLowerCase())) {
        errors.push({
          sheet: SHEET_NAMES.subjects,
          rowNumber,
          message: `Duplicate subject code '${code}'`,
        });
        return;
      }
      if (code) seenCodes.add(code.toLowerCase());
      parsed.push({
        name,
        nameAr: asString(row.name_ar) || undefined,
        code: code || undefined,
      });
    });
    return parsed;
  }

  private parseClasses(rows: WorkbookRow[], errors: ValidationError[]) {
    const parsed: PreparedImport['classes'] = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name);
      const displayName = asString(row.display_name) || name;
      if (!name) {
        errors.push({
          sheet: SHEET_NAMES.classes,
          rowNumber,
          message: 'name is required',
        });
        return;
      }
      parsed.push({
        name,
        displayName,
        sortOrder: asNumber(row.sort_order, index + 1),
      });
    });
    return parsed;
  }

  private parseSections(rows: WorkbookRow[], errors: ValidationError[]) {
    const parsed: PreparedImport['sections'] = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name);
      if (!name) {
        errors.push({
          sheet: SHEET_NAMES.sections,
          rowNumber,
          message: 'name is required',
        });
        return;
      }
      parsed.push({
        name,
        sortOrder: asNumber(row.sort_order, index + 1),
      });
    });
    return parsed;
  }

  private parseLevels(rows: WorkbookRow[], errors: ValidationError[]) {
    const parsed: PreparedImport['levels'] = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name);
      const classNames = asString(row.class_names)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (!name || classNames.length === 0) {
        errors.push({
          sheet: SHEET_NAMES.levels,
          rowNumber,
          message: 'name and class_names are required',
        });
        return;
      }
      parsed.push({ name, classNames });
    });
    return parsed;
  }

  private parseAssessmentTypes(rows: WorkbookRow[], errors: ValidationError[]) {
    const parsed: PreparedImport['assessmentTypes'] = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name_en) || asString(row.name_ar);
      if (!name) {
        errors.push({
          sheet: SHEET_NAMES.assessmentTypes,
          rowNumber,
          message: 'name_en or name_ar is required',
        });
        return;
      }
      parsed.push({
        name,
        nameAr: asString(row.name_ar) || undefined,
        sortOrder: asNumber(row.sort_order, index + 1),
      });
    });
    return parsed;
  }

  private parseLeaveQuota(rows: WorkbookRow[], errors: ValidationError[]) {
    if (rows.length === 0) return undefined;
    const row = rows[0];
    const annualQuota = asNumber(row.annual_quota, -1);
    if (annualQuota < 0) {
      errors.push({
        sheet: SHEET_NAMES.leaveQuota,
        rowNumber: 2,
        message: 'annual_quota must be 0 or greater',
      });
      return undefined;
    }
    return { annualQuota };
  }

  private parseSimpleCategories(rows: WorkbookRow[]): string[] {
    return Array.from(
      new Set(
        rows
          .map((r) => asString(r.category))
          .filter(Boolean),
      ),
    );
  }

  private computeSheetSummary(totalRows: number, errors: ValidationError[], sheet: string): SheetSummary {
    const invalidRows = new Set(
      errors.filter((e) => e.sheet === sheet).map((e) => e.rowNumber),
    ).size;
    return {
      totalRows,
      validRows: Math.max(0, totalRows - invalidRows),
      invalidRows,
    };
  }

  private cleanupExpiredTokens() {
    const now = Date.now();
    for (const [token, payload] of this.preparedImports.entries()) {
      if (payload.expiresAt <= now) {
        this.preparedImports.delete(token);
      }
    }
  }
}

