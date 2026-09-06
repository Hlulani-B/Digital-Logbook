#!/usr/bin/env node
/**
 * restore.js — One-command database restore for the Digital Logbook.
 *
 * Usage:
 *   node restore.js <backup-file>         Restore from a .dump file
 *   node restore.js                       Restore from the latest backup in ./backups/
 *
 * Environment:
 *   DATABASE_URL   PostgreSQL connection string (required)
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  // Load .env
  const dotenv = await import('dotenv');
  const envPaths = [
    join(process.cwd(), '.env'),
    join(__dirname, '..', 'services', 'project-service', '.env'),
    join(__dirname, '..', 'frontend', '.env'),
  ];
  for (const p of envPaths) {
    try {
      dotenv.config({ path: p });
    } catch {
      /* file not found */
    }
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      'ERROR: DATABASE_URL is not set.\n' + 'Set it in your environment or in a .env file.\n'
    );
    process.exit(1);
  }

  // Determine input file
  let inputPath = process.argv[2];
  if (!inputPath) {
    // Find the most recent backup in the backups directory
    const backupDir = join(__dirname, 'backups');
    if (!existsSync(backupDir)) {
      console.error(
        'ERROR: No backup file specified and no ./backups/ directory found.\n' +
          'Usage: node restore.js <backup-file>\n'
      );
      process.exit(1);
    }

    const files = readdirSync(backupDir)
      .filter((f) => f.endsWith('.dump'))
      .map((f) => ({
        name: f,
        path: join(backupDir, f),
        mtime: statSync(join(backupDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      console.error('ERROR: No .dump files found in ./backups/\n');
      process.exit(1);
    }

    inputPath = files[0].path;
    console.log(`Using most recent backup: ${files[0].name}\n`);
  }

  if (!existsSync(inputPath)) {
    console.error(`ERROR: File not found: ${inputPath}\n`);
    process.exit(1);
  }

  console.log(`Restoring database from: ${inputPath}\n`);
  console.log('WARNING: This will overwrite existing data in the target database.');
  console.log('         Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

  // Brief pause so the user can cancel
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Check pg_restore is available
  try {
    execFileSync('pg_restore', ['--version'], { stdio: 'pipe' });
  } catch {
    console.error(
      'ERROR: pg_restore not found.\n' +
        'Install PostgreSQL client tools:\n' +
        '  Windows: https://www.postgresql.org/download/windows/\n' +
        '  macOS:   brew install libpq\n' +
        '  Linux:   sudo apt install postgresql-client\n'
    );
    process.exit(1);
  }

  // Run pg_restore
  // --clean          → drop objects before recreating them
  // --if-exists      → don't error on missing objects
  // --no-owner       → skip ownership commands (portable)
  // --no-acl         → skip GRANT/REVOKE commands
  // --schema=public  → only restore our app tables
  const args = [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-acl',
    '--schema=public',
    '--dbname',
    process.env.DATABASE_URL,
    inputPath,
  ];

  try {
    execFileSync('pg_restore', args, { stdio: 'inherit' });
    console.log(`\n✓ Database restored from: ${inputPath}`);
    console.log('  Run migrations after restore: npm run db:migrate');
  } catch (err) {
    // pg_restore exits with non-zero on warnings too (e.g. "object already exists")
    // Only treat it as failure if there was an actual stderr with errors
    if (err.stderr && err.stderr.toString().includes('ERROR')) {
      console.error('\n✗ Restore failed:', err.message);
      process.exit(1);
    }
    console.log('\n✓ Restore completed (with non-fatal warnings).');
    console.log('  Run migrations after restore: npm run db:migrate');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
