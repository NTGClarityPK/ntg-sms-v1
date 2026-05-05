import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StudentJwtGuard } from '../../common/guards/student-jwt.guard';
import { CurrentStudent, CurrentStudentPayload } from '../../common/decorators/current-student.decorator';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AssessmentsService } from '../assessments/assessments.service';
import { AssessmentDto } from '../assessments/dto/assessment.dto';
import { UpdateStudentAssessmentStatusDto } from '../assessments/dto/update-student-assessment-status.dto';

@ApiTags('Student self-service')
@Controller('api/v1/student')
@UseGuards(StudentJwtGuard)
export class StudentSelfController {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly assessmentsService: AssessmentsService,
  ) {}

  @Get('me')
  async getMe(
    @CurrentStudent() student: CurrentStudentPayload,
  ): Promise<{
    data: {
      id: string;
      studentId: string;
      firstName: string;
      lastName: string;
      className: string | null;
      sectionName: string | null;
    };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name, classes:class_id(display_name), sections:section_id(name)')
      .eq('id', student.id)
      .maybeSingle();

    if (error || !data) {
      return {
        data: {
          id: student.id,
          studentId: '',
          firstName: '',
          lastName: '',
          className: null,
          sectionName: null,
        },
      };
    }

    const row = data as {
      id: string;
      student_id: string;
      first_name: string | null;
      last_name: string | null;
      classes: { display_name: string } | { display_name: string }[] | null;
      sections: { name: string } | { name: string }[] | null;
    };

    const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
    const sectionData = Array.isArray(row.sections) ? row.sections[0] : row.sections;

    return {
      data: {
        id: row.id,
        studentId: row.student_id,
        firstName: row.first_name ?? '',
        lastName: row.last_name ?? '',
        className: classData?.display_name ?? null,
        sectionName: sectionData?.name ?? null,
      },
    };
  }

  @Get('assessments/examination-schedule')
  async getMyExaminationSchedule(
    @CurrentStudent() student: CurrentStudentPayload,
  ): Promise<{ data: AssessmentDto[] }> {
    return this.assessmentsService.getExaminationScheduleForStudentById(student.id, student.branchId);
  }

  @Get('assessments')
  async getMyAssessments(
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const result = await this.assessmentsService.getMyAssessmentsForStudentById(
      student.id,
      student.branchId,
    );
    return { data: result };
  }

  @Post('assessments/:id/status')
  async updateAssessmentStatus(
    @Param('id') assessmentId: string,
    @Body() body: UpdateStudentAssessmentStatusDto,
    @CurrentStudent() student: CurrentStudentPayload,
  ) {
    const status = await this.assessmentsService.updateMyAssessmentStatusByStudentId(
      assessmentId,
      student.id,
      student.branchId,
      body,
    );
    return { data: status };
  }
}

