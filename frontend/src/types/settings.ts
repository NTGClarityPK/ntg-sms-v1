export interface AcademicYear {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isActive: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
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
}

export interface AcademicEntityDeletionBlocker {
  type: string;
  count: number;
}

export interface AcademicEntityDeletionStatus {
  canDelete: boolean;
  blockers: AcademicEntityDeletionBlocker[];
}

export interface Subject {
  id: string;
  name: string;
  nameAr?: string;
  code?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassEntity {
  id: string;
  name: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Level {
  id: string;
  name: string;
  nameAr?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  classes: ClassEntity[];
}

export interface TimingSlot {
  id: string;
  name: string;
  startTime?: string;
  endTime?: string;
  sortOrder: number;
}

export interface TimingTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  periodDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
  assignedClassIds: string[];
  slots: TimingSlot[];
}

export interface PublicHoliday {
  id: string;
  name: string;
  nameAr?: string;
  startDate: string;
  endDate: string;
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vacation {
  id: string;
  name: string;
  nameAr?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  academicYearId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentType {
  id: string;
  name: string;
  nameAr?: string;
  isTermExamination: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GradeRange {
  id: string;
  letter: string;
  minPercentage: number;
  maxPercentage: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GradeTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  ranges: GradeRange[];
}

export interface ClassGradeAssignment {
  id: string;
  classId: string;
  className: string;
  gradeTemplateId: string;
  gradeTemplateName: string;
  minimumPassingGrade: string;
  createdAt: string;
  updatedAt: string;
}



