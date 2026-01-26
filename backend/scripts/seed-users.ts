/**
 * Seed Users Script
 * Creates users with multiple roles for the Default School tenant
 * Run with: npx ts-node scripts/seed-users.ts (from backend directory)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Configuration
const BRANCH_ID = '04e1ae26-dbfe-4443-8e0f-2d50d6c68e6b';
const DEFAULT_PASSWORD = 'User@123';

// Role IDs (from database)
const ROLES = {
  principal: '5824da4a-186e-4fa5-9829-9500ed9e96ff',
  school_admin: '525153bb-7fe6-40b1-b123-b58892970277',
  academic_coordinator: 'f5487e3b-7534-413c-aa8d-dac6c39a74de',
  class_teacher: '92ad7ad0-d895-4444-898f-1203a16bd7f5',
  subject_teacher: '14490b6c-15be-44c8-841d-9b61e5b33cb3',
  guidance_counselor: 'f8ae8adc-9f3a-42e9-bbb4-3b055ad15a0f',
  admin_assistant: 'fa0b2181-0ffa-462f-b736-7f286feeb831',
  parent: '89cee07f-0cef-4848-bcc2-10fa6e501c24',
};

// Users to create with their roles (multiple roles per user where applicable)
const usersToCreate = [
  // Principal
  {
    firstName: 'Ahmed',
    lastName: 'Al-Mansouri',
    email: 'ahmed.almansouri@school.com',
    roles: [ROLES.principal],
    phone: '+964 750 123 4567',
    gender: 'male' as const,
  },
  // School Admin (multi-role: admin + coordinator)
  {
    firstName: 'Fatima',
    lastName: 'Hassan',
    email: 'fatima.hassan@school.com',
    roles: [ROLES.school_admin, ROLES.academic_coordinator],
    phone: '+964 750 234 5678',
    gender: 'female' as const,
  },
  // Academic Coordinator
  {
    firstName: 'Mohammed',
    lastName: 'Ibrahim',
    email: 'mohammed.ibrahim@school.com',
    roles: [ROLES.academic_coordinator],
    phone: '+964 750 345 6789',
    gender: 'male' as const,
  },
  // Class Teachers (multi-role: class teacher + subject teacher)
  {
    firstName: 'Aisha',
    lastName: 'Mahmoud',
    email: 'aisha.mahmoud@school.com',
    roles: [ROLES.class_teacher, ROLES.subject_teacher],
    phone: '+964 750 456 7890',
    gender: 'female' as const,
  },
  {
    firstName: 'Omar',
    lastName: 'Khalil',
    email: 'omar.khalil@school.com',
    roles: [ROLES.class_teacher],
    phone: '+964 750 567 8901',
    gender: 'male' as const,
  },
  // Subject Teachers
  {
    firstName: 'Layla',
    lastName: 'Yusuf',
    email: 'layla.yusuf@school.com',
    roles: [ROLES.subject_teacher],
    phone: '+964 750 678 9012',
    gender: 'female' as const,
  },
  {
    firstName: 'Hassan',
    lastName: 'Salim',
    email: 'hassan.salim@school.com',
    roles: [ROLES.subject_teacher],
    phone: '+964 750 789 0123',
    gender: 'male' as const,
  },
  // Guidance Counselor
  {
    firstName: 'Zainab',
    lastName: 'Nouri',
    email: 'zainab.nouri@school.com',
    roles: [ROLES.guidance_counselor],
    phone: '+964 750 890 1234',
    gender: 'female' as const,
  },
  // Admin Assistant
  {
    firstName: 'Ali',
    lastName: 'Rashid',
    email: 'ali.rashid@school.com',
    roles: [ROLES.admin_assistant],
    phone: '+964 750 901 2345',
    gender: 'male' as const,
  },
  {
    firstName: 'Mariam',
    lastName: 'Tariq',
    email: 'mariam.tariq@school.com',
    roles: [ROLES.admin_assistant],
    phone: '+964 750 012 3456',
    gender: 'female' as const,
  },
  // Parents
  {
    firstName: 'Khalid',
    lastName: 'Jamil',
    email: 'khalid.jamil@parent.com',
    roles: [ROLES.parent],
    phone: '+964 751 123 4567',
    gender: 'male' as const,
  },
  {
    firstName: 'Noor',
    lastName: 'Faisal',
    email: 'noor.faisal@parent.com',
    roles: [ROLES.parent],
    phone: '+964 751 234 5678',
    gender: 'female' as const,
  },
  {
    firstName: 'Yusuf',
    lastName: 'Adnan',
    email: 'yusuf.adnan@parent.com',
    roles: [ROLES.parent],
    phone: '+964 751 345 6789',
    gender: 'male' as const,
  },
];

async function seedUsers() {
  console.log('Starting user seeding...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const userData of usersToCreate) {
    const fullName = `${userData.firstName} ${userData.lastName}`;
    const email = userData.email;

    try {
      console.log(`Creating user: ${fullName} (${email})...`);

      // 1. Create or get auth user
      let userId: string;
      let isNewUser = false;

      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers.users.find((u) => u.email === email);

      if (existingUser) {
        userId = existingUser.id;
        console.log(`  ℹ User ${email} already exists, updating roles...`);
      } else {
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
          },
        });

        if (authError) {
          throw authError;
        }

        if (!authUser.user) {
          throw new Error('Failed to create auth user.');
        }

        userId = authUser.user.id;
        isNewUser = true;
      }

      // 2. Create or update profile
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: userId,
          full_name: fullName,
          phone: userData.phone,
          gender: userData.gender,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
      if (profileError) throw profileError;

      // 3. Assign to branch
      const { error: userBranchError } = await supabase.from('user_branches').upsert(
        {
          user_id: userId,
          branch_id: BRANCH_ID,
          is_primary: true,
        },
        { onConflict: 'user_id,branch_id' },
      );
      if (userBranchError) throw userBranchError;

      // 4. Assign roles (multiple roles per user) - remove existing roles first, then add new ones
      // Remove existing roles for this branch
      const { error: deleteRolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('branch_id', BRANCH_ID);
      if (deleteRolesError) throw deleteRolesError;

      // Add new roles
      if (userData.roles.length > 0) {
        const roleAssignments = userData.roles.map((roleId) => ({
          user_id: userId,
          role_id: roleId,
          branch_id: BRANCH_ID,
        }));

        const { error: userRoleError } = await supabase
          .from('user_roles')
          .insert(roleAssignments);
        if (userRoleError) throw userRoleError;
      }

      // 5. Set current branch in profile
      const { error: updateBranchError } = await supabase
        .from('profiles')
        .update({ current_branch_id: BRANCH_ID })
        .eq('id', userId);
      if (updateBranchError) throw updateBranchError;

      const rolesList = userData.roles
        .map((roleId) => {
          const roleName = Object.entries(ROLES).find(([, id]) => id === roleId)?.[0];
          return roleName?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        })
        .join(', ');

      const action = isNewUser ? 'Created' : 'Updated';
      console.log(`  ✓ ${action}: ${fullName} - Roles: ${rolesList}`);
      successCount++;
    } catch (error: any) {
      console.error(`  ✗ Failed to create user ${fullName}: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n✓ Seeding complete!');
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`\nDefault password for all users: ${DEFAULT_PASSWORD}`);
}

seedUsers().catch(console.error);

