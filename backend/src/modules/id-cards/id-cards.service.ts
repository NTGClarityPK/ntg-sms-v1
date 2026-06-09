import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import archiver from 'archiver';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { IdCardDto } from './dto/id-card.dto';
import { QueryIdCardsDto } from './dto/query-id-cards.dto';
import { GenerateIdCardsDto } from './dto/generate-id-cards.dto';
import type { IdCardPersonType, IdCardStatus } from './types/id-card-person-type';
import { CardDataService } from './card-data.service';
import { IdCardPdfService } from './id-card-pdf.service';
import { TemplatesService } from './templates.service';
import { IdCardDesignService } from './id-card-design.service';
import type { IdCardDesignVariant } from './types/id-card-design-variant';
import { normalizeIdCardDesignVariant } from './types/id-card-design-variant';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { StudentPlacementService } from '../../common/services/student-placement.service';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type IdCardRow = {
  id: string;
  branch_id: string;
  person_id: string;
  person_type: IdCardPersonType;
  card_number: string;
  template_id: string | null;
  photo_url: string | null;
  qr_payload: string | null;
  status: IdCardStatus;
  valid_from: string | null;
  valid_until: string | null;
  print_count: number;
  last_printed_at: string | null;
  is_reissued: boolean;
  design_variant?: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class IdCardsService {
  private static readonly BULK_MAX = 60;
  private static readonly BULK_CHUNK = 3;

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly cardDataService: CardDataService,
    private readonly idCardPdfService: IdCardPdfService,
    private readonly templatesService: TemplatesService,
    private readonly idCardDesignService: IdCardDesignService,
    private readonly academicYearsService: AcademicYearsService,
    private readonly studentPlacementService: StudentPlacementService,
  ) {}

  private resolveDesignVariant(value: string | undefined): IdCardDesignVariant {
    return normalizeIdCardDesignVariant(value);
  }

  async getDesignPreviewHtml(
    branchId: string,
    variant: IdCardDesignVariant,
    personType: IdCardPersonType = 'student',
    personId?: string,
  ): Promise<{ data: { html: string } }> {
    const payload = await this.resolvePreviewPayload(branchId, personType, personId);
    const html = this.idCardDesignService.buildPreviewHtml(variant, payload);
    return { data: { html } };
  }

  private async resolvePreviewPayload(
    branchId: string,
    personType: IdCardPersonType,
    personId?: string,
  ) {
    const verifyBase = process.env.PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? '';
    if (personId) {
      return this.cardDataService.buildCardPayload(personType, personId, branchId, 'PREVIEW', {
        verifyBaseUrl: verifyBase ? `${verifyBase}/api/v1/id-cards/verify` : undefined,
      });
    }
    const supabase = this.supabaseConfig.getClient();
    if (personType === 'student') {
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (student) {
        return this.cardDataService.buildCardPayload('student', (student as { id: string }).id, branchId, 'PREVIEW', {
          verifyBaseUrl: verifyBase ? `${verifyBase}/api/v1/id-cards/verify` : undefined,
        });
      }
    } else {
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (staff) {
        return this.cardDataService.buildCardPayload('staff', (staff as { id: string }).id, branchId, 'PREVIEW', {
          verifyBaseUrl: verifyBase ? `${verifyBase}/api/v1/id-cards/verify` : undefined,
        });
      }
    }
    return this.cardDataService.buildCardPayload(personType, personId ?? branchId, branchId, 'PREVIEW', {
      verifyBaseUrl: verifyBase ? `${verifyBase}/api/v1/id-cards/verify` : undefined,
    });
  }

  private async getTenantCode(branchId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch } = await supabase.from('branches').select('tenant_id').eq('id', branchId).maybeSingle();
    const tenantId = (branch as { tenant_id?: string } | null)?.tenant_id;
    if (!tenantId) return 'ALM';
    const { data: tenant } = await supabase.from('tenants').select('code').eq('id', tenantId).maybeSingle();
    return ((tenant as { code?: string } | null)?.code ?? 'ALM').toUpperCase();
  }

  private rolePrefix(personType: IdCardPersonType): string {
    if (personType === 'student') return 'STU';
    if (personType === 'staff') return 'FAC';
    if (personType === 'admin') return 'ADM';
    return 'VIS';
  }

  async generateCardNumber(
    branchId: string,
    personType: IdCardPersonType,
    rollOrEmployeeId: string,
  ): Promise<string> {
    const code = await this.getTenantCode(branchId);
    const year = new Date().getFullYear();
    const padded = rollOrEmployeeId.replace(/\D/g, '').padStart(4, '0').slice(-6);
    return `${code}-${year}-${this.rolePrefix(personType)}-${padded}`;
  }

  /**
   * Picks a branch-unique card number. Reuses `base` when free or already owned by `personId`.
   * Appends a numeric suffix when another person already has `base` (duplicate roll/employee IDs).
   */
  private async resolveAvailableCardNumber(
    branchId: string,
    base: string,
    personId: string,
  ): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    let candidate = base;
    for (let attempt = 0; attempt < 25; attempt++) {
      const { data, error } = await supabase
        .from('id_cards')
        .select('person_id')
        .eq('branch_id', branchId)
        .eq('card_number', candidate)
        .maybeSingle();
      throwIfDbError(error);
      const ownerId = (data as { person_id?: string } | null)?.person_id;
      if (!ownerId || ownerId === personId) return candidate;
      candidate = `${base}-${attempt + 2}`;
    }
    return `${base}-${personId.replace(/-/g, '').slice(0, 6)}`;
  }

  private async resolveClassSectionIds(
    branchId: string,
    query: QueryIdCardsDto,
  ): Promise<{ classId: string; sectionId: string } | null> {
    let classId = query.classId;
    let sectionId = query.sectionId;
    if (query.classSectionId) {
      const supabase = this.supabaseConfig.getClient();
      const { data, error } = await supabase
        .from('class_sections')
        .select('class_id, section_id')
        .eq('id', query.classSectionId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(error);
      if (!data) {
        throw new BadRequestException('Class section not found');
      }
      const row = data as { class_id: string; section_id: string };
      classId = row.class_id;
      sectionId = row.section_id;
    }
    if (!classId && !sectionId) return null;
    if (!classId || !sectionId) {
      throw new BadRequestException('classId and sectionId must both be provided for class section filter');
    }
    return { classId, sectionId };
  }

  async list(
    branchId: string,
    query: QueryIdCardsDto,
  ): Promise<{ data: IdCardDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.listIdCards(branchId, query);
  }

  /** Students in branch/class (from enrolments), with optional id_card — alphabetical, paginated. */
  private async listStudentRoster(
    branchId: string,
    query: QueryIdCardsDto,
  ): Promise<{ data: IdCardDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const classSectionFilter = await this.resolveClassSectionIds(branchId, query);
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);

    let rosterStudentIds: string[] | null = null;
    if (classSectionFilter) {
      let academicYearId = activeYear?.id;
      if (query.classSectionId) {
        const { data: csRow, error: csErr } = await supabase
          .from('class_sections')
          .select('academic_year_id')
          .eq('id', query.classSectionId)
          .eq('branch_id', branchId)
          .maybeSingle();
        throwIfDbError(csErr);
        if (csRow) {
          academicYearId = (csRow as { academic_year_id: string }).academic_year_id;
        }
      }
      if (academicYearId) {
        rosterStudentIds = await this.studentPlacementService.listActiveStudentIdsForClassSection({
          branchId,
          academicYearId,
          classId: classSectionFilter.classId,
          sectionId: classSectionFilter.sectionId,
        });
        if (rosterStudentIds.length === 0) {
          return {
            data: [],
            meta: { total: 0, page, limit, totalPages: 1 },
          };
        }
      }
    }

    let studentQuery = supabase
      .from('students')
      .select(
        'id, student_id, first_name, last_name, class_id, section_id, user_id',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .eq('is_active', true);

    if (rosterStudentIds) {
      studentQuery = studentQuery.in('id', rosterStudentIds);
    } else if (activeYear) {
      studentQuery = studentQuery.eq('academic_year_id', activeYear.id);
    }

    if (query.status) {
      let statusCardQuery = supabase
        .from('id_cards')
        .select('person_id')
        .eq('branch_id', branchId)
        .eq('person_type', 'student')
        .eq('status', query.status);
      const { data: statusRows, error: statusError } = await statusCardQuery;
      throwIfDbError(statusError);
      const statusPersonIds = (statusRows || []).map((r) => (r as { person_id: string }).person_id);
      if (statusPersonIds.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
      }
      studentQuery = studentQuery.in('id', statusPersonIds);
    }

    const search = query.search?.trim();
    if (search) {
      const term = search.replace(/[%_]/g, '');
      studentQuery = studentQuery.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,student_id.ilike.%${term}%`,
      );
    }

    studentQuery = studentQuery
      .order('first_name', { ascending: true })
      .order('last_name', { ascending: true });

    const { data: studentRows, error: studentError, count } = await studentQuery.range(from, to);
    throwIfDbError(studentError);

    const students = (studentRows || []) as Array<{
      id: string;
      student_id: string;
      first_name: string | null;
      last_name: string | null;
      class_id: string | null;
      section_id: string | null;
      user_id: string | null;
    }>;

    if (students.length === 0) {
      const total = count ?? 0;
      return {
        data: [],
        meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit) || 1) },
      };
    }

    const studentIds = students.map((s) => s.id);
    const classIds = [...new Set(students.map((s) => s.class_id).filter(Boolean))] as string[];
    const sectionIds = [...new Set(students.map((s) => s.section_id).filter(Boolean))] as string[];
    const classNameById = await this.loadClassNames(classIds);
    const sectionNameById = await this.loadSectionNames(sectionIds);

    const userIds = students
      .map((s) => s.user_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const avatarByUserId = await this.loadAvatarUrls(userIds);

    let cardQuery = supabase
      .from('id_cards')
      .select(
        'id, branch_id, person_id, person_type, card_number, template_id, photo_url, status, valid_from, valid_until, print_count, last_printed_at, is_reissued, design_variant, created_at, updated_at',
      )
      .eq('branch_id', branchId)
      .eq('person_type', 'student')
      .in('person_id', studentIds);

    const { data: cardRows, error: cardError } = await cardQuery;
    throwIfDbError(cardError);

    const cardByPersonId = new Map(
      ((cardRows || []) as IdCardRow[]).map((row) => [row.person_id, row]),
    );

    let items: IdCardDto[] = students.map((st) => {
      const card = cardByPersonId.get(st.id);
      const personName = [st.first_name, st.last_name].filter(Boolean).join(' ');
      const className = st.class_id ? classNameById.get(st.class_id) : undefined;
      const sectionName = st.section_id ? sectionNameById.get(st.section_id) : undefined;
      const avatarUrl = st.user_id ? avatarByUserId.get(st.user_id) : undefined;
      const photoUrl = card?.photo_url?.trim() || avatarUrl;
      const hasPhoto = !!(photoUrl && photoUrl.length > 0);

      if (!card) {
        return new IdCardDto({
          id: '',
          branchId,
          personId: st.id,
          personType: 'student',
          cardNumber: '',
          status: 'draft',
          printCount: 0,
          isReissued: false,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          personName,
          className,
          sectionName,
          rollNumber: st.student_id,
          hasCard: false,
          hasPhoto,
          photoUrl: avatarUrl,
        });
      }

      return new IdCardDto({
        id: card.id,
        branchId: card.branch_id,
        personId: card.person_id,
        personType: card.person_type,
        cardNumber: card.card_number,
        templateId: card.template_id ?? undefined,
        photoUrl: card.photo_url ?? undefined,
        status: card.status,
        validFrom: card.valid_from ?? undefined,
        validUntil: card.valid_until ?? undefined,
        printCount: card.print_count,
        lastPrintedAt: card.last_printed_at ?? undefined,
        isReissued: card.is_reissued,
        designVariant: this.resolveDesignVariant(card.design_variant ?? undefined),
        createdAt: card.created_at,
        updatedAt: card.updated_at,
        personName,
        className,
        sectionName,
        rollNumber: st.student_id,
        hasCard: true,
        hasPhoto,
      });
    });

    if (query.missingPhotoOnly) {
      items = items.filter((item) => !item.hasPhoto);
    }

    const total = count ?? items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { data: items, meta: { total, page, limit, totalPages } };
  }

  private async listIdCards(
    branchId: string,
    query: QueryIdCardsDto,
  ): Promise<{ data: IdCardDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let db = supabase
      .from('id_cards')
      .select(
        'id, branch_id, person_id, person_type, card_number, template_id, photo_url, status, valid_from, valid_until, print_count, last_printed_at, is_reissued, design_variant, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId);

    if (query.personType) db = db.eq('person_type', query.personType);
    if (query.status) db = db.eq('status', query.status);
    if (query.missingPhotoOnly) db = db.or('photo_url.is.null,photo_url.eq.');

    if (query.personType === 'student' && query.classSectionId) {
      const classSectionFilter = await this.resolveClassSectionIds(branchId, query);
      if (classSectionFilter) {
        const { data: students, error: studentFilterError } = await supabase
          .from('students')
          .select('id')
          .eq('branch_id', branchId)
          .eq('is_active', true)
          .eq('class_id', classSectionFilter.classId)
          .eq('section_id', classSectionFilter.sectionId);
        throwIfDbError(studentFilterError);
        const studentIds = (students || []).map((s) => (s as { id: string }).id);
        if (studentIds.length === 0) {
          return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
        }
        db = db.in('person_id', studentIds);
      }
    }

    const { data, error, count } = await db
      .order('created_at', { ascending: false })
      .range(from, to);
    throwIfDbError(error);

    const rows = (data || []) as IdCardRow[];
    const hydrated = await this.hydrateCardRows(rows, branchId);

    let filtered = hydrated;
    if (query.search?.trim()) {
      const s = query.search.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.personName?.toLowerCase().includes(s) ||
          (c.rollNumber ?? '').toLowerCase().includes(s) ||
          c.cardNumber.toLowerCase().includes(s),
      );
    }

    if (query.personType === 'student') {
      filtered = [...filtered].sort((a, b) =>
        (a.personName ?? '').localeCompare(b.personName ?? '', undefined, { sensitivity: 'base' }),
      );
    }

    const total = count ?? filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { data: filtered, meta: { total, page, limit, totalPages } };
  }

  private async loadClassNames(classIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (classIds.length === 0) return map;
    const supabase = this.supabaseConfig.getClient();
    const { data } = await supabase.from('classes').select('id, display_name, name').in('id', classIds);
    for (const row of data || []) {
      const r = row as { id: string; display_name: string | null; name: string };
      map.set(r.id, r.display_name || r.name);
    }
    return map;
  }

  private async loadSectionNames(sectionIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (sectionIds.length === 0) return map;
    const supabase = this.supabaseConfig.getClient();
    const { data } = await supabase.from('sections').select('id, name').in('id', sectionIds);
    for (const row of data || []) {
      const r = row as { id: string; name: string };
      map.set(r.id, r.name);
    }
    return map;
  }

  private async loadAvatarUrls(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (userIds.length === 0) return map;
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', userIds);
    throwIfDbError(error);
    for (const row of data || []) {
      const r = row as { id: string; avatar_url: string | null };
      if (r.avatar_url?.trim()) map.set(r.id, r.avatar_url.trim());
    }
    return map;
  }

  private async hydrateCardRows(rows: IdCardRow[], branchId: string): Promise<IdCardDto[]> {
    if (rows.length === 0) return [];
    const supabase = this.supabaseConfig.getClient();
    const studentIds = rows.filter((r) => r.person_type === 'student').map((r) => r.person_id);
    const staffIds = rows.filter((r) => r.person_type === 'staff' || r.person_type === 'admin').map((r) => r.person_id);

    const studentMap = new Map<
      string,
      { name: string; rollNumber: string; classId?: string; sectionId?: string }
    >();
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from('students')
        .select('id, student_id, first_name, last_name, class_id, section_id')
        .in('id', studentIds)
        .eq('branch_id', branchId);
      for (const s of students || []) {
        const row = s as {
          id: string;
          student_id: string;
          first_name: string | null;
          last_name: string | null;
          class_id: string | null;
          section_id: string | null;
        };
        studentMap.set(row.id, {
          name: [row.first_name, row.last_name].filter(Boolean).join(' '),
          rollNumber: row.student_id,
          classId: row.class_id ?? undefined,
          sectionId: row.section_id ?? undefined,
        });
      }
    }

    const classIds = [...new Set([...studentMap.values()].map((v) => v.classId).filter(Boolean))] as string[];
    const sectionIds = [...new Set([...studentMap.values()].map((v) => v.sectionId).filter(Boolean))] as string[];
    const classNameById = await this.loadClassNames(classIds);
    const sectionNameById = await this.loadSectionNames(sectionIds);

    const staffMap = new Map<string, { name: string; rollNumber: string }>();
    if (staffIds.length > 0) {
      const { data: staffRows } = await supabase
        .from('staff')
        .select('id, user_id, employee_id')
        .in('id', staffIds);
      const userIds = (staffRows || []).map((s) => (s as { user_id: string }).user_id);
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] };
      const nameByUser = new Map((profiles || []).map((p) => [(p as { id: string }).id, (p as { full_name: string }).full_name]));
      for (const s of staffRows || []) {
        const st = s as { id: string; user_id: string; employee_id: string | null };
        staffMap.set(st.id, {
          name: nameByUser.get(st.user_id) ?? 'Staff',
          rollNumber: st.employee_id?.trim() || st.user_id.slice(0, 8),
        });
      }
    }

    return rows.map((row) => {
        const st = studentMap.get(row.person_id);
        const staff = staffMap.get(row.person_id);
        const personName =
          row.person_type === 'student' ? st?.name : staff?.name;
        const rollNumber =
          row.person_type === 'student' ? st?.rollNumber : staff?.rollNumber;
        const className = st?.classId ? classNameById.get(st.classId) : undefined;
        const sectionName = st?.sectionId ? sectionNameById.get(st.sectionId) : undefined;
        return new IdCardDto({
          id: row.id,
          branchId: row.branch_id,
          personId: row.person_id,
          personType: row.person_type,
          cardNumber: row.card_number,
          templateId: row.template_id ?? undefined,
          photoUrl: row.photo_url ?? undefined,
          status: row.status,
          validFrom: row.valid_from ?? undefined,
          validUntil: row.valid_until ?? undefined,
          printCount: row.print_count,
          lastPrintedAt: row.last_printed_at ?? undefined,
          isReissued: row.is_reissued,
          designVariant: this.resolveDesignVariant(row.design_variant ?? undefined),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          personName,
          className,
          sectionName,
          rollNumber,
          hasCard: true,
          hasPhoto: !!(row.photo_url && row.photo_url.trim()),
        });
      });
  }

  async getStats(branchId: string): Promise<{
    data: { issued: number; pending: number; missingPhotos: number; draft: number };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { count: issued } = await supabase
      .from('id_cards')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('status', 'issued');
    const { count: pending } = await supabase
      .from('id_cards')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .in('status', ['draft', 'approved']);
    const { count: draft } = await supabase
      .from('id_cards')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('status', 'draft');
    const { count: missingPhotos } = await supabase
      .from('id_cards')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .or('photo_url.is.null,photo_url.eq.');

    return {
      data: {
        issued: issued ?? 0,
        pending: pending ?? 0,
        missingPhotos: missingPhotos ?? 0,
        draft: draft ?? 0,
      },
    };
  }

  async getCardData(
    personType: IdCardPersonType,
    personId: string,
    branchId: string,
  ): Promise<{ data: import('./types/id-card-render-data').IdCardRenderData }> {
    const previewNumber = await this.generateCardNumber(branchId, personType, '0000');
    const verifyBase = process.env.PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? '';
    const data = await this.cardDataService.buildCardPayload(personType, personId, branchId, previewNumber, {
      verifyBaseUrl: verifyBase ? `${verifyBase}/api/v1/id-cards/verify` : undefined,
    });
    return { data };
  }

  async getById(id: string, branchId: string): Promise<{ data: IdCardDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('id_cards')
      .select(
        'id, branch_id, person_id, person_type, card_number, template_id, photo_url, status, valid_from, valid_until, print_count, last_printed_at, is_reissued, design_variant, created_at, updated_at',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('ID card not found');
    const [dto] = await this.hydrateCardRows([data as IdCardRow], branchId);
    return { data: dto };
  }

  async resolvePersonIds(
    dto: GenerateIdCardsDto,
    branchId: string,
  ): Promise<string[]> {
    if (dto.personIds?.length) return dto.personIds;

    if (dto.personType === 'staff' || dto.personType === 'admin') {
      return this.resolveStaffPersonIds(branchId, dto.staffRoleId);
    }

    if (!dto.classSectionId) {
      throw new BadRequestException('personIds or classSectionId is required for students');
    }
    const supabase = this.supabaseConfig.getClient();
    const { data: cs } = await supabase
      .from('class_sections')
      .select('class_id, section_id, academic_year_id')
      .eq('id', dto.classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (!cs) throw new NotFoundException('Class section not found');
    const csRow = cs as { class_id: string; section_id: string; academic_year_id: string };
    return this.studentPlacementService.listActiveStudentIdsForClassSection({
      branchId,
      academicYearId: csRow.academic_year_id,
      classId: csRow.class_id,
      sectionId: csRow.section_id,
    });
  }

  private async resolveStaffPersonIds(branchId: string, staffRoleId?: string): Promise<string[]> {
    const supabase = this.supabaseConfig.getClient();
    let staffIdsForRole: string[] | null = null;

    if (staffRoleId) {
      const { data: userRolesData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', staffRoleId)
        .eq('branch_id', branchId);
      throwIfDbError(roleError);
      const userIds = (userRolesData || []).map((r) => (r as { user_id: string }).user_id);
      if (userIds.length === 0) return [];
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .in('user_id', userIds);
      throwIfDbError(staffError);
      staffIdsForRole = (staffData || []).map((s) => (s as { id: string }).id);
      if (staffIdsForRole.length === 0) return [];
    }

    let query = supabase
      .from('staff')
      .select('id')
      .eq('branch_id', branchId)
      .eq('is_active', true);
    if (staffIdsForRole) query = query.in('id', staffIdsForRole);
    const { data, error } = await query;
    throwIfDbError(error);
    return (data || []).map((s) => (s as { id: string }).id);
  }

  async getClassSectionStudentRecipients(
    branchId: string,
    classSectionId: string,
  ): Promise<{
    data: Array<{
      id: string;
      studentId: string;
      firstName: string | null;
      lastName: string | null;
      cardStatus: IdCardStatus | null;
    }>;
    meta: { statusCounts: Partial<Record<IdCardStatus, number>> };
  }> {
    const personIds = await this.resolvePersonIds(
      { personType: 'student', classSectionId },
      branchId,
    );
    if (personIds.length === 0) {
      return { data: [], meta: { statusCounts: {} } };
    }

    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .in('id', personIds);
    throwIfDbError(error);

    const { data: cardRows, error: cardError } = await supabase
      .from('id_cards')
      .select('person_id, status, created_at')
      .eq('branch_id', branchId)
      .eq('person_type', 'student')
      .in('person_id', personIds);
    throwIfDbError(cardError);

    const cardList = (cardRows || []) as Array<{
      person_id: string;
      status: IdCardStatus;
      created_at: string;
    }>;
    cardList.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const statusByPerson = new Map<string, IdCardStatus>();
    for (const card of cardList) {
      if (!statusByPerson.has(card.person_id)) {
        statusByPerson.set(card.person_id, card.status);
      }
    }

    const statusCounts: Partial<Record<IdCardStatus, number>> = {};
    for (const status of statusByPerson.values()) {
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    }

    const rows = (data || []) as Array<{
      id: string;
      student_id: string;
      first_name: string | null;
      last_name: string | null;
    }>;

    const sorted = rows.sort((a, b) => {
      const nameA = [a.first_name, a.last_name].filter(Boolean).join(' ');
      const nameB = [b.first_name, b.last_name].filter(Boolean).join(' ');
      return nameA.localeCompare(nameB);
    });

    return {
      data: sorted.map((r) => ({
        id: r.id,
        studentId: r.student_id,
        firstName: r.first_name,
        lastName: r.last_name,
        cardStatus: statusByPerson.get(r.id) ?? null,
      })),
      meta: { statusCounts },
    };
  }

  async generate(
    dto: GenerateIdCardsDto,
    branchId: string,
    userId: string,
  ): Promise<{ data: IdCardDto[] }> {
    const personIds = await this.resolvePersonIds(dto, branchId);
    if (personIds.length === 0) throw new BadRequestException('No recipients found');

    const roleType =
      dto.personType === 'admin' ? 'admin' : dto.personType === 'visitor' ? 'visitor' : dto.personType;
    const templateRole =
      roleType === 'admin' ? 'admin' : roleType === 'visitor' ? 'visitor' : roleType === 'staff' ? 'staff' : 'student';
    const { templateRowId } = await this.templatesService.resolveTemplateKeys(
      branchId,
      templateRole,
      dto.templateId,
    );

    const supabase = this.supabaseConfig.getClient();
    const created: IdCardDto[] = [];
    const verifyBase = process.env.PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? '';

    for (const personId of personIds) {
      const { data: existingRows, error: existingLookupError } = await supabase
        .from('id_cards')
        .select('id, card_number')
        .eq('branch_id', branchId)
        .eq('person_id', personId)
        .eq('person_type', dto.personType)
        .order('created_at', { ascending: false })
        .limit(1);
      throwIfDbError(existingLookupError);
      const existing = (existingRows?.[0] as { id: string; card_number: string } | undefined) ?? null;

      const preview = await this.cardDataService.buildCardPayload(
        dto.personType,
        personId,
        branchId,
        'PREVIEW',
      );
      const proposedNumber = await this.generateCardNumber(
        branchId,
        dto.personType,
        preview.rollOrEmployeeId,
      );
      const cardNumber = existing?.card_number
        ? existing.card_number
        : await this.resolveAvailableCardNumber(branchId, proposedNumber, personId);

      const fullPayload = await this.cardDataService.buildCardPayload(
        dto.personType,
        personId,
        branchId,
        cardNumber,
        { verifyBaseUrl: verifyBase ? `${verifyBase}/api/v1/id-cards/verify` : undefined },
      );

      const row = {
        branch_id: branchId,
        person_id: personId,
        person_type: dto.personType,
        card_number: cardNumber,
        template_id: templateRowId,
        photo_url: fullPayload.photoUrl || null,
        qr_payload: cardNumber,
        status: 'draft' as IdCardStatus,
        valid_from: new Date().toISOString().slice(0, 10),
        valid_until: null as string | null,
        issued_by: userId,
        design_variant: this.resolveDesignVariant(dto.designVariant),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { data: updated, error } = await supabase
          .from('id_cards')
          .update(row)
          .eq('id', existing.id)
          .select(
            'id, branch_id, person_id, person_type, card_number, template_id, photo_url, status, valid_from, valid_until, print_count, last_printed_at, is_reissued, design_variant, created_at, updated_at',
          )
          .single();
        throwIfDbError(error);
        const [dtoOut] = await this.hydrateCardRows([updated as IdCardRow], branchId);
        created.push(dtoOut);
      } else {
        const { data: inserted, error } = await supabase
          .from('id_cards')
          .insert(row)
          .select(
            'id, branch_id, person_id, person_type, card_number, template_id, photo_url, status, valid_from, valid_until, print_count, last_printed_at, is_reissued, design_variant, created_at, updated_at',
          )
          .single();
        throwIfDbError(error);
        const [dtoOut] = await this.hydrateCardRows([inserted as IdCardRow], branchId);
        created.push(dtoOut);
      }
    }

    return { data: created };
  }

  async updateStatus(
    branchId: string,
    status: IdCardStatus,
    cardIds: string[],
  ): Promise<{ data: { updated: number } }> {
    const supabase = this.supabaseConfig.getClient();
    const { error, count } = await supabase
      .from('id_cards')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('branch_id', branchId)
      .in('id', cardIds);
    throwIfDbError(error);
    return { data: { updated: count ?? cardIds.length } };
  }

  async getCardPdfBuffer(
    cardId: string,
    branchId: string,
    side: 'front' | 'back' | 'both' = 'both',
    designOverride?: string,
  ): Promise<Buffer> {
    const supabase = this.supabaseConfig.getClient();
    const { data: card, error } = await supabase
      .from('id_cards')
      .select('id, person_id, person_type, card_number, is_reissued, template_id, design_variant')
      .eq('id', cardId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!card) throw new NotFoundException('ID card not found');

    const row = card as {
      person_id: string;
      person_type: IdCardPersonType;
      card_number: string;
      is_reissued: boolean;
      template_id: string | null;
      design_variant: string | null;
    };
    const variant = this.resolveDesignVariant(designOverride ?? row.design_variant ?? 'classic');
    const verifyBase = process.env.PUBLIC_APP_URL ?? process.env.FRONTEND_URL ?? '';
    const payload = await this.cardDataService.buildCardPayload(
      row.person_type,
      row.person_id,
      branchId,
      row.card_number,
      { isReissued: row.is_reissued, verifyBaseUrl: verifyBase ? `${verifyBase}/api/v1/id-cards/verify` : undefined },
    );

    if (side === 'front') {
      const html = this.idCardDesignService.buildPrintSideHtml(variant, 'front', payload);
      return this.idCardPdfService.renderHtmlDocumentToPdf(html);
    }
    if (side === 'back') {
      const html = this.idCardDesignService.buildPrintSideHtml(variant, 'back', payload);
      return this.idCardPdfService.renderHtmlDocumentToPdf(html);
    }
    const bothHtml = this.idCardDesignService.buildPrintBothSidesHtml(variant, payload);
    return this.idCardPdfService.renderHtmlDocumentToPdf(bothHtml);
  }

  async getBulkPdfArchive(
    cardIds: string[],
    branchId: string,
    layout: 'single' | 'a4_9up' = 'single',
    designVariant?: IdCardDesignVariant,
  ): Promise<archiver.Archiver> {
    if (cardIds.length > IdCardsService.BULK_MAX) {
      throw new BadRequestException(`Maximum ${IdCardsService.BULK_MAX} cards per bulk download`);
    }
    const archive = archiver('zip', { zlib: { level: 9 } });
    if (layout === 'a4_9up') {
      const slots: string[] = [];
      for (const id of cardIds.slice(0, 9)) {
        const buf = await this.getCardPdfBuffer(id, branchId, 'front', designVariant);
        slots.push(`<img style="width:100%;height:100%;object-fit:contain" src="data:application/pdf;base64,${buf.toString('base64')}" />`);
      }
      const a4 = await this.idCardPdfService.renderA4NineUp(slots);
      archive.append(a4, { name: 'id-cards-a4-9up.pdf' });
    } else {
      for (let i = 0; i < cardIds.length; i += IdCardsService.BULK_CHUNK) {
        const chunk = cardIds.slice(i, i + IdCardsService.BULK_CHUNK);
        const buffers = await Promise.all(
          chunk.map((id) => this.getCardPdfBuffer(id, branchId, 'both', designVariant)),
        );
        chunk.forEach((id, j) => {
          archive.append(buffers[j]!, { name: `id-card-${id}.pdf` });
        });
      }
    }
    archive.finalize();
    return archive;
  }

  async verifyCard(cardNumber: string, branchId?: string): Promise<{
    data: {
      valid: boolean;
      cardNumber: string;
      personName: string;
      personType: string;
      photoUrl: string;
      schoolName: string;
      status: string;
      validUntil?: string;
    };
  }> {
    const supabase = this.supabaseConfig.getClient();
    let q = supabase
      .from('id_cards')
      .select('id, branch_id, person_id, person_type, card_number, photo_url, status, valid_until')
      .eq('card_number', cardNumber);
    if (branchId) q = q.eq('branch_id', branchId);
    const { data: card, error } = await q.maybeSingle();
    throwIfDbError(error);
    if (!card) {
      return {
        data: {
          valid: false,
          cardNumber,
          personName: '',
          personType: '',
          photoUrl: '',
          schoolName: '',
          status: 'not_found',
        },
      };
    }
    const row = card as IdCardRow;
    const payload = await this.cardDataService.buildCardPayload(
      row.person_type,
      row.person_id,
      row.branch_id,
      row.card_number,
    );
    const expired =
      row.valid_until && new Date(row.valid_until) < new Date(new Date().toISOString().slice(0, 10));
    return {
      data: {
        valid: row.status !== 'revoked' && !expired,
        cardNumber: row.card_number,
        personName: payload.fullName,
        personType: row.person_type,
        photoUrl: row.photo_url ?? payload.photoUrl,
        schoolName: payload.schoolName,
        status: row.status,
        validUntil: row.valid_until ?? undefined,
      },
    };
  }

  async requestReprint(
    cardId: string,
    branchId: string,
    userId: string,
    reason: string,
    feeCharged?: number,
  ): Promise<{ data: IdCardDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: card, error } = await supabase
      .from('id_cards')
      .select('id')
      .eq('id', cardId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!card) throw new NotFoundException('ID card not found');

    await supabase.from('id_card_reprints').insert({
      card_id: cardId,
      branch_id: branchId,
      reason,
      requested_by: userId,
      approved_by: userId,
      fee_charged: feeCharged ?? null,
    });

    const { error: updErr } = await supabase
      .from('id_cards')
      .update({ is_reissued: true, status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', cardId);
    throwIfDbError(updErr);

    return this.getById(cardId, branchId);
  }

  async getAnalytics(branchId: string): Promise<{
    data: {
      totalCards: number;
      issued: number;
      reprintCount: number;
      reprintRate: number;
    };
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { count: totalCards } = await supabase
      .from('id_cards')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId);
    const { count: issued } = await supabase
      .from('id_cards')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('status', 'issued');
    const { count: reprintCount } = await supabase
      .from('id_card_reprints')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId);
    const total = totalCards ?? 0;
    const reprints = reprintCount ?? 0;
    return {
      data: {
        totalCards: total,
        issued: issued ?? 0,
        reprintCount: reprints,
        reprintRate: total > 0 ? Math.round((reprints / total) * 1000) / 10 : 0,
      },
    };
  }

}
