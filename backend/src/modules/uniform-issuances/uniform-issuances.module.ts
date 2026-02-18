import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { UniformsModule } from '../uniforms/uniforms.module';
import { UniformIssuancesService } from './uniform-issuances.service';
import { UniformIssuancesController } from './uniform-issuances.controller';

@Module({
  imports: [UniformsModule],
  controllers: [UniformIssuancesController],
  providers: [UniformIssuancesService, SupabaseConfig],
})
export class UniformIssuancesModule {}
