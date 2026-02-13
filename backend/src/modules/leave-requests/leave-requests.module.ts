import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestsController } from './leave-requests.controller';

@Module({
  imports: [AcademicYearsModule, NotificationsModule, ScheduleModule],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService, SupabaseConfig],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}


