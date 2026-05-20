import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchesModule } from '../branches/branches.module';
import { StorageModule } from '../storage/storage.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { LibraryService } from './library.service';
import { LibraryController } from './library.controller';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [BranchesModule, StorageModule, SystemSettingsModule, SubscriptionModule],
  controllers: [LibraryController],
  providers: [LibraryService, SupabaseConfig],
  exports: [LibraryService],
})
export class LibraryModule {}
