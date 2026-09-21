export async function migrateTemplates(pool) {
  if (!pool) {
    throw new Error('Template migration requires a configured database pool.');
  }

  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query(
      "SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.schema_templates'))"
    );

    await client.query(`
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

    await client.query(`
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS schema_templates_scope_idx
        ON public.schema_templates (scope, user_email) WHERE deleted IS NOT TRUE;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS schema_templates_fork_idx
        ON public.schema_templates (forked_from) WHERE is_fork = true;
    `);
    await client.query('ALTER TABLE public.schema_templates ENABLE ROW LEVEL SECURITY');
    await client.query('REVOKE ALL ON public.schema_templates FROM PUBLIC');
    await client.query(`
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

    await client.query('COMMIT');
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the migration failure; the pool is still closed below.
      }
    }
    throw error;
  } finally {
    try {
      client?.release();
    } finally {
      await pool.end();
    }
  }
}

// Avoid import.meta so Jest's CommonJS transform can import the reusable migration.
if (
  !process.env.JEST_WORKER_ID &&
  process.argv[1] &&
  /(?:^|[\\/])migrate-templates\.js$/.test(process.argv[1])
) {
  (async () => {
    await import('../src/config.js');
    const { default: pool } = await import('../src/db.js');
    await migrateTemplates(pool);
    console.log('Template schema migration completed.');
  })().catch((error) => {
    console.error('Template schema migration failed:', error.message);
    process.exitCode = 1;
  });
}
