#!/usr/bin/env node
/**
 * backup.js — One-command database backup for the Digital Logbook.
 *
 * Usage:
 *   node backup.js                        Backup to ./backups/<timestamp>.dump
 *   node backup.js ./my-backup.dump       Backup to a specific path
 *
 * Produces a PostgreSQL custom-format dump (compressed, supports pg_restore).
 *
 * Environment:
 *   DATABASE_URL   PostgreSQL connection string (required)
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  // Load .env
  let dotenv;
  try {
    dotenv = await import('dotenv');
  } catch {
    console.error('ERROR: dotenv not installed. Run: npm install');
    process.exit(1);
  }

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

  // Determine output path
  let outputPath = process.argv[2];
  if (!outputPath) {
    const backupDir = join(__dirname, 'backups');
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = join(backupDir, `logbook-${ts}.dump`);
  }

  console.log(`Backing up database to: ${outputPath}\n`);

  // Check pg_dump is available
  try {
    execFileSync('pg_dump', ['--version'], { stdio: 'pipe' });
  } catch {
    console.error(
      'ERROR: pg_dump not found.\n' +
        'Install PostgreSQL client tools:\n' +
        '  Windows: https://www.postgresql.org/download/windows/\n' +
        '  macOS:   brew install libpq\n' +
        '  Linux:   sudo apt install postgresql-client\n'
    );
    process.exit(1);
  }

  // Run pg_dump
  // --format=custom  → compressed, supports pg_restore selective restore
  // --no-owner       → skip ownership/privilege commands (portable across environments)
  // --no-acl         → skip GRANT/REVOKE commands
  // --schema=public  → only back up our app tables (skip Supabase internals)
  const args = [
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--schema=public',
    `--file=${outputPath}`,
    process.env.DATABASE_URL,
  ];

  try {
    execFileSync('pg_dump', args, { stdio: 'inherit' });
    console.log(`\n✓ Backup created: ${outputPath}`);
    console.log('  Restore with: npm run db:restore -- ' + outputPath);
  } catch (err) {
    console.error('\n✗ Backup failed:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
