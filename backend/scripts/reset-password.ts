import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Reset password by SUPABASE auth user id (avoids listUsers, which is failing in this environment).
 *
 * Usage:
 *   ts-node reset-password.ts <userId> [newPassword]
 */
async function resetPasswordById(userId: string, newPassword: string) {
  try {
    console.log(`\nResetting password for user id: ${userId}\n`);

    // Update the password using Admin API directly by id
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      throw new Error(`Failed to reset password: ${error.message}`);
    }

    console.log('\n✅ Password reset successfully!');
    console.log(`\nNew password: ${newPassword}`);
    console.log(`\nUser can now login with this password.`);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Get user id and password from command line arguments
const userId = process.argv[2];
const newPassword = process.argv[3] || 'TempPassword@123';

if (!userId) {
  console.error('Usage: ts-node reset-password.ts <userId> [newPassword]');
  console.error('Example: ts-node reset-password.ts 85c67153-4cc5-4891-82d1-c98a0be11136 MyNewPassword@123');
  process.exit(1);
}

resetPasswordById(userId, newPassword);


