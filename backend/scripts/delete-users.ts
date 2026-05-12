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
 * Delete users by their auth user IDs.
 *
 * Usage:
 *   ts-node delete-users.ts <userId1> [userId2] [userId3] ...
 */
async function deleteUsers(userIds: string[]) {
  try {
    console.log(`\nDeleting ${userIds.length} user(s) from auth.users...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const userId of userIds) {
      try {
        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) {
          console.error(`❌ Failed to delete user ${userId}: ${error.message}`);
          failCount++;
        } else {
          console.log(`✅ Deleted user ${userId}`);
          successCount++;
        }
      } catch (error: any) {
        console.error(`❌ Error deleting user ${userId}: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n\nSummary:`);
    console.log(`✅ Successfully deleted: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Get user IDs from command line arguments
const userIds = process.argv.slice(2);

if (userIds.length === 0) {
  console.error('Usage: ts-node delete-users.ts <userId1> [userId2] [userId3] ...');
  console.error('Example: ts-node delete-users.ts 85c67153-4cc5-4891-82d1-c98a0be11136 86c67153-4cc5-4891-82d1-c98a0be11137');
  process.exit(1);
}

deleteUsers(userIds);

