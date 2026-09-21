import { migrateTemplates } from '../../scripts/migrate-templates.js';
import servicePackage from '../../package.json';

const mockLoadConfig = jest.fn();
const mockLoadPool = jest.fn();
let mockPool;

jest.mock('../config.js', () => {
  mockLoadConfig();
  return {};
});
jest.mock('../db.js', () => {
  mockLoadPool();
  return { __esModule: true, default: mockPool };
});
jest.mock('pg', () => {
  throw new Error('Migration tests must not load a real database driver.');
});
jest.mock('dotenv', () => {
  throw new Error('Migration tests must not load environment files.');
});

const normalize = (sql) => sql.replace(/\s+/g, ' ').trim();
const makePool = () => {
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
  return {
    client,
    connect: jest.fn().mockResolvedValue(client),
    query: jest.fn(() => {
      throw new Error('Migration statements must use the connected client.');
    }),
    end: jest.fn().mockResolvedValue(undefined),
  };
};
const statements = (pool) => pool.client.query.mock.calls.map(([sql]) => normalize(sql));

beforeEach(() => {
  mockPool = makePool();
  mockLoadConfig.mockReset();
  mockLoadPool.mockReset();
});

const expectedTable = normalize(`
  CREATE TABLE IF NOT EXISTS public.schema_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255),
    scope TEXT NOT NULL DEFAULT 'personal'
      CHECK (scope IN ('built_in', 'personal', 'global')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    is_fork BOOLEAN NOT NULL DEFAULT false,
    forked_from TEXT,
    deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT schema_templates_name_length CHECK (length(name) BETWEEN 1 AND 255),
    CONSTRAINT schema_templates_description_length CHECK (description IS NULL OR length(description) <= 2000),
    CONSTRAINT schema_templates_version_positive CHECK (version > 0),
    CONSTRAINT schema_templates_user_scope CHECK (
      (scope = 'built_in' AND user_email IS NULL) OR
      (scope IN ('personal', 'global') AND user_email IS NOT NULL)
    ),
    CONSTRAINT schema_templates_fork_consistency CHECK (
      (is_fork = true AND forked_from IS NOT NULL) OR
      (is_fork = false AND forked_from IS NULL)
    )
  );
`);
const expectedConversion = normalize(`
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid = 'public.schema_templates'::regclass
        AND attname = 'forked_from'
        AND atttypid = 'pg_catalog.uuid'::regtype
        AND NOT attisdropped
    ) THEN
      ALTER TABLE public.schema_templates
        ALTER COLUMN forked_from TYPE TEXT USING forked_from::text;
    END IF;
  END $$;
`);
const expectedRestrictions = normalize(`
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
      REVOKE ALL ON public.schema_templates FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON public.schema_templates FROM authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'public'
                   AND tablename = 'schema_templates' AND policyname = 'deny_client_template_writes') THEN
      CREATE POLICY deny_client_template_writes ON public.schema_templates
        AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
    END IF;
  END $$;
`);
const expectedStatements = [
  'BEGIN',
  "SET LOCAL lock_timeout = '15s'",
  "SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.schema_templates'))",
  expectedTable,
  expectedConversion,
  'CREATE INDEX IF NOT EXISTS schema_templates_scope_idx ON public.schema_templates (scope, user_email) WHERE deleted IS NOT TRUE;',
  'CREATE INDEX IF NOT EXISTS schema_templates_fork_idx ON public.schema_templates (forked_from) WHERE is_fork = true;',
  'ALTER TABLE public.schema_templates ENABLE ROW LEVEL SECURITY',
  'REVOKE ALL ON public.schema_templates FROM PUBLIC',
  expectedRestrictions,
  'COMMIT',
];

function expectClosed(pool) {
  expect(pool.client.release).toHaveBeenCalledTimes(1);
  expect(pool.end).toHaveBeenCalledTimes(1);
  expect(pool.client.release.mock.invocationCallOrder[0]).toBeLessThan(
    pool.end.mock.invocationCallOrder[0]
  );
  expect(pool.query).not.toHaveBeenCalled();
}

