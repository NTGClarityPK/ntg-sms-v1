import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { RubricsController } from './rubrics.controller';
import { RubricsService } from './rubrics.service';

@Module({
  controllers: [RubricsController],
  providers: [RubricsService, SupabaseConfig],
  exports: [RubricsService],
})
export class RubricsModule {}
