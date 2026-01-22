/**
 * Seed Students Script
 * Creates 25 students with Iraqi names for the admin@school.com tenant
 * Run with: npx ts-node scripts/seed-students.ts
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
const ACADEMIC_YEAR_ID = '17bb7c23-81d1-46ea-b356-fc4922f22b68';
const STUDENT_ROLE_ID = 'b67b3f85-ccf0-4270-9a85-f2e12236e6c5';
const DEFAULT_PASSWORD = 'Student@123';
const YEAR_PREFIX = '2026';

// Classes
const CLASSES = {
  class1: '2f1a9f54-5ff6-412c-9954-bdc8527061d1',
  class2: '86a53008-ab55-4d9b-8e26-d08da959dea9',
  class3: '8368dc3b-5040-4ee3-9a31-3933c751364e',
  class4: '04baf0c8-ae6a-49e9-bd50-d0bcd1115339',
  class5: 'af0435f6-60ee-410c-a058-652205a34728',
};

// Sections
const SECTIONS = {
  A: 'b3c92545-160c-4202-8eb5-4387a9edecbc',
  B: '5546f26f-4ca1-4bb1-90f2-18aa4acc84c1',
  C: '51bf7e80-c274-488b-95ae-ae509a5770e9',
};

// Get class and section names
async function getClassSectionNames() {
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .in('id', Object.values(CLASSES));

  const { data: sections } = await supabase
    .from('sections')
    .select('id, name')
    .in('id', Object.values(SECTIONS));

  const classMap = new Map(classes?.map((c: { id: string; name: string }) => [c.id, c.name]) || []);
  const sectionMap = new Map(sections?.map((s: { id: string; name: string }) => [s.id, s.name]) || []);

  return { classMap, sectionMap };
}

// Students data: Iraqi names in English
const STUDENTS = [
  // Class 1
  { firstName: 'Ahmed', lastName: 'Hassan', class: 'class1', section: 'A', suffix: '001' },
  { firstName: 'Fatima', lastName: 'Ali', class: 'class1', section: 'A', suffix: '002' },
  { firstName: 'Mohammed', lastName: 'Ibrahim', class: 'class1', section: 'B', suffix: '003' },
  { firstName: 'Aisha', lastName: 'Mahmoud', class: 'class1', section: 'B', suffix: '004' },
  { firstName: 'Omar', lastName: 'Khalil', class: 'class1', section: 'C', suffix: '005' },

  // Class 2
  { firstName: 'Layla', lastName: 'Yusuf', class: 'class2', section: 'A', suffix: '001' },
  { firstName: 'Hassan', lastName: 'Salim', class: 'class2', section: 'A', suffix: '002' },
  { firstName: 'Zainab', lastName: 'Nouri', class: 'class2', section: 'B', suffix: '003' },
  { firstName: 'Ali', lastName: 'Rashid', class: 'class2', section: 'B', suffix: '004' },
  { firstName: 'Mariam', lastName: 'Tariq', class: 'class2', section: 'C', suffix: '005' },

  // Class 3
  { firstName: 'Khalid', lastName: 'Jamil', class: 'class3', section: 'A', suffix: '001' },
  { firstName: 'Noor', lastName: 'Faisal', class: 'class3', section: 'A', suffix: '002' },
  { firstName: 'Yusuf', lastName: 'Adnan', class: 'class3', section: 'B', suffix: '003' },
  { firstName: 'Sara', lastName: 'Bashir', class: 'class3', section: 'B', suffix: '004' },
  { firstName: 'Ibrahim', lastName: 'Karim', class: 'class3', section: 'C', suffix: '005' },

  // Class 4
  { firstName: 'Hana', lastName: 'Nasser', class: 'class4', section: 'A', suffix: '001' },
  { firstName: 'Tariq', lastName: 'Malik', class: 'class4', section: 'A', suffix: '002' },
  { firstName: 'Rania', lastName: 'Saeed', class: 'class4', section: 'B', suffix: '003' },
  { firstName: 'Amjad', lastName: 'Waleed', class: 'class4', section: 'B', suffix: '004' },
  { firstName: 'Dina', lastName: 'Hakim', class: 'class4', section: 'C', suffix: '005' },

  // Class 5
  { firstName: 'Bilal', lastName: 'Zaid', class: 'class5', section: 'A', suffix: '001' },
  { firstName: 'Lina', lastName: 'Farid', class: 'class5', section: 'A', suffix: '002' },
  { firstName: 'Samir', lastName: 'Nadim', class: 'class5', section: 'B', suffix: '003' },
  { firstName: 'Rana', lastName: 'Qasim', class: 'class5', section: 'B', suffix: '004' },
  { firstName: 'Waleed', lastName: 'Hamza', class: 'class5', section: 'C', suffix: '005' },
];

async function createStudent(student: typeof STUDENTS[0], classMap: Map<string, string>, sectionMap: Map<string, string>, index: number) {
  try {
    const classId = CLASSES[student.class as keyof typeof CLASSES];
    const sectionId = SECTIONS[student.section as keyof typeof SECTIONS];
    const className = classMap.get(classId) || '';
    const sectionName = sectionMap.get(sectionId) || '';

    const email = `${student.firstName.toLowerCase()}.${student.lastName.toLowerCase()}${index + 1}@student.school.com`;
    const fullName = `${student.firstName} ${student.lastName}`;
    const studentId = `${YEAR_PREFIX}-${className}-${sectionName}-${student.suffix}`;

    console.log(`Creating student: ${fullName} (${email})...`);

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) {
      console.error(`Failed to create auth user for ${email}:`, authError.message);
      return;
    }

    if (!authData.user) {
      console.error(`No user returned for ${email}`);
      return;
    }

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      is_active: true,
    });

    if (profileError) {
      console.error(`Failed to create profile for ${email}:`, profileError.message);
      await supabase.auth.admin.deleteUser(userId);
      return;
    }

    // Assign to branch
    const { error: branchError } = await supabase.from('user_branches').insert({
      user_id: userId,
      branch_id: BRANCH_ID,
      is_primary: false,
    });

    if (branchError) {
      console.error(`Failed to assign branch for ${email}:`, branchError.message);
    }

    // Assign student role
    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: userId,
      role_id: STUDENT_ROLE_ID,
      branch_id: BRANCH_ID,
    });

    if (roleError) {
      console.error(`Failed to assign role for ${email}:`, roleError.message);
    }

    // Create student record
    const admissionDate = new Date();
    admissionDate.setDate(admissionDate.getDate() - Math.floor(Math.random() * 60 + 1));

    const { error: studentError } = await supabase.from('students').insert({
      user_id: userId,
      branch_id: BRANCH_ID,
      student_id: studentId,
      class_id: classId,
      section_id: sectionId,
      academic_year_id: ACADEMIC_YEAR_ID,
      is_active: true,
      admission_date: admissionDate.toISOString().split('T')[0],
    });

    if (studentError) {
      console.error(`Failed to create student record for ${email}:`, studentError.message);
    } else {
      console.log(`✓ Created: ${fullName} - ${studentId}`);
    }
  } catch (error) {
    console.error(`Error creating student ${student.firstName} ${student.lastName}:`, error);
  }
}

async function main() {
  console.log('Starting student seeding...\n');

  const { classMap, sectionMap } = await getClassSectionNames();

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < STUDENTS.length; i++) {
    await createStudent(STUDENTS[i], classMap, sectionMap, i);
    successCount++;
    
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n✓ Seeding complete!`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
}

main().catch(console.error);

