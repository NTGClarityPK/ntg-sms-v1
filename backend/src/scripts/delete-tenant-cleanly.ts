/**
 * SAFE tenant hard-delete script (manual ops only).
 *
 * Deletes ALL data for ONE tenant: branches, academic structure, students,
 * staff/parents (exclusive auth users), fees, certificates, storage refs, etc.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SAFETY — READ BEFORE USE
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. DEFAULT MODE IS DRY-RUN. Nothing is deleted unless you pass --execute.
 * 2. You MUST also pass --confirm=<EXACT_TENANT_CODE> (case-sensitive).
 * 3. Prefer a DB backup / branch restore point before --execute.
 * 4. Auth users who still belong to OTHER tenants are NEVER deleted.
 * 5. This script does NOT auto-run. Create → review → run yourself.
 *
 * Usage (from backend/):
 *   # Inventory only (safe)
 *   npx tsx src/scripts/delete-tenant-cleanly.ts --tenant-code=ABC-NET
 *
 *   # Same, by UUID
 *   npx tsx src/scripts/delete-tenant-cleanly.ts --tenant-id=<uuid>
 *
 *   # Actually delete (destructive)
 *   npx tsx src/scripts/delete-tenant-cleanly.ts --tenant-code=ABC-NET --confirm=ABC-NET --execute
 *
 * Env (backend/.env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or SUPABASE_SERVICE_KEY)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const CHUNK = 200;

type CliArgs = {
  tenantCode?: string;
  tenantId?: string;
  confirm?: string;
  execute: boolean;
};

type TenantRow = {
  id: string;
  name: string;
  code: string;
  is_active: boolean | null;
  deletion_status: string | null;
};

type CountRow = { table: string; count: number; scope: string };

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { execute: false };
  for (const raw of argv) {
    if (raw === '--execute') out.execute = true;
    else if (raw.startsWith('--tenant-code=')) out.tenantCode = raw.slice('--tenant-code='.length).trim();
    else if (raw.startsWith('--tenant-id=')) out.tenantId = raw.slice('--tenant-id='.length).trim();
    else if (raw.startsWith('--confirm=')) out.confirm = raw.slice('--confirm='.length).trim();
  }
  return out;
}

function requireEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY).');
    process.exit(1);
  }
  return { url, key };
}

function chunkIds<T>(ids: T[], size = CHUNK): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < ids.length; i += size) batches.push(ids.slice(i, i + size));
  return batches.length > 0 ? batches : [[]];
}

async function countEq(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[],
): Promise<number> {
  if (values.length === 0) return 0;
  let total = 0;
  for (const batch of chunkIds(values)) {
    if (batch.length === 0) continue;
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in(column, batch);
    if (error) {
      // Some tables may not exist in older envs — report and continue inventory.
      console.warn(`   [count skip] ${table}: ${error.message}`);
      return -1;
    }
    total += count ?? 0;
  }
  return total;
}

async function countTenant(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (error) {
    console.warn(`   [count skip] ${table}: ${error.message}`);
    return -1;
  }
  return count ?? 0;
}

async function deleteIn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[],
  dryRun: boolean,
): Promise<number> {
  if (values.length === 0) return 0;
  let deleted = 0;
  for (const batch of chunkIds(values)) {
    if (batch.length === 0) continue;
    if (dryRun) {
      const { count, error } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .in(column, batch);
      if (error) throw new Error(`dry-run count ${table}: ${error.message}`);
      deleted += count ?? 0;
      continue;
    }
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in(column, batch);
    if (error) throw new Error(`delete ${table} where ${column} in (...): ${error.message}`);
    deleted += count ?? batch.length;
  }
  return deleted;
}

async function deleteEq(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
  dryRun: boolean,
): Promise<number> {
  if (dryRun) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(column, value);
    if (error) throw new Error(`dry-run count ${table}: ${error.message}`);
    return count ?? 0;
  }
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq(column, value);
  if (error) throw new Error(`delete ${table} where ${column}=${value}: ${error.message}`);
  return count ?? 0;
}

async function nullProfileFks(
  supabase: SupabaseClient,
  branchIds: string[],
  studentIds: string[],
  dryRun: boolean,
): Promise<void> {
  if (branchIds.length > 0) {
    for (const batch of chunkIds(branchIds)) {
      if (batch.length === 0) continue;
      if (dryRun) {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('current_branch_id', batch);
        console.log(`   would null profiles.current_branch_id: ${count ?? 0}`);
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({ current_branch_id: null })
          .in('current_branch_id', batch);
        if (error) throw new Error(`null current_branch_id: ${error.message}`);
      }
    }
  }
  if (studentIds.length > 0) {
    for (const batch of chunkIds(studentIds)) {
      if (batch.length === 0) continue;
      if (dryRun) {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .in('current_student_id', batch);
        console.log(`   would null profiles.current_student_id: ${count ?? 0}`);
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({ current_student_id: null })
          .in('current_student_id', batch);
        if (error) throw new Error(`null current_student_id: ${error.message}`);
      }
    }
  }
}

/**
 * Ordered deletes for rows scoped by branch_id.
 * RESTRICT / NO ACTION blockers come first; CASCADE children follow for clarity.
 * Branch delete at the end should then succeed (or report leftover blockers).
 */
