/**
 * Frontend type definitions for events and activities
 */

export type ConsentStatus = 'pending' | 'approved' | 'rejected';

export interface EventConsentStatus {
  studentId: string;
  studentName: string;
  status: ConsentStatus;
  respondedAt?: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  requiresConsent: boolean;
  consentDeadline?: string;
  createdBy: string;
  branchId: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
  participants?: EventParticipant[];
  studentNames?: string[]; // Names of students involved (for parents)
  consentStatuses?: EventConsentStatus[]; // Consent statuses for each student (for parents)
}

export interface EventParticipant {
  id: string;
  eventId: string;
  classSectionId?: string;
  studentId?: string;
  branchId: string;
  createdAt: string;
}

export interface EventConsent {
  id: string;
  eventId: string;
  studentId: string;
  studentName?: string;
  studentStudentId?: string;
  className?: string;
  sectionName?: string;
  parentUserId: string;
  parentName?: string;
  status: ConsentStatus;
  respondedAt?: string;
  ipAddress?: string;
  notes?: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventConsentStats {
  approved: number;
  rejected: number;
  pending: number;
  total: number;
}

export interface EventConflict {
  assessmentConflicts: Array<{
    id: string;
    title: string;
    dueDate: string;
    classSectionId: string;
  }>;
  eventConflicts: Array<{
    id: string;
    title: string;
    startDate: string;
    endDate: string;
  }>;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  requiresConsent?: boolean;
  consentDeadline?: string;
  classSectionIds?: string[];
  studentIds?: string[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  requiresConsent?: boolean;
  consentDeadline?: string;
  classSectionIds?: string[];
  studentIds?: string[];
}

export interface QueryEventsInput {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  classSectionId?: string;
  requiresConsent?: boolean;
  status?: 'upcoming' | 'past' | 'all';
}

export interface SubmitConsentInput {
  studentId: string;
  status: 'approved' | 'rejected';
  notes?: string;
}

