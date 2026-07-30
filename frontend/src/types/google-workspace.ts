/**
 * Frontend types for Google Classroom / Workspace integration
 * (never includes OAuth tokens)
 */

export interface GoogleWorkspaceSettings {
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
}

export interface GoogleCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  room?: string;
  ownerId?: string;
  courseState?: string;
  alternateLink?: string;
}

export interface GoogleCourseMapping {
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
}

export interface GoogleMappingSuggestion {
  classSectionId: string;
  subjectId: string;
  classSectionLabel: string;
  subjectName: string;
  googleCourseId: string;
  googleCourseName: string;
  googleCourseSection: string | null;
  confidence: number;
}

export interface GoogleCoursework {
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
}

export interface PullGradesResult {
  synced: number;
  failed: number;
  unmatchedGoogleEmails: string[];
  message: string;
}

export interface SyncAuditEntry {
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
}

export interface SyncStatus {
  assessmentId: string;
  gradingSource: string;
  googleCourseId: string | null;
  googleCourseworkId: string | null;
  googleLastSyncedAt: string | null;
  hasRubric: boolean;
  lastAudit: SyncAuditEntry | null;
}

export interface CreateGoogleCourseMappingInput {
  classSectionId: string;
  subjectId: string;
  googleCourseId: string;
  googleCourseName?: string;
  googleCourseSection?: string;
}

export interface QuerySyncHistoryParams {
  page?: number;
  limit?: number;
  assessmentId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TestConnectionResult {
  ok: boolean;
  courseCount: number;
  email: string | null;
}

export interface ConnectGoogleResult {
  authorizationUrl: string;
}