const BRANCH_DELETE_ORDER: string[] = [
  // Fees (challan items RESTRICT templates — delete challans before templates)
  'fee_late_fee_applications',
  'fee_payments',
  'fee_challan_month_coverage',
  'fee_challans',
  'fee_metric_exclusions',
  'fee_student_template_links',
  'fee_template_assignments',
  'fee_templates',
  'fee_challan_settings',
  'fee_challan_generation_jobs',

  // ID cards
  'id_card_reprints',
  'id_card_photos',
  'id_cards',
  'id_card_generation_jobs',
  'id_card_templates',

  // Certificates
  'certificates',
  'certificate_settings',
  'certificate_number_counters',

  // Behavioral framework
  'student_framework_category_scores',
  'student_framework_ratings',
  'branch_behavioral_config',
  'behavioral_framework_presets',

  // Rubrics / Google Classroom
  'student_rubric_scores',
  'assessment_rubrics',
  'rubric_presets',
  'google_sync_audit_log',
  'google_classroom_course_mappings',
  'google_workspace_settings',

  // Enrolment / promotions / substitutions / library
  'teacher_substitutions',
  'academic_year_rollovers',
  'student_promotion_decisions',
  'student_enrolments',
  'library_items',

  // Messaging / notifications-ish (conversations cascade messages)
  'conversations',

  // Assessments & results (must go before subjects / academic years)
  // assessment_attachments / draft files cascade from assessments
  'student_grades',
  'student_assessment_statuses',
  'assessment_draft_files',
  'assessments',
  'result_cards',
  'result_report_settings',

  // Attendance / leave / events / behavioural (legacy)
  // behavioral_scores cascades from behavioral_assessments
  'attendance',
  'leave_requests',
  'early_departure_requests',
  'event_consents',
  'event_participants',
  'events',
  'behavioral_assessments',

  // Timetable / assignments
  // timing_template_slots cascade from timing_templates
  'timetable_slots',
  'teacher_assignments',
  'class_timing_assignments',
  'timing_templates',

  // Uniforms
  'uniform_issuances',
  'uniform_requests',
  'uniform_stock',
  'uniform_items',

  // Subject templates & grades structure
  // subject_template_subjects / grade_ranges cascade from parents
  'student_subject_template_assignments',
  'class_subject_template_assignments',
  'level_subject_template_assignments',
  'subject_templates',
  'class_grade_assignments',
  'grade_templates',
  'assessment_types',

  // Students / staff / roles (after parent links cleared separately)
  'students',
  'staff',
  'class_sections',
  'dashboard_preferences',
  'storage_usage',
  'storage_alerts',
  'role_permissions',
  'user_roles',
  'user_branches',

  // Core lookups (NO ACTION on branch / tenant)
  // level_classes cascades when levels/classes are deleted
  'school_days',
  'public_holidays',
  'subjects',
  'classes',
  'sections',
  'levels',
];

