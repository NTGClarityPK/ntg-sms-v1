import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { ParentsModule } from '../parents/parents.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [AcademicYearsModule, InvitationsModule, ParentsModule, MessagesModule],
  controllers: [StudentsController],
  providers: [StudentsService, SupabaseConfig],
  exports: [StudentsService],
})
export class StudentsModule {}

