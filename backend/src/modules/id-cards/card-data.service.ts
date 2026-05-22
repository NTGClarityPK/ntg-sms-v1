import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { ParentsService } from '../parents/parents.service';
import type { IdCardPersonType } from './types/id-card-person-type';
import type { IdCardRenderData } from './types/id-card-render-data';
import { IdCardPdfService } from './id-card-pdf.service';
import { PDF_DEFAULT_PRIMARY } from '../results/pdf-theme';
import {
  formatStaffJoinDate,
  formatStaffRoleBadgeHtml,
  formatStaffRoleDisplayName,
  pickPrimaryStaffRoleName,
} from './utils/staff-role-format.util';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function formatShortDate(iso: string | undefined): string {
  if (!iso) return '—';
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

@Injectable()
export class CardDataService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly parentsService: ParentsService,
    private readonly idCardPdfService: IdCardPdfService,
  ) {}

  async buildCardPayload(
    personType: IdCardPersonType,
    personId: string,
    branchId: string,
    cardNumber: string,
    options?: { isReissued?: boolean; verifyBaseUrl?: string },
  ): Promise<IdCardRenderData> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('tenant_id, name, address, phone, email')
      .eq('id', branchId)
      .maybeSingle();
    throwIfDbError(branchErr);
    if (!branch) throw new NotFoundException('Branch not found');

    const tenantId = (branch as { tenant_id: string }).tenant_id;
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('name, logo_url, phone, domain')
      .eq('id', tenantId)
      .maybeSingle();
    throwIfDbError(tenantErr);

    const themeKey = `tenant_theme_primary_color:${tenantId}`;
    const { data: settings, error: settingsErr } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', themeKey)
      .maybeSingle();
    throwIfDbError(settingsErr);
    const raw = (settings as { value?: unknown } | null)?.value;
    const primaryColor =
      typeof raw === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw.trim()) ? raw.trim() : null;

    const { data: activeYear } = await supabase
      .from('academic_years')
      .select('name, start_date, end_date')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    const validFrom = (activeYear as { start_date?: string } | null)?.start_date ?? new Date().toISOString().slice(0, 10);
    const validUntil = (activeYear as { end_date?: string } | null)?.end_date ?? validFrom;

    let render: Partial<IdCardRenderData> = {
      schoolName: (tenant as { name?: string } | null)?.name ?? (branch as { name?: string }).name ?? 'School',
      schoolLogoUrl: (tenant as { logo_url?: string } | null)?.logo_url ?? '',
      academicYearLabel: (activeYear as { name?: string } | null)?.name ?? '',
      personType,
      cardNumber,
      validFrom: formatShortDate(validFrom),
      validUntil: formatShortDate(validUntil),
      primaryColor: primaryColor ?? PDF_DEFAULT_PRIMARY,
      schoolPhone:
        (branch as { phone?: string | null }).phone ??
        (tenant as { phone?: string } | null)?.phone ??
        '',
      schoolEmail:
        (branch as { email?: string | null }).email ?? '',
      schoolWebsite: (tenant as { domain?: string } | null)?.domain ?? '',
      schoolLocation: (branch as { address?: string | null }).address ?? '',
      isReissued: options?.isReissued ?? false,
      reissuedLabel: 'REISSUED',
      photoUrl: '',
      email: '',
      phone: '',
      address: '',
      bloodGroup: '',
      dateOfBirth: '',
      admissionDate: '',
      guardianName: '',
      guardianPhone: '',
      guardianRelation: '',
      fullName: '',
      roleLabel: '',
      classSection: '',
      rollOrEmployeeId: '',
    };

    if (personType === 'student') {
      render = { ...render, ...(await this.loadStudentFields(personId, branchId)) };
    } else if (personType === 'staff' || personType === 'admin') {
      render = { ...render, ...(await this.loadStaffFields(personId, branchId, personType)) };
    } else {
      throw new BadRequestException('Visitor cards require manual data entry (not yet supported)');
    }

    const verifyUrl = options?.verifyBaseUrl
      ? `${options.verifyBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(cardNumber)}`
      : cardNumber;
    const qrCodeDataUrl = await this.idCardPdfService.buildQrDataUrl(verifyUrl);
    return { ...(render as IdCardRenderData), qrCodeDataUrl };
  }

  private async loadStudentFields(
    studentId: string,
    branchId: string,
  ): Promise<Partial<IdCardRenderData>> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('students')
      .select(
        'id, user_id, student_id, first_name, last_name, blood_group, admission_date, class_id, section_id, academic_year_id',
      )
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Student not found');

    const row = data as {
      user_id: string | null;
      student_id: string;
      first_name: string | null;
      last_name: string | null;
      blood_group: string | null;
      admission_date: string | null;
      class_id: string | null;
      section_id: string | null;
      academic_year_id: string | null;
    };

    let className = '';
    let sectionName = '';
    if (row.academic_year_id) {
      const { data: enrol } = await supabase
        .from('student_enrolments')
        .select('class_id, section_id')
        .eq('student_id', studentId)
        .eq('academic_year_id', row.academic_year_id)
        .eq('branch_id', branchId)
        .maybeSingle();
      const classId = (enrol as { class_id?: string } | null)?.class_id ?? row.class_id;
      const sectionId = (enrol as { section_id?: string } | null)?.section_id ?? row.section_id;
      if (classId) {
        const { data: cls } = await supabase.from('classes').select('display_name, name').eq('id', classId).maybeSingle();
        className = (cls as { display_name?: string; name?: string } | null)?.display_name ?? (cls as { name?: string } | null)?.name ?? '';
      }
      if (sectionId) {
        const { data: sec } = await supabase.from('sections').select('name').eq('id', sectionId).maybeSingle();
        sectionName = (sec as { name?: string } | null)?.name ?? '';
      }
    }

    let photoUrl = '';
    let phone = '';
    let address = '';
    let dateOfBirth = '';
    let email = '';
    if (row.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, phone, address, date_of_birth, email')
        .eq('id', row.user_id)
        .maybeSingle();
      photoUrl = (profile as { avatar_url?: string } | null)?.avatar_url ?? '';
      phone = (profile as { phone?: string } | null)?.phone ?? '';
      address = (profile as { address?: string } | null)?.address ?? '';
      dateOfBirth = formatShortDate((profile as { date_of_birth?: string } | null)?.date_of_birth);
      email = (profile as { email?: string } | null)?.email ?? '';
      if (!email) {
        const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);
        email = authUser.user?.email ?? '';
      }
    }

    const guardians = await this.parentsService.getGuardiansForStudent(studentId);
    const primary = guardians.find((g) => g.isPrimary) ?? guardians[0];

    return {
      fullName: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Student',
      roleLabel: 'Student',
      classSection: [className, sectionName].filter(Boolean).join(' · ') || '—',
      rollOrEmployeeId: row.student_id,
      photoUrl,
      phone,
      address,
      email,
      bloodGroup: row.blood_group ?? '—',
      dateOfBirth,
      admissionDate: formatShortDate(row.admission_date ?? undefined),
      guardianName: primary?.parentName ?? '—',
      guardianPhone: primary?.parentPhone ?? primary?.parentEmail ?? '—',
      guardianRelation: primary?.relationship ?? '—',
    };
  }

  private async loadStaffFields(
    staffId: string,
    branchId: string,
    personType: IdCardPersonType,
  ): Promise<Partial<IdCardRenderData>> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('staff')
      .select('id, user_id, employee_id, department, join_date')
      .eq('id', staffId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Staff member not found');

    const row = data as {
      user_id: string;
      employee_id: string | null;
      department: string | null;
      join_date: string | null;
    };
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, phone, address, date_of_birth')
      .eq('id', row.user_id)
      .maybeSingle();

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role_id, roles:role_id(name, display_name)')
      .eq('user_id', row.user_id)
      .eq('branch_id', branchId);

    const roleEntries = (roles || [])
      .map((r) => {
        const rel = (r as { roles: { name: string; display_name?: string } | { name: string; display_name?: string }[] | null })
          .roles;
        const role = Array.isArray(rel) ? rel[0] : rel;
        if (!role?.name) return null;
        return {
          name: role.name,
          displayName: role.display_name?.trim() || formatStaffRoleDisplayName(role.name),
        };
      })
      .filter((e): e is { name: string; displayName: string } => e !== null);

    const roleNames = roleEntries.map((e) => e.name);
    const primaryRoleName = pickPrimaryStaffRoleName(roleNames);
    const primaryDisplay =
      roleEntries.find((e) => e.name === primaryRoleName)?.displayName ??
      formatStaffRoleDisplayName(primaryRoleName);
    const positionLabel =
      personType === 'admin'
        ? 'Administrator'
        : primaryDisplay || 'Staff';
    const department = row.department?.trim() || '—';
    const joinDateLabel = formatStaffJoinDate(row.join_date);

    return {
      fullName: (profile as { full_name?: string } | null)?.full_name ?? 'Staff',
      roleLabel: positionLabel,
      classSection: department,
      staffDepartment: department,
      staffPosition: positionLabel,
      staffJoinDate: joinDateLabel,
      staffRoleBadgeHtml: formatStaffRoleBadgeHtml(positionLabel),
      rollOrEmployeeId: row.employee_id ?? row.user_id.slice(0, 8),
      photoUrl: (profile as { avatar_url?: string } | null)?.avatar_url ?? '',
      phone: (profile as { phone?: string } | null)?.phone ?? '',
      address: (profile as { address?: string } | null)?.address ?? '',
      dateOfBirth: formatShortDate((profile as { date_of_birth?: string } | null)?.date_of_birth),
      email: '',
      bloodGroup: '—',
      admissionDate: joinDateLabel,
      guardianName: '—',
      guardianPhone: '—',
      guardianRelation: '—',
    };
  }
}
