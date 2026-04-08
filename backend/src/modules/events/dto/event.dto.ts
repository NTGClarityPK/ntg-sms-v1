import { EventParticipantDto } from './event-participant.dto';

export interface EventConsentStatus {
  studentId: string;
  studentName: string;
  status: 'pending' | 'approved' | 'rejected';
  respondedAt?: string;
}

export class EventDto {
  id!: string;
  title!: string;
  description?: string;
  startDate!: string;
  endDate!: string;
  requiresConsent!: boolean;
  consentDeadline?: string;
  createdBy!: string;
  branchId!: string;
  academicYearId!: string;
  createdAt!: string;
  updatedAt!: string;
  participants?: EventParticipantDto[];
  studentNames?: string[]; // Names of students involved (for parents)
  consentStatuses?: EventConsentStatus[]; // Consent statuses for each student (for parents)
  studentConsentStatus?: 'pending' | 'approved' | 'rejected'; // For students: latest consent status for this event
  studentConsentRespondedAt?: string; // For students: when consent was last responded

  constructor(partial: Partial<EventDto>) {
    Object.assign(this, partial);
  }
}

