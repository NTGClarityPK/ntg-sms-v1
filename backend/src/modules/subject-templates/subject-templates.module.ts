import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { SubjectTemplatesController } from './subject-templates.controller';
import { SubjectTemplatesService } from './subject-templates.service';

@Module({
  imports: [AcademicYearsModule],
  controllers: [SubjectTemplatesController],
  providers: [SubjectTemplatesService, SupabaseConfig],
  exports: [SubjectTemplatesService],
})
export class SubjectTemplatesModule {}

