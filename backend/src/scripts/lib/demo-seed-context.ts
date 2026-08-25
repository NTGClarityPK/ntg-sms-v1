/**
 * Shared helpers for lean demo factory (wipe + rebuild).
 * NEVER used to delete tenants / branches / academic_years / subscriptions / school_admin.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

/** Audit username for created_by text fields (matches school admin login). */
export function usernameFromEmail(email: string): string {
  return email.split('@')[0].toLowerCase();
}

export async function resolveBranchActorUsername(
  supabase: SupabaseClient,
  branchId: string,
): Promise<string> {
  const adminIds = await findSchoolAdminUserIds(supabase, branchId);
  if (adminIds.size > 0) {
    const adminId = [...adminIds][0];
    const { data } = await supabase.from('profiles').select('email').eq('id', adminId).maybeSingle();
    const email = (data as { email: string } | null)?.email;
    if (email) return usernameFromEmail(email);
  }
  return 'admin';
}
export const DEFAULT_PASSWORD = 'user123';
export const CHUNK = 200;

/** Tables that this tooling must never delete (hard deny). */
export const NEVER_DELETE_TABLES = new Set([
  'tenants',
  'branches',
  'academic_years',
  'subscriptions',
  'roles',
  'role_permissions',
]);

export const DEMO_EMAIL_PREFIXES = [
  'cteacher1',
  'cteacher2',
  'steacher1',
  'student1',
  'student2',
  'student3',
  'student4',
  'parent1',
  'parent2',
  'parent3',
  'parent4',
] as const;

export type TenantRow = {
  id: string;
  code: string;
  name: string;
  timezone: string | null;
  domain: string | null;
};

export type BranchRow = {
  id: string;
  code: string | null;
  name: string;
  tenant_id: string;
};

export type AcademicYearRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  tenant_id: string;
};

export type DemoCliArgs = {
  tenantCode?: string;
  tenantId?: string;
  /** Comma-separated branch codes, or a single code. Empty = first active (unless allBranches). */
  branchCodes: string[];
  branchId?: string;
  /** Wipe + rebuild every active branch on the tenant. */
  allBranches: boolean;
  confirm?: string;
  execute: boolean;
  password: string;
  help: boolean;
};

export function requireEnv(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY).');
  }
  return { url, key };
}

export function createServiceClient(): SupabaseClient {
  const { url, key } = requireEnv();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function parseDemoCliArgs(argv: string[]): DemoCliArgs {
  const out: DemoCliArgs = {
    execute: false,
    password: DEFAULT_PASSWORD,
    help: false,
    branchCodes: [],
    allBranches: false,
  };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') out.help = true;
    else if (raw === '--execute') out.execute = true;
    else if (raw === '--all-branches') out.allBranches = true;
    else if (raw.startsWith('--tenant-code=')) out.tenantCode = raw.slice('--tenant-code='.length).trim();
    else if (raw.startsWith('--tenant-id=')) out.tenantId = raw.slice('--tenant-id='.length).trim();
    else if (raw.startsWith('--branch-code=')) {
      const value = raw.slice('--branch-code='.length).trim();
      for (const part of value.split(',')) {
        const code = part.trim();
        if (code) out.branchCodes.push(code);
      }
    } else if (raw.startsWith('--branch-id=')) out.branchId = raw.slice('--branch-id='.length).trim();
    else if (raw.startsWith('--confirm=')) out.confirm = raw.slice('--confirm='.length).trim();
    else if (raw.startsWith('--password=')) out.password = raw.slice('--password='.length).trim() || DEFAULT_PASSWORD;
    else if (raw.startsWith('--')) throw new Error(`Unknown flag: ${raw}. Use --help.`);
  }
  return out;
}

export function assertNeverDeleteTable(table: string): void {
  if (NEVER_DELETE_TABLES.has(table)) {
    throw new Error(`REFUSED: attempted to delete protected table "${table}"`);
  }
}

