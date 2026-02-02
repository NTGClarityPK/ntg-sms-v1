import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  controllers: [ScheduleController],
  providers: [ScheduleService, SupabaseConfig],
  exports: [ScheduleService],
})
export class ScheduleModule {}


