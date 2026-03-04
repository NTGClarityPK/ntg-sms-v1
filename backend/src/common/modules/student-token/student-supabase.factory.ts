import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import type { StudentTokenPayloadInput } from './student-token.service';
import { StudentTokenService } from './student-token.service';

@Injectable()
export class StudentSupabaseFactory {
  private readonly supabaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly studentTokenService: StudentTokenService,
  ) {
    const url = this.configService.get<string>('SUPABASE_URL');
    if (!url) {
      throw new Error('SUPABASE_URL is not configured');
    }
    this.supabaseUrl = url;
  }

  createClient(input: StudentTokenPayloadInput): SupabaseClient {
    const token = this.studentTokenService.mintStudentToken(input);

    // We only need the URL; anonymous key is not required when passing a JWT
    return createClient(this.supabaseUrl, '', {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }
}

