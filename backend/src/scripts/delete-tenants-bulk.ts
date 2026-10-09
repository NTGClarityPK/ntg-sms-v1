/**
 * SAFE bulk tenant hard-delete (manual ops only).
 *
 * Runs `delete-tenant-cleanly.ts` once per target tenant (same delete order,
 * exclusive-auth rules, and inventory). Prefer a DB backup before --execute.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SAFETY — READ BEFORE USE
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. DEFAULT MODE IS DRY-RUN. Nothing is deleted unless you pass --execute.
 * 2. --execute requires --confirm=BULK-DELETE (exact string).
 * 3. You must name targets via --codes / --file, OR --all-except=<keep codes>.
 * 4. Deleting EVERY tenant (empty keep list) is refused unless
 *    --confirm=DELETE-EVERY-TENANT.
 * 5. Stops on first failure unless --continue-on-error.
 * 6. Shared auth users across tenants are still protected by the single script.
 *
 * Usage (from backend/):
 *   # List all tenants (safe)
 *   npx tsx src/scripts/delete-tenants-bulk.ts --list
 *
 *   # Dry-run specific codes
 *   npx tsx src/scripts/delete-tenants-bulk.ts --codes=AAA,BBB,CCC
 *
 *   # Dry-run from file (one tenant code per line; # comments ok)
 *   npx tsx src/scripts/delete-tenants-bulk.ts --file=./tenant-codes-to-delete.txt
 *
 *   # Dry-run: every tenant except keepers
 *   npx tsx src/scripts/delete-tenants-bulk.ts --all-except=KEEP1,KEEP2
 *
 *   # Actually delete
 *   npx tsx src/scripts/delete-tenants-bulk.ts --codes=AAA,BBB --confirm=BULK-DELETE --execute
 *
 * Env (backend/.env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or SUPABASE_SERVICE_KEY)
 */

import { spawnSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const BULK_CONFIRM = 'BULK-DELETE';
const EVERY_TENANT_CONFIRM = 'DELETE-EVERY-TENANT';

type CliArgs = {
  list: boolean;
  codes: string[];
  file?: string;
  allExcept: string[] | null;
  exclude: string[];
  confirm?: string;
  execute: boolean;
  continueOnError: boolean;
};

type TenantRow = {
  id: string;
  name: string;
  code: string;
  is_active: boolean | null;
  deletion_status: string | null;
};

function parseCsv(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    list: false,
    codes: [],
    allExcept: null,
    exclude: [],
    execute: false,
    continueOnError: false,
  };

  for (const raw of argv) {
    if (raw === '--list') out.list = true;
    else if (raw === '--execute') out.execute = true;
    else if (raw === '--continue-on-error') out.continueOnError = true;
    else if (raw.startsWith('--codes=')) out.codes.push(...parseCsv(raw.slice('--codes='.length)));
    else if (raw.startsWith('--file=')) out.file = raw.slice('--file='.length).trim();
    else if (raw.startsWith('--all-except=')) {
      out.allExcept = parseCsv(raw.slice('--all-except='.length));
    } else if (raw.startsWith('--exclude=')) {
      out.exclude.push(...parseCsv(raw.slice('--exclude='.length)));
    } else if (raw.startsWith('--confirm=')) {
      out.confirm = raw.slice('--confirm='.length).trim();
    }
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

function printUsage(): void {
  console.error(`
Usage:
  npx tsx src/scripts/delete-tenants-bulk.ts --list
  npx tsx src/scripts/delete-tenants-bulk.ts --codes=CODE1,CODE2
  npx tsx src/scripts/delete-tenants-bulk.ts --file=./codes.txt
  npx tsx src/scripts/delete-tenants-bulk.ts --all-except=KEEP1,KEEP2
  npx tsx src/scripts/delete-tenants-bulk.ts --codes=CODE1,CODE2 --confirm=BULK-DELETE --execute

Options:
  --exclude=CODE     Extra codes to skip (can repeat / comma-separate)
  --continue-on-error  Keep going after a failed tenant (execute mode)
`);
}

function readCodesFile(filePath: string): string[] {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Codes file not found: ${resolved}`);
  }
  const text = fs.readFileSync(resolved, 'utf8');
  const codes: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Allow "CODE" or "CODE  # comment"
    const code = trimmed.split(/\s+/)[0]?.trim();
    if (code) codes.push(code);
  }
  return codes;
}

function uniquePreserveOrder(codes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function runSingleTenant(code: string, execute: boolean): number {
  const scriptPath = path.join(__dirname, 'delete-tenant-cleanly.ts');
  const args = ['tsx', scriptPath, `--tenant-code=${code}`];
  if (execute) {
    args.push(`--confirm=${code}`, '--execute');
  }

  const result = spawnSync('npx', args, {
    cwd: path.join(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
    shell: true,
  });

  if (result.error) {
    console.error(`Failed to spawn delete-tenant-cleanly for ${code}:`, result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const hasTargetSelector =
    args.codes.length > 0 || !!args.file || args.allExcept !== null;

  if (!args.list && !hasTargetSelector) {
    printUsage();
    process.exit(1);
  }

  const { url, key } = requireEnv();
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name, code, is_active, deletion_status')
    .order('code', { ascending: true });
  if (error) throw new Error(error.message);

  const all = (tenants ?? []) as TenantRow[];
  const byCode = new Map(all.map((t) => [t.code, t]));

  if (args.list) {
    console.log(`\nTenants (${all.length}):\n`);
    for (const t of all) {
      const active = t.is_active === false ? 'inactive' : 'active';
      const del = t.deletion_status ? ` deletion_status=${t.deletion_status}` : '';
      console.log(`  ${t.code.padEnd(24)} ${active.padEnd(10)} ${t.name}${del}`);
      console.log(`    ${t.id}`);
    }
    console.log('');
    if (!hasTargetSelector) return;
  }

  let requested: string[] = [];
  if (args.allExcept !== null) {
    const keep = new Set([...args.allExcept, ...args.exclude]);
    requested = all.map((t) => t.code).filter((code) => !keep.has(code));
  } else {
    if (args.file) requested.push(...readCodesFile(args.file));
    requested.push(...args.codes);
    const exclude = new Set(args.exclude);
    requested = requested.filter((code) => !exclude.has(code));
  }

  requested = uniquePreserveOrder(requested);

  const missing = requested.filter((code) => !byCode.has(code));
  const targets = requested
    .filter((code) => byCode.has(code))
    .map((code) => byCode.get(code)!);

  console.log('\n════════════════════════════════════════════════════════');
  console.log(args.execute ? '  MODE: EXECUTE — DESTRUCTIVE BULK' : '  MODE: DRY-RUN (no deletes)');
  console.log('════════════════════════════════════════════════════════\n');
  console.log(`DB tenants:     ${all.length}`);
  console.log(`Requested:      ${requested.length}`);
  console.log(`Resolved:       ${targets.length}`);
  if (missing.length > 0) {
    console.log(`Not found:      ${missing.length} → ${missing.join(', ')}`);
  }

  if (targets.length === 0) {
    console.log('\nNo matching tenants. Nothing to do.\n');
    return;
  }

  if (targets.length === all.length) {
    if (!args.execute) {
      console.warn(
        '\n⚠ This dry-run targets EVERY tenant in the database.',
      );
      console.warn(
        `  Execute will require --confirm=${EVERY_TENANT_CONFIRM} (not ${BULK_CONFIRM}).\n`,
      );
    } else if (args.confirm !== EVERY_TENANT_CONFIRM) {
      console.error(
        `REFUSED: deleting every tenant requires --confirm=${EVERY_TENANT_CONFIRM}.`,
      );
      process.exit(1);
    }
  } else if (args.execute) {
    if (args.confirm !== BULK_CONFIRM) {
      console.error(
        `REFUSED: --execute requires --confirm=${BULK_CONFIRM} (exact string).`,
      );
      process.exit(1);
    }
  }

  console.log('\nTargets:');
  for (const t of targets) {
    console.log(`  - ${t.code.padEnd(24)} ${t.name}  (${t.id})`);
  }
  console.log('');

  const ok: string[] = [];
  const failed: Array<{ code: string; status: number }> = [];

  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i]!;
    console.log(`\n────────── [${i + 1}/${targets.length}] ${t.code} ──────────\n`);
    const status = runSingleTenant(t.code, args.execute);
    if (status === 0) {
      ok.push(t.code);
    } else {
      failed.push({ code: t.code, status });
      if (!args.continueOnError) {
        console.error(
          `\nStopped after failure on ${t.code} (exit ${status}). ` +
            `Re-run with --continue-on-error to skip failures.\n`,
        );
        break;
      }
    }
  }

  console.log('\n════════════════════════════════════════════════════════');
  console.log('  BULK SUMMARY');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  succeeded: ${ok.length}`);
  console.log(`  failed:    ${failed.length}`);
  if (failed.length > 0) {
    for (const f of failed) {
      console.log(`    - ${f.code} (exit ${f.status})`);
    }
  }
  if (!args.execute) {
    console.log(
      `\nDry-run complete. Re-run with --confirm=${
        targets.length === all.length ? EVERY_TENANT_CONFIRM : BULK_CONFIRM
      } --execute to delete.`,
    );
  }
  console.log('');

  if (failed.length > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nScript aborted:', err);
    process.exit(1);
  });
