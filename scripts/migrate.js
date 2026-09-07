#!/usr/bin/env node
/**
 * migrate.js — Versioned schema migration runner for the Digital Logbook.
 *
 * Usage:
 *   node migrate.js              Run all pending migrations
 *   node migrate.js status       Show applied / pending migrations
 *   node migrate.js bootstrap    Mark existing migrations as already applied
 *                                (for a database where 001-007 were run manually)
 *
 * Environment:
 *   DATABASE_URL   PostgreSQL connection string (required)
 *                  Loaded from .env in ../services/project-service/.env
 *                  or any .env file in the working directory.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

// ─── Helpers ────────────────────────────────────────────────

/**
 * Read all .sql files from the migrations directory, sorted by filename prefix.
 */
export function discoverMigrations(dir = MIGRATIONS_DIR) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.map((file) => ({
    file,
    version: file.replace(/\.sql$/, ''),
    sql: readFileSync(join(dir, file), 'utf-8'),
  }));
}

/**
 * Ensure the schema_migrations tracking table exists.
 */
async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version     VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum    TEXT
    )
  `);
}

/**
 * Return the set of already-applied migration versions.
 */
async function getApplied(pool) {
  const { rows } = await pool.query(
    'SELECT version FROM public.schema_migrations ORDER BY version'
  );
  return new Set(rows.map((r) => r.version));
}

/**
 * Run a single migration inside a transaction.
 */
async function runMigration(pool, migration) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(migration.sql);

    // Simple checksum: first 16 hex chars of a hash
    const crypto = await import('node:crypto');
    const checksum = crypto.createHash('sha256').update(migration.sql).digest('hex').slice(0, 16);

    await client.query(
      `INSERT INTO public.schema_migrations (version, checksum)
       VALUES ($1, $2)
       ON CONFLICT (version) DO UPDATE SET checksum = $2`,
      [migration.version, checksum]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Commands ───────────────────────────────────────────────

/**
 * Run all pending migrations.
 */
export async function migrate(pool) {
  await ensureMigrationsTable(pool);
  const migrations = discoverMigrations();
  const applied = await getApplied(pool);

  const pending = migrations.filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    console.log('✓ All migrations already applied — nothing to do.');
    return { applied: 0, skipped: migrations.length };
  }

  console.log(`Found ${pending.length} pending migration(s):\n`);
  for (const m of pending) {
    console.log(`  → ${m.file}`);
  }
  console.log();

  const appliedNow = [];
  for (const m of pending) {
    const start = Date.now();
    try {
      await runMigration(pool, m);
      const ms = Date.now() - start;
      console.log(`  ✓ ${m.file}  (${ms}ms)`);
      appliedNow.push(m.version);
    } catch (err) {
      console.error(`\n  ✗ ${m.file} FAILED: ${err.message}`);
      console.error('    Migration stopped. Fix the error and re-run.\n');
      return { applied: appliedNow.length, failed: m.file, error: err };
    }
  }

  console.log(`\n✓ ${appliedNow.length} migration(s) applied successfully.`);
  return { applied: appliedNow.length, skipped: migrations.length - pending.length };
}

/**
 * Show the status of all migrations.
 */
export async function status(pool) {
  await ensureMigrationsTable(pool);
  const migrations = discoverMigrations();
  const applied = await getApplied(pool);

  console.log('\nMigration status:\n');
  console.log('  Status   Version');
  console.log('  ──────   ──────────────────────────────────────────────');

  for (const m of migrations) {
    const label = applied.has(m.version) ? '  ✓ applied' : '  ○ pending';
    console.log(`${label}   ${m.file}`);
  }

  const totalApplied = migrations.filter((m) => applied.has(m.version)).length;
  const totalPending = migrations.length - totalApplied;
  console.log(`\n  ${totalApplied} applied, ${totalPending} pending\n`);

  return { applied: totalApplied, pending: totalPending };
}

/**
 * Mark all existing migrations as applied without running them.
 * Use this when upgrading a database where migrations 001-007 were run manually.
 */
export async function bootstrap(pool) {
  await ensureMigrationsTable(pool);
  const migrations = discoverMigrations();
  const applied = await getApplied(pool);

  const toMark = migrations.filter((m) => !applied.has(m.version));

  if (toMark.length === 0) {
    console.log('✓ All migrations already marked — nothing to do.');
    return { marked: 0 };
  }

  console.log(`Marking ${toMark.length} migration(s) as applied (without running them):\n`);

  const crypto = await import('node:crypto');

  for (const m of toMark) {
    const checksum = crypto.createHash('sha256').update(m.sql).digest('hex').slice(0, 16);

    await pool.query(
      `INSERT INTO public.schema_migrations (version, checksum)
       VALUES ($1, $2)
       ON CONFLICT (version) DO UPDATE SET checksum = $2`,
      [m.version, checksum]
    );
    console.log(`  ✓ ${m.file} (marked)`);
  }

  console.log(`\n✓ ${toMark.length} migration(s) marked as applied.`);
  return { marked: toMark.length };
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  // Load environment
  const dotenv = await import('dotenv');
  const envPaths = [
    join(process.cwd(), '.env'),
    join(__dirname, '..', 'services', 'project-service', '.env'),
    join(__dirname, '..', 'frontend', '.env'),
  ];
  for (const p of envPaths) {
    dotenv.config({ path: p });
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      'ERROR: DATABASE_URL is not set.\n' + 'Set it in your environment or in a .env file.\n'
    );
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const command = process.argv[2] || 'migrate';

  try {
    switch (command) {
      case 'migrate':
        await migrate(pool);
        break;
      case 'status':
        await status(pool);
        break;
      case 'bootstrap':
        await bootstrap(pool);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: node migrate.js [migrate|status|bootstrap]');
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
