import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AcademicYearsModule, NotificationsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, SupabaseConfig],
  exports: [AttendanceService],
})
export class AttendanceModule {}

