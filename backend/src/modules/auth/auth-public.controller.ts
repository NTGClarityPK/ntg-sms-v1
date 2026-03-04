import { BadRequestException, Controller, Post, Body } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Controller('api/v1/public')
export class AuthPublicController {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  /**
   * Resolve a student roll number to their email address.
   * Students are assigned to one branch; lookup is by roll number only.
   * This endpoint is intentionally minimal and unauthenticated, and must be rate-limited at the edge.
   */
  @Post('resolve-student-roll')
  async resolveStudentRoll(
    @Body() body: { rollNumber?: string },
  ): Promise<{ data: { email: string } }> {
    const rollNumber = body?.rollNumber?.trim();
    if (!rollNumber) {
      throw new BadRequestException('Invalid roll number');
    }

    const supabase = this.supabaseConfig.getClient();

    // Find the student row by roll number (student_id). Students belong to one branch.
    // Use limit(1) and handle array result explicitly to avoid errors when multiple rows exist.
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('student_id', rollNumber)
      .limit(1);

    if (studentError || !students || students.length === 0) {
      // Deliberately generic message to avoid enumeration
      throw new BadRequestException('No student found');
    }

    const studentRow = students[0] as { id: string; user_id: string | null };
    if (!studentRow.user_id) {
      throw new BadRequestException('No student found');
    }

    // Look up the auth user to get the email
    const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(
      studentRow.user_id,
    );

    const email = userResult?.user?.email;
    if (userError || !email) {
      throw new BadRequestException('No student found');
    }

    return { data: { email } };
  }
}

