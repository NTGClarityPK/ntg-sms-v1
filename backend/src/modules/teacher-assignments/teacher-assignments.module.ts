import { Module } from '@nestjs/common';
import { TeacherAssignmentsController } from './teacher-assignments.controller';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Module({
  imports: [AcademicYearsModule],
  controllers: [TeacherAssignmentsController],
  providers: [TeacherAssignmentsService, SupabaseConfig],
  exports: [TeacherAssignmentsService],
})
export class TeacherAssignmentsModule {}

