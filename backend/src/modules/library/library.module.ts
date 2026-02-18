import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchesModule } from '../branches/branches.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { LibraryService } from './library.service';
import { LibraryController } from './library.controller';

@Module({
  imports: [BranchesModule, SystemSettingsModule],
  controllers: [LibraryController],
  providers: [LibraryService, SupabaseConfig],
  exports: [LibraryService],
})
export class LibraryModule {}
