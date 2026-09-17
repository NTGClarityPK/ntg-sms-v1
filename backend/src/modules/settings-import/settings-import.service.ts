import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { randomUUID } from 'crypto';
import {
  DEFAULT_BEHAVIOURAL_ASSESSMENT_VALUE,
  DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES,
} from '../../common/constants/default-behavioral-attributes';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { CoreLookupsService } from '../core-lookups/core-lookups.service';
import { AssessmentService } from '../assessment/assessment.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { TenantsService } from '../tenants/tenants.service';
import { BranchesService } from '../branches/branches.service';
import { SubjectTemplatesService } from '../subject-templates/subject-templates.service';
import { ScheduleService } from '../schedule/schedule.service';
import { ClassSectionsService } from '../class-sections/class-sections.service';
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

type TranslatedEntity = {
  name: string;
  nameAr?: string;
  nameTranslations: Record<string, string>;
  code?: string;
  sortOrder?: number;
  isTermExamination?: boolean;
};

type SubjectTemplateImportRow = {
  name: string;
  description?: string;
  subjectRefs: string[];
  assignMode: 'classes' | 'levels';
  assignNames: string[];
};

type ClassImportRow = {
  name: string;
  displayName: string;
  sortOrder: number;
  /** Optional section names → class × section combos for the active academic year. */
  sectionNames: string[];
};

type TimingTemplateImportRow = {
  name: string;
  startTime: string;
  endTime: string;
  periodDurationMinutes: number;
  assignedClassNames: string[];
};

type TimingSlotImportRow = {
  templateName: string;
  slotName: string;
  startTime?: string;
  endTime?: string;
  sortOrder: number;
};

type GradeTemplateImportRow = {
  name: string;
  assignedClassNames: string[];
  minimumPassingGrade: string;
};

type GradeRangeImportRow = {
  templateName: string;
  letter: string;
  minPercentage: number;
  maxPercentage: number;
  sortOrder: number;
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
  subjects: TranslatedEntity[];
  classes: ClassImportRow[];
  sections: Array<{ name: string; sortOrder: number }>;
  levels: Array<{ name: string; classNames: string[] }>;
  assessmentTypes: TranslatedEntity[];
  subjectTemplates: SubjectTemplateImportRow[];
  schoolDays: number[];
  timingTemplates: TimingTemplateImportRow[];
  timingSlots: TimingSlotImportRow[];
  gradeTemplates: GradeTemplateImportRow[];
  gradeRanges: GradeRangeImportRow[];
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

const DISALLOWED_SCHOOL_NAME_PLACEHOLDERS = new Set(
  ['ntg international school', 'your school name', 'your school name here', 'example school'].map((s) =>
    s.toLowerCase(),
  ),
);

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

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
  levels: 'levels',
  assessmentTypes: 'assessment_types',
  subjectTemplates: 'subject_templates',
  schoolDays: 'school_days',
  timingTemplates: 'timing_templates',
  timingSlots: 'timing_slots',
  gradeTemplates: 'grade_templates',
  gradeRanges: 'grade_ranges',
} as const;

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = asString(value).toLowerCase();
  return (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes' ||
    normalized === 'y'
  );
}

