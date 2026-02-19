import { Module } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { NotificationsModule } from '../notifications/notifications.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { ClassSectionsModule } from '../class-sections/class-sections.module';
import { TeacherAssignmentsModule } from '../teacher-assignments/teacher-assignments.module';
import { StaffModule } from '../staff/staff.module';
import { BranchesModule } from '../branches/branches.module';
import { StorageModule } from '../storage/storage.module';
import { AssessmentsService } from './assessments.service';
import { AssessmentsController } from './assessments.controller';

@Module({
  imports: [AssessmentModule, AcademicYearsModule, ClassSectionsModule, TeacherAssignmentsModule, StaffModule, NotificationsModule, BranchesModule, StorageModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, SupabaseConfig],
  exports: [AssessmentsService], // Export so GradesModule can use it
})
export class AssessmentsModule {}


