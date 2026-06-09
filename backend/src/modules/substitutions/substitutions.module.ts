import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogModule } from '../../common/modules/audit-log/audit-log.module';
import { SubstitutionsService } from './substitutions.service';
import { SubstitutionsController } from './substitutions.controller';
import { SubstitutionsReminderScheduler } from './substitutions-reminder.scheduler';

@Module({
  imports: [AcademicYearsModule, NotificationsModule, AuditLogModule],
  controllers: [SubstitutionsController],
  providers: [SubstitutionsService, SubstitutionsReminderScheduler, SupabaseConfig],
  exports: [SubstitutionsService],
})
export class SubstitutionsModule {}
