import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { BulkImportService } from './bulk-import.service';
import { BulkImportController } from './bulk-import.controller';
import { StudentsModule } from '../students/students.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [StudentsModule, UsersModule],
  controllers: [BulkImportController],
  providers: [BulkImportService, SupabaseConfig],
})
export class BulkImportModule {}
