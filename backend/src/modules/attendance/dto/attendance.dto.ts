export class AttendanceDto {
  id!: string;
  studentId!: string;
  studentIdNumber?: string; // The student's unique identifier (e.g., "2026-Class 1-A-001")
  studentName!: string;
  classSectionId!: string;
  className!: string;
  sectionName!: string;
  date!: string;
  status!: 'present' | 'absent' | 'late' | 'excused';
  entryTime?: string;
  exitTime?: string;
  notes?: string;
  markedById?: string;
  markedByName?: string;
  branchId!: string;
  academicYearId!: string;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<AttendanceDto>) {
    Object.assign(this, partial);
  }
}

