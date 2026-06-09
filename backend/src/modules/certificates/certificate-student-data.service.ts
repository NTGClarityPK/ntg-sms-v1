import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { ParentsService } from '../parents/parents.service';
import { throwIfDbError } from './utils/throw-if-db-error.util';
import type { CertificateStudentSnapshot } from './certificate-render.mapper';
import type { CertificateType } from './types/certificate.types';
import { isAdministrativeType, isAwardType } from './utils/certificate-type.util';
import { TERMINAL_ENROLMENT_STATUSES } from './types/certificate.types';

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function yearsBetween(startIso: string | null, end: Date): string {
  if (!startIso) return '—';
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return '—';
  const years = Math.max(
    0,
    end.getFullYear() -
      start.getFullYear() -
      (end < new Date(end.getFullYear(), start.getMonth(), start.getDate()) ? 1 : 0),
  );
  return years > 0 ? `${years} year${years === 1 ? '' : 's'}` : 'Less than 1 year';
}

@Injectable()
export class CertificateStudentDataService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly parentsService: ParentsService,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  private async resolveActiveAcademicYearId(branchId: string): Promise<string> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear?.id) {
      throw new BadRequestException(
        'No active academic year found. Please activate an academic year in Settings.',
      );
    }
    return activeYear.id;
  }

  async assertStudentEligible(
    studentId: string,
    branchId: string,
    certificateType: CertificateType,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const yearId = await this.resolveActiveAcademicYearId(branchId);

    const { data: enrol, error } = await supabase
      .from('student_enrolments')
      .select('status')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .maybeSingle();
    throwIfDbError(error);
    if (!enrol) {
      throw new BadRequestException('Student has no enrolment for the active academic year');
    }

    const status = (enrol as { status: string }).status;

    if (certificateType === 'leaving') {
      if (!TERMINAL_ENROLMENT_STATUSES.includes(status as (typeof TERMINAL_ENROLMENT_STATUSES)[number])) {
        throw new BadRequestException(
          'Leaving certificates can only be issued to students who have left or completed education (transferred, withdrawn, or graduated)',
        );
      }
      return;
    }

    if (isAwardType(certificateType) || certificateType === 'character') {
      if (status !== 'active') {
        throw new BadRequestException(
          'This certificate type requires an active student enrolment',
        );
      }
    }

    if (isAdministrativeType(certificateType) && certificateType !== 'character' && status !== 'active') {
      throw new BadRequestException('Student enrolment is not active');
    }
  }

  async loadStudentSnapshot(
    studentId: string,
    branchId: string,
  ): Promise<CertificateStudentSnapshot> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('students')
      .select(
        'id, user_id, student_id, first_name, last_name, admission_date, class_id, section_id, academic_year_id',
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
      admission_date: string | null;
      class_id: string | null;
      section_id: string | null;
      academic_year_id: string | null;
    };

    let className = '';
    let sectionName = '';
    const yearId = row.academic_year_id;
    if (yearId) {
      const { data: enrol } = await supabase
        .from('student_enrolments')
        .select('class_id, section_id')
        .eq('student_id', studentId)
        .eq('academic_year_id', yearId)
        .eq('branch_id', branchId)
        .maybeSingle();
      const classId = (enrol as { class_id?: string } | null)?.class_id ?? row.class_id;
      const sectionId = (enrol as { section_id?: string } | null)?.section_id ?? row.section_id;
      if (classId) {
        const { data: cls } = await supabase
          .from('classes')
          .select('display_name, name')
          .eq('id', classId)
          .maybeSingle();
        className =
          (cls as { display_name?: string; name?: string } | null)?.display_name ??
          (cls as { name?: string } | null)?.name ??
          '';
      }
      if (sectionId) {
        const { data: sec } = await supabase
          .from('sections')
          .select('name')
          .eq('id', sectionId)
          .maybeSingle();
        sectionName = (sec as { name?: string } | null)?.name ?? '';
      }
    }

    let dateOfBirth = '—';
    if (row.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('date_of_birth')
        .eq('id', row.user_id)
        .maybeSingle();
      dateOfBirth = formatShortDate(
        (profile as { date_of_birth?: string } | null)?.date_of_birth,
      );
    }

    const guardians = await this.parentsService.getGuardiansForStudent(studentId);
    const father = guardians.find((g) => g.relationship === 'father');
    const primary = father ?? guardians.find((g) => g.isPrimary) ?? guardians[0];

    const studentName =
      [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Student';
    const classSection = [className, sectionName].filter(Boolean).join(' · ') || '—';

    let academicSession = '—';
    if (yearId) {
      const { data: ay } = await supabase
        .from('academic_years')
        .select('name')
        .eq('id', yearId)
        .maybeSingle();
      academicSession = (ay as { name?: string } | null)?.name ?? '—';
    }

    return {
      studentName,
      parentName: primary?.parentName ?? '—',
      dateOfBirth,
      admissionNumber: row.student_id,
      admissionDate: formatShortDate(row.admission_date ?? undefined),
      classLastAttended: classSection,
      academicSession,
      yearsAttended: yearsBetween(row.admission_date, new Date()),
    };
  }

  async resolveClassTeacherName(
    studentId: string,
    branchId: string,
  ): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    const yearId = activeYear?.id;
    if (!yearId) return '—';

    const { data: enrol } = await supabase
      .from('student_enrolments')
      .select('class_id, section_id')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .maybeSingle();
    const classId = (enrol as { class_id?: string } | null)?.class_id;
    const sectionId = (enrol as { section_id?: string } | null)?.section_id;
    if (!classId || !sectionId) return '—';

    const { data: cs } = await supabase
      .from('class_sections')
      .select('class_teacher_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .eq('class_id', classId)
      .eq('section_id', sectionId)
      .maybeSingle();
    const teacherId = (cs as { class_teacher_id?: string } | null)?.class_teacher_id;
    if (!teacherId) return '—';

    const { data: staff } = await supabase
      .from('staff')
      .select('user_id')
      .eq('id', teacherId)
      .maybeSingle();
    const userId = (staff as { user_id?: string } | null)?.user_id;
    if (!userId) return '—';

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();
    return (profile as { full_name?: string } | null)?.full_name?.trim() || '—';
  }
}
