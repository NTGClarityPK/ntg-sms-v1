import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AssessmentModule } from '../assessment/assessment.module';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { ClassSectionsModule } from '../class-sections/class-sections.module';
import { TeacherAssignmentsModule } from '../teacher-assignments/teacher-assignments.module';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';

@Module({
  imports: [AssessmentModule, AcademicYearsModule, ClassSectionsModule, TeacherAssignmentsModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, SupabaseConfig],
  exports: [AssessmentsService], // Export so GradesModule can use it
})
export class AssessmentsModule {}


