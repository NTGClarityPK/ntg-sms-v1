import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';

@Module({
  controllers: [AssessmentController],
  providers: [AssessmentService, SupabaseConfig],
})
export class AssessmentModule {}


