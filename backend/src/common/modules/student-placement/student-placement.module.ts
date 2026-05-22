import { Global, Module } from '@nestjs/common';
import { SupabaseConfig } from '../../config/supabase.config';
import { StudentPlacementService } from '../../services/student-placement.service';

@Global()
@Module({
  providers: [StudentPlacementService, SupabaseConfig],
  exports: [StudentPlacementService],
})
export class StudentPlacementModule {}