export function chunkIds<T>(ids: T[], size = CHUNK): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < ids.length; i += size) batches.push(ids.slice(i, i + size));
  return batches.length > 0 ? batches : [[]];
}

export function todayInTz(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addCalendarDays(isoDate: string, delta: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function weekdaySun0(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

export function yearMonthInTz(timeZone: string, now = new Date()): string {
  return todayInTz(timeZone, now).slice(0, 7);
}

/**
 * Local-part for factory users.
 * Branch index 0 → `cteacher1@domain` (single-branch friendly).
 * Branch index 1+ → `cteacher1.b2@domain` so multi-branch does not clash.
 */
export function demoEmail(prefix: string, domain: string, branchIndex = 0): string {
  const local = branchIndex <= 0 ? prefix : `${prefix}.b${branchIndex + 1}`;
  return `${local}@${domain}`.toLowerCase();
}

export function demoEmailsForBranch(domain: string, branchIndex: number): string[] {
  return DEMO_EMAIL_PREFIXES.map((p) => demoEmail(p, domain, branchIndex));
}

export async function resolveTenant(
  supabase: SupabaseClient,
  args: Pick<DemoCliArgs, 'tenantCode' | 'tenantId'>,
): Promise<TenantRow> {
  if (!args.tenantCode && !args.tenantId) {
    throw new Error('Provide --tenant-code=CODE or --tenant-id=UUID');
  }
  let query = supabase.from('tenants').select('id, code, name, timezone, domain');
  if (args.tenantId) query = query.eq('id', args.tenantId);
  else query = query.eq('code', args.tenantCode!);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`tenants: ${error.message}`);
  if (!data) throw new Error('Tenant not found');
  return data as TenantRow;
}

async function listActiveBranches(supabase: SupabaseClient, tenantId: string): Promise<BranchRow[]> {
  const { data: branches, error } = await supabase
    .from('branches')
    .select('id, code, name, tenant_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`branches: ${error.message}`);
  if (!branches?.length) throw new Error('Tenant has no active branches');
  return branches as BranchRow[];
}

/** Resolve one or more branches to wipe + rebuild. */
export async function resolveBranches(
  supabase: SupabaseClient,
  tenantId: string,
  args: Pick<DemoCliArgs, 'branchCodes' | 'branchId' | 'allBranches'>,
): Promise<BranchRow[]> {
  const branches = await listActiveBranches(supabase, tenantId);

  if (args.branchId) {
    const match = branches.find((b) => b.id === args.branchId);
    if (!match) {
      const { data, error } = await supabase
        .from('branches')
        .select('id, code, name, tenant_id')
        .eq('id', args.branchId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw new Error(`branches: ${error.message}`);
      if (!data) throw new Error('Branch not found for this tenant');
      return [data as BranchRow];
    }
    return [match];
  }

  if (args.allBranches) {
    console.log(`   Targeting all ${branches.length} active branch(es).`);
    return branches;
  }

  if (args.branchCodes.length > 0) {
    const selected: BranchRow[] = [];
    const available = branches.map((b) => b.code || `(unnamed:${b.id.slice(0, 8)})`).join(', ');
    for (const wanted of args.branchCodes) {
      const match = branches.find((b) => (b.code || '').toLowerCase() === wanted.toLowerCase());
      if (!match) {
        throw new Error(`Branch code "${wanted}" not found among active branches. Available: ${available}`);
      }
      if (!selected.some((s) => s.id === match.id)) selected.push(match);
    }
    return selected;
  }

  if (branches.length > 1) {
    console.log(
      `   Multiple branches — using first only (${branches[0].code || branches[0].name}). Pass --all-branches or --branch-code=A,B.`,
    );
  }
  return [branches[0]];
}

/** @deprecated Prefer resolveBranches — kept for attendance/assessment helpers if imported. */
export async function resolveBranch(
  supabase: SupabaseClient,
  tenantId: string,
  args: Pick<DemoCliArgs, 'branchCodes' | 'branchId' | 'allBranches'> & { branchCode?: string },
): Promise<BranchRow> {
  const codes = args.branchCodes?.length
    ? args.branchCodes
    : args.branchCode
      ? [args.branchCode]
      : [];
  const list = await resolveBranches(supabase, tenantId, {
    branchCodes: codes,
    branchId: args.branchId,
    allBranches: false,
  });
  return list[0];
}

export async function resolveActiveAcademicYear(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<AcademicYearRow | null> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('id, name, start_date, end_date, is_active, tenant_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(`academic_years: ${error.message}`);
  return (data as AcademicYearRow) ?? null;
}

export async function countEq(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  assertNeverDeleteTable(table);
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);
  if (error) {
    console.warn(`   [count skip] ${table}: ${error.message}`);
    return -1;
  }
  return count ?? 0;
}

export async function deleteEq(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
  dryRun: boolean,
): Promise<number> {
  assertNeverDeleteTable(table);
  if (dryRun) return countEq(supabase, table, column, value);
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq(column, value);
  if (error) throw new Error(`delete ${table} where ${column}=${value}: ${error.message}`);
  return count ?? 0;
}

export async function deleteIn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[],
  dryRun: boolean,
): Promise<number> {
  assertNeverDeleteTable(table);
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
    const { error, count } = await supabase.from(table).delete({ count: 'exact' }).in(column, batch);
    if (error) throw new Error(`delete ${table} where ${column} in (...): ${error.message}`);
    deleted += count ?? batch.length;
  }
  return deleted;
}

export async function findSchoolAdminUserIds(
  supabase: SupabaseClient,
  branchId: string,
): Promise<Set<string>> {
  const { data: role, error: rErr } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'school_admin')
    .maybeSingle();
  if (rErr) throw new Error(`roles: ${rErr.message}`);
  if (!role) return new Set();

  const { data: urs, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('branch_id', branchId)
    .eq('role_id', (role as { id: string }).id);
  if (error) throw new Error(`user_roles: ${error.message}`);
  return new Set((urs ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean));
}

/** Auth users linked only to branches of this tenant (safe to delete). */
export async function filterExclusiveAuthUsers(
  supabase: SupabaseClient,
  tenantId: string,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { data: tenantBranches, error: bErr } = await supabase
    .from('branches')
    .select('id')
    .eq('tenant_id', tenantId);
  if (bErr) throw new Error(`branches: ${bErr.message}`);
  const tenantBranchIds = new Set((tenantBranches ?? []).map((b) => (b as { id: string }).id));

  const exclusive: string[] = [];
  for (const batch of chunkIds(userIds)) {
    if (batch.length === 0) continue;
    const { data: links, error } = await supabase
      .from('user_branches')
      .select('user_id, branch_id')
      .in('user_id', batch);
    if (error) throw new Error(`user_branches: ${error.message}`);
    const byUser = new Map<string, string[]>();
    for (const row of links ?? []) {
      const r = row as { user_id: string; branch_id: string };
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.branch_id);
      byUser.set(r.user_id, arr);
    }
    for (const uid of batch) {
      const branches = byUser.get(uid) ?? [];
      if (branches.length === 0) {
        exclusive.push(uid);
        continue;
      }
      if (branches.every((bid) => tenantBranchIds.has(bid))) exclusive.push(uid);
    }
  }
  return exclusive;
}

export async function ensureAuthUser(
  supabase: SupabaseClient,
  input: {
    email: string;
    password: string;
    fullName: string;
    branchId: string;
    roleName: string;
    isActive?: boolean;
  },
): Promise<string> {
  const email = input.email.toLowerCase();
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let userId = (existingProfile as { id: string } | null)?.id ?? null;

  if (!userId) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    userId = created.user?.id ?? null;
    if (!userId) throw new Error(`createUser ${email}: no user id`);
  } else {
    // Ensure password is reset for demo predictability
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password: input.password,
      email_confirm: true,
    });
    if (updErr) console.warn(`   password reset ${email}: ${updErr.message}`);
  }

  const { error: pErr } = await supabase.from('profiles').upsert({
    id: userId,
    email,
    full_name: input.fullName,
    is_active: input.isActive ?? true,
    current_branch_id: input.branchId,
  });
  if (pErr) throw new Error(`profiles upsert ${email}: ${pErr.message}`);

  const { data: existingUb } = await supabase
    .from('user_branches')
    .select('id')
    .eq('user_id', userId)
    .eq('branch_id', input.branchId)
    .maybeSingle();
  if (!existingUb) {
    const { error: ubErr } = await supabase.from('user_branches').insert({
      user_id: userId,
      branch_id: input.branchId,
      is_primary: true,
    });
    if (ubErr) throw new Error(`user_branches ${email}: ${ubErr.message}`);
  }

  const { data: role, error: rErr } = await supabase
    .from('roles')
    .select('id')
    .eq('name', input.roleName)
    .maybeSingle();
  if (rErr || !role) throw new Error(`role ${input.roleName} not found`);

  const { data: existingUr } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('branch_id', input.branchId)
    .eq('role_id', (role as { id: string }).id)
    .maybeSingle();
  if (!existingUr) {
    const { error: urErr } = await supabase.from('user_roles').insert({
      user_id: userId,
      branch_id: input.branchId,
      role_id: (role as { id: string }).id,
    });
    if (urErr) throw new Error(`user_roles ${email}: ${urErr.message}`);
  }

  return userId;
}

