import { Module } from '@nestjs/common';
import { StudentSelfController } from './student-self.controller';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AssessmentsModule } from '../assessments/assessments.module';

@Module({
  imports: [AssessmentsModule],
  controllers: [StudentSelfController],
  providers: [SupabaseConfig],
})
export class StudentSelfModule {}

