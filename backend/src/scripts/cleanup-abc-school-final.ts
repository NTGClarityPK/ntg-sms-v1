/**
 * ABC School Final Cleanup
 * 
 * Deletes remaining ABC School data (subjects, classes, sections, tenant)
 * 
 * Run: npx tsx src/scripts/cleanup-abc-final.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function finalCleanup() {
  console.log('🧹 Final ABC School cleanup...\n');

  try {
    // Find ABC tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('code', 'ABC-NET')
      .single();

    if (!tenant) {
      console.log('✅ ABC School already cleaned up!');
      return;
    }

    console.log('Found ABC tenant:', tenant.id);

    // Delete subjects by tenant_id
    console.log('Deleting subjects...');
    await supabase
      .from('subjects')
      .delete()
      .eq('tenant_id', tenant.id);

    // Delete classes by tenant_id
    console.log('Deleting classes...');
    await supabase
      .from('classes')
      .delete()
      .eq('tenant_id', tenant.id);

    // Delete sections by tenant_id
    console.log('Deleting sections...');
    await supabase
      .from('sections')
      .delete()
      .eq('tenant_id', tenant.id);

    // Delete academic years by tenant_id
    console.log('Deleting academic years...');
    await supabase
      .from('academic_years')
      .delete()
      .eq('tenant_id', tenant.id);

    // Delete grade templates by tenant_id
    console.log('Deleting grade templates...');
    await supabase
      .from('grade_templates')
      .delete()
      .eq('tenant_id', tenant.id);

    // Delete any remaining data tied to tenant
    console.log('Deleting public holidays...');
    await supabase
      .from('public_holidays')
      .delete()
      .eq('tenant_id', tenant.id);

    console.log('Deleting vacations...');
    await supabase
      .from('vacations')
      .delete()
      .eq('tenant_id', tenant.id);

    // Now delete tenant
    console.log('Deleting tenant...');
    const { error: tenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenant.id);

    if (tenantError) {
      console.error('❌ Error deleting tenant:', tenantError.message);
      console.log('\nRemaining foreign key references - checking...');
      
      // Check what's still referencing the tenant
      const tables = [
        'subjects', 'classes', 'sections', 'academic_years', 
        'grade_templates', 'public_holidays', 'vacations',
        'assessment_types', 'subject_templates'
      ];
      
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .eq('tenant_id', tenant.id)
          .limit(1);
        
        if (!error && data && data.length > 0) {
          console.log(`   ⚠️  ${table} still has ${data.length}+ records`);
        }
      }
    } else {
      console.log('✅ Tenant deleted successfully!');
    }

    console.log('\n✅ Final cleanup completed!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

finalCleanup()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));