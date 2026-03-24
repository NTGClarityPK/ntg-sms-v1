import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SettingsImportController } from './settings-import.controller';
import { SettingsImportService } from './settings-import.service';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { CoreLookupsModule } from '../core-lookups/core-lookups.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { TenantsModule } from '../tenants/tenants.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [
    AcademicYearsModule,
    CoreLookupsModule,
    AssessmentModule,
    SystemSettingsModule,
    TenantsModule,
    BranchesModule,
  ],
  controllers: [SettingsImportController],
  providers: [SettingsImportService, SupabaseConfig],
})
export class SettingsImportModule {}

