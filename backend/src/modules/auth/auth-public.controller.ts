import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Public API')
@Controller('api/v1/public')
export class AuthPublicController {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly passwordResetService: PasswordResetService,
  ) {}

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
      .select('id, user_id, is_active')
      .eq('student_id', rollNumber)
      .limit(1);

    if (studentError || !students || students.length === 0) {
      // Deliberately generic message to avoid enumeration
      throw new BadRequestException('No student found');
    }

    const studentRow = students[0] as { id: string; user_id: string | null; is_active: boolean };
    if (!studentRow.user_id) {
      throw new BadRequestException('No student found');
    }

    if (studentRow.is_active === false) {
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

  /**
   * Password reset by email. Sends the same style of link as Supabase recovery,
   * but email is delivered via Mailjet to avoid GoTrue strict recipient validation.
   */
  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() body: RequestPasswordResetDto,
  ): Promise<{ data: { ok: true } }> {
    const res = await this.passwordResetService.requestPasswordReset({
      rawEmail: body.email,
      confirmSendToProvided: body.confirmSendToProvided,
    });
    return { data: res };
  }

  /**
   * Lightweight login pre-check used only after Supabase returns "invalid credentials".
   * Helps the UI show a clearer message for deactivated users.
   * Always returns 200 with a generic shape to avoid account enumeration via status codes.
   */
  @Post('login-status')
  async loginStatus(
    @Body() body: { email?: string },
  ): Promise<{ data: { inactive: boolean; message?: string } }> {
    const email = body?.email?.trim().toLowerCase();
    if (!email) return { data: { inactive: false } };

    const supabase = this.supabaseConfig.getClient();

    const { data: userIdResult, error: userIdErr } = await supabase.rpc('auth_user_id_by_email', {
      p_email: email,
    });
    if (userIdErr) {
      throw new BadRequestException(userIdErr.message);
    }

    const userId =
      typeof userIdResult === 'string' && userIdResult.trim().length > 0 ? userIdResult : null;
    if (!userId) {
      return { data: { inactive: false } };
    }

    const [{ data: profile }, { data: studentRows }] = await Promise.all([
      supabase.from('profiles').select('is_active').eq('id', userId).maybeSingle(),
      supabase.from('students').select('is_active').eq('user_id', userId),
    ]);

    const profileInactive = (profile as { is_active?: boolean | null } | null)?.is_active === false;
    const studentInactive = ((studentRows || []) as Array<{ is_active: boolean }>).some(
      (row) => row.is_active === false,
    );

    if (profileInactive || studentInactive) {
      return {
        data: {
          inactive: true,
          message: 'Your account has been marked as inactive. Please contact your administrator.',
        },
      };
    }

    return { data: { inactive: false } };
  }
}

