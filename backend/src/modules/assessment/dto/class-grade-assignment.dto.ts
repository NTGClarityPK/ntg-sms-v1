export class ClassGradeAssignmentDto {
  id: string;
  classId: string;
  className: string;
  gradeTemplateId: string;
  gradeTemplateName: string;
  minimumPassingGrade: string;
  createdAt: string;
  updatedAt: string;

  constructor(init: {
    id: string;
    classId: string;
    className: string;
    gradeTemplateId: string;
    gradeTemplateName: string;
    minimumPassingGrade: string;
    createdAt: string;
    updatedAt: string;
  }) {
    this.id = init.id;
    this.classId = init.classId;
    this.className = init.className;
    this.gradeTemplateId = init.gradeTemplateId;
    this.gradeTemplateName = init.gradeTemplateName;
    this.minimumPassingGrade = init.minimumPassingGrade;
    this.createdAt = init.createdAt;
    this.updatedAt = init.updatedAt;
  }
}


