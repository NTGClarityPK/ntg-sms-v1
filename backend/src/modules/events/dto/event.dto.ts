import { EventParticipantDto } from './event-participant.dto';

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

  constructor(partial: Partial<EventDto>) {
    Object.assign(this, partial);
  }
}

