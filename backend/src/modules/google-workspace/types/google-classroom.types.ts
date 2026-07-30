/** Google Classroom API v1 course (subset). */
export type GoogleClassroomCourse = {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  room?: string;
  ownerId?: string;
  courseState?: string;
  alternateLink?: string;
};

/** Google Classroom coursework (assignment). */
export type GoogleClassroomCoursework = {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  state?: string;
  maxPoints?: number;
  workType?: string;
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
  gradeCategory?: {
    id?: string;
    name?: string;
    defaultGradeDenominator?: number;
  };
};

/** Rubric criterion level from Google Classroom rubrics API. */
export type GoogleRubricLevel = {
  id: string;
  title?: string;
  description?: string;
  points?: number;
};

/** Rubric criterion from Google Classroom rubrics API. */
export type GoogleRubricCriterion = {
  id: string;
  title: string;
  description?: string;
  levels?: GoogleRubricLevel[];
};

/** Full rubric attached to coursework. */
export type GoogleClassroomRubric = {
  courseId: string;
  courseWorkId: string;
  id?: string;
  criteria: GoogleRubricCriterion[];
};

/** Per-criterion grade on a student submission. */
export type GoogleRubricGrade = {
  criterionId: string;
  levelId?: string;
  points?: number;
};

/** Google Classroom student submission (subset). */
export type GoogleStudentSubmission = {
  id: string;
  courseId: string;
  courseWorkId: string;
  userId: string;
  state?: string;
  late?: boolean;
  draftGrade?: number;
  assignedGrade?: number;
  rubricId?: string;
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  userProfile?: {
    id?: string;
    name?: {
      fullName?: string;
      givenName?: string;
      familyName?: string;
    };
    emailAddress?: string;
    photoUrl?: string;
  };
  assignedRubricGrades?: Record<string, GoogleRubricGrade>;
  draftRubricGrades?: Record<string, GoogleRubricGrade>;
};

/** Public settings DTO (never includes tokens). */
export type GoogleWorkspaceSettingsDto = {
  id: string;
  branchId: string;
  tenantId: string | null;
  isFeatureEnabled: boolean;
  isConnected: boolean;
  googleDomain: string | null;
  connectedEmail: string | null;
  connectedAt: string | null;
  scopes: string[];
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Course mapping DTO. */
export type GoogleCourseMappingDto = {
  id: string;
  branchId: string;
  classSectionId: string;
  subjectId: string;
  googleCourseId: string;
  googleCourseName: string | null;
  googleCourseSection: string | null;
  linkedByUserId: string | null;
  linkedAt: string;
  isActive: boolean;
  classSectionLabel?: string;
  subjectName?: string;
};

/** Auto-suggest mapping candidate. */
export type GoogleMappingSuggestionDto = {
  classSectionId: string;
  subjectId: string;
  classSectionLabel: string;
  subjectName: string;
  googleCourseId: string;
  googleCourseName: string;
  googleCourseSection: string | null;
  confidence: number;
};

/** Sync audit log entry. */
export type GoogleSyncAuditDto = {
  id: string;
  branchId: string;
  assessmentId: string | null;
  triggeredByUserId: string | null;
  syncStatus: string;
  studentsSynced: number;
  studentsFailed: number;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
};

/** Grade pull summary. */
export type GradePullResultDto = {
  synced: number;
  failed: number;
  unmatchedGoogleEmails: string[];
  message: string;
};

/** Assessment Google sync status. */
export type AssessmentGoogleSyncStatusDto = {
  assessmentId: string;
  gradingSource: string;
  googleCourseId: string | null;
  googleCourseworkId: string | null;
  googleLastSyncedAt: string | null;
  hasRubric: boolean;
  lastAudit: GoogleSyncAuditDto | null;
};

/** Internal settings row (includes encrypted tokens). */
export type GoogleWorkspaceSettingsRow = {
  id: string;
  branch_id: string;
  tenant_id: string | null;
  is_feature_enabled: boolean;
  is_connected: boolean;
  google_domain: string | null;
  connected_email: string | null;
  connected_by_user_id: string | null;
  connected_at: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

/** OAuth token bundle after exchange / refresh. */
export type GoogleOAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  email: string | null;
  scopes: string[];
};

/** OAuth state payload encoded in the authorize URL. */
export type GoogleOAuthStatePayload = {
  branchId: string;
  userId: string;
  nonce: string;
};
