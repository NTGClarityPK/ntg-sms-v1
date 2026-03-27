import { Module } from '@nestjs/common';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';

@Module({
  imports: [AcademicYearsModule],
  controllers: [RegistrationController],
  providers: [RegistrationService, SupabaseConfig],
  exports: [RegistrationService],
})
export class RegistrationModule {}