const TENANT_DELETE_ORDER: string[] = [
  'school_data_export_logs',
  'subscription_invoices',
  'subscriptions',
  'billing_payment_events',
  'academic_years',
  // Leftover tenant-scoped NO ACTION rows (if any survived without branch_id)
  'assessment_types',
  'grade_templates',
  'subjects',
  'classes',
  'sections',
  'levels',
  'public_holidays',
  'timing_templates',
  'school_days',
  'subject_templates',
];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.tenantCode && !args.tenantId) {
    console.error(`
Usage:
  npx tsx src/scripts/delete-tenant-cleanly.ts --tenant-code=CODE
  npx tsx src/scripts/delete-tenant-cleanly.ts --tenant-id=UUID
  npx tsx src/scripts/delete-tenant-cleanly.ts --tenant-code=CODE --confirm=CODE --execute
`);
    process.exit(1);
  }

  const dryRun = !args.execute;
  const { url, key } = requireEnv();
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('\n════════════════════════════════════════════════════════');
  console.log(dryRun ? '  MODE: DRY-RUN (no deletes)' : '  MODE: EXECUTE — DESTRUCTIVE');
  console.log('════════════════════════════════════════════════════════\n');

  // ── Resolve tenant ──────────────────────────────────────────────────────
  let tenantQuery = supabase
    .from('tenants')
    .select('id, name, code, is_active, deletion_status');
  tenantQuery = args.tenantId
    ? tenantQuery.eq('id', args.tenantId)
    : tenantQuery.eq('code', args.tenantCode!);

  const { data: tenant, error: tenantError } = await tenantQuery.maybeSingle();
  if (tenantError) throw new Error(tenantError.message);
  if (!tenant) {
    console.log('Tenant not found. Nothing to do.');
    return;
  }
  const t = tenant as TenantRow;

  if (args.execute) {
    if (!args.confirm || args.confirm !== t.code) {
      console.error(
        `REFUSED: --execute requires --confirm=${t.code} (exact tenant code).`,
      );
      process.exit(1);
    }
  }

  console.log('Target tenant:');
  console.log(`  id:               ${t.id}`);
  console.log(`  name:             ${t.name}`);
  console.log(`  code:             ${t.code}`);
  console.log(`  is_active:        ${t.is_active}`);
  console.log(`  deletion_status:  ${t.deletion_status ?? 'none'}`);

  // ── Branches ────────────────────────────────────────────────────────────
  const { data: branches, error: branchError } = await supabase
    .from('branches')
    .select('id, name, code')
    .eq('tenant_id', t.id);
  if (branchError) throw new Error(branchError.message);
  const branchIds = (branches ?? []).map((b) => b.id as string);
  console.log(`\nBranches (${branchIds.length}):`);
  for (const b of branches ?? []) {
    console.log(`  - ${b.code}  ${b.name}  (${b.id})`);
  }

  // ── Collect people IDs ──────────────────────────────────────────────────
  let studentIds: string[] = [];
  let studentUserIds: string[] = [];
  let staffUserIds: string[] = [];
  let parentUserIds: string[] = [];
  let branchUserIds: string[] = [];

  if (branchIds.length > 0) {
    for (const batch of chunkIds(branchIds)) {
      const { data: students } = await supabase
        .from('students')
        .select('id, user_id')
        .in('branch_id', batch);
      for (const s of students ?? []) {
        studentIds.push(s.id as string);
        if (s.user_id) studentUserIds.push(s.user_id as string);
      }

      const { data: staff } = await supabase
        .from('staff')
        .select('user_id')
        .in('branch_id', batch);
      for (const s of staff ?? []) {
        if (s.user_id) staffUserIds.push(s.user_id as string);
      }

      const { data: ub } = await supabase
        .from('user_branches')
        .select('user_id')
        .in('branch_id', batch);
      for (const row of ub ?? []) {
        if (row.user_id) branchUserIds.push(row.user_id as string);
      }
    }
  }

  studentIds = [...new Set(studentIds)];
  studentUserIds = [...new Set(studentUserIds)];
  staffUserIds = [...new Set(staffUserIds)];
  branchUserIds = [...new Set(branchUserIds)];

  if (studentIds.length > 0) {
    for (const batch of chunkIds(studentIds)) {
      const { data: links } = await supabase
        .from('parent_students')
        .select('parent_user_id')
        .in('student_id', batch);
      for (const link of links ?? []) {
        if (link.parent_user_id) parentUserIds.push(link.parent_user_id as string);
      }
    }
  }
  parentUserIds = [...new Set(parentUserIds)];

  const candidateUserIds = [
    ...new Set([...branchUserIds, ...staffUserIds, ...parentUserIds, ...studentUserIds]),
  ];

  // Exclusive users = no membership / parent / staff links outside this tenant
  const exclusiveUserIds: string[] = [];
  const sharedUserIds: string[] = [];
  const branchIdSet = new Set(branchIds);
  const studentIdSet = new Set(studentIds);

  for (const batch of chunkIds(candidateUserIds)) {
    if (batch.length === 0) continue;

    const [{ data: allLinks }, { data: parentLinks }, { data: staffRows }] = await Promise.all([
      supabase.from('user_branches').select('user_id, branch_id').in('user_id', batch),
      supabase.from('parent_students').select('parent_user_id, student_id').in('parent_user_id', batch),
      supabase.from('staff').select('user_id, branch_id').in('user_id', batch),
    ]);

    const outsideBranch = new Set<string>();
    for (const row of allLinks ?? []) {
      if (!branchIdSet.has(row.branch_id as string)) {
        outsideBranch.add(row.user_id as string);
      }
    }
    for (const row of parentLinks ?? []) {
      if (!studentIdSet.has(row.student_id as string)) {
        outsideBranch.add(row.parent_user_id as string);
      }
    }
    for (const row of staffRows ?? []) {
      if (row.user_id && !branchIdSet.has(row.branch_id as string)) {
        outsideBranch.add(row.user_id as string);
      }
    }

    for (const uid of batch) {
      if (outsideBranch.has(uid)) sharedUserIds.push(uid);
      else exclusiveUserIds.push(uid);
    }
  }

  console.log('\nPeople inventory:');
  console.log(`  students:              ${studentIds.length}`);
  console.log(`  staff auth users:      ${staffUserIds.length}`);
  console.log(`  parent auth users:     ${parentUserIds.length}`);
  console.log(`  branch-linked users:   ${branchUserIds.length}`);
  console.log(`  exclusive auth users:  ${exclusiveUserIds.length} (safe to delete)`);
  console.log(`  shared auth users:     ${sharedUserIds.length} (KEEP — other tenants)`);

  // ── Table inventory ─────────────────────────────────────────────────────
  console.log('\nRow inventory (approx):');
  const inventory: CountRow[] = [];
  for (const table of BRANCH_DELETE_ORDER) {
    const count = await countEq(supabase, table, 'branch_id', branchIds);
    if (count !== 0) inventory.push({ table, count, scope: 'branch_id' });
  }
  if (studentIds.length > 0) {
    const ps = await countEq(supabase, 'parent_students', 'student_id', studentIds);
    inventory.push({ table: 'parent_students', count: ps, scope: 'student_id' });
  }
  for (const table of TENANT_DELETE_ORDER) {
    const count = await countTenant(supabase, table, t.id);
    if (count !== 0) inventory.push({ table, count, scope: 'tenant_id' });
  }
  // Vacations hang off academic years (no branch_id)
  const { data: yearRowsForInventory } = await supabase
    .from('academic_years')
    .select('id')
    .eq('tenant_id', t.id);
  const yearIdsForInventory = (yearRowsForInventory ?? []).map((r) => r.id as string);
  if (yearIdsForInventory.length > 0) {
    const vacationCount = await countEq(
      supabase,
      'vacations',
      'academic_year_id',
      yearIdsForInventory,
    );
    if (vacationCount !== 0) {
      inventory.push({
        table: 'vacations',
        count: vacationCount,
        scope: 'academic_year_id',
      });
    }
    const leaveSettingsCount = await countEq(
      supabase,
      'leave_settings',
      'academic_year_id',
      yearIdsForInventory,
    );
    if (leaveSettingsCount !== 0) {
      inventory.push({
        table: 'leave_settings',
        count: leaveSettingsCount,
        scope: 'academic_year_id',
      });
    }
  }

  for (const row of inventory) {
    const label = row.count < 0 ? 'n/a' : String(row.count);
    console.log(`  ${row.table.padEnd(40)} ${label.padStart(8)}  (${row.scope})`);
  }

  if (dryRun) {
    console.log('\nDry-run complete. Re-run with --confirm=<CODE> --execute to delete.');
    console.log('No data was modified.\n');
    return;
  }

  console.log('\n⚠ EXECUTE starting in dependency order...\n');

  // ── Phase 1: unblock profiles ───────────────────────────────────────────
  console.log('1) Nulling profile FKs that block student/branch deletes...');
  await nullProfileFks(supabase, branchIds, studentIds, dryRun);

  // ── Phase 2: parent_students ────────────────────────────────────────────
  console.log('2) Deleting parent_students...');
  const psDeleted = await deleteIn(supabase, 'parent_students', 'student_id', studentIds, dryRun);
  console.log(`   parent_students: ${psDeleted}`);

  // ── Phase 3: branch-scoped tables ───────────────────────────────────────
  console.log('3) Deleting branch-scoped tables...');
  const seen = new Set<string>();
  for (const table of BRANCH_DELETE_ORDER) {
    if (seen.has(table)) continue;
    seen.add(table);
    try {
      const n = await deleteIn(supabase, table, 'branch_id', branchIds, dryRun);
      if (n > 0) console.log(`   ${table}: ${n}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Table missing in some envs — skip; real FK failures must abort
      if (message.includes('does not exist') || message.includes('Could not find')) {
        console.warn(`   skip ${table}: ${message}`);
        continue;
      }
      throw err;
    }
  }

  // ── Phase 4: leave_settings / vacations via academic years ──────────────
  console.log('4) Deleting academic-year children + academic_years...');
  const { data: years } = await supabase.from('academic_years').select('id').eq('tenant_id', t.id);
  const yearIds = (years ?? []).map((y) => y.id as string);
  if (yearIds.length > 0) {
    // leave_settings / vacations CASCADE from academic_years in schema, but delete explicitly
    await deleteIn(supabase, 'leave_settings', 'academic_year_id', yearIds, dryRun);
    await deleteIn(supabase, 'vacations', 'academic_year_id', yearIds, dryRun);
  }
  await deleteEq(supabase, 'academic_years', 'tenant_id', t.id, dryRun);

  // ── Phase 5: branches ───────────────────────────────────────────────────
  console.log('5) Deleting branches...');
  const branchesDeleted = await deleteIn(supabase, 'branches', 'id', branchIds, dryRun);
  console.log(`   branches: ${branchesDeleted}`);

  // ── Phase 6: remaining tenant-scoped ────────────────────────────────────
  console.log('6) Deleting remaining tenant-scoped rows...');
  for (const table of TENANT_DELETE_ORDER) {
    if (table === 'academic_years') continue; // already done
    try {
      const n = await deleteEq(supabase, table, 'tenant_id', t.id, dryRun);
      if (n > 0) console.log(`   ${table}: ${n}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('does not exist') || message.includes('Could not find')) {
        console.warn(`   skip ${table}: ${message}`);
        continue;
      }
      throw err;
    }
  }

  // Theme / system_settings key
  const themeKey = `tenant_theme_primary_color:${t.id}`;
  const { error: themeErr } = await supabase.from('system_settings').delete().eq('key', themeKey);
  if (themeErr) console.warn(`   system_settings theme key: ${themeErr.message}`);
  else console.log(`   system_settings: removed ${themeKey} (if present)`);

  // ── Phase 7: tenant row ─────────────────────────────────────────────────
  console.log('7) Deleting tenant row...');
  const { error: tenantDelError } = await supabase.from('tenants').delete().eq('id', t.id);
  if (tenantDelError) {
    console.error(`   FAILED to delete tenant: ${tenantDelError.message}`);
    console.error('   Likely leftover FK references. Re-run inventory / check blockers.');
    throw tenantDelError;
  }
  console.log('   tenant deleted');

  // ── Phase 8: exclusive auth users ───────────────────────────────────────
  console.log('8) Deleting exclusive auth users (+ cascading profiles)...');
  let authOk = 0;
  let authFail = 0;
  for (const userId of exclusiveUserIds) {
    // Clean user-scoped leftovers first
    await supabase.from('invitations').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('user_id', userId);
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    await supabase.from('dashboard_preferences').delete().eq('user_id', userId);

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      authFail += 1;
      if (authFail <= 10) console.warn(`   auth delete failed ${userId}: ${error.message}`);
    } else {
      authOk += 1;
    }
  }
  console.log(`   auth deleted: ${authOk}, failed: ${authFail}, shared kept: ${sharedUserIds.length}`);

  // ── Phase 9: storage (best-effort, non-fatal) ───────────────────────────
  console.log('9) Storage cleanup (best-effort)...');
  const buckets = [
    'school-logos',
    'assessment-files',
    'library-files',
    'fee-documents',
    'inventory-images',
    'id-card-assets',
    'certificate-documents',
  ];
  for (const bucket of buckets) {
    for (const branchId of branchIds) {
      try {
        const { data: files, error } = await supabase.storage.from(bucket).list(branchId, {
          limit: 1000,
        });
        if (error || !files || files.length === 0) continue;
        const paths = files
          .filter((f) => f.name)
          .map((f) => `${branchId}/${f.name}`);
        if (paths.length > 0) {
          const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
          if (rmErr) console.warn(`   ${bucket}/${branchId}: ${rmErr.message}`);
          else console.log(`   ${bucket}/${branchId}: removed ${paths.length} object(s)`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`   ${bucket}/${branchId}: ${message}`);
      }
    }
  }
  // Tenant logo often stored as tenants/{id} or bare filename — attempt tenant folder
  try {
    const { data: logoFiles } = await supabase.storage.from('school-logos').list(t.id, {
      limit: 100,
    });
    if (logoFiles && logoFiles.length > 0) {
      const paths = logoFiles.map((f) => `${t.id}/${f.name}`);
      await supabase.storage.from('school-logos').remove(paths);
      console.log(`   school-logos/${t.id}: removed ${paths.length}`);
    }
  } catch {
    /* ignore */
  }

  // ── Verify ──────────────────────────────────────────────────────────────
  console.log('\n10) Verification...');
  const { data: stillTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', t.id)
    .maybeSingle();
  const { count: stillBranches } = await supabase
    .from('branches')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', t.id);

  console.log(`   tenant row present:   ${stillTenant ? 'YES (BAD)' : 'no (good)'}`);
  console.log(`   leftover branches:    ${stillBranches ?? 0}`);

  console.log('\nDone. Review auth failures / storage warnings above if any.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nScript aborted:', err);
    process.exit(1);
  });
