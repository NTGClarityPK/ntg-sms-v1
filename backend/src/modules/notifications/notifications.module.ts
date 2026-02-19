import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SupabaseConfig],
  exports: [NotificationsService],
})
export class NotificationsModule {}



