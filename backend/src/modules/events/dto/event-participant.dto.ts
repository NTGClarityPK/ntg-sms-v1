export class EventParticipantDto {
  id!: string;
  eventId!: string;
  classSectionId?: string;
  studentId?: string;
  branchId!: string;
  createdAt!: string;
  className?: string;
  sectionName?: string;

  constructor(partial: Partial<EventParticipantDto>) {
    Object.assign(this, partial);
  }
}


