import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { ReachClientService } from './reach-client.service';
import { StudentSupportController } from './student-support.controller';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [ConfigModule],
  controllers: [SupportController, StudentSupportController],
  providers: [SupportService, ReachClientService, SupabaseConfig],
  exports: [SupportService],
})
export class SupportModule {}
