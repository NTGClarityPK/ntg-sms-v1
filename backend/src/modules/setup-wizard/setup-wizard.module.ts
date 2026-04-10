import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SetupWizardController } from './setup-wizard.controller';
import { SetupWizardService } from './setup-wizard.service';

@Module({
  controllers: [SetupWizardController],
  providers: [SetupWizardService, SupabaseConfig],
})
export class SetupWizardModule {}

