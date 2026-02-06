import { Module } from '@nestjs/common';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { StudentsModule } from '../students/students.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Module for managing student grades
 */
@Module({
  imports: [AcademicYearsModule, AssessmentsModule, StudentsModule, AuthModule],
  controllers: [GradesController],
  providers: [GradesService, SupabaseConfig],
  exports: [GradesService],
})
export class GradesModule {}

