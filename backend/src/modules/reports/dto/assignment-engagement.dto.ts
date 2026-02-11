export class AssignmentEngagementDto {
  assignmentId!: string;
  assignmentTitle!: string;
  subjectName!: string;
  dueDate?: string;
  isViewed!: boolean;
  viewedAt?: string;
  status!: 'not_started' | 'in_progress' | 'submitted';
  submittedAt?: string;
  daysUntilDue?: number; // negative if overdue
  engagementScore!: number; // 0-100

  constructor(partial: Partial<AssignmentEngagementDto>) {
    Object.assign(this, partial);
  }
}
