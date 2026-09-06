/**
 * Tests for the migration runner — pure functions that don't need a DB.
 * Run with: cd codacaine/frontend && npm test -- --run
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations');

describe('Migration files', () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  it('has at least 8 migration files (000 baseline + 001-007)', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  it('includes the baseline migration 000', () => {
    expect(files[0]).toMatch(/^000_/);
  });

  it('includes migrations 001 through 007', () => {
    for (let i = 1; i <= 7; i++) {
      const prefix = String(i).padStart(3, '0');
      const found = files.find((f) => f.startsWith(prefix));
      expect(found).toBeTruthy();
    }
  });

  it('every migration file is non-empty', () => {
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      expect(sql.length).toBeGreaterThan(10);
    }
  });

  describe('000 baseline migration', () => {
    const baseline = readFileSync(
      join(
        MIGRATIONS_DIR,
        files.find((f) => f.startsWith('000_'))!
      ),
      'utf-8'
    );

    it('creates the users table', () => {
      expect(baseline).toContain('CREATE TABLE IF NOT EXISTS public.users');
    });

    it('creates the projects table', () => {
      expect(baseline).toContain('CREATE TABLE IF NOT EXISTS public.projects');
    });

    it('creates the entries table with all columns', () => {
      expect(baseline).toContain('CREATE TABLE IF NOT EXISTS public.entries');
      expect(baseline).toContain('user_email');
      expect(baseline).toContain('project_name');
      expect(baseline).toContain('entries');
      expect(baseline).toContain('JSONB');
      expect(baseline).toContain('due_date');
      expect(baseline).toContain('priority');
      expect(baseline).toContain('status');
      expect(baseline).toContain('archived');
      expect(baseline).toContain('started_at');
      expect(baseline).toContain('ended_at');
      expect(baseline).toContain('duration');
      expect(baseline).toContain('GENERATED ALWAYS AS');
      expect(baseline).toContain('deleted');
      expect(baseline).toContain('summary');
    });

    it('creates the fields table', () => {
      expect(baseline).toContain('CREATE TABLE IF NOT EXISTS public.fields');
      expect(baseline).toContain('table_name');
      expect(baseline).toContain('field_name');
      expect(baseline).toContain('data_type');
    });

    it('creates the activity_log table', () => {
      expect(baseline).toContain('CREATE TABLE IF NOT EXISTS public.activity_log');
      expect(baseline).toContain('action_type');
    });

    it('creates the health_ping table with RLS', () => {
      expect(baseline).toContain('CREATE TABLE IF NOT EXISTS public.health_ping');
      expect(baseline).toContain('ENABLE ROW LEVEL SECURITY');
    });

    it('creates the ai_provider_cooldowns table', () => {
      expect(baseline).toContain('CREATE TABLE IF NOT EXISTS public.ai_provider_cooldowns');
      expect(baseline).toContain('cooldown_until');
    });

    it('creates the priority_level enum', () => {
      expect(baseline).toContain('priority_level');
      expect(baseline).toContain('Urgent and important');
    });

    it('creates indexes', () => {
      expect(baseline).toContain('idx_entries_due_date');
      expect(baseline).toContain('idx_entries_archived');
      expect(baseline).toContain('idx_projects_archived');
      expect(baseline).toContain('idx_activity_log_user_email');
    });

    it('creates the RPC functions', () => {
      expect(baseline).toContain('CREATE OR REPLACE FUNCTION delete_user()');
      expect(baseline).toContain('CREATE OR REPLACE FUNCTION restore_user()');
      expect(baseline).toContain('CREATE OR REPLACE FUNCTION purge_deleted_users()');
      expect(baseline).toContain('CREATE OR REPLACE FUNCTION get_project_stats');
    });

    it('creates the auth trigger', () => {
      expect(baseline).toContain('handle_new_auth_user');
      expect(baseline).toContain('on_auth_user_created');
    });

    it('uses IF NOT EXISTS for idempotency', () => {
      // Every CREATE TABLE should be IF NOT EXISTS
      const createTableMatches = baseline.match(/CREATE TABLE(?! IF NOT EXISTS)/g);
      expect(createTableMatches).toBeNull();
    });

    it('guards pg_cron behind an extension check', () => {
      expect(baseline).toContain('pg_extension');
      expect(baseline).toContain('pg_cron');
    });
  });
});

describe('Migration runner module', () => {
  it('exports discoverMigrations, migrate, status, and bootstrap', async () => {
    // We can't import migrate.js directly (it has a top-level main() call),
    // but we can verify the file structure
    const source = readFileSync(join(MIGRATIONS_DIR, '..', '..', 'scripts', 'migrate.js'), 'utf-8');
    expect(source).toContain('export function discoverMigrations');
    expect(source).toContain('export async function migrate');
    expect(source).toContain('export async function status');
    expect(source).toContain('export async function bootstrap');
  });

  it('creates schema_migrations table', async () => {
    const source = readFileSync(join(MIGRATIONS_DIR, '..', '..', 'scripts', 'migrate.js'), 'utf-8');
    expect(source).toContain('schema_migrations');
    expect(source).toContain('version');
    expect(source).toContain('checksum');
  });

  it('wraps migrations in transactions', async () => {
    const source = readFileSync(join(MIGRATIONS_DIR, '..', '..', 'scripts', 'migrate.js'), 'utf-8');
    expect(source).toContain('BEGIN');
    expect(source).toContain('COMMIT');
    expect(source).toContain('ROLLBACK');
  });
});
