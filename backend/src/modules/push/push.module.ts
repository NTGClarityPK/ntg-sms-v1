import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Module({
  imports: [ConfigModule],
  controllers: [PushController],
  providers: [PushService, SupabaseConfig],
  exports: [PushService],
})
export class PushModule {}
