import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SubjectTemplatesController } from './subject-templates.controller';
import { SubjectTemplatesService } from './subject-templates.service';

@Module({
  controllers: [SubjectTemplatesController],
  providers: [SubjectTemplatesService, SupabaseConfig],
  exports: [SubjectTemplatesService],
})
export class SubjectTemplatesModule {}

