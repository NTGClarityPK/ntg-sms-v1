import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../../common/config/supabase.config';
import { RubricsService } from '../../rubrics/rubrics.service';
import type {
  GradePullResultDto,
  GoogleClassroomRubric,
  GoogleRubricGrade,
  GoogleStudentSubmission,
  GoogleWorkspaceSettingsRow,
} from '../types/google-classroom.types';
import { GoogleClassroomApiService } from './google-classroom-api.service';
import { GoogleOAuthService } from './google-oauth.service';
import { TokenEncryptionService } from './token-encryption.service';
import {
  collectRubricHintsFromSubmissions,
  criterionMaxPoints,
  fingerprintAlmaRubric,
  fingerprintGoogleRubric,
  mapGoogleCriteriaForImport,
  shouldFetchGoogleRubric,
} from '../utils/rubric-fingerprint.util';

type AssessmentRow = {
  id: string;
  branch_id: string;
  class_section_id: string;
  subject_id: string;
  academic_year_id: string;
  grading_source: string;
  google_course_id: string | null;
  google_coursework_id: string | null;
  has_rubric: boolean;
};

type StudentRow = {
  id: string;
  user_id: string | null;
  google_account_email?: string | null;
};

type CategoryRow = {
  id: string;
  google_criterion_id: string | null;
  max_marks: number;
  google_max_points: number | null;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class GradePullService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly classroomApi: GoogleClassroomApiService,
    private readonly rubricsService: RubricsService,
  ) {}

  async pullGrades(
    assessmentId: string,
    branchId: string,
    userId: string,
  ): Promise<{ data: GradePullResultDto }> {
    const startedAt = Date.now();
    const supabase = this.supabaseConfig.getClient();

    const { data: assessmentRaw, error: assessmentError } = await supabase
      .from('assessments')
      .select(
        'id, branch_id, class_section_id, subject_id, academic_year_id, grading_source, google_course_id, google_coursework_id, has_rubric, total_marks',
      )
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(assessmentError);
    if (!assessmentRaw) {
      throw new NotFoundException('Assessment not found');
    }

    const assessment = assessmentRaw as AssessmentRow & { total_marks?: number | string | null };
    if (assessment.grading_source !== 'google_classroom') {
      throw new BadRequestException(
        'Assessment is not linked to Google Classroom',
      );
    }
    if (!assessment.google_course_id || !assessment.google_coursework_id) {
      throw new BadRequestException(
        'Assessment is missing Google course or coursework identifiers',
      );
    }

    const accessToken = await this.resolveAccessToken(branchId);

    let submissions: GoogleStudentSubmission[];
    let googleMaxPoints: number | null = null;
    let googleRubric: GoogleClassroomRubric | null = null;
    let courseworkForRubric: Awaited<
      ReturnType<GoogleClassroomApiService['getCoursework']>
    > | null = null;
    try {
      const coursework = await this.classroomApi.getCoursework(
        accessToken,
        assessment.google_course_id,
        assessment.google_coursework_id,
      );
      courseworkForRubric = coursework;
      googleMaxPoints =
        typeof coursework.maxPoints === 'number' && coursework.maxPoints > 0
          ? coursework.maxPoints
          : null;
      submissions = await this.classroomApi.listStudentSubmissions(
        accessToken,
        assessment.google_course_id,
        assessment.google_coursework_id,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch Google submissions';
      await this.writeAuditLog({
        branchId,
        assessmentId,
        userId,
        syncStatus: 'failed',
        synced: 0,
        failed: 0,
        errorMessage: message,
        durationMs: Date.now() - startedAt,
      });
      await this.updateSyncMeta(branchId, assessmentId, 'failed', message);
      throw err;
    }

    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .eq('id', assessment.class_section_id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(csError);
    if (!classSection) {
      throw new NotFoundException('Class section not found for assessment');
    }

    const cs = classSection as {
      class_id: string;
      section_id: string;
    };

    // Prefer year-scoped enrolments (source of truth), fall back to students.class/section.
    const { data: enrolmentsRaw, error: enrolError } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', assessment.academic_year_id)
      .eq('class_id', cs.class_id)
      .eq('section_id', cs.section_id)
      .eq('status', 'active');
    throwIfDbError(enrolError);

    const enrolledIds = [
      ...new Set(
        ((enrolmentsRaw || []) as Array<{ student_id: string }>)
          .map((e) => e.student_id)
          .filter(Boolean),
      ),
    ];

    const studentsQuery =
      enrolledIds.length > 0
        ? supabase
            .from('students')
            .select('id, user_id, google_account_email')
            .eq('branch_id', branchId)
            .in('id', enrolledIds)
            .eq('is_active', true)
        : supabase
            .from('students')
            .select('id, user_id, google_account_email')
            .eq('branch_id', branchId)
            .eq('class_id', cs.class_id)
            .eq('section_id', cs.section_id)
            .eq('is_active', true);

    const { data: studentsRaw, error: studentsError } = await studentsQuery;
    throwIfDbError(studentsError);

    const students = (studentsRaw || []) as StudentRow[];
    const userIds = students
      .map((s) => s.user_id)
      .filter((id): id is string => !!id);

    const emailToStudentId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);
      throwIfDbError(profilesError);

      const userIdToEmail = new Map<string, string>();
      for (const p of profiles || []) {
        const row = p as { id: string; email: string | null };
        if (row.email) {
          userIdToEmail.set(row.id, row.email.toLowerCase().trim());
        }
      }
      // Fallback: school login email
      for (const student of students) {
        if (!student.user_id) continue;
        const email = userIdToEmail.get(student.user_id);
        if (email) emailToStudentId.set(email, student.id);
      }
    }

    // Preferred: explicit Google Classroom account email (overrides login email collisions)
    for (const student of students) {
      const googleEmail = student.google_account_email?.toLowerCase().trim();
      if (googleEmail) emailToStudentId.set(googleEmail, student.id);
    }

    let { data: rubricDto } = await this.rubricsService.getAssessmentRubric(
      assessmentId,
      branchId,
    );

    const { rubricIdHint, criterionIds } =
      collectRubricHintsFromSubmissions(submissions);

    // Only hit Google rubrics API when Alma is missing / stale relative to submission hints.
    if (shouldFetchGoogleRubric(rubricDto, rubricIdHint, criterionIds)) {
      try {
        googleRubric = await this.classroomApi.getRubricIfAny(
          accessToken,
          assessment.google_course_id,
          assessment.google_coursework_id,
          courseworkForRubric ?? undefined,
          rubricIdHint,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to fetch Google Classroom rubric';
        await this.writeAuditLog({
          branchId,
          assessmentId,
          userId,
          syncStatus: 'failed',
          synced: 0,
          failed: 0,
          errorMessage: message,
          durationMs: Date.now() - startedAt,
        });
        await this.updateSyncMeta(branchId, assessmentId, 'failed', message);
        throw err;
      }

      // Google is authoritative once linked: override Alma only when structure changed.
      if (googleRubric?.criteria?.length) {
        const googleFp = fingerprintGoogleRubric(googleRubric);
        const almaFp = rubricDto ? fingerprintAlmaRubric(rubricDto) : '';
        if (googleFp !== almaFp) {
          const tenantId = await this.resolveTenantId(branchId);
          await this.rubricsService.importGoogleRubric(
            assessmentId,
            branchId,
            tenantId,
            userId,
            googleRubric.id ?? null,
            mapGoogleCriteriaForImport(googleRubric),
          );
          ({ data: rubricDto } = await this.rubricsService.getAssessmentRubric(
            assessmentId,
            branchId,
          ));
        }
      }
    }

    const googleMaxByCriterionId = new Map<string, number>();
    for (const criterion of googleRubric?.criteria ?? []) {
      googleMaxByCriterionId.set(criterion.id, criterionMaxPoints(criterion));
    }

    let categories: CategoryRow[] = [];
    if (rubricDto?.categories?.length) {
      categories = rubricDto.categories
        .filter((c) => !!c.googleCriterionId)
        .map((c) => ({
          id: c.id,
          google_criterion_id: c.googleCriterionId ?? null,
          max_marks: c.maxMarks,
          google_max_points: c.googleCriterionId
            ? (googleMaxByCriterionId.get(c.googleCriterionId) ?? null)
            : null,
        }));
    }

    const almaTotalMarks = Number(assessment.total_marks);
    const canScale =
      Number.isFinite(almaTotalMarks) &&
      almaTotalMarks > 0 &&
      googleMaxPoints != null &&
      googleMaxPoints > 0;

    let synced = 0;
    let failed = 0;
    let missingEmail = 0;
    let missingGrade = 0;
    const unmatchedGoogleEmails: string[] = [];
    const failureReasons: string[] = [];
    const now = new Date().toISOString();

    for (const submission of submissions) {
      const email =
        submission.userProfile?.emailAddress?.toLowerCase().trim() ?? null;
      if (!email) {
        missingEmail += 1;
        failed += 1;
        continue;
      }

      const studentId = emailToStudentId.get(email);
      if (!studentId) {
        unmatchedGoogleEmails.push(email);
        continue;
      }

      const rawMarks =
        submission.assignedGrade ?? submission.draftGrade ?? null;
      if (rawMarks == null && categories.length === 0) {
        missingGrade += 1;
        failed += 1;
        continue;
      }

      const marksObtained =
        rawMarks == null
          ? 0
          : canScale
            ? Math.round(((Number(rawMarks) / googleMaxPoints!) * almaTotalMarks) * 100) / 100
            : Number(rawMarks);

      try {
        const studentGradeId = await this.upsertStudentGrade({
          studentId,
          assessmentId,
          branchId,
          academicYearId: assessment.academic_year_id,
          marksObtained,
          userId,
          now,
        });

        if (categories.length > 0) {
          await this.upsertRubricScoresFromSubmission({
            studentGradeId,
            branchId,
            userId,
            now,
            categories,
            submission,
          });
        }

        synced += 1;
      } catch (err) {
        failed += 1;
        const reason = err instanceof Error ? err.message : 'Unknown save error';
        if (failureReasons.length < 3) {
          failureReasons.push(`${email}: ${reason}`);
        }
      }
    }

    const syncStatus =
      failed === 0 && unmatchedGoogleEmails.length === 0
        ? 'success'
        : synced > 0
          ? 'partial'
          : 'failed';

    const details: string[] = [];
    if (missingEmail > 0) {
      details.push(
        `${missingEmail} submission(s) had no Google email (reconnect Google Classroom to grant profile email access)`,
      );
    }
    if (missingGrade > 0) {
      details.push(`${missingGrade} matched student(s) had no grade in Google yet`);
    }
    if (unmatchedGoogleEmails.length > 0) {
      details.push(
        `${unmatchedGoogleEmails.length} unmatched Google email(s): ${unmatchedGoogleEmails.slice(0, 5).join(', ')}`,
      );
    }
    if (failureReasons.length > 0) {
      details.push(`save errors: ${failureReasons.join('; ')}`);
    }

    const message =
      syncStatus === 'success'
        ? `Synced ${synced} student grade(s) from Google Classroom`
        : `Synced ${synced} grade(s); ${failed} failed. ${details.join('. ')}`;

    await this.writeAuditLog({
      branchId,
      assessmentId,
      userId,
      syncStatus,
      synced,
      failed: failed + unmatchedGoogleEmails.length,
      errorMessage: syncStatus === 'success' ? null : message,
      durationMs: Date.now() - startedAt,
    });
    await this.updateSyncMeta(
      branchId,
      assessmentId,
      syncStatus,
      syncStatus === 'success' ? null : message,
    );

    return {
      data: {
        synced,
        failed,
        unmatchedGoogleEmails,
        message,
      },
    };
  }

  private async resolveAccessToken(branchId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('google_workspace_settings')
      .select(
        'id, branch_id, is_connected, access_token_encrypted, refresh_token_encrypted, token_expires_at',
      )
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new BadRequestException(
        'Google Workspace is not configured for this branch',
      );
    }

    const settings = data as Pick<
      GoogleWorkspaceSettingsRow,
      | 'id'
      | 'branch_id'
      | 'is_connected'
      | 'access_token_encrypted'
      | 'refresh_token_encrypted'
      | 'token_expires_at'
    >;

    if (
      !settings.is_connected ||
      !settings.access_token_encrypted ||
      !settings.refresh_token_encrypted
    ) {
      throw new BadRequestException(
        'Google Classroom is not connected for this branch',
      );
    }

    const expiresAt = settings.token_expires_at
      ? new Date(settings.token_expires_at).getTime()
      : 0;
    const needsRefresh = expiresAt < Date.now() + 60_000;

    if (!needsRefresh) {
      return this.tokenEncryption.decrypt(settings.access_token_encrypted);
    }

    const refreshToken = this.tokenEncryption.decrypt(
      settings.refresh_token_encrypted,
    );
    try {
      const refreshed = await this.googleOAuth.refreshAccessToken(refreshToken);
      const accessEncrypted = this.tokenEncryption.encrypt(
        refreshed.accessToken,
      );
      const refreshEncrypted = refreshed.refreshToken
        ? this.tokenEncryption.encrypt(refreshed.refreshToken)
        : settings.refresh_token_encrypted;

      await supabase
        .from('google_workspace_settings')
        .update({
          access_token_encrypted: accessEncrypted,
          refresh_token_encrypted: refreshEncrypted,
          token_expires_at: refreshed.expiresAt.toISOString(),
          scopes: refreshed.scopes,
          updated_at: new Date().toISOString(),
        })
        .eq('branch_id', branchId);

      return refreshed.accessToken;
    } catch (err) {
      await supabase
        .from('google_workspace_settings')
        .update({
          is_connected: false,
          last_sync_status: 'failed',
          last_sync_error:
            'Google access token expired. Please reconnect Google Classroom.',
          updated_at: new Date().toISOString(),
        })
        .eq('branch_id', branchId);
      throw err;
    }
  }

  private async upsertStudentGrade(input: {
    studentId: string;
    assessmentId: string;
    branchId: string;
    academicYearId: string;
    marksObtained: number;
    userId: string;
    now: string;
  }): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { data: existing, error: existingError } = await supabase
      .from('student_grades')
      .select('id')
      .eq('student_id', input.studentId)
      .eq('assessment_id', input.assessmentId)
      .eq('branch_id', input.branchId)
      .maybeSingle();
    throwIfDbError(existingError);

    if (existing) {
      const gradeId = (existing as { id: string }).id;
      const { error: updateError } = await supabase
        .from('student_grades')
        .update({
          marks_obtained: input.marksObtained,
          submission_status: 'submitted',
          graded_by: input.userId,
          graded_at: input.now,
          submitted_at: input.now,
        })
        .eq('id', gradeId)
        .eq('branch_id', input.branchId);
      throwIfDbError(updateError);
      return gradeId;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('student_grades')
      .insert({
        student_id: input.studentId,
        assessment_id: input.assessmentId,
        marks_obtained: input.marksObtained,
        submission_status: 'submitted',
        graded_by: input.userId,
        graded_at: input.now,
        submitted_at: input.now,
        branch_id: input.branchId,
        academic_year_id: input.academicYearId,
      })
      .select('id')
      .single();
    throwIfDbError(insertError);
    if (!inserted) {
      throw new BadRequestException('Failed to create student grade');
    }
    return (inserted as { id: string }).id;
  }

  private async resolveTenantId(branchId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('google_workspace_settings')
      .select('tenant_id')
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    return (data as { tenant_id: string | null } | null)?.tenant_id ?? null;
  }

  private scaleCriterionPoints(
    googlePoints: number,
    googleMax: number | null,
    almaMax: number,
  ): number {
    if (!Number.isFinite(googlePoints) || googlePoints < 0) return 0;
    if (
      googleMax != null &&
      googleMax > 0 &&
      Number.isFinite(almaMax) &&
      almaMax > 0 &&
      Math.abs(googleMax - almaMax) > 0.001
    ) {
      return Math.min(
        Math.round(((googlePoints / googleMax) * almaMax) * 100) / 100,
        almaMax,
      );
    }
    return Math.min(googlePoints, almaMax);
  }

  private async upsertRubricScoresFromSubmission(input: {
    studentGradeId: string;
    branchId: string;
    userId: string;
    now: string;
    categories: CategoryRow[];
    submission: GoogleStudentSubmission;
  }): Promise<void> {
    const gradeMap = new Map<string, GoogleRubricGrade>();
    const assigned = input.submission.assignedRubricGrades ?? {};
    const draft = input.submission.draftRubricGrades ?? {};
    for (const [key, value] of Object.entries(assigned)) {
      gradeMap.set(value.criterionId || key, value);
    }
    for (const [key, value] of Object.entries(draft)) {
      const criterionId = value.criterionId || key;
      if (!gradeMap.has(criterionId)) {
        gradeMap.set(criterionId, value);
      }
    }

    if (gradeMap.size === 0) return;

    const supabase = this.supabaseConfig.getClient();
    let total = 0;
    let scored = 0;

    for (const category of input.categories) {
      if (!category.google_criterion_id) continue;
      const rubricGrade = gradeMap.get(category.google_criterion_id);
      if (!rubricGrade || rubricGrade.points == null) continue;

      const marks = this.scaleCriterionPoints(
        Number(rubricGrade.points),
        category.google_max_points,
        category.max_marks,
      );
      total += marks;
      scored += 1;

      const { error } = await supabase.from('student_rubric_scores').upsert(
        {
          student_grade_id: input.studentGradeId,
          rubric_category_id: category.id,
          marks_obtained: marks,
          branch_id: input.branchId,
          graded_by: input.userId,
          graded_at: input.now,
          source: 'google_classroom',
        },
        { onConflict: 'student_grade_id,rubric_category_id' },
      );
      throwIfDbError(error);
    }

    if (scored > 0) {
      await supabase
        .from('student_grades')
        .update({
          marks_obtained: total,
          graded_by: input.userId,
          graded_at: input.now,
          submission_status: 'submitted',
        })
        .eq('id', input.studentGradeId)
        .eq('branch_id', input.branchId);
    }
  }

  private async writeAuditLog(input: {
    branchId: string;
    assessmentId: string;
    userId: string;
    syncStatus: string;
    synced: number;
    failed: number;
    errorMessage: string | null;
    durationMs: number;
  }): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    await supabase.from('google_sync_audit_log').insert({
      branch_id: input.branchId,
      assessment_id: input.assessmentId,
      triggered_by_user_id: input.userId,
      sync_status: input.syncStatus,
      students_synced: input.synced,
      students_failed: input.failed,
      error_message: input.errorMessage,
      duration_ms: input.durationMs,
    });
  }

  private async updateSyncMeta(
    branchId: string,
    assessmentId: string,
    status: string,
    errorMessage: string | null,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('assessments')
        .update({ google_last_synced_at: now })
        .eq('id', assessmentId)
        .eq('branch_id', branchId),
      supabase
        .from('google_workspace_settings')
        .update({
          last_sync_at: now,
          last_sync_status: status,
          last_sync_error: errorMessage,
          updated_at: now,
        })
        .eq('branch_id', branchId),
    ]);
  }
}
