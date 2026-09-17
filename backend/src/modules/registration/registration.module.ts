import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { SignupEmailVerificationService } from './signup-email-verification.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { MailjetService } from '../../common/services/email/mailjet.service';

@Module({
  imports: [ConfigModule, AcademicYearsModule, SystemSettingsModule],
  controllers: [RegistrationController],
  providers: [
    RegistrationService,
    SignupEmailVerificationService,
    MailjetService,
    SupabaseConfig,
  ],
  exports: [RegistrationService],
})
export class RegistrationModule {}
