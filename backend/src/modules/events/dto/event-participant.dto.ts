export class EventParticipantDto {
  id!: string;
  eventId!: string;
  classSectionId?: string;
  studentId?: string;
  branchId!: string;
  createdAt!: string;

  constructor(partial: Partial<EventParticipantDto>) {
    Object.assign(this, partial);
  }
}

