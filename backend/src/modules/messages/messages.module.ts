import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { MessagesService } from './messages.service';
import { ConversationsController } from './conversations.controller';
import { MessagesController } from './messages.controller';

@Module({
  imports: [SystemSettingsModule, NotificationsModule, AcademicYearsModule],
  controllers: [ConversationsController, MessagesController],
  providers: [MessagesService, SupabaseConfig],
  exports: [MessagesService],
})
export class MessagesModule {}
