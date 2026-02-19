import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { GradesModule } from '../grades/grades.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { BehavioralModule } from '../behavioral/behavioral.module';
import { StudentsModule } from '../students/students.module';
import { BranchesModule } from '../branches/branches.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PublicStatisticsController } from './public-statistics.controller';

@Module({
  imports: [
    AcademicYearsModule,
    GradesModule,
    AttendanceModule,
    BehavioralModule,
    StudentsModule,
    BranchesModule,
  ],
  controllers: [ReportsController, PublicStatisticsController],
  providers: [ReportsService, SupabaseConfig],
  exports: [ReportsService],
})
export class ReportsModule {}