describe('template-only migration', () => {
  test('npm start runs the service-local template migration first', () => {
    expect(servicePackage.scripts.prestart).toBe('node scripts/migrate-templates.js');
    expect(servicePackage.scripts.start).toBe('node src/index.js');
  });

  test('commits constraints, indexes, and restrictions on one locked client', async () => {
    await expect(migrateTemplates(mockPool)).resolves.toBeUndefined();

    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(statements(mockPool)).toEqual(expectedStatements);
    expect(mockPool.client.query.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mockPool.client.release.mock.invocationCallOrder[0]
    );
    expectClosed(mockPool);
    expect(mockLoadConfig).not.toHaveBeenCalled();
    expect(mockLoadPool).not.toHaveBeenCalled();
  });

  test('repeats guarded DDL without seeding, deleting, or overwriting rows', async () => {
    const secondPool = makePool();
    await migrateTemplates(mockPool);
    await migrateTemplates(secondPool);

    for (const pool of [mockPool, secondPool]) {
      expect(statements(pool)).toEqual(expectedStatements);
      const sql = statements(pool).join('\n');
      expect(sql).not.toMatch(/\b(DROP|TRUNCATE|INSERT|UPDATE|DELETE|MERGE|GRANT|CASCADE)\b/i);
      expect(sql).not.toMatch(/\b(CREATE|ALTER)\s+(USER|ROLE)\b/i);
      expect(sql).not.toMatch(/\b(users|admins|schema_migrations)\b/i);
      expectClosed(pool);
    }
  });

  test('the sole type conversion is conditional on an existing UUID fork source', async () => {
    await migrateTemplates(mockPool);
    const conversions = statements(mockPool).filter((sql) => sql.includes('ALTER COLUMN'));
    expect(conversions).toEqual([expectedConversion]);
    expect(conversions[0]).not.toMatch(/DROP|SET NOT NULL|SET DEFAULT/);
  });

  test.each([null, undefined])(
    'rejects a missing pool (%s) without loading configuration',
    async (pool) => {
      await expect(migrateTemplates(pool)).rejects.toThrow('configured database pool');
      expect(mockLoadConfig).not.toHaveBeenCalled();
      expect(mockLoadPool).not.toHaveBeenCalled();
      expect(mockPool.connect).not.toHaveBeenCalled();
    }
  );

  test('closes the pool when connection acquisition fails', async () => {
    const failure = new Error('database unavailable');
    mockPool.connect.mockRejectedValueOnce(failure);
    await expect(migrateTemplates(mockPool)).rejects.toBe(failure);
    expect(mockPool.client.query).not.toHaveBeenCalled();
    expect(mockPool.client.release).not.toHaveBeenCalled();
    expect(mockPool.end).toHaveBeenCalledTimes(1);
  });

  test.each([
    'BEGIN',
    'SET LOCAL',
    'SELECT pg_catalog.pg_advisory_xact_lock',
    'CREATE TABLE',
    'DO $$ BEGIN IF EXISTS ( SELECT 1 FROM pg_catalog.pg_attribute',
    'CREATE INDEX IF NOT EXISTS schema_templates_scope_idx',
    'CREATE INDEX IF NOT EXISTS schema_templates_fork_idx',
    'ALTER TABLE public.schema_templates ENABLE',
    'REVOKE ALL',
    'DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles',
    'COMMIT',
  ])('cleans up and aborts when %s fails', async (prefix) => {
    const failure = new Error(`failed: ${prefix}`);
    mockPool.client.query.mockImplementation(async (sql) => {
      if (normalize(sql).startsWith(prefix)) throw failure;
      return { rows: [] };
    });

    await expect(migrateTemplates(mockPool)).rejects.toBe(failure);
    const sql = statements(mockPool);
    if (prefix === 'BEGIN') {
      expect(sql).toEqual(['BEGIN']);
    } else {
      expect(sql.at(-1)).toBe('ROLLBACK');
      expect(sql.filter((statement) => statement === 'ROLLBACK')).toHaveLength(1);
    }
    if (prefix !== 'COMMIT') expect(sql).not.toContain('COMMIT');
    expectClosed(mockPool);
  });

  test('retains the original failure and closes resources even when rollback fails', async () => {
    const failure = new Error('DDL failed');
    mockPool.client.query.mockImplementation(async (sql) => {
      if (normalize(sql).startsWith('CREATE TABLE')) throw failure;
      if (sql === 'ROLLBACK') throw new Error('rollback failed');
      return { rows: [] };
    });
    await expect(migrateTemplates(mockPool)).rejects.toBe(failure);
    expect(statements(mockPool).at(-1)).toBe('ROLLBACK');
    expectClosed(mockPool);
  });

  test('closes the pool even if releasing the client throws', async () => {
    const failure = new Error('release failed');
    mockPool.client.release.mockImplementationOnce(() => {
      throw failure;
    });
    await expect(migrateTemplates(mockPool)).rejects.toBe(failure);
    expectClosed(mockPool);
  });

  test('propagates pool shutdown failure instead of reporting success', async () => {
    const failure = new Error('shutdown failed');
    mockPool.end.mockRejectedValueOnce(failure);
    await expect(migrateTemplates(mockPool)).rejects.toBe(failure);
    expectClosed(mockPool);
  });
});

