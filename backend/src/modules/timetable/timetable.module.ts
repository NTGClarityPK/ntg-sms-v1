import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { TeacherAssignmentsModule } from '../teacher-assignments/teacher-assignments.module';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [
    AcademicYearsModule,
    ScheduleModule,
    TeacherAssignmentsModule,
    StaffModule,
  ],
  controllers: [TimetableController],
  providers: [TimetableService, SupabaseConfig],
  exports: [TimetableService],
})
export class TimetableModule {}




