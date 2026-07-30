import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { RubricsService } from '../rubrics/rubrics.service';
import { CreateGoogleCourseMappingDto } from './dto/create-mapping.dto';
import { QuerySyncHistoryDto } from './dto/query-sync-history.dto';
import { GradePullService } from './services/grade-pull.service';
import { GoogleClassroomApiService } from './services/google-classroom-api.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { TokenEncryptionService } from './services/token-encryption.service';
import {
  fingerprintAlmaRubric,
  fingerprintGoogleRubric,
  mapGoogleCriteriaForImport,
} from './utils/rubric-fingerprint.util';
import type {
  AssessmentGoogleSyncStatusDto,
  GoogleClassroomCourse,
  GoogleClassroomCoursework,
  GoogleCourseMappingDto,
  GoogleMappingSuggestionDto,
  GoogleOAuthStatePayload,
  GoogleSyncAuditDto,
  GoogleWorkspaceSettingsDto,
  GoogleWorkspaceSettingsRow,
  GradePullResultDto,
} from './types/google-classroom.types';

const SETTINGS_SELECT =
  'id, branch_id, tenant_id, is_feature_enabled, is_connected, google_domain, connected_email, connected_by_user_id, connected_at, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, last_sync_at, last_sync_status, last_sync_error, created_at, updated_at';

const MAPPING_SELECT =
  'id, branch_id, class_section_id, subject_id, google_course_id, google_course_name, google_course_section, linked_by_user_id, linked_at, is_active, created_at, updated_at';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function encodeState(payload: GoogleOAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeState(state: string): GoogleOAuthStatePayload {
  try {
    const json = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<GoogleOAuthStatePayload>;
    if (!parsed.branchId || !parsed.userId || !parsed.nonce) {
      throw new Error('invalid');
    }
    return {
      branchId: parsed.branchId,
      userId: parsed.userId,
      nonce: parsed.nonce,
    };
  } catch {
    throw new BadRequestException('Invalid OAuth state');
  }
}

function normaliseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function nameSimilarity(a: string, b: string): number {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i += 1) {
      set.add(s.slice(i, i + 2));
    }
    return set;
  };
  const aSet = bigrams(na);
  const bSet = bigrams(nb);
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let overlap = 0;
  for (const g of aSet) {
    if (bSet.has(g)) overlap += 1;
  }
  return (2 * overlap) / (aSet.size + bSet.size);
}

