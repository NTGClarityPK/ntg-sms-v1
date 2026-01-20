import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class AuthService {
  constructor(private supabaseConfig: SupabaseConfig) {}

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    // Get user from auth.users
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      throw new NotFoundException('User not found');
    }

    // Get profile from public.profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is okay for new users
      throw new NotFoundException('Profile not found');
    }

    return new UserResponseDto({
      id: user.id,
      email: user.email || '',
      fullName: profile?.full_name || user.email || 'User',
      avatarUrl: profile?.avatar_url || undefined,
      roles: [], // Placeholder - will be populated later with role management
    });
  }

  async validateToken(token: string): Promise<UserResponseDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify token and get user
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new NotFoundException('Invalid token');
    }

    return this.getCurrentUser(user.id);
  }
}

