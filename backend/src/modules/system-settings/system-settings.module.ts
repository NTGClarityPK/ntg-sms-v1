import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsService } from './system-settings.service';

@Module({
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService, SupabaseConfig],
})
export class SystemSettingsModule {}


