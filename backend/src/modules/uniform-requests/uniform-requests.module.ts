import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { UniformsModule } from '../uniforms/uniforms.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UniformRequestsService } from './uniform-requests.service';
import { UniformRequestsController } from './uniform-requests.controller';

@Module({
  imports: [UniformsModule, NotificationsModule],
  controllers: [UniformRequestsController],
  providers: [UniformRequestsService, SupabaseConfig],
})
export class UniformRequestsModule {}
