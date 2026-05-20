import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { InvitationsModule } from '../invitations/invitations.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [InvitationsModule, SubscriptionModule],
  controllers: [UsersController],
  providers: [UsersService, SupabaseConfig],
  exports: [UsersService],
})
export class UsersModule {}

