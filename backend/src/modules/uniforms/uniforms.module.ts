import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchesModule } from '../branches/branches.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { UniformsService } from './uniforms.service';
import { UniformsController } from './uniforms.controller';

@Module({
  imports: [SystemSettingsModule, BranchesModule],
  controllers: [UniformsController],
  providers: [UniformsService, SupabaseConfig],
  exports: [UniformsService],
})
export class UniformsModule {}
