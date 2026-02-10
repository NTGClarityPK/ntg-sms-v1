import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { ClassSectionsModule } from '../class-sections/class-sections.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  imports: [AcademicYearsModule, ClassSectionsModule, NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService, SupabaseConfig],
  exports: [EventsService],
})
export class EventsModule {}


