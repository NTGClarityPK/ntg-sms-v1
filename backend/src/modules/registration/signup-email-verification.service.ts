import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'crypto';
import { signupEmailVerificationTemplate } from '../../common/email/templates/signup-email-verification';
import { MailjetService } from '../../common/services/email/mailjet.service';

type PendingOtp = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
};

type VerifiedEmailToken = {
  email: string;
  expiresAt: number;
};

const OTP_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 45 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class SignupEmailVerificationService {
  private readonly pendingByEmail = new Map<string, PendingOtp>();
  private readonly tokensById = new Map<string, VerifiedEmailToken>();

  constructor(private readonly mailjetService: MailjetService) {}

  private normalizeEmail(raw: string): string {
    return raw.normalize('NFKC').trim().toLowerCase();
  }

  private hashCode(email: string, code: string): string {
    return createHash('sha256').update(`${email}:${code}`).digest('hex');
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [email, row] of this.pendingByEmail.entries()) {
      if (row.expiresAt <= now) this.pendingByEmail.delete(email);
    }
    for (const [token, row] of this.tokensById.entries()) {
      if (row.expiresAt <= now) this.tokensById.delete(token);
    }
  }

  async sendCode(input: { email: string; fullName?: string }): Promise<{
    data: { sent: true; expiresInSeconds: number; resendAvailableInSeconds: number };
  }> {
    this.cleanupExpired();
    const email = this.normalizeEmail(input.email);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      throw new BadRequestException('Enter a valid email address');
    }

    const existing = this.pendingByEmail.get(email);
    const now = Date.now();
    if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      throw new HttpException(
        `Please wait ${wait}s before requesting another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(1000, 10000));
    this.pendingByEmail.set(email, {
      codeHash: this.hashCode(email, code),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: now,
    });

    // Changing email invalidates any previous verification token for other emails only;
    // tokens stay email-scoped and are checked on register.
    const template = signupEmailVerificationTemplate({
      email,
      code,
      fullName: input.fullName,
    });
    await this.mailjetService.sendEmail({
      toEmail: email,
      toName: input.fullName?.trim() || email,
      subject: template.subject,
      html: template.html,
    });

    return {
      data: {
        sent: true,
        expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
        resendAvailableInSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
      },
    };
  }

  verifyCode(input: { email: string; code: string }): {
    data: { verified: true; emailVerificationToken: string; expiresInSeconds: number };
  } {
    this.cleanupExpired();
    const email = this.normalizeEmail(input.email);
    const code = String(input.code ?? '').trim();
    if (!/^\d{4}$/.test(code)) {
      throw new BadRequestException('Enter the 4-digit verification code');
    }

    const pending = this.pendingByEmail.get(email);
    if (!pending || pending.expiresAt <= Date.now()) {
      this.pendingByEmail.delete(email);
      throw new BadRequestException('Verification code expired. Please request a new one.');
    }

    if (pending.attempts >= MAX_VERIFY_ATTEMPTS) {
      this.pendingByEmail.delete(email);
      throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
    }

    const expected = this.hashCode(email, code);
    if (expected !== pending.codeHash) {
      pending.attempts += 1;
      this.pendingByEmail.set(email, pending);
      const remaining = MAX_VERIFY_ATTEMPTS - pending.attempts;
      throw new BadRequestException(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
      );
    }

    this.pendingByEmail.delete(email);
    const token = randomUUID();
    this.tokensById.set(token, {
      email,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    });

    return {
      data: {
        verified: true,
        emailVerificationToken: token,
        expiresInSeconds: Math.floor(TOKEN_TTL_MS / 1000),
      },
    };
  }

  /**
   * Consumes a one-time verification token. Throws if missing/expired/mismatched.
   */
  assertAndConsumeToken(email: string, token: string | undefined): void {
    this.cleanupExpired();
    const normalizedEmail = this.normalizeEmail(email);
    if (!token?.trim()) {
      throw new BadRequestException('Please verify your email before creating the account');
    }

    const row = this.tokensById.get(token.trim());
    if (!row || row.expiresAt <= Date.now()) {
      this.tokensById.delete(token.trim());
      throw new BadRequestException('Email verification expired. Please verify your email again.');
    }
    if (row.email !== normalizedEmail) {
      throw new BadRequestException('Email verification does not match the signup email');
    }

    this.tokensById.delete(token.trim());
  }
}
