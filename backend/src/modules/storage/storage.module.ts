import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BranchesModule } from '../branches/branches.module';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [BranchesModule],
  controllers: [StorageController],
  providers: [StorageService, SupabaseConfig],
  exports: [StorageService],
})
export class StorageModule {}
