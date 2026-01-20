import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { CoreLookupsService } from './core-lookups.service';
import { SubjectsController } from './subjects.controller';
import { ClassesController } from './classes.controller';
import { SectionsController } from './sections.controller';
import { LevelsController } from './levels.controller';

@Module({
  controllers: [SubjectsController, ClassesController, SectionsController, LevelsController],
  providers: [CoreLookupsService, SupabaseConfig],
})
export class CoreLookupsModule {}


