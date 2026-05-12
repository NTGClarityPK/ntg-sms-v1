/**
 * ABC School Cleanup Script
 * 
 * Safely removes ALL ABC School data while preserving other tenants/students.
 * 
 * Prerequisites:
 * 1. Set environment variables:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 * 
 * 2. Run:
 *    npx tsx cleanup-abc-school.ts
 * 
 * WARNING: This deletes all data for ABC School Networks tenant!
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanupABCSchool() {
  console.log('🧹 Starting ABC School cleanup...\n');

  try {
    // Step 1: Find ABC tenant
    console.log('1️⃣ Finding ABC School tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, code')
      .eq('code', 'ABC-NET')
      .single();

    if (tenantError || !tenant) {
      console.log('✅ ABC School tenant not found. Nothing to clean up.');
      return;
    }

    console.log(`   Found tenant: ${tenant.name} (${tenant.id})`);

    // Step 2: Find ABC branches
    console.log('\n2️⃣ Finding ABC School branches...');
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('tenant_id', tenant.id);

    if (branchError) {
      console.error('   Error finding branches:', branchError);
      throw branchError;
    }

    const branchIds = branches?.map(b => b.id) || [];
    console.log(`   Found ${branchIds.length} branches:`, branches?.map(b => b.code).join(', '));

    if (branchIds.length === 0) {
      console.log('   No branches found. Skipping child data cleanup.');
    }

    // Step 3: Get all ABC students (to find their parents)
    let studentIds: string[] = [];
    let parentUserIds: string[] = [];

    if (branchIds.length > 0) {
      console.log('\n3️⃣ Finding ABC students...');
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, student_id')
        .in('branch_id', branchIds);

      if (studentsError) {
        console.error('   Error finding students:', studentsError);
      } else {
        studentIds = students?.map(s => s.id) || [];
        console.log(`   Found ${studentIds.length} students`);
        if (students && students.length > 0) {
          console.log(`   Roll numbers: ${students[0].student_id} to ${students[students.length - 1].student_id}`);
        }
      }

      // Find parent user IDs
      if (studentIds.length > 0) {
        console.log('\n4️⃣ Finding parent accounts...');
        const { data: parentLinks, error: parentError } = await supabase
          .from('parent_students')
          .select('parent_user_id')
          .in('student_id', studentIds);

        if (parentError) {
          console.error('   Error finding parents:', parentError);
        } else {
          parentUserIds = [...new Set(parentLinks?.map(p => p.parent_user_id) || [])];
          console.log(`   Found ${parentUserIds.length} unique parent accounts`);
        }
      }
    }

    // Step 4: Get all ABC staff user IDs
    let staffUserIds: string[] = [];
    if (branchIds.length > 0) {
      console.log('\n5️⃣ Finding staff accounts...');
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('user_id')
        .in('branch_id', branchIds);

      if (staffError) {
        console.error('   Error finding staff:', staffError);
      } else {
        staffUserIds = staff?.map(s => s.user_id).filter(Boolean) || [];
        console.log(`   Found ${staffUserIds.length} staff accounts`);
      }
    }

    // Combine all user IDs to delete
    const allUserIdsToDelete = [...new Set([...parentUserIds, ...staffUserIds])];
    console.log(`\n   Total auth users to delete: ${allUserIdsToDelete.length}`);

    // Step 5: Delete in proper order (respecting foreign keys)
    console.log('\n6️⃣ Deleting data in dependency order...\n');

    if (branchIds.length > 0) {
      // Delete child records first (no FKs pointing to them)
      
      // Behavioral scores -> behavioral assessments
      console.log('   Deleting behavioral scores...');
      const { error: e1 } = await supabase
        .from('behavioral_scores')
        .delete()
        .in('branch_id', branchIds);
      if (e1) console.error('   Error:', e1.message);

      console.log('   Deleting behavioral assessments...');
      const { error: e2 } = await supabase
        .from('behavioral_assessments')
        .delete()
        .in('branch_id', branchIds);
      if (e2) console.error('   Error:', e2.message);

      // Event consents -> events
      console.log('   Deleting event consents...');
      const { error: e3 } = await supabase
        .from('event_consents')
        .delete()
        .in('branch_id', branchIds);
      if (e3) console.error('   Error:', e3.message);

      console.log('   Deleting event participants...');
      const { error: e4 } = await supabase
        .from('event_participants')
        .delete()
        .in('branch_id', branchIds);
      if (e4) console.error('   Error:', e4.message);

      console.log('   Deleting events...');
      const { error: e5 } = await supabase
        .from('events')
        .delete()
        .in('branch_id', branchIds);
      if (e5) console.error('   Error:', e5.message);

      // Student grades -> assessments
      console.log('   Deleting student grades...');
      const { error: e6 } = await supabase
        .from('student_grades')
        .delete()
        .in('branch_id', branchIds);
      if (e6) console.error('   Error:', e6.message);

      console.log('   Deleting student assessment statuses...');
      const { error: e7 } = await supabase
        .from('student_assessment_statuses')
        .delete()
        .in('branch_id', branchIds);
      if (e7) console.error('   Error:', e7.message);

      console.log('   Deleting assessments...');
      const { error: e8 } = await supabase
        .from('assessments')
        .delete()
        .in('branch_id', branchIds);
      if (e8) console.error('   Error:', e8.message);

      // Attendance
      console.log('   Deleting attendance records...');
      const { error: e9 } = await supabase
        .from('attendance')
        .delete()
        .in('branch_id', branchIds);
      if (e9) console.error('   Error:', e9.message);

      // Leave/early departure requests
      console.log('   Deleting leave requests...');
      const { error: e10 } = await supabase
        .from('leave_requests')
        .delete()
        .in('branch_id', branchIds);
      if (e10) console.error('   Error:', e10.message);

      console.log('   Deleting early departure requests...');
      const { error: e11 } = await supabase
        .from('early_departure_requests')
        .delete()
        .in('branch_id', branchIds);
      if (e11) console.error('   Error:', e11.message);

      // Messages & conversations
      console.log('   Deleting messages...');
      const { error: e12 } = await supabase
        .from('messages')
        .delete()
        .in('branch_id', branchIds);
      if (e12) console.error('   Error:', e12.message);

      console.log('   Deleting conversations...');
      const { error: e13 } = await supabase
        .from('conversations')
        .delete()
        .in('branch_id', branchIds);
      if (e13) console.error('   Error:', e13.message);

      // Notifications
      console.log('   Deleting notifications...');
      const { error: e14 } = await supabase
        .from('notifications')
        .delete()
        .in('branch_id', branchIds);
      if (e14) console.error('   Error:', e14.message);

      // Student-related
      if (studentIds.length > 0) {
        console.log('   Deleting parent-student links...');
        const { error: e15 } = await supabase
          .from('parent_students')
          .delete()
          .in('student_id', studentIds);
        if (e15) console.error('   Error:', e15.message);

        console.log('   Deleting student subject template assignments...');
        const { error: e16 } = await supabase
          .from('student_subject_template_assignments')
          .delete()
          .in('student_id', studentIds);
        if (e16) console.error('   Error:', e16.message);

        console.log('   Deleting students...');
        const { error: e17 } = await supabase
          .from('students')
          .delete()
          .in('id', studentIds);
        if (e17) console.error('   Error:', e17.message);
      }

      // Timetable
      console.log('   Deleting timetable slots...');
      const { error: e18 } = await supabase
        .from('timetable_slots')
        .delete()
        .in('branch_id', branchIds);
      if (e18) console.error('   Error:', e18.message);

      console.log('   Deleting timing templates...');
      const { error: e19 } = await supabase
        .from('timing_templates')
        .delete()
        .in('branch_id', branchIds);
      if (e19) console.error('   Error:', e19.message);

      // Library & Uniforms
      console.log('   Deleting library items...');
      const { error: e20 } = await supabase
        .from('library_items')
        .delete()
        .in('branch_id', branchIds);
      if (e20) console.error('   Error:', e20.message);

      console.log('   Deleting uniform requests...');
      const { error: e21 } = await supabase
        .from('uniform_requests')
        .delete()
        .in('branch_id', branchIds);
      if (e21) console.error('   Error:', e21.message);

      console.log('   Deleting uniform stock...');
      const { error: e22 } = await supabase
        .from('uniform_stock')
        .delete()
        .in('branch_id', branchIds);
      if (e22) console.error('   Error:', e22.message);

      console.log('   Deleting uniform items...');
      const { error: e23 } = await supabase
        .from('uniform_items')
        .delete()
        .in('branch_id', branchIds);
      if (e23) console.error('   Error:', e23.message);

      // Staff
      console.log('   Deleting staff records...');
      const { error: e24 } = await supabase
        .from('staff')
        .delete()
        .in('branch_id', branchIds);
      if (e24) console.error('   Error:', e24.message);

      // User roles & branches
      if (allUserIdsToDelete.length > 0) {
        console.log('   Deleting user roles...');
        const { error: e25 } = await supabase
          .from('user_roles')
          .delete()
          .in('user_id', allUserIdsToDelete);
        if (e25) console.error('   Error:', e25.message);

        console.log('   Deleting user branches...');
        const { error: e26 } = await supabase
          .from('user_branches')
          .delete()
          .in('user_id', allUserIdsToDelete);
        if (e26) console.error('   Error:', e26.message);
      }

      // Class sections
      console.log('   Deleting class sections...');
      const { error: e27 } = await supabase
        .from('class_sections')
        .delete()
        .in('branch_id', branchIds);
      if (e27) console.error('   Error:', e27.message);

      // Grading
      console.log('   Deleting class grade assignments...');
      const { error: e28 } = await supabase
        .from('class_grade_assignments')
        .delete()
        .in('branch_id', branchIds);
      if (e28) console.error('   Error:', e28.message);

      console.log('   Deleting grade ranges...');
      const { error: e29 } = await supabase
        .from('grade_ranges')
        .delete()
        .in('branch_id', branchIds);
      if (e29) console.error('   Error:', e29.message);

      console.log('   Deleting grade templates...');
      const { error: e30 } = await supabase
        .from('grade_templates')
        .delete()
        .in('branch_id', branchIds);
      if (e30) console.error('   Error:', e30.message);

      // Assessment types
      console.log('   Deleting assessment types...');
      const { error: e31 } = await supabase
        .from('assessment_types')
        .delete()
        .in('branch_id', branchIds);
      if (e31) console.error('   Error:', e31.message);

      // Subject templates
      console.log('   Deleting subject template mappings...');
      const { error: e32 } = await supabase
        .from('subject_template_mappings')
        .delete()
        .in('branch_id', branchIds);
      if (e32) console.error('   Error:', e32.message);

      console.log('   Deleting subject templates...');
      const { error: e33 } = await supabase
        .from('subject_templates')
        .delete()
        .in('branch_id', branchIds);
      if (e33) console.error('   Error:', e33.message);

      // Subjects
      console.log('   Deleting subjects...');
      const { error: e34 } = await supabase
        .from('subjects')
        .delete()
        .in('branch_id', branchIds);
      if (e34) console.error('   Error:', e34.message);

      // Academic years, classes, sections, holidays
      console.log('   Deleting academic years...');
      const { error: e35 } = await supabase
        .from('academic_years')
        .delete()
        .in('branch_id', branchIds);
      if (e35) console.error('   Error:', e35.message);

      console.log('   Deleting public holidays...');
      const { error: e36 } = await supabase
        .from('public_holidays')
        .delete()
        .in('branch_id', branchIds);
      if (e36) console.error('   Error:', e36.message);

      console.log('   Deleting vacation periods...');
      const { error: e37 } = await supabase
        .from('vacation_periods')
        .delete()
        .in('branch_id', branchIds);
      if (e37) console.error('   Error:', e37.message);

      console.log('   Deleting school days...');
      const { error: e38 } = await supabase
        .from('school_days')
        .delete()
        .in('branch_id', branchIds);
      if (e38) console.error('   Error:', e38.message);

      console.log('   Deleting classes...');
      const { error: e39 } = await supabase
        .from('classes')
        .delete()
        .in('branch_id', branchIds);
      if (e39) console.error('   Error:', e39.message);

      console.log('   Deleting sections...');
      const { error: e40 } = await supabase
        .from('sections')
        .delete()
        .in('branch_id', branchIds);
      if (e40) console.error('   Error:', e40.message);
    }

    // Step 7: Delete profiles for parents and staff
    if (allUserIdsToDelete.length > 0) {
      console.log('\n7️⃣ Deleting profiles...');
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .in('user_id', allUserIdsToDelete);
      if (profileError) console.error('   Error:', profileError.message);
      else console.log(`   Deleted ${allUserIdsToDelete.length} profiles`);
    }

    // Step 8: Delete branches
    if (branchIds.length > 0) {
      console.log('\n8️⃣ Deleting branches...');
      const { error: branchDelError } = await supabase
        .from('branches')
        .delete()
        .in('id', branchIds);
      if (branchDelError) console.error('   Error:', branchDelError.message);
      else console.log(`   Deleted ${branchIds.length} branches`);
    }

    // Step 9: Delete tenant
    console.log('\n9️⃣ Deleting tenant...');
    const { error: tenantDelError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenant.id);
    if (tenantDelError) console.error('   Error:', tenantDelError.message);
    else console.log('   Deleted tenant');

    // Step 10: Delete auth users (parents and staff)
    if (allUserIdsToDelete.length > 0) {
      console.log('\n🔟 Deleting auth users...');
      console.log(`   Attempting to delete ${allUserIdsToDelete.length} auth users...`);
      
      let deletedCount = 0;
      let failedCount = 0;

      for (const userId of allUserIdsToDelete) {
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) {
          failedCount++;
          if (failedCount <= 5) { // Only show first 5 errors
            console.error(`   Failed to delete user ${userId}:`, error.message);
          }
        } else {
          deletedCount++;
        }
      }

      console.log(`   Deleted ${deletedCount} auth users`);
      if (failedCount > 0) {
        console.log(`   Failed to delete ${failedCount} auth users (may have been already deleted)`);
      }
    }

    console.log('\n✅ ABC School cleanup completed!\n');
    console.log('📊 Summary:');
    console.log(`   - Branches deleted: ${branchIds.length}`);
    console.log(`   - Students deleted: ${studentIds.length}`);
    console.log(`   - Staff deleted: ${staffUserIds.length}`);
    console.log(`   - Parents deleted: ${parentUserIds.length}`);
    console.log(`   - Total auth users deleted: ${allUserIdsToDelete.length}`);

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    throw error;
  }
}

// Run the cleanup
cleanupABCSchool()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));