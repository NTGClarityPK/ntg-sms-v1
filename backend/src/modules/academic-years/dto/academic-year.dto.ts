export class AcademicYearDto {
  id!: string;
  name!: string;
  startDate!: string; // ISO date (YYYY-MM-DD)
  endDate!: string; // ISO date (YYYY-MM-DD)
  isActive!: boolean;
  isLocked!: boolean;
  createdAt!: string;
  updatedAt!: string;
  rollover?: {
    sourceAcademicYearId: string;
    sourceAcademicYearName?: string;
    completedAt: string;
    carryForward: {
      teacherAssignments?: boolean;
      timetableSlots?: boolean;
      leaveSettings?: boolean;
    };
    result: {
      classSectionsCopied?: number;
      teacherAssignmentsCopied?: number;
      timetableSlotsCopied?: number;
      leaveSettingsCopied?: number;
    };
  };

  constructor(partial: Partial<AcademicYearDto>) {
    Object.assign(this, partial);
  }
}