@Injectable()
export class GoogleWorkspaceService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly configService: ConfigService,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly classroomApi: GoogleClassroomApiService,
    private readonly gradePullService: GradePullService,
    private readonly rubricsService: RubricsService,
  ) {}

  async getOrCreateSettings(
    branchId: string,
    tenantId: string | null,
  ): Promise<GoogleWorkspaceSettingsRow> {
    const supabase = this.supabaseConfig.getClient();
    const { data: existing, error } = await supabase
      .from('google_workspace_settings')
      .select(SETTINGS_SELECT)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (existing) return existing as GoogleWorkspaceSettingsRow;

    const { data: created, error: createError } = await supabase
      .from('google_workspace_settings')
      .insert({
        branch_id: branchId,
        tenant_id: tenantId,
        is_feature_enabled: false,
        is_connected: false,
      })
      .select(SETTINGS_SELECT)
      .single();
    throwIfDbError(createError);
    if (!created) {
      throw new BadRequestException('Failed to create Google Workspace settings');
    }
    return created as GoogleWorkspaceSettingsRow;
  }

  async getSettings(
    branchId: string,
    tenantId: string | null,
  ): Promise<{ data: GoogleWorkspaceSettingsDto }> {
    const row = await this.getOrCreateSettings(branchId, tenantId);
    return { data: this.mapSettings(row) };
  }

  async updateFeatureEnabled(
    branchId: string,
    enabled: boolean,
    tenantId: string | null,
  ): Promise<{ data: GoogleWorkspaceSettingsDto }> {
    await this.getOrCreateSettings(branchId, tenantId);
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('google_workspace_settings')
      .update({
        is_feature_enabled: enabled,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      })
      .eq('branch_id', branchId)
      .select(SETTINGS_SELECT)
      .single();
    throwIfDbError(error);
    return { data: this.mapSettings(data as GoogleWorkspaceSettingsRow) };
  }

  async startConnect(
    branchId: string,
    userId: string,
  ): Promise<{ data: { authorizationUrl: string } }> {
    await this.assertFeatureEnabled(branchId);
    const state = encodeState({
      branchId,
      userId,
      nonce: randomBytes(16).toString('hex'),
    });
    const authorizationUrl = this.googleOAuth.getAuthorizationUrl(state);
    return { data: { authorizationUrl } };
  }

  async handleOAuthCallback(
    code: string,
    state: string,
  ): Promise<{ branchId: string; frontendRedirect: string }> {
    const payload = decodeState(state);
    const tokens = await this.googleOAuth.exchangeCode(code);
    if (!tokens.refreshToken) {
      throw new BadRequestException(
        'Google did not return a refresh token. Please revoke Alma access in your Google account and try again.',
      );
    }

    const supabase = this.supabaseConfig.getClient();
    await this.getOrCreateSettings(payload.branchId, null);

    const accessEncrypted = this.tokenEncryption.encrypt(tokens.accessToken);
    const refreshEncrypted = this.tokenEncryption.encrypt(tokens.refreshToken);
    const domain = tokens.email?.includes('@')
      ? tokens.email.split('@')[1] ?? null
      : null;

    const { error } = await supabase
      .from('google_workspace_settings')
      .update({
        is_connected: true,
        connected_email: tokens.email,
        google_domain: domain,
        connected_by_user_id: payload.userId,
        connected_at: new Date().toISOString(),
        access_token_encrypted: accessEncrypted,
        refresh_token_encrypted: refreshEncrypted,
        token_expires_at: tokens.expiresAt.toISOString(),
        scopes: tokens.scopes,
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('branch_id', payload.branchId);
    throwIfDbError(error);

    const frontendBase =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ||
      'http://localhost:3000';
    return {
      branchId: payload.branchId,
      frontendRedirect: `${frontendBase}/settings?section=integrations&connected=1`,
    };
  }

  async disconnect(branchId: string): Promise<{ data: GoogleWorkspaceSettingsDto }> {
    const supabase = this.supabaseConfig.getClient();
    const row = await this.getOrCreateSettings(branchId, null);

    if (row.access_token_encrypted) {
      try {
        const token = this.tokenEncryption.decrypt(row.access_token_encrypted);
        await this.googleOAuth.revokeToken(token);
      } catch {
        // Best-effort revoke
      }
    }
    if (row.refresh_token_encrypted) {
      try {
        const token = this.tokenEncryption.decrypt(row.refresh_token_encrypted);
        await this.googleOAuth.revokeToken(token);
      } catch {
        // Best-effort revoke
      }
    }

    const { data, error } = await supabase
      .from('google_workspace_settings')
      .update({
        is_connected: false,
        connected_email: null,
        google_domain: null,
        connected_by_user_id: null,
        connected_at: null,
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        scopes: null,
        updated_at: new Date().toISOString(),
      })
      .eq('branch_id', branchId)
      .select(SETTINGS_SELECT)
      .single();
    throwIfDbError(error);
    return { data: this.mapSettings(data as GoogleWorkspaceSettingsRow) };
  }

  async testConnection(
    branchId: string,
  ): Promise<{ data: { ok: boolean; courseCount: number; email: string | null } }> {
    await this.assertFeatureEnabledAndConnected(branchId);
    const accessToken = await this.resolveAccessToken(branchId);
    const courses = await this.classroomApi.listCourses(accessToken);
    const settings = await this.getOrCreateSettings(branchId, null);
    return {
      data: {
        ok: true,
        courseCount: courses.length,
        email: settings.connected_email,
      },
    };
  }

  async listCourses(
    branchId: string,
  ): Promise<{ data: GoogleClassroomCourse[] }> {
    await this.assertFeatureEnabledAndConnected(branchId);
    const accessToken = await this.resolveAccessToken(branchId);
    const courses = await this.classroomApi.listCourses(accessToken);
    return { data: courses };
  }

  async listMappings(
    branchId: string,
  ): Promise<{ data: GoogleCourseMappingDto[] }> {
    await this.assertFeatureEnabled(branchId);
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('google_classroom_course_mappings')
      .select(MAPPING_SELECT)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('linked_at', { ascending: false });
    throwIfDbError(error);

    const rows = (data || []) as Array<{
      id: string;
      branch_id: string;
      class_section_id: string;
      subject_id: string;
      google_course_id: string;
      google_course_name: string | null;
      google_course_section: string | null;
      linked_by_user_id: string | null;
      linked_at: string;
      is_active: boolean;
    }>;

    const enriched = await this.enrichMappings(rows, branchId);
    return { data: enriched };
  }

  async createMapping(
    dto: CreateGoogleCourseMappingDto,
    branchId: string,
    userId: string,
  ): Promise<{ data: GoogleCourseMappingDto }> {
    await this.assertFeatureEnabledAndConnected(branchId);
    const supabase = this.supabaseConfig.getClient();

    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('id')
      .eq('id', dto.classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(csError);
    if (!classSection) {
      throw new BadRequestException('Class section not found in this branch');
    }

    const { data: subject, error: subjectError } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', dto.subjectId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(subjectError);
    if (!subject) {
      throw new BadRequestException('Subject not found in this branch');
    }

    const { data: existing } = await supabase
      .from('google_classroom_course_mappings')
      .select('id')
      .eq('branch_id', branchId)
      .eq('class_section_id', dto.classSectionId)
      .eq('subject_id', dto.subjectId)
      .eq('is_active', true)
      .maybeSingle();
    if (existing) {
      throw new BadRequestException(
        'An active mapping already exists for this class section and subject',
      );
    }

    const { data: inserted, error } = await supabase
      .from('google_classroom_course_mappings')
      .insert({
        branch_id: branchId,
        class_section_id: dto.classSectionId,
        subject_id: dto.subjectId,
        google_course_id: dto.googleCourseId,
        google_course_name: dto.googleCourseName ?? null,
        google_course_section: dto.googleCourseSection ?? null,
        linked_by_user_id: userId,
        linked_at: new Date().toISOString(),
        is_active: true,
      })
      .select(MAPPING_SELECT)
      .single();
    throwIfDbError(error);
    if (!inserted) {
      throw new BadRequestException('Failed to create course mapping');
    }

    const mappingRow = inserted as {
      id: string;
      branch_id: string;
      class_section_id: string;
      subject_id: string;
      google_course_id: string;
      google_course_name: string | null;
      google_course_section: string | null;
      linked_by_user_id: string | null;
      linked_at: string;
      is_active: boolean;
    };
    const [mapped] = await this.enrichMappings([mappingRow], branchId);
    return { data: mapped };
  }

  async deleteMapping(
    id: string,
    branchId: string,
  ): Promise<{ data: { id: string; deactivated: boolean } }> {
    await this.assertFeatureEnabled(branchId);
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('google_classroom_course_mappings')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .select('id')
      .maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Mapping not found');
    }
    return { data: { id: (data as { id: string }).id, deactivated: true } };
  }

  async autoSuggestMappings(
    branchId: string,
  ): Promise<{ data: GoogleMappingSuggestionDto[] }> {
    await this.assertFeatureEnabledAndConnected(branchId);
    const accessToken = await this.resolveAccessToken(branchId);
    const courses = await this.classroomApi.listCourses(accessToken);

    const supabase = this.supabaseConfig.getClient();
    const { data: classSections, error: csError } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .eq('branch_id', branchId)
      .eq('is_active', true);
    throwIfDbError(csError);

    const csRows = (classSections || []) as Array<{
      id: string;
      class_id: string;
      section_id: string;
    }>;
    if (csRows.length === 0) return { data: [] };

    const classIds = [...new Set(csRows.map((r) => r.class_id))];
    const sectionIds = [...new Set(csRows.map((r) => r.section_id))];

    const [classesRes, sectionsRes, subjectsRes, existingRes] =
      await Promise.all([
        supabase.from('classes').select('id, name, display_name').in('id', classIds),
        supabase.from('sections').select('id, name').in('id', sectionIds),
        supabase
          .from('subjects')
          .select('id, name')
          .eq('branch_id', branchId)
          .eq('is_active', true),
        supabase
          .from('google_classroom_course_mappings')
          .select('class_section_id, subject_id')
          .eq('branch_id', branchId)
          .eq('is_active', true),
      ]);
    throwIfDbError(classesRes.error);
    throwIfDbError(sectionsRes.error);
    throwIfDbError(subjectsRes.error);
    throwIfDbError(existingRes.error);

    const classNameById = new Map(
      (classesRes.data || []).map((c) => {
        const row = c as { id: string; name: string; display_name: string | null };
        return [row.id, row.display_name || row.name];
      }),
    );
    const sectionNameById = new Map(
      (sectionsRes.data || []).map((s) => {
        const row = s as { id: string; name: string };
        return [row.id, row.name];
      }),
    );
    const subjects = (subjectsRes.data || []) as Array<{ id: string; name: string }>;
    const existingKeys = new Set(
      (existingRes.data || []).map((m) => {
        const row = m as { class_section_id: string; subject_id: string };
        return `${row.class_section_id}:${row.subject_id}`;
      }),
    );

    const suggestions: GoogleMappingSuggestionDto[] = [];
    const CONFIDENCE_THRESHOLD = 0.55;

    for (const cs of csRows) {
      const className = classNameById.get(cs.class_id) || '';
      const sectionName = sectionNameById.get(cs.section_id) || '';
      const csLabel = `${className} ${sectionName}`.trim();

      for (const subject of subjects) {
        const key = `${cs.id}:${subject.id}`;
        if (existingKeys.has(key)) continue;

        const almaLabel = `${csLabel} ${subject.name}`.trim();
        let best: {
          course: GoogleClassroomCourse;
          confidence: number;
        } | null = null;

        for (const course of courses) {
          const googleLabel = [course.name, course.section]
            .filter(Boolean)
            .join(' ');
          const confidence = Math.max(
            nameSimilarity(almaLabel, googleLabel),
            nameSimilarity(subject.name, course.name),
            nameSimilarity(csLabel, course.name),
          );
          if (!best || confidence > best.confidence) {
            best = { course, confidence };
          }
        }

        if (best && best.confidence >= CONFIDENCE_THRESHOLD) {
          suggestions.push({
            classSectionId: cs.id,
            subjectId: subject.id,
            classSectionLabel: csLabel,
            subjectName: subject.name,
            googleCourseId: best.course.id,
            googleCourseName: best.course.name,
            googleCourseSection: best.course.section ?? null,
            confidence: Math.round(best.confidence * 100) / 100,
          });
        }
      }
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);
    return { data: suggestions.slice(0, 50) };
  }

  async listCoursework(
    branchId: string,
    googleCourseId: string,
  ): Promise<{ data: GoogleClassroomCoursework[] }> {
    await this.assertFeatureEnabledAndConnected(branchId);
    const accessToken = await this.resolveAccessToken(branchId);
    const coursework = await this.classroomApi.listCoursework(
      accessToken,
      googleCourseId,
    );
    return { data: coursework };
  }

  async linkAssessment(
    assessmentId: string,
    googleCourseworkId: string,
    branchId: string,
    userId: string,
    tenantId: string | null,
  ): Promise<{ data: AssessmentGoogleSyncStatusDto }> {
    await this.assertFeatureEnabledAndConnected(branchId);
    const supabase = this.supabaseConfig.getClient();

    const { data: assessmentRaw, error: assessmentError } = await supabase
      .from('assessments')
      .select(
        'id, class_section_id, subject_id, grading_source, google_course_id, google_coursework_id, google_last_synced_at, has_rubric',
      )
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(assessmentError);
    if (!assessmentRaw) {
      throw new NotFoundException('Assessment not found');
    }

    const assessment = assessmentRaw as {
      id: string;
      class_section_id: string;
      subject_id: string;
      grading_source: string;
      google_course_id: string | null;
      google_coursework_id: string | null;
      google_last_synced_at: string | null;
      has_rubric: boolean;
    };

    const { data: mappingRaw, error: mappingError } = await supabase
      .from('google_classroom_course_mappings')
      .select('id, google_course_id, google_course_name')
      .eq('branch_id', branchId)
      .eq('class_section_id', assessment.class_section_id)
      .eq('subject_id', assessment.subject_id)
      .eq('is_active', true)
      .maybeSingle();
    throwIfDbError(mappingError);
    if (!mappingRaw) {
      throw new BadRequestException(
        'No active Google course mapping found for this assessment class section and subject',
      );
    }

    const mapping = mappingRaw as {
      google_course_id: string;
    };

    const accessToken = await this.resolveAccessToken(branchId);
    const coursework = await this.classroomApi.getCoursework(
      accessToken,
      mapping.google_course_id,
      googleCourseworkId,
    );

    const { error: updateError } = await supabase
      .from('assessments')
      .update({
        grading_source: 'google_classroom',
        google_course_id: mapping.google_course_id,
        google_coursework_id: googleCourseworkId,
      })
      .eq('id', assessmentId)
      .eq('branch_id', branchId);
    throwIfDbError(updateError);

    const rubric = await this.classroomApi.getRubricIfAny(
      accessToken,
      mapping.google_course_id,
      googleCourseworkId,
      coursework,
    );

    if (rubric?.criteria?.length) {
      const { data: existingRubric } = await this.rubricsService.getAssessmentRubric(
        assessmentId,
        branchId,
      );
      const googleFp = fingerprintGoogleRubric(rubric);
      const almaFp = existingRubric
        ? fingerprintAlmaRubric(existingRubric)
        : '';
      if (googleFp !== almaFp) {
        await this.rubricsService.importGoogleRubric(
          assessmentId,
          branchId,
          tenantId,
          userId,
          rubric.id ?? null,
          mapGoogleCriteriaForImport(rubric),
        );
      }
    }

    return this.getAssessmentSyncStatus(assessmentId, branchId);
  }

  async unlinkAssessment(
    assessmentId: string,
    branchId: string,
  ): Promise<{ data: AssessmentGoogleSyncStatusDto }> {
    await this.assertFeatureEnabled(branchId);
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: findError } = await supabase
      .from('assessments')
      .select('id')
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(findError);
    if (!existing) {
      throw new NotFoundException('Assessment not found');
    }

    const { error } = await supabase
      .from('assessments')
      .update({
        grading_source: 'manual',
        google_course_id: null,
        google_coursework_id: null,
      })
      .eq('id', assessmentId)
      .eq('branch_id', branchId);
    throwIfDbError(error);

    return this.getAssessmentSyncStatus(assessmentId, branchId);
  }

  async pullGrades(
    assessmentId: string,
    branchId: string,
    userId: string,
  ): Promise<{ data: GradePullResultDto }> {
    await this.assertFeatureEnabledAndConnected(branchId);
    return this.gradePullService.pullGrades(assessmentId, branchId, userId);
  }

  async getSyncHistory(
    branchId: string,
    query: QuerySyncHistoryDto,
  ): Promise<{
    data: GoogleSyncAuditDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    await this.assertFeatureEnabled(branchId);
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = supabase
      .from('google_sync_audit_log')
      .select(
        'id, branch_id, assessment_id, triggered_by_user_id, sync_status, students_synced, students_failed, error_message, duration_ms, created_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.assessmentId) {
      dbQuery = dbQuery.eq('assessment_id', query.assessmentId);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    return {
      data: ((data || []) as Array<{
        id: string;
        branch_id: string;
        assessment_id: string | null;
        triggered_by_user_id: string | null;
        sync_status: string;
        students_synced: number;
        students_failed: number;
        error_message: string | null;
        duration_ms: number | null;
        created_at: string;
      }>).map((row) => this.mapAudit(row)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getAssessmentSyncStatus(
    assessmentId: string,
    branchId: string,
  ): Promise<{ data: AssessmentGoogleSyncStatusDto }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: assessmentRaw, error } = await supabase
      .from('assessments')
      .select(
        'id, grading_source, google_course_id, google_coursework_id, google_last_synced_at, has_rubric',
      )
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!assessmentRaw) {
      throw new NotFoundException('Assessment not found');
    }

    const assessment = assessmentRaw as {
      id: string;
      grading_source: string;
      google_course_id: string | null;
      google_coursework_id: string | null;
      google_last_synced_at: string | null;
      has_rubric: boolean;
    };

    const { data: auditRaw } = await supabase
      .from('google_sync_audit_log')
      .select(
        'id, branch_id, assessment_id, triggered_by_user_id, sync_status, students_synced, students_failed, error_message, duration_ms, created_at',
      )
      .eq('branch_id', branchId)
      .eq('assessment_id', assessmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: {
        assessmentId: assessment.id,
        gradingSource: assessment.grading_source,
        googleCourseId: assessment.google_course_id,
        googleCourseworkId: assessment.google_coursework_id,
        googleLastSyncedAt: assessment.google_last_synced_at,
        hasRubric: assessment.has_rubric,
        lastAudit: auditRaw
          ? this.mapAudit(
              auditRaw as {
                id: string;
                branch_id: string;
                assessment_id: string | null;
                triggered_by_user_id: string | null;
                sync_status: string;
                students_synced: number;
                students_failed: number;
                error_message: string | null;
                duration_ms: number | null;
                created_at: string;
              },
            )
          : null,
      },
    };
  }

  getOAuthErrorRedirect(message?: string): string {
    const frontendBase =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ||
      'http://localhost:3000';
    const params = new URLSearchParams({ connected: '0' });
    if (message) params.set('error', message.slice(0, 200));
    return `${frontendBase}/settings?section=integrations&${params.toString()}`;
  }

  private async assertFeatureEnabled(branchId: string): Promise<GoogleWorkspaceSettingsRow> {
    const settings = await this.getOrCreateSettings(branchId, null);
    if (!settings.is_feature_enabled) {
      throw new ForbiddenException(
        'Google Classroom integration is disabled for this branch',
      );
    }
    return settings;
  }

  private async assertFeatureEnabledAndConnected(
    branchId: string,
  ): Promise<GoogleWorkspaceSettingsRow> {
    const settings = await this.assertFeatureEnabled(branchId);
    if (!settings.is_connected) {
      throw new BadRequestException(
        'Google Classroom is not connected for this branch',
      );
    }
    return settings;
  }

  private async resolveAccessToken(branchId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const settings = await this.getOrCreateSettings(branchId, null);
    if (
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
          connected_email: refreshed.email ?? settings.connected_email,
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

  private mapSettings(row: GoogleWorkspaceSettingsRow): GoogleWorkspaceSettingsDto {
    return {
      id: row.id,
      branchId: row.branch_id,
      tenantId: row.tenant_id,
      isFeatureEnabled: row.is_feature_enabled,
      isConnected: row.is_connected,
      googleDomain: row.google_domain,
      connectedEmail: row.connected_email,
      connectedAt: row.connected_at,
      scopes: row.scopes ?? [],
      lastSyncAt: row.last_sync_at,
      lastSyncStatus: row.last_sync_status,
      lastSyncError: row.last_sync_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAudit(row: {
    id: string;
    branch_id: string;
    assessment_id: string | null;
    triggered_by_user_id: string | null;
    sync_status: string;
    students_synced: number;
    students_failed: number;
    error_message: string | null;
    duration_ms: number | null;
    created_at: string;
  }): GoogleSyncAuditDto {
    return {
      id: row.id,
      branchId: row.branch_id,
      assessmentId: row.assessment_id,
      triggeredByUserId: row.triggered_by_user_id,
      syncStatus: row.sync_status,
      studentsSynced: row.students_synced,
      studentsFailed: row.students_failed,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    };
  }

  private async enrichMappings(
    rows: Array<{
      id: string;
      branch_id: string;
      class_section_id: string;
      subject_id: string;
      google_course_id: string;
      google_course_name: string | null;
      google_course_section: string | null;
      linked_by_user_id: string | null;
      linked_at: string;
      is_active: boolean;
    }>,
    branchId: string,
  ): Promise<GoogleCourseMappingDto[]> {
    if (rows.length === 0) return [];
    const supabase = this.supabaseConfig.getClient();
    const classSectionIds = [...new Set(rows.map((r) => r.class_section_id))];
    const subjectIds = [...new Set(rows.map((r) => r.subject_id))];

    const { data: classSections } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .eq('branch_id', branchId)
      .in('id', classSectionIds);

    const csList = (classSections || []) as Array<{
      id: string;
      class_id: string;
      section_id: string;
    }>;
    const classIds = [...new Set(csList.map((c) => c.class_id))];
    const sectionIds = [...new Set(csList.map((c) => c.section_id))];

    const [classesRes, sectionsRes, subjectsRes] = await Promise.all([
      classIds.length
        ? supabase.from('classes').select('id, name, display_name').in('id', classIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string; display_name: string | null }> }),
      sectionIds.length
        ? supabase.from('sections').select('id, name').in('id', sectionIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      subjectIds.length
        ? supabase.from('subjects').select('id, name').in('id', subjectIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);

    const classNameById = new Map(
      ((classesRes.data || []) as Array<{
        id: string;
        name: string;
        display_name: string | null;
      }>).map((c) => [c.id, c.display_name || c.name]),
    );
    const sectionNameById = new Map(
      ((sectionsRes.data || []) as Array<{ id: string; name: string }>).map(
        (s) => [s.id, s.name],
      ),
    );
    const subjectNameById = new Map(
      ((subjectsRes.data || []) as Array<{ id: string; name: string }>).map(
        (s) => [s.id, s.name],
      ),
    );
    const csById = new Map(csList.map((c) => [c.id, c]));

    return rows.map((row) => {
      const cs = csById.get(row.class_section_id);
      const classSectionLabel = cs
        ? `${classNameById.get(cs.class_id) || ''} ${sectionNameById.get(cs.section_id) || ''}`.trim()
        : undefined;
      return {
        id: row.id,
        branchId: row.branch_id,
        classSectionId: row.class_section_id,
        subjectId: row.subject_id,
        googleCourseId: row.google_course_id,
        googleCourseName: row.google_course_name,
        googleCourseSection: row.google_course_section,
        linkedByUserId: row.linked_by_user_id,
        linkedAt: row.linked_at,
        isActive: row.is_active,
        classSectionLabel,
        subjectName: subjectNameById.get(row.subject_id),
      };
    });
  }
}
