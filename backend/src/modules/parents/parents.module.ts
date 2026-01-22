import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { ParentsService } from './parents.service';
import { ParentsController } from './parents.controller';

@Module({
  controllers: [ParentsController],
  providers: [ParentsService, SupabaseConfig],
  exports: [ParentsService],
})
export class ParentsModule {}

