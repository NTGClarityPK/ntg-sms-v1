import { Module } from '@nestjs/common';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Module({
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService, SupabaseConfig],
  exports: [AcademicYearsService],
})
export class AcademicYearsModule {}


