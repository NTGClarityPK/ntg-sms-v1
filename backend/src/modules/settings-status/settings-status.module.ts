import { Module } from '@nestjs/common';
import { SettingsStatusController } from './settings-status.controller';
import { SettingsStatusService } from './settings-status.service';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Module({
  controllers: [SettingsStatusController],
  providers: [SettingsStatusService, SupabaseConfig],
  exports: [SettingsStatusService],
})
export class SettingsStatusModule {}