describe('CLI invocation guard and lifecycle (mocked imports only)', () => {
  let originalArgv;
  let originalWorkerId;
  let originalExitCode;
  let log;
  let error;

  beforeEach(() => {
    originalArgv = process.argv;
    originalWorkerId = process.env.JEST_WORKER_ID;
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    if (originalWorkerId === undefined) delete process.env.JEST_WORKER_ID;
    else process.env.JEST_WORKER_ID = originalWorkerId;
    jest.restoreAllMocks();
  });

  async function importEntry() {
    await jest.isolateModulesAsync(async () => {
      await import('../../scripts/migrate-templates.js');
      await new Promise((resolve) => setImmediate(resolve));
    });
  }

  test.each([undefined, '/app/node_modules/jest/bin/jest.js', '/app/src/index.js'])(
    'importing from %s does not load config or connect, even without a Jest worker flag',
    async (entry) => {
      delete process.env.JEST_WORKER_ID;
      process.argv = entry ? ['node', entry] : ['node'];
      await importEntry();
      expect(mockLoadConfig).not.toHaveBeenCalled();
      expect(mockLoadPool).not.toHaveBeenCalled();
      expect(mockPool.connect).not.toHaveBeenCalled();
      expect(mockPool.end).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    }
  );

  test('Jest cannot accidentally invoke the CLI even when argv names the script', async () => {
    process.env.JEST_WORKER_ID = '1';
    process.argv = ['node', '/app/scripts/migrate-templates.js'];
    await importEntry();
    expect(mockLoadConfig).not.toHaveBeenCalled();
    expect(mockLoadPool).not.toHaveBeenCalled();
    expect(mockPool.connect).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  test.each([
    'scripts/migrate-templates.js',
    '/app/scripts/migrate-templates.js',
    'C:\\service\\scripts\\migrate-templates.js',
  ])('direct invocation %s loads config before the existing pool and closes it', async (entry) => {
    delete process.env.JEST_WORKER_ID;
    process.argv = ['node', entry];
    await importEntry();
    expect(mockLoadConfig).toHaveBeenCalledTimes(1);
    expect(mockLoadPool).toHaveBeenCalledTimes(1);
    expect(mockLoadConfig.mock.invocationCallOrder[0]).toBeLessThan(
      mockLoadPool.mock.invocationCallOrder[0]
    );
    expect(mockLoadPool.mock.invocationCallOrder[0]).toBeLessThan(
      mockPool.connect.mock.invocationCallOrder[0]
    );
    expect(statements(mockPool)).toEqual(expectedStatements);
    expectClosed(mockPool);
    expect(log).toHaveBeenCalledWith('Template schema migration completed.');
    expect(error).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  test.each([
    'missing pool',
    'connection',
    'migration',
    'shutdown',
    'config import',
    'pool import',
  ])('direct invocation fails nonzero on %s and closes any acquired pool', async (failure) => {
    const pool = mockPool;
    if (failure === 'missing pool') mockPool = null;
    if (failure === 'connection') pool.connect.mockRejectedValueOnce(new Error(failure));
    if (failure === 'migration') pool.client.query.mockRejectedValueOnce(new Error(failure));
    if (failure === 'shutdown') pool.end.mockRejectedValueOnce(new Error(failure));
    if (failure === 'config import') {
      mockLoadConfig.mockImplementationOnce(() => {
        throw new Error(failure);
      });
    }
    if (failure === 'pool import') {
      mockLoadPool.mockImplementationOnce(() => {
        throw new Error(failure);
      });
    }
    delete process.env.JEST_WORKER_ID;
    process.argv = ['node', '/app/scripts/migrate-templates.js'];
    await importEntry();
    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith('Template schema migration failed:', expect.any(String));
    expect(log).not.toHaveBeenCalled();
    if (['connection', 'migration', 'shutdown'].includes(failure)) {
      expect(pool.end).toHaveBeenCalledTimes(1);
    } else {
      expect(pool.connect).not.toHaveBeenCalled();
      expect(pool.end).not.toHaveBeenCalled();
    }
    if (['migration', 'shutdown'].includes(failure)) {
      expectClosed(pool);
    } else {
      expect(pool.client.release).not.toHaveBeenCalled();
    }
  });
});
