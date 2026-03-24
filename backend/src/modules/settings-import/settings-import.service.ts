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

const SHEET_NAMES = {
  meta: 'meta',
  schoolInfo: 'school_info',
  academicYears: 'academic_years',
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

function normalizeDate(value: unknown): string {
  const v = asString(value);
  if (!v) return '';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (iso) return v;
  const ddmmyy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyy) {
    const day = ddmmyy[1].padStart(2, '0');
    const month = ddmmyy[2].padStart(2, '0');
    return `${ddmmyy[3]}-${month}-${day}`;
  }
  return '';
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
          { name: SHEET_NAMES.meta, columns: ['template_version', 'branch_code', 'dry_run'], sample: { template_version: '1.0', branch_code: 'MAIN', dry_run: 'true' } },
          {
            name: SHEET_NAMES.schoolInfo,
            columns: [
              'school_name',
              'domain',
              'email',
              'phone',
              'timezone',
              'fiscal_year_start',
              'vat_number',
              'branch_name',
              'branch_address',
              'branch_phone',
              'branch_email',
            ],
            sample: {
              school_name: 'NTG International School',
              domain: 'ntg.edu',
              email: 'info@ntg.edu',
              phone: '+9647700000000',
              timezone: 'Asia/Baghdad',
              fiscal_year_start: '2026-09-01',
              vat_number: '',
              branch_name: 'Main Branch',
              branch_address: 'Baghdad, Iraq',
              branch_phone: '+9647700000001',
              branch_email: 'main@ntg.edu',
            },
          },
          { name: SHEET_NAMES.academicYears, columns: ['name', 'start_date', 'end_date', 'set_active'], sample: { name: '2026-2027', start_date: '2026-09-01', end_date: '2027-06-30', set_active: 'true' } },
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

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const summaryBySheet: Record<string, SheetSummary> = {};

    const metaRows = this.readSheet(workbook, SHEET_NAMES.meta);
    const meta = metaRows[0] ?? {};
    const templateVersion = asString(meta.template_version);
    const requestedBranchCode = asString(meta.branch_code);
    if (templateVersion && templateVersion !== '1.0') {
      warnings.push(`Template version '${templateVersion}' is not current. Expected 1.0.`);
    }

    const branch = await this.branchesService.getById(branchId, 'en');
    if (requestedBranchCode && branch.code && requestedBranchCode !== branch.code) {
      errors.push({
        sheet: SHEET_NAMES.meta,
        rowNumber: 2,
        message: `branch_code '${requestedBranchCode}' does not match current branch '${branch.code}'.`,
      });
    }

    const schoolInfoRows = this.readSheet(workbook, SHEET_NAMES.schoolInfo);
    const academicYearRows = this.readSheet(workbook, SHEET_NAMES.academicYears);
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
      academicYears: this.parseAcademicYears(academicYearRows, errors),
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
    summaryBySheet[SHEET_NAMES.academicYears] = this.computeSheetSummary(
      academicYearRows.length,
      errors,
      SHEET_NAMES.academicYears,
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
          name: prepared.schoolInfo.schoolName,
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
    if (!schoolName) {
      errors.push({
        sheet: SHEET_NAMES.schoolInfo,
        rowNumber: 2,
        message: 'school_name is required',
      });
    }
    return {
      schoolName,
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
    const parsed: PreparedImport['academicYears'] = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name);
      const startDate = normalizeDate(row.start_date);
      const endDate = normalizeDate(row.end_date);
      if (!name || !startDate || !endDate) {
        errors.push({
          sheet: SHEET_NAMES.academicYears,
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

