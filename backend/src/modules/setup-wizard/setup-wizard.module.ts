import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { SetupWizardController } from './setup-wizard.controller';
import { SetupWizardService } from './setup-wizard.service';

@Module({
  imports: [SystemSettingsModule],
  controllers: [SetupWizardController],
  providers: [SetupWizardService, SupabaseConfig],
})
export class SetupWizardModule {}