/** Strict Y/N (also accepts yes/no/true/false/1/0). Returns null when blank/invalid. */
function asYesNo(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const normalized = asString(value).toLowerCase();
  if (!normalized) return null;
  if (normalized === 'y' || normalized === 'yes' || normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'n' || normalized === 'no' || normalized === 'false' || normalized === '0') {
    return false;
  }
  return null;
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

function excelSerialToIsoDate(serial: number): string | undefined {
  if (!Number.isFinite(serial)) return undefined;
  const whole = Math.floor(serial);
  if (whole < 1 || whole > 2958465) return undefined;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return undefined;
  return formatDateParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

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

function normalizeLangCode(raw: string): string {
  const v = raw.trim().toLowerCase().replace(/_/g, '-');
  if (!v) return 'en';
  if (v === 'en' || v === 'eng' || v === 'english') return 'en';
  if (v === 'en-gb' || v === 'engb') return 'en-GB';
  if (v === 'en-us' || v === 'enus') return 'en-US';
  if (v === 'ar' || v === 'ara' || v === 'arabic') return 'ar';
  if (v.includes('-')) {
    const [base, region, ...rest] = v.split('-');
    if (!region || rest.length > 0) return v;
    return `${base}-${region.toUpperCase()}`;
  }
  return v;
}

function pickPrimaryName(translations: Record<string, string>): string {
  const preferred = ['en-GB', 'en-US', 'en', 'ar'];
  for (const key of preferred) {
    const value = translations[key]?.trim();
    if (value) return value;
  }
  const first = Object.values(translations).find((v) => v.trim().length > 0);
  return first?.trim() ?? '';
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function hasLegacyNameColumns(row: WorkbookRow): boolean {
  return Boolean(asString(row.name_en) || asString(row.name_ar));
}

/** Accept HH:MM or HH:MM:SS → HH:MM:SS */
function normalizeTime(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return undefined;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const ss = Number(match[3] ?? '0');
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return undefined;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function parseDayOfWeek(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }
  const raw = asString(value).toLowerCase();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n >= 0 && n <= 6 ? n : null;
  }
  return DAY_NAME_TO_NUMBER[raw] ?? null;
}

type TranslationGroupDraft = {
  code?: string;
  translations: Record<string, string>;
  sortOrder?: number;
  isTermExamination?: boolean;
  firstRowNumber: number;
};

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
    private readonly subjectTemplatesService: SubjectTemplatesService,
    private readonly scheduleService: ScheduleService,
    private readonly classSectionsService: ClassSectionsService,
  ) {}

  async getTemplateDefinition() {
    return {
      data: {
        workbookName: 'settings-onboarding-template.xlsx',
        sheets: [
          {
            name: SHEET_NAMES.subjects,
            columns: ['name', 'code', 'lang_code'],
            sample: { name: 'Mathematics', code: 'MATH', lang_code: 'EN' },
            samples: [
              { name: 'Mathematics', code: 'MATH', lang_code: 'EN' },
              { name: 'رياضيات', code: 'MATH', lang_code: 'AR' },
              { name: 'English', code: 'ENG', lang_code: 'EN' },
            ],
          },
          {
            name: SHEET_NAMES.classes,
            columns: ['name', 'display_name', 'sort_order', 'section_names'],
            sample: {
              name: 'Grade 1',
              display_name: 'Grade 1',
              sort_order: '1',
              section_names: 'A,B',
            },
            samples: [
              {
                name: 'Grade 1',
                display_name: 'Grade 1',
                sort_order: '1',
                section_names: 'A,B',
              },
              {
                name: 'Grade 2',
                display_name: 'Grade 2',
                sort_order: '2',
                section_names: 'A,B',
              },
            ],
          },
          {
            name: SHEET_NAMES.levels,
            columns: ['name', 'class_names'],
            sample: { name: 'Primary', class_names: 'Grade 1,Grade 2' },
          },
          {
            name: SHEET_NAMES.assessmentTypes,
            columns: ['name', 'code', 'lang_code', 'sort_order', 'is_term_examination'],
            sample: {
              name: 'Mid Term',
              code: 'MID',
              lang_code: 'EN',
              sort_order: '1',
              is_term_examination: 'yes',
            },
            samples: [
              {
                name: 'Mid Term',
                code: 'MID',
                lang_code: 'EN',
                sort_order: '1',
                is_term_examination: 'yes',
              },
              {
                name: 'Final',
                code: 'FINAL',
                lang_code: 'EN',
                sort_order: '2',
                is_term_examination: 'yes',
              },
              {
                name: 'Quiz',
                code: 'QUIZ',
                lang_code: 'EN',
                sort_order: '3',
                is_term_examination: 'no',
              },
            ],
          },
          {
            name: SHEET_NAMES.subjectTemplates,
            columns: ['name', 'description', 'subject_names', 'assign_mode', 'assign_names'],
            sample: {
              name: 'Primary Core',
              description: 'Core subjects for primary classes',
              subject_names: 'MATH,ENG',
              assign_mode: 'classes',
              assign_names: 'Grade 1,Grade 2',
            },
          },
          {
            name: SHEET_NAMES.schoolDays,
            columns: ['day', 'active'],
            sample: { day: 'Monday', active: 'Y' },
            samples: [
              { day: 'Sunday', active: 'N' },
              { day: 'Monday', active: 'Y' },
              { day: 'Tuesday', active: 'Y' },
              { day: 'Wednesday', active: 'Y' },
              { day: 'Thursday', active: 'Y' },
              { day: 'Friday', active: 'Y' },
              { day: 'Saturday', active: 'N' },
            ],
          },
          {
            name: SHEET_NAMES.timingTemplates,
            columns: [
              'name',
              'start_time',
              'end_time',
              'period_duration_minutes',
              'assigned_class_names',
            ],
            sample: {
              name: 'Primary Day',
              start_time: '07:30',
              end_time: '14:00',
              period_duration_minutes: '40',
              assigned_class_names: 'Grade 1,Grade 2',
            },
          },
          {
            name: SHEET_NAMES.timingSlots,
            columns: ['template_name', 'slot_name', 'start_time', 'end_time', 'sort_order'],
            sample: {
              template_name: 'Primary Day',
              slot_name: 'Break',
              start_time: '10:00',
              end_time: '10:20',
              sort_order: '1',
            },
            samples: [
              {
                template_name: 'Primary Day',
                slot_name: 'Break',
                start_time: '10:00',
                end_time: '10:20',
                sort_order: '1',
              },
              {
                template_name: 'Primary Day',
                slot_name: 'Lunch',
                start_time: '12:00',
                end_time: '12:40',
                sort_order: '2',
              },
            ],
          },
          {
            name: SHEET_NAMES.gradeTemplates,
            columns: ['name', 'assigned_class_names', 'minimum_passing_grade'],
            sample: {
              name: 'Primary Grades',
              assigned_class_names: 'Grade 1,Grade 2',
              minimum_passing_grade: 'D',
            },
          },
          {
            name: SHEET_NAMES.gradeRanges,
            columns: ['template_name', 'letter', 'min_percentage', 'max_percentage', 'sort_order'],
            sample: {
              template_name: 'Primary Grades',
              letter: 'A',
              min_percentage: '80',
              max_percentage: '100',
              sort_order: '1',
            },
            samples: [
              {
                template_name: 'Primary Grades',
                letter: 'A',
                min_percentage: '80',
                max_percentage: '100',
                sort_order: '1',
              },
              {
                template_name: 'Primary Grades',
                letter: 'B',
                min_percentage: '65',
                max_percentage: '79',
                sort_order: '2',
              },
              {
                template_name: 'Primary Grades',
                letter: 'C',
                min_percentage: '50',
                max_percentage: '64',
                sort_order: '3',
              },
              {
                template_name: 'Primary Grades',
                letter: 'D',
                min_percentage: '40',
                max_percentage: '49',
                sort_order: '4',
              },
              {
                template_name: 'Primary Grades',
                letter: 'F',
                min_percentage: '0',
                max_percentage: '39',
                sort_order: '5',
              },
            ],
          },
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

    if (
      workbook.SheetNames.includes('leave_quota') ||
      workbook.SheetNames.includes('library_categories') ||
      workbook.SheetNames.includes('inventory_categories') ||
      workbook.SheetNames.includes('behavioral_attributes') ||
      workbook.SheetNames.includes('sections')
    ) {
      warnings.push(
        'Sheets leave_quota, library_categories, inventory_categories, behavioral_attributes, and sections are no longer used by bulk setup and will be ignored. Sections are taken from classes.section_names.',
      );
    }

    const schoolInfoRows = this.readSheet(workbook, SHEET_NAMES.schoolInfo);
    const subjectRows = this.readSheet(workbook, SHEET_NAMES.subjects);
    const classRows = this.readSheet(workbook, SHEET_NAMES.classes);
    const levelRows = this.readSheet(workbook, SHEET_NAMES.levels);
    const assessmentTypeRows = this.readSheet(workbook, SHEET_NAMES.assessmentTypes);
    const subjectTemplateRows = this.readSheet(workbook, SHEET_NAMES.subjectTemplates);
    const schoolDayRows = this.readSheet(workbook, SHEET_NAMES.schoolDays);
    const timingTemplateRows = this.readSheet(workbook, SHEET_NAMES.timingTemplates);
    const timingSlotRows = this.readSheet(workbook, SHEET_NAMES.timingSlots);
    const gradeTemplateRows = this.readSheet(workbook, SHEET_NAMES.gradeTemplates);
    const gradeRangeRows = this.readSheet(workbook, SHEET_NAMES.gradeRanges);

    this.validateRowCap(workbook, errors);

    const subjects = this.parseTranslatedEntities(subjectRows, errors, {
      sheet: SHEET_NAMES.subjects,
      includeSortOrder: false,
      codeIsStored: true,
      includeTermExamination: false,
    });
    const assessmentTypes = this.parseTranslatedEntities(assessmentTypeRows, errors, {
      sheet: SHEET_NAMES.assessmentTypes,
      includeSortOrder: true,
      codeIsStored: false,
      includeTermExamination: true,
    });
    if (assessmentTypes.length > 0) {
      const termCount = assessmentTypes.filter((a) => a.isTermExamination).length;
      if (termCount < 2) {
        errors.push({
          sheet: SHEET_NAMES.assessmentTypes,
          rowNumber: 1,
          message: 'At least two assessment types must have is_term_examination = yes',
        });
      }
    }

    const classes = this.parseClasses(classRows, errors);
    const sections = this.deriveSectionsFromClasses(classes);
    const levels = this.parseLevels(levelRows, errors, classes);
    const subjectTemplates = this.parseSubjectTemplates(subjectTemplateRows, errors, {
      subjects,
      classes,
      levels,
    });
    const schoolDays = this.parseSchoolDays(schoolDayRows, errors);
    const timingTemplates = this.parseTimingTemplates(timingTemplateRows, errors, classes);
    const timingSlots = this.parseTimingSlots(timingSlotRows, errors, timingTemplates);
    const gradeTemplates = this.parseGradeTemplates(gradeTemplateRows, errors, classes);
    const gradeRanges = this.parseGradeRanges(gradeRangeRows, errors, gradeTemplates);

    const needsClassSections = classes.some((c) => c.sectionNames.length > 0);
    if (needsClassSections) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        errors.push({
          sheet: SHEET_NAMES.classes,
          rowNumber: 1,
          message:
            'section_names requires an active academic year for this campus before class × section combinations can be created',
        });
      }
    }

    const prepared: PreparedImport = {
      token: randomUUID(),
      branchId,
      tenantId,
      actorEmail,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      schoolInfo: this.parseSchoolInfoRows(schoolInfoRows, errors),
      academicYears: [],
      subjects,
      classes,
      sections,
      levels,
      assessmentTypes,
      subjectTemplates,
      schoolDays,
      timingTemplates,
      timingSlots,
      gradeTemplates,
      gradeRanges,
      summaryBySheet,
      warnings,
    };

    const sheetRowCounts: Array<[string, number]> = [
      [SHEET_NAMES.schoolInfo, schoolInfoRows.length],
      [SHEET_NAMES.subjects, subjectRows.length],
      [SHEET_NAMES.classes, classRows.length],
      [SHEET_NAMES.levels, levelRows.length],
      [SHEET_NAMES.assessmentTypes, assessmentTypeRows.length],
      [SHEET_NAMES.subjectTemplates, subjectTemplateRows.length],
      [SHEET_NAMES.schoolDays, schoolDayRows.length],
      [SHEET_NAMES.timingTemplates, timingTemplateRows.length],
      [SHEET_NAMES.timingSlots, timingSlotRows.length],
      [SHEET_NAMES.gradeTemplates, gradeTemplateRows.length],
      [SHEET_NAMES.gradeRanges, gradeRangeRows.length],
    ];
    for (const [sheet, totalRows] of sheetRowCounts) {
      summaryBySheet[sheet] = this.computeSheetSummary(totalRows, errors, sheet);
    }

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
      subjectTemplates: 0,
      schoolDays: 0,
      timingTemplates: 0,
      timingSlots: 0,
      gradeTemplates: 0,
      gradeRanges: 0,
      classSections: 0,
      behavioralAssessment: 1,
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
        await this.academicYearsService.activate(
          createdYear.id,
          prepared.tenantId,
          prepared.actorEmail,
        );
      }
    }

    const subjectIdByCode = new Map<string, string>();
    const subjectIdByName = new Map<string, string>();
    for (const row of prepared.subjects) {
      const createdSubject = await this.coreLookupsService.createSubject(
        {
          name: row.name,
          nameAr: row.nameAr,
          name_translations: row.nameTranslations,
          code: row.code,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.subjects += 1;
      if (row.code) subjectIdByCode.set(row.code.toLowerCase(), createdSubject.id);
      subjectIdByName.set(row.name.toLowerCase(), createdSubject.id);
      for (const translated of Object.values(row.nameTranslations)) {
        if (translated.trim()) {
          subjectIdByName.set(translated.trim().toLowerCase(), createdSubject.id);
        }
      }
    }

    const classIdByName = new Map<string, string>();
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

    const sectionIdByName = new Map<string, string>();
    for (const row of prepared.sections) {
      const createdSection = await this.coreLookupsService.createSection(
        {
          name: row.name,
          sortOrder: row.sortOrder,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.sections += 1;
      sectionIdByName.set(row.name.toLowerCase(), createdSection.id);
    }

    const levelIdByName = new Map<string, string>();
    for (const row of prepared.levels) {
      const classIds = row.classNames
        .map((n) => classIdByName.get(n.toLowerCase()))
        .filter((v): v is string => !!v);
      const createdLevel = await this.coreLookupsService.createLevel(
        {
          name: row.name,
          classIds,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.levels += 1;
      levelIdByName.set(row.name.toLowerCase(), createdLevel.id);
    }

    for (const row of prepared.assessmentTypes) {
      await this.assessmentService.createAssessmentType(
        {
          name: row.name,
          nameAr: row.nameAr,
          name_translations: row.nameTranslations,
          sortOrder: row.sortOrder ?? 0,
          isTermExamination: row.isTermExamination ?? false,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.assessmentTypes += 1;
    }

    for (const row of prepared.subjectTemplates) {
      const subjectIds = row.subjectRefs
        .map((ref) => subjectIdByCode.get(ref.toLowerCase()) ?? subjectIdByName.get(ref.toLowerCase()))
        .filter((v): v is string => !!v);
      const classIds =
        row.assignMode === 'classes'
          ? row.assignNames
              .map((n) => classIdByName.get(n.toLowerCase()))
              .filter((v): v is string => !!v)
          : [];
      const levelIds =
        row.assignMode === 'levels'
          ? row.assignNames
              .map((n) => levelIdByName.get(n.toLowerCase()))
              .filter((v): v is string => !!v)
          : [];

      await this.subjectTemplatesService.createSubjectTemplate(
        {
          name: row.name,
          description: row.description,
          subjectIds,
          classIds: classIds.length > 0 ? classIds : undefined,
          levelIds: levelIds.length > 0 ? levelIds : undefined,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.subjectTemplates += 1;
    }

    if (prepared.schoolDays.length > 0) {
      const result = await this.scheduleService.updateSchoolDays(
        prepared.schoolDays,
        prepared.branchId,
        prepared.tenantId,
      );
      created.schoolDays = result.data.length;
    }

    const slotsByTemplate = new Map<string, TimingSlotImportRow[]>();
    for (const slot of prepared.timingSlots) {
      const key = slot.templateName.toLowerCase();
      const list = slotsByTemplate.get(key) ?? [];
      list.push(slot);
      slotsByTemplate.set(key, list);
    }

    for (const row of prepared.timingTemplates) {
      const slots = (slotsByTemplate.get(row.name.toLowerCase()) ?? []).map((s) => ({
        name: s.slotName,
        startTime: s.startTime,
        endTime: s.endTime,
        sortOrder: s.sortOrder,
      }));
      const createdTemplate = await this.scheduleService.createTimingTemplate(
        {
          name: row.name,
          startTime: row.startTime,
          endTime: row.endTime,
          periodDurationMinutes: row.periodDurationMinutes,
          slots,
        },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.timingTemplates += 1;
      created.timingSlots += slots.length;

      if (row.assignedClassNames.length > 0) {
        const classIds = row.assignedClassNames
          .map((n) => classIdByName.get(n.toLowerCase()))
          .filter((v): v is string => !!v);
        if (classIds.length > 0) {
          await this.scheduleService.assignClassesToTimingTemplate(createdTemplate.id, classIds);
        }
      }
    }

    const rangesByTemplate = new Map<string, GradeRangeImportRow[]>();
    for (const range of prepared.gradeRanges) {
      const key = range.templateName.toLowerCase();
      const list = rangesByTemplate.get(key) ?? [];
      list.push(range);
      rangesByTemplate.set(key, list);
    }

    for (const row of prepared.gradeTemplates) {
      const ranges = (rangesByTemplate.get(row.name.toLowerCase()) ?? []).map((r) => ({
        letter: r.letter,
        minPercentage: r.minPercentage,
        maxPercentage: r.maxPercentage,
        sortOrder: r.sortOrder,
      }));
      const createdTemplate = await this.assessmentService.createGradeTemplate(
        { name: row.name, ranges },
        prepared.branchId,
        prepared.tenantId,
        prepared.actorEmail,
      );
      created.gradeTemplates += 1;
      created.gradeRanges += ranges.length;

      if (row.assignedClassNames.length > 0) {
        const classIds = row.assignedClassNames
          .map((n) => classIdByName.get(n.toLowerCase()))
          .filter((v): v is string => !!v);
        if (classIds.length > 0) {
          await this.assessmentService.assignGradeTemplateToClass({
            classIds,
            gradeTemplateId: createdTemplate.id,
            minimumPassingGrade: row.minimumPassingGrade,
          });
        }
      }
    }

    const classSectionPairs: Array<{ classId: string; sectionId: string }> = [];
    for (const row of prepared.classes) {
      const classId = classIdByName.get(row.name.toLowerCase());
      if (!classId) continue;
      for (const sectionName of row.sectionNames) {
        const sectionId = sectionIdByName.get(sectionName.toLowerCase());
        if (!sectionId) continue;
        classSectionPairs.push({ classId, sectionId });
      }
    }
    if (classSectionPairs.length > 0) {
      const result = await this.classSectionsService.bulkCreateClassSections(
        {
          classSections: classSectionPairs.map((p) => ({
            classId: p.classId,
            sectionId: p.sectionId,
          })),
        },
        prepared.branchId,
        prepared.actorEmail,
      );
      created.classSections = result.data.length;
    }

    // Seed default behavioural assessment (configured later in Settings → Behaviour).
    await this.systemSettingsService.upsert('behavioral_assessment', {
      ...DEFAULT_BEHAVIOURAL_ASSESSMENT_VALUE,
      attributes: [...DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES],
    });

    await this.seedWizardDefaultPermissionsIfMissing(prepared.branchId, prepared.actorEmail);

    await this.systemSettingsService.upsert(initKey, {
      source: 'settings-import',
      completedAt: new Date().toISOString(),
    });

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

  private parseTranslatedEntities(
    rows: WorkbookRow[],
    errors: ValidationError[],
    options: {
      sheet: string;
      includeSortOrder: boolean;
      codeIsStored: boolean;
      includeTermExamination: boolean;
    },
  ): TranslatedEntity[] {
    const groups = new Map<string, TranslationGroupDraft>();
    const uncoded: TranslationGroupDraft[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      if (hasLegacyNameColumns(row) && !asString(row.name)) {
        errors.push({
          sheet: options.sheet,
          rowNumber,
          message: 'Legacy name_en/name_ar columns are no longer supported. Use name, code, lang_code.',
        });
        return;
      }

      const name = asString(row.name);
      const code = asString(row.code);
      const langCode = normalizeLangCode(asString(row.lang_code) || 'EN');
      if (!name) {
        errors.push({
          sheet: options.sheet,
          rowNumber,
          message: 'name is required',
        });
        return;
      }

      const sortOrder = options.includeSortOrder ? asNumber(row.sort_order, index + 1) : undefined;
      const isTerm = options.includeTermExamination ? asBoolean(row.is_term_examination) : undefined;

      if (!code) {
        uncoded.push({
          code: undefined,
          translations: { [langCode]: name },
          sortOrder,
          isTermExamination: isTerm,
          firstRowNumber: rowNumber,
        });
        return;
      }

      const groupKey = `code:${code.toLowerCase()}`;
      let draft = groups.get(groupKey);
      if (!draft) {
        draft = {
          code,
          translations: {},
          sortOrder,
          isTermExamination: isTerm,
          firstRowNumber: rowNumber,
        };
        groups.set(groupKey, draft);
      } else if (draft.translations[langCode]) {
        errors.push({
          sheet: options.sheet,
          rowNumber,
          message: `Duplicate lang_code '${langCode}' for code '${code}'`,
        });
        return;
      }

      draft.translations[langCode] = name;
      if (options.includeSortOrder && draft.sortOrder === undefined) {
        draft.sortOrder = sortOrder;
      }
      if (options.includeTermExamination && isTerm) {
        draft.isTermExamination = true;
      }
    });

    const drafts = [...groups.values(), ...uncoded];
    const parsed: TranslatedEntity[] = [];
    const seenStoredCodes = new Set<string>();

    for (const draft of drafts) {
      const primaryName = pickPrimaryName(draft.translations);
      if (!primaryName) {
        errors.push({
          sheet: options.sheet,
          rowNumber: draft.firstRowNumber,
          message: 'name is required',
        });
        continue;
      }

      if (options.codeIsStored && draft.code) {
        const key = draft.code.toLowerCase();
        if (seenStoredCodes.has(key)) {
          errors.push({
            sheet: options.sheet,
            rowNumber: draft.firstRowNumber,
            message: `Duplicate subject code '${draft.code}'`,
          });
          continue;
        }
        seenStoredCodes.add(key);
      }

      parsed.push({
        name: primaryName,
        nameAr: draft.translations.ar,
        nameTranslations: draft.translations,
        code: options.codeIsStored ? draft.code : undefined,
        sortOrder: draft.sortOrder,
        isTermExamination: draft.isTermExamination ?? false,
      });
    }

    return parsed;
  }

  private parseClasses(rows: WorkbookRow[], errors: ValidationError[]): ClassImportRow[] {
    const parsed: ClassImportRow[] = [];
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
        sectionNames: splitCsv(asString(row.section_names)),
      });
    });
    return parsed;
  }

  /** Unique section master records, in first-seen order from classes.section_names. */
  private deriveSectionsFromClasses(classes: ClassImportRow[]): PreparedImport['sections'] {
    const seen = new Set<string>();
    const parsed: PreparedImport['sections'] = [];
    for (const row of classes) {
      for (const sectionName of row.sectionNames) {
        const key = sectionName.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        parsed.push({
          name: sectionName,
          sortOrder: parsed.length + 1,
        });
      }
    }
    return parsed;
  }

  private parseLevels(
    rows: WorkbookRow[],
    errors: ValidationError[],
    classes: ClassImportRow[],
  ) {
    const classLookup = new Set(
      classes.flatMap((c) => [c.name.toLowerCase(), c.displayName.toLowerCase()]),
    );
    const parsed: PreparedImport['levels'] = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name);
      const classNames = splitCsv(asString(row.class_names));
      if (!name || classNames.length === 0) {
        errors.push({
          sheet: SHEET_NAMES.levels,
          rowNumber,
          message: 'name and class_names are required',
        });
        return;
      }
      for (const className of classNames) {
        if (!classLookup.has(className.toLowerCase())) {
          errors.push({
            sheet: SHEET_NAMES.levels,
            rowNumber,
            message: `Class '${className}' not found in classes sheet`,
          });
        }
      }
      parsed.push({ name, classNames });
    });
    return parsed;
  }

  private parseSchoolDays(rows: WorkbookRow[], errors: ValidationError[]): number[] {
    if (rows.length === 0) return [];
    const active = new Set<number>();
    const seenDays = new Set<number>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      // Prefer human day names (`day`); still accept legacy `day_of_week` (0–6).
      const day = parseDayOfWeek(row.day ?? row.day_of_week);
      if (day === null) {
        errors.push({
          sheet: SHEET_NAMES.schoolDays,
          rowNumber,
          message: 'day must be a weekday name (Sunday–Saturday)',
        });
        return;
      }
      if (seenDays.has(day)) {
        errors.push({
          sheet: SHEET_NAMES.schoolDays,
          rowNumber,
          message: 'Duplicate day — list each weekday only once',
        });
        return;
      }
      seenDays.add(day);

      const flagRaw = row.active ?? row.school_day ?? row.is_active;
      const isActive = asYesNo(flagRaw);
      if (isActive === null) {
        errors.push({
          sheet: SHEET_NAMES.schoolDays,
          rowNumber,
          message: 'active must be Y or N',
        });
        return;
      }
      if (isActive) active.add(day);
    });

    return Array.from(active).sort((a, b) => a - b);
  }

  private parseTimingTemplates(
    rows: WorkbookRow[],
    errors: ValidationError[],
    classes: ClassImportRow[],
  ): TimingTemplateImportRow[] {
    const classLookup = new Set(
      classes.flatMap((c) => [c.name.toLowerCase(), c.displayName.toLowerCase()]),
    );
    const seenNames = new Set<string>();
    const parsed: TimingTemplateImportRow[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name);
      const startTime = normalizeTime(row.start_time);
      const endTime = normalizeTime(row.end_time);
      if (!name || !startTime || !endTime) {
        errors.push({
          sheet: SHEET_NAMES.timingTemplates,
          rowNumber,
          message: 'name, start_time and end_time are required (times as HH:MM)',
        });
        return;
      }
      if (startTime >= endTime) {
        errors.push({
          sheet: SHEET_NAMES.timingTemplates,
          rowNumber,
          message: 'start_time must be before end_time',
        });
        return;
      }
      if (seenNames.has(name.toLowerCase())) {
        errors.push({
          sheet: SHEET_NAMES.timingTemplates,
          rowNumber,
          message: `Duplicate timing template name '${name}'`,
        });
        return;
      }
      seenNames.add(name.toLowerCase());

      const assignedClassNames = splitCsv(asString(row.assigned_class_names));
      for (const className of assignedClassNames) {
        if (!classLookup.has(className.toLowerCase())) {
          errors.push({
            sheet: SHEET_NAMES.timingTemplates,
            rowNumber,
            message: `Class '${className}' not found in classes sheet`,
          });
        }
      }

      parsed.push({
        name,
        startTime,
        endTime,
        periodDurationMinutes: asNumber(row.period_duration_minutes, 60),
        assignedClassNames,
      });
    });
    return parsed;
  }

  private parseTimingSlots(
    rows: WorkbookRow[],
    errors: ValidationError[],
    templates: TimingTemplateImportRow[],
  ): TimingSlotImportRow[] {
    const templateLookup = new Set(templates.map((t) => t.name.toLowerCase()));
    const parsed: TimingSlotImportRow[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const templateName = asString(row.template_name);
      const slotName = asString(row.slot_name);
      if (!templateName || !slotName) {
        errors.push({
          sheet: SHEET_NAMES.timingSlots,
          rowNumber,
          message: 'template_name and slot_name are required',
        });
        return;
      }
      if (!templateLookup.has(templateName.toLowerCase())) {
        errors.push({
          sheet: SHEET_NAMES.timingSlots,
          rowNumber,
          message: `Timing template '${templateName}' not found in timing_templates sheet`,
        });
        return;
      }

      const startRaw = asString(row.start_time);
      const endRaw = asString(row.end_time);
      const startTime = startRaw ? normalizeTime(row.start_time) : undefined;
      const endTime = endRaw ? normalizeTime(row.end_time) : undefined;
      if (startRaw && !startTime) {
        errors.push({
          sheet: SHEET_NAMES.timingSlots,
          rowNumber,
          message: 'start_time must be HH:MM',
        });
        return;
      }
      if (endRaw && !endTime) {
        errors.push({
          sheet: SHEET_NAMES.timingSlots,
          rowNumber,
          message: 'end_time must be HH:MM',
        });
        return;
      }

      parsed.push({
        templateName,
        slotName,
        startTime,
        endTime,
        sortOrder: asNumber(row.sort_order, index + 1),
      });
    });
    return parsed;
  }

  private parseGradeTemplates(
    rows: WorkbookRow[],
    errors: ValidationError[],
    classes: ClassImportRow[],
  ): GradeTemplateImportRow[] {
    const classLookup = new Set(
      classes.flatMap((c) => [c.name.toLowerCase(), c.displayName.toLowerCase()]),
    );
    const seenNames = new Set<string>();
    const parsed: GradeTemplateImportRow[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name);
      if (!name) {
        errors.push({
          sheet: SHEET_NAMES.gradeTemplates,
          rowNumber,
          message: 'name is required',
        });
        return;
      }
      if (seenNames.has(name.toLowerCase())) {
        errors.push({
          sheet: SHEET_NAMES.gradeTemplates,
          rowNumber,
          message: `Duplicate grade template name '${name}'`,
        });
        return;
      }
      seenNames.add(name.toLowerCase());

      const assignedClassNames = splitCsv(asString(row.assigned_class_names));
      for (const className of assignedClassNames) {
        if (!classLookup.has(className.toLowerCase())) {
          errors.push({
            sheet: SHEET_NAMES.gradeTemplates,
            rowNumber,
            message: `Class '${className}' not found in classes sheet`,
          });
        }
      }

      parsed.push({
        name,
        assignedClassNames,
        minimumPassingGrade: asString(row.minimum_passing_grade) || 'D',
      });
    });
    return parsed;
  }

  private parseGradeRanges(
    rows: WorkbookRow[],
    errors: ValidationError[],
    templates: GradeTemplateImportRow[],
  ): GradeRangeImportRow[] {
    const templateLookup = new Map(templates.map((t) => [t.name.toLowerCase(), t]));
    const lettersByTemplate = new Map<string, Set<string>>();
    const parsed: GradeRangeImportRow[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const templateName = asString(row.template_name);
      const letter = asString(row.letter);
      const minPercentage = asNumber(row.min_percentage, Number.NaN);
      const maxPercentage = asNumber(row.max_percentage, Number.NaN);

      if (!templateName || !letter || !Number.isFinite(minPercentage) || !Number.isFinite(maxPercentage)) {
        errors.push({
          sheet: SHEET_NAMES.gradeRanges,
          rowNumber,
          message: 'template_name, letter, min_percentage and max_percentage are required',
        });
        return;
      }
      if (!templateLookup.has(templateName.toLowerCase())) {
        errors.push({
          sheet: SHEET_NAMES.gradeRanges,
          rowNumber,
          message: `Grade template '${templateName}' not found in grade_templates sheet`,
        });
        return;
      }
      if (minPercentage > maxPercentage) {
        errors.push({
          sheet: SHEET_NAMES.gradeRanges,
          rowNumber,
          message: 'min_percentage must be <= max_percentage',
        });
        return;
      }

      const letterKey = templateName.toLowerCase();
      const seenLetters = lettersByTemplate.get(letterKey) ?? new Set<string>();
      if (seenLetters.has(letter.toUpperCase())) {
        errors.push({
          sheet: SHEET_NAMES.gradeRanges,
          rowNumber,
          message: `Duplicate letter '${letter}' for template '${templateName}'`,
        });
        return;
      }
      seenLetters.add(letter.toUpperCase());
      lettersByTemplate.set(letterKey, seenLetters);

      parsed.push({
        templateName,
        letter,
        minPercentage,
        maxPercentage,
        sortOrder: asNumber(row.sort_order, index + 1),
      });
    });

    for (const template of templates) {
      const ranges = parsed.filter((r) => r.templateName.toLowerCase() === template.name.toLowerCase());
      if (ranges.length === 0) {
        errors.push({
          sheet: SHEET_NAMES.gradeTemplates,
          rowNumber: 1,
          message: `Grade template '${template.name}' has no ranges in grade_ranges sheet`,
        });
        continue;
      }
      const letters = new Set(ranges.map((r) => r.letter.toUpperCase()));
      if (!letters.has(template.minimumPassingGrade.toUpperCase())) {
        errors.push({
          sheet: SHEET_NAMES.gradeTemplates,
          rowNumber: 1,
          message: `minimum_passing_grade '${template.minimumPassingGrade}' for '${template.name}' must match a letter in grade_ranges`,
        });
      }
    }

    return parsed;
  }

  private parseSubjectTemplates(
    rows: WorkbookRow[],
    errors: ValidationError[],
    refs: {
      subjects: TranslatedEntity[];
      classes: ClassImportRow[];
      levels: PreparedImport['levels'];
    },
  ): SubjectTemplateImportRow[] {
    if (rows.length === 0) return [];

    const subjectLookup = new Set<string>();
    for (const subject of refs.subjects) {
      if (subject.code) subjectLookup.add(subject.code.toLowerCase());
      subjectLookup.add(subject.name.toLowerCase());
      for (const translated of Object.values(subject.nameTranslations)) {
        if (translated.trim()) subjectLookup.add(translated.trim().toLowerCase());
      }
    }
    const classLookup = new Set(
      refs.classes.flatMap((c) => [c.name.toLowerCase(), c.displayName.toLowerCase()]),
    );
    const levelLookup = new Set(refs.levels.map((l) => l.name.toLowerCase()));

    const parsed: SubjectTemplateImportRow[] = [];
    const seenNames = new Set<string>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = asString(row.name);
      const description = asString(row.description) || undefined;
      const subjectRefs = splitCsv(asString(row.subject_names));
      const assignModeRaw = asString(row.assign_mode).toLowerCase();
      const assignNames = splitCsv(asString(row.assign_names));

      if (!name) {
        errors.push({
          sheet: SHEET_NAMES.subjectTemplates,
          rowNumber,
          message: 'name is required',
        });
        return;
      }
      if (seenNames.has(name.toLowerCase())) {
        errors.push({
          sheet: SHEET_NAMES.subjectTemplates,
          rowNumber,
          message: `Duplicate subject template name '${name}'`,
        });
        return;
      }
      seenNames.add(name.toLowerCase());

      if (subjectRefs.length === 0) {
        errors.push({
          sheet: SHEET_NAMES.subjectTemplates,
          rowNumber,
          message: 'subject_names is required',
        });
        return;
      }

      if (assignModeRaw !== 'classes' && assignModeRaw !== 'levels') {
        errors.push({
          sheet: SHEET_NAMES.subjectTemplates,
          rowNumber,
          message: "assign_mode must be 'classes' or 'levels'",
        });
        return;
      }
      if (assignNames.length === 0) {
        errors.push({
          sheet: SHEET_NAMES.subjectTemplates,
          rowNumber,
          message: 'assign_names is required',
        });
        return;
      }

      for (const ref of subjectRefs) {
        if (!subjectLookup.has(ref.toLowerCase())) {
          errors.push({
            sheet: SHEET_NAMES.subjectTemplates,
            rowNumber,
            message: `Subject '${ref}' not found in subjects sheet (use name or code)`,
          });
        }
      }

      if (assignModeRaw === 'classes') {
        for (const className of assignNames) {
          if (!classLookup.has(className.toLowerCase())) {
            errors.push({
              sheet: SHEET_NAMES.subjectTemplates,
              rowNumber,
              message: `Class '${className}' not found in classes sheet`,
            });
          }
        }
      } else {
        for (const levelName of assignNames) {
          if (!levelLookup.has(levelName.toLowerCase())) {
            errors.push({
              sheet: SHEET_NAMES.subjectTemplates,
              rowNumber,
              message: `Level '${levelName}' not found in levels sheet`,
            });
          }
        }
      }

      parsed.push({
        name,
        description,
        subjectRefs,
        assignMode: assignModeRaw,
        assignNames,
      });
    });

    return parsed;
  }

  private computeSheetSummary(totalRows: number, errors: ValidationError[], sheet: string): SheetSummary {
    const invalidRows = new Set(errors.filter((e) => e.sheet === sheet).map((e) => e.rowNumber)).size;
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
