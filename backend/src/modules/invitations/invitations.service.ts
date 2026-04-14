import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { MailjetService } from '../../common/services/email/mailjet.service';
import { parentSetsStudentPasswordTemplate } from '../../common/email/templates/parent-sets-student-password';
import { studentSetsOwnPasswordTemplate } from '../../common/email/templates/student-sets-own-password';
import { parentSetsOwnPasswordTemplate } from '../../common/email/templates/parent-sets-own-password';
import { staffSetsOwnPasswordTemplate } from '../../common/email/templates/staff-sets-own-password';
import type { InvitationEmailBranding } from '../../common/email/templates/invitation-email-layout';

type InvitationType = 'student' | 'parent' | 'parent_account' | 'staff';

type InvitationRow = {
  id: string;
  token: string;
  user_id: string;
  recipient_email: string;
  invitation_type: InvitationType;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;

  const message = error.message || '';
  if (message.includes("Could not find the table 'public.invitations'")) {
    throw new BadRequestException(
      'Invitations table is missing. Apply the new migration `20260327120500_create_invitations_table.sql` and restart the backend.',
    );
  }
  throw new BadRequestException(error.message);
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);
  private readonly invitationsPerMinuteLimit: number;

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
    private readonly mailjetService: MailjetService,
    private readonly configService: ConfigService,
  ) {
    const configured = Number(this.configService.get<string>('INVITATIONS_RATE_LIMIT_PER_MINUTE'));
    // Default to 20 invitations/min so bulk import can do ~10 students/min when creating parent accounts too.
    this.invitationsPerMinuteLimit = Number.isFinite(configured) && configured > 0 ? configured : 20;
  }

  private getFrontendUrl(): string {
    const url = this.configService.get<string>('FRONTEND_URL')?.trim();
    if (!url) {
      throw new Error('FRONTEND_URL must be set');
    }
    return url.replace(/\/+$/, '');
  }

  private invitationLink(token: string): string {
    return `${this.getFrontendUrl()}/setup?token=${encodeURIComponent(token)}`;
  }

  private async resolveInvitationBranding(branchId?: string): Promise<InvitationEmailBranding> {
    if (!branchId) {
      return { schoolName: null, branchName: null };
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('name, tenant_id')
      .eq('id', branchId)
      .maybeSingle();

    if (branchError || !branch) {
      return { schoolName: null, branchName: null };
    }

    const b = branch as { name: string | null; tenant_id: string | null };
    if (!b.tenant_id) {
      return {
        schoolName: b.name,
        branchName: b.name,
      };
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, logo_url')
      .eq('id', b.tenant_id)
      .maybeSingle();

    const t = tenant as { name: string | null; logo_url: string | null } | null;
    return {
      schoolName: t?.name ?? b.name,
      branchName: b.name,
    };
  }

  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private expiresAt(days = 7): string {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  private async enforceRateLimit(createdByUserId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', createdByUserId)
      .gte('created_at', oneMinuteAgo);

    throwIfDbError(error);
    const sentRecently = count ?? 0;
    if (sentRecently >= this.invitationsPerMinuteLimit) {
      throw new HttpException(
        `Rate limit exceeded: maximum ${this.invitationsPerMinuteLimit} invitations per minute`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async createInvitation(input: {
    userId: string;
    recipientEmail: string;
    invitationType: InvitationType;
    createdByUserId: string;
  }): Promise<InvitationRow> {
    const supabase = this.supabaseConfig.getClient();
    await this.enforceRateLimit(input.createdByUserId);

    // Extremely unlikely collision; retry a few times to satisfy unique constraint.
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = this.generateToken();
      const payload = {
        token,
        user_id: input.userId,
        recipient_email: input.recipientEmail,
        invitation_type: input.invitationType,
        created_by: input.createdByUserId,
        expires_at: this.expiresAt(7),
      };

      const { data, error } = await supabase
        .from('invitations')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        // Unique token collision.
        if (error.code === '23505') continue;
        throwIfDbError(error);
      }

      if (!data) {
        throw new BadRequestException('Failed to create invitation');
      }

      return data as InvitationRow;
    }

    throw new BadRequestException('Failed to generate a unique invitation token');
  }

  async sendInvitationEmail(input: {
    invitation: InvitationRow;
    recipientName: string;
    loginEmail: string;
    studentName?: string;
    userEmailForAudit: string;
    branchId?: string;
  }): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    let studentName = input.studentName;
    if (input.invitation.invitation_type === 'parent' && !studentName) {
      const { data: st } = await supabase
        .from('students')
        .select('first_name, last_name')
        .eq('user_id', input.invitation.user_id)
        .maybeSingle();
      const row = st as { first_name: string | null; last_name: string | null } | null;
      if (row) {
        studentName = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || undefined;
      }
    }

    const branding = await this.resolveInvitationBranding(input.branchId);
    const link = this.invitationLink(input.invitation.token);
    const expiresInDays = 7;

    const template = (() => {
      if (input.invitation.invitation_type === 'parent') {
        return parentSetsStudentPasswordTemplate({
          parentName: input.recipientName,
          studentName: studentName ?? 'Student',
          loginEmail: input.loginEmail,
          invitationLink: link,
          expiresInDays,
          branding,
        });
      }
      if (input.invitation.invitation_type === 'parent_account') {
        return parentSetsOwnPasswordTemplate({
          parentName: input.recipientName,
          loginEmail: input.loginEmail,
          invitationLink: link,
          expiresInDays,
          branding,
        });
      }
      if (input.invitation.invitation_type === 'staff') {
        return staffSetsOwnPasswordTemplate({
          staffName: input.recipientName,
          loginEmail: input.loginEmail,
          invitationLink: link,
          expiresInDays,
          branding,
        });
      }
      return studentSetsOwnPasswordTemplate({
        studentName: input.recipientName,
        loginEmail: input.loginEmail,
        invitationLink: link,
        expiresInDays,
        branding,
      });
    })();

    try {
      await this.mailjetService.sendEmail({
        toEmail: input.invitation.recipient_email,
        toName: input.recipientName,
        subject: template.subject,
        html: template.html,
      });

      // Persist latest invite destination for admin visibility (best-effort).
      // Invitations table is the source of truth; this is a denormalised convenience field.
      try {
        const sentAt = new Date().toISOString();
        await supabase
          .from('profiles')
          .update({
            invitation_recipient_email: input.invitation.recipient_email,
            invitation_sent_at: sentAt,
            updated_at: sentAt,
          })
          .eq('id', input.invitation.user_id);

        if (
          input.invitation.invitation_type === 'student' ||
          input.invitation.invitation_type === 'parent'
        ) {
          await supabase
            .from('students')
            .update({
              invitation_recipient_email: input.invitation.recipient_email,
              invitation_sent_at: sentAt,
              updated_at: sentAt,
            })
            .eq('user_id', input.invitation.user_id);
        }
      } catch (e) {
        this.logger.warn(
          `Could not persist invitation metadata for user ${input.invitation.user_id}: ${e instanceof Error ? e.message : e}`,
        );
      }

      this.auditLogService
        .logCreate(
          'invitations',
          input.invitation.id,
          input.userEmailForAudit,
          { ...input.invitation, invitation_link: link } as unknown as Record<string, unknown>,
        )
        .catch(() => {});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email error';
      throw new BadRequestException(`Failed to send invitation email: ${message}`);
    }
  }

  async validateSetupToken(token: string): Promise<{
    invitationId: string;
    invitationType: InvitationType;
    loginEmail: string;
    name: string;
    studentName?: string;
    expiresAt: string;
  }> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('invitations')
      .select('id, token, user_id, invitation_type, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) throw new NotFoundException('Invitation not found');

    const inv = data as Pick<
      InvitationRow,
      'id' | 'token' | 'user_id' | 'invitation_type' | 'expires_at' | 'used_at'
    >;

    if (inv.used_at) {
      throw new BadRequestException('Invitation has already been used');
    }
    if (new Date(inv.expires_at).getTime() <= Date.now()) {
      throw new BadRequestException('Invitation has expired');
    }

    const { data: authUserResult } = await supabase.auth.admin.getUserById(inv.user_id);
    const loginEmail = authUserResult.user?.email;
    if (!loginEmail) {
      throw new NotFoundException('User not found');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', inv.user_id)
      .maybeSingle();

    const name =
      (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
      loginEmail;

    return {
      invitationId: inv.id,
      invitationType: inv.invitation_type,
      loginEmail,
      name,
      expiresAt: inv.expires_at,
    };
  }

  async setupPassword(token: string, newPassword: string): Promise<{ success: true }> {
    const supabase = this.supabaseConfig.getClient();

    // Validate again (exist / not expired / not used)
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    throwIfDbError(error);
    if (!data) throw new NotFoundException('Invitation not found');
    const inv = data as InvitationRow;

    if (inv.used_at) {
      throw new BadRequestException('Invitation has already been used');
    }
    if (new Date(inv.expires_at).getTime() <= Date.now()) {
      throw new BadRequestException('Invitation has expired');
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(inv.user_id, {
      password: newPassword,
    });
    if (updateError) {
      throw new BadRequestException(updateError.message);
    }

    const usedAt = new Date().toISOString();
    const { error: usedError } = await supabase
      .from('invitations')
      .update({ used_at: usedAt })
      .eq('id', inv.id);
    throwIfDbError(usedError);

    if (inv.invitation_type !== 'parent_account') {
      await this.activateStudentAfterPasswordSetup(inv.user_id);
    }

    return { success: true };
  }

  /**
   * When the invited user is a student, move them from pending verification to active.
   */
  private async activateStudentAfterPasswordSetup(userId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase
      .from('students')
      .update({
        account_status: 'active',
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('account_status', 'pending_verification');
    if (error) {
      this.logger.warn(
        `Could not activate student after password setup for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Remove auth users whose invitations expired unused; mark affected students as link_expired.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireUnusedInvitationsJob(): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const now = new Date().toISOString();

    const { data: rows, error } = await supabase
      .from('invitations')
      .select('user_id')
      .lt('expires_at', now)
      .is('used_at', null);

    if (error) {
      this.logger.warn(`expireUnusedInvitationsJob: query failed: ${error.message}`);
      return;
    }

    const userIds = [
      ...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean)),
    ];

    for (const userId of userIds) {
      try {
        await this.purgeExpiredInvitationUser(supabase, userId);
      } catch (e) {
        this.logger.warn(
          `expireUnusedInvitationsJob: failed for user ${userId}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  private async purgeExpiredInvitationUser(supabase: SupabaseClient, userId: string): Promise<void> {
    const { error: stuErr } = await supabase
      .from('students')
      .update({
        user_id: null,
        account_status: 'link_expired',
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('account_status', 'pending_verification');
    if (stuErr) throw new BadRequestException(stuErr.message);

    await supabase.from('parent_students').delete().eq('parent_user_id', userId);
    await supabase.from('user_roles').delete().eq('user_id', userId);
    await supabase.from('user_branches').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    const { error: delAuthErr } = await supabase.auth.admin.deleteUser(userId);
    if (delAuthErr && !delAuthErr.message.toLowerCase().includes('not found')) {
      throw new BadRequestException(delAuthErr.message);
    }

    await supabase.from('invitations').delete().eq('user_id', userId).is('used_at', null);
  }

  async resendInvitation(input: {
    invitationId?: string;
    token?: string;
    recipientEmailOverride?: string;
    invitationTypeOverride?: InvitationType;
    createdByUserId: string;
    userEmailForAudit: string;
    branchId?: string;
  }): Promise<{ token: string; expiresAt: string }> {
    const supabase = this.supabaseConfig.getClient();
    await this.enforceRateLimit(input.createdByUserId);

    let existing: InvitationRow | null = null;
    if (input.invitationId) {
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', input.invitationId)
        .maybeSingle();
      existing = (data as InvitationRow | null) ?? null;
    } else if (input.token) {
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', input.token)
        .maybeSingle();
      existing = (data as InvitationRow | null) ?? null;
    }

    if (!existing) {
      throw new NotFoundException('Invitation not found');
    }

    // Only allow resend if unused. (Expired or still valid doesn't matter: we rotate the token.)
    if (existing.used_at) {
      throw new BadRequestException('Invitation has already been used');
    }

    const recipientEmail =
      input.recipientEmailOverride?.trim() || existing.recipient_email;
    const invitationType =
      input.invitationTypeOverride ?? existing.invitation_type;

    // Rotate token on the existing record to keep a single invitation row.
    let newToken: string | null = null;
    let newExpiresAt: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const tokenCandidate = this.generateToken();
      const expiresAt = this.expiresAt(7);

      const { data: updated, error } = await supabase
        .from('invitations')
        .update({
          token: tokenCandidate,
          recipient_email: recipientEmail,
          invitation_type: invitationType,
          expires_at: expiresAt,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') continue;
        throwIfDbError(error);
      }
      if (!updated) {
        throw new BadRequestException('Failed to resend invitation');
      }

      const updatedRow = updated as InvitationRow;
      newToken = updatedRow.token;
      newExpiresAt = updatedRow.expires_at;
      existing = updatedRow;
      break;
    }

    if (!newToken || !newExpiresAt) {
      throw new BadRequestException('Failed to generate a unique invitation token');
    }

    const { data: authUserResult } = await supabase.auth.admin.getUserById(existing.user_id);
    const loginEmail = authUserResult.user?.email;
    if (!loginEmail) throw new NotFoundException('User not found');

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', existing.user_id)
      .maybeSingle();
    const name =
      (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
      loginEmail;

    await this.sendInvitationEmail({
      invitation: existing,
      recipientName: name,
      loginEmail,
      userEmailForAudit: input.userEmailForAudit,
      branchId: input.branchId,
    });

    return { token: newToken, expiresAt: newExpiresAt };
  }

  async resendLatestInvitationForUser(input: {
    userId: string;
    invitationType: InvitationType;
    recipientEmailOverride?: string;
    createdByUserId: string;
    userEmailForAudit: string;
    branchId?: string;
  }): Promise<{ token: string; expiresAt: string }> {
    const supabase = this.supabaseConfig.getClient();
    await this.enforceRateLimit(input.createdByUserId);

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('user_id', input.userId)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1);

    throwIfDbError(error);
    const existing = (data as InvitationRow[] | null)?.[0] ?? null;
    if (!existing) {
      throw new NotFoundException('No active invitation found for this user');
    }

    return this.resendInvitation({
      invitationId: existing.id,
      recipientEmailOverride: input.recipientEmailOverride,
      invitationTypeOverride: input.invitationType,
      createdByUserId: input.createdByUserId,
      userEmailForAudit: input.userEmailForAudit,
      branchId: input.branchId,
    });
  }
}