export async function ensureEnterprisePlan(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<void> {
  const { data: sub, error } = await supabase
    .from('subscriptions')
    .select('id, plan_id, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(`subscriptions: ${error.message}`);
  if (!sub) {
    const far = new Date();
    far.setFullYear(far.getFullYear() + 100);
    const { error: insErr } = await supabase.from('subscriptions').insert({
      tenant_id: tenantId,
      plan_id: 'enterprise',
      status: 'active',
      billing_cycle: 'monthly',
      payment_provider: 'manual',
      current_period_start: new Date().toISOString(),
      current_period_end: far.toISOString(),
    });
    if (insErr) throw new Error(`subscriptions insert: ${insErr.message}`);
    console.log('   Created enterprise subscription');
    return;
  }
  if ((sub as { plan_id: string }).plan_id !== 'enterprise') {
    const { error: updErr } = await supabase
      .from('subscriptions')
      .update({ plan_id: 'enterprise', status: 'active' })
      .eq('id', (sub as { id: string }).id);
    if (updErr) throw new Error(`subscriptions update: ${updErr.message}`);
    console.log('   Upgraded subscription → enterprise');
  }
}

export async function mergeSystemSettingArray(
  supabase: SupabaseClient,
  key: string,
  valuesToEnsure: string[],
): Promise<void> {
  const { data, error } = await supabase.from('system_settings').select('key, value').eq('key', key).maybeSingle();
  if (error) throw new Error(`system_settings ${key}: ${error.message}`);
  const existing = Array.isArray((data as { value?: unknown } | null)?.value)
    ? ([...(data as { value: string[] }).value] as string[])
    : [];
  let changed = false;
  for (const v of valuesToEnsure) {
    if (!existing.some((e) => e.toLowerCase() === v.toLowerCase())) {
      existing.push(v);
      changed = true;
    }
  }
  if (!data) {
    const { error: insErr } = await supabase.from('system_settings').insert({ key, value: existing });
    if (insErr) throw new Error(`system_settings insert ${key}: ${insErr.message}`);
    return;
  }
  if (changed) {
    const { error: updErr } = await supabase.from('system_settings').update({ value: existing }).eq('key', key);
    if (updErr) throw new Error(`system_settings update ${key}: ${updErr.message}`);
  }
}
