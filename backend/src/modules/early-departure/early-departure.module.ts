import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TimetableModule } from '../timetable/timetable.module';
import { EarlyDepartureService } from './early-departure.service';
import { EarlyDepartureController } from './early-departure.controller';

@Module({
  imports: [AcademicYearsModule, NotificationsModule, TimetableModule],
  controllers: [EarlyDepartureController],
  providers: [EarlyDepartureService, SupabaseConfig],
  exports: [EarlyDepartureService],
})
export class EarlyDepartureModule {}


