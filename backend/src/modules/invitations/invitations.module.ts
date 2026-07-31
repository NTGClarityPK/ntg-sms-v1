import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { MailjetService } from '../../common/services/email/mailjet.service';
import { InvitationsService } from './invitations.service';
import { InvitationsPublicController } from './invitations-public.controller';
import { InvitationsController } from './invitations.controller';

@Module({
  controllers: [InvitationsPublicController, InvitationsController],
  providers: [InvitationsService, SupabaseConfig, MailjetService],
  exports: [InvitationsService],
})
export class InvitationsModule {}

