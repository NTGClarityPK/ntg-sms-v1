export interface AcademicYearData {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SubjectData {
  name: string;
  nameAr?: string;
  code?: string;
  sortOrder: number;
}

export interface ClassData {
  name: string;
  displayName: string;
  sortOrder: number;
}

export interface SectionData {
  name: string;
  sortOrder: number;
}

export interface LevelData {
  name: string;
  nameAr?: string;
  sortOrder: number;
  classIds: string[];
}

export interface AcademicData {
  subjects: SubjectData[];
  classes: ClassData[];
  sections: SectionData[];
  levels: LevelData[];
  levelClasses: Array<{ levelId: string; classId: string }>;
}

export interface SchoolDayData {
  dayOfWeek: number;
  isActive: boolean;
}

export interface TimingTemplateData {
  name: string;
  startTime: string;
  endTime: string;
  periodDurationMinutes: number;
  slots: Array<{
    name: string;
    startTime: string;
    endTime: string;
    sortOrder: number;
  }>;
  classIds: string[];
}

export interface ScheduleData {
  schoolDays: SchoolDayData[];
  timingTemplates: TimingTemplateData[];
  classTimingAssignments: Array<{ classId: string; templateId: string }>;
}

export interface AssessmentTypeData {
  name: string;
  nameAr?: string;
  sortOrder: number;
}

export interface GradeRangeData {
  letter: string;
  minPercentage: number;
  maxPercentage: number;
  sortOrder: number;
}

export interface GradeTemplateData {
  name: string;
  ranges: GradeRangeData[];
  classAssignments: Array<{
    classId: string;
    minimumPassingGrade: string;
  }>;
}

export interface AssessmentData {
  assessmentTypes: AssessmentTypeData[];
  gradeTemplates: GradeTemplateData[];
  gradeRanges: Array<{ templateId: string; range: GradeRangeData }>;
  classGradeAssignments: Array<{ classId: string; templateId: string; minimumPassingGrade: string }>;
  leaveQuota: number | null;
}

export interface CommunicationData {
  teacherStudent: 'teacher_only' | 'both';
  teacherParent: 'teacher_only' | 'both';
}

export interface BehaviorData {
  enabled: boolean;
  mandatory: boolean;
  attributes: string[];
}

export interface PermissionData {
  roleId: string;
  featureId: string;
  permission: 'none' | 'view' | 'edit';
}

export interface SetupWizardData {
  academicYear: AcademicYearData | null;
  academic: AcademicData;
  schedule: ScheduleData;
  assessment: AssessmentData;
  communication: CommunicationData | null;
  behavior: BehaviorData | null;
  permissions: PermissionData[];
}

