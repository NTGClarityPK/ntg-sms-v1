import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailjet from 'node-mailjet';

export type InvitationEmailTemplate = {
  subject: string;
  html: string;
};

export type SendInvitationEmailInput = {
  recipientEmail: string;
  recipientName: string;
  loginEmail: string;
  studentName?: string;
  invitationType: 'student' | 'parent';
  invitationLink: string;
};

@Injectable()
export class MailjetService {
  private readonly client: ReturnType<typeof Mailjet.apiConnect>;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('MAILJET_API_KEY');
    const secretKey = this.configService.get<string>('MAILJET_SECRET_KEY');
    this.fromEmail = this.configService.get<string>('MAILJET_FROM_EMAIL') ?? '';
    this.fromName = this.configService.get<string>('MAILJET_FROM_NAME') ?? 'NTG SMS';

    if (!apiKey || !secretKey) {
      throw new Error('MAILJET_API_KEY and MAILJET_SECRET_KEY must be set');
    }
    if (!this.fromEmail) {
      throw new Error('MAILJET_FROM_EMAIL must be set');
    }

    this.client = Mailjet.apiConnect(apiKey, secretKey);
  }

  async sendEmail(options: {
    toEmail: string;
    toName: string;
    subject: string;
    html: string;
  }): Promise<void> {
    await this.client.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: { Email: this.fromEmail, Name: this.fromName },
          To: [{ Email: options.toEmail, Name: options.toName }],
          Subject: options.subject,
          HTMLPart: options.html,
        },
      ],
    });
  }
}

