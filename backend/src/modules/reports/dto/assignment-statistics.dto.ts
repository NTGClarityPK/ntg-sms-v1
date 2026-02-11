export class AssignmentStatisticsDto {
  totalAssignments!: number;
  viewedAssignments!: number;
  notViewedAssignments!: number;
  submittedAssignments!: number;
  inProgressAssignments!: number;
  notStartedAssignments!: number;
  viewingRate!: number; // percentage
  submissionRate!: number; // percentage

  constructor(partial: Partial<AssignmentStatisticsDto>) {
    Object.assign(this, partial);
  }
}
