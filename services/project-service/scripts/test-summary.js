/**
 * All-in-one test for entry summaries.
 *
 * 1. Connects to Supabase PostgreSQL and runs migration 007
 * 2. Starts project-service on port 5099
 * 3. Authenticates via Supabase Auth to get a JWT
 * 4. POSTs a natural language entry
 * 5. Retrieves entries and verifies the summary field
 *
 * Usage:  node scripts/test-summary.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project-service root
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

function log(msg) {
  console.log(`\n━━━ ${msg} ━━━`);
}

function httpPost(port, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(chunks) });
          } catch {
            resolve({ status: res.statusCode, body: chunks });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // ── 1. Database connection ────────────────────────────────────────
  log('Step 1: Connect to Supabase PostgreSQL');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // eslint-disable-line -- Supabase managed DB
  });

  try {
    await pool.query('SELECT 1');
    console.log('✓ Connected');
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }

  // ── 2. Run migration ──────────────────────────────────────────────
  log('Step 2: Run migration 007 (add summary column)');
  await pool.query('ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS summary TEXT');
  console.log('✓ summary column added / already exists');

  const colInfo = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'entries' AND column_name = 'summary'`
  );
  console.log('✓ Column info:', colInfo.rows[0]);

  // ── 3. Start project-service ──────────────────────────────────────
  log('Step 3: Start project-service on port 5099');
  process.env.PORT = '5099';

  // Import the service (it calls app.listen internally)
  await import('../src/index.js');

  // Wait for the server to be ready
  await new Promise((r) => setTimeout(r, 3000));
  console.log('✓ Service running on port 5099');

  // ── 4. Get JWT token ──────────────────────────────────────────────
  log('Step 4: Authenticate via Supabase Auth');

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testEmail = 'summary-test@logbook.test';
  const testPassword = 'TestSummaries123!';

  // Create user via service role (bypasses email confirmation)
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    }),
  });
  const createData = await createRes.json();

  if (createData.error && !createData.error.includes('already')) {
    // User might already exist, try to sign in
    console.log('User may exist, trying sign-in...');
  } else {
    console.log('✓ Test user created (or already exists)');
  }

  // Sign in to get JWT
  const signinRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const signinData = await signinRes.json();

  if (!signinData.access_token) {
    console.error('✗ Could not get JWT:', JSON.stringify(signinData));
    await pool.end();
    process.exit(1);
  }

  const token = signinData.access_token;
  console.log('✓ Got JWT token');

  // Ensure profile exists
  await pool.query(
    `INSERT INTO public.users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING`,
    [testEmail]
  );

  // ── 5. Add entry via natural language ─────────────────────────────
  log('Step 5: POST /service/natural-language-entry');
  console.log('Input: "Fixed the login bug for the dashboard, urgent"');

  const addResult = await httpPost(
    5099,
    '/service/natural-language-entry',
    { text: 'Fixed the login bug for the dashboard, urgent' },
    token
  );

  console.log('Status:', addResult.status);
  console.log('Success:', addResult.body?.success);
  console.log('Project:', addResult.body?.project);
  console.log('Fields:', JSON.stringify(addResult.body?.fields));
  console.log('🎯 SUMMARY:', addResult.body?.summary || '(null)');
  console.log('Comment:', addResult.body?.comment || '(null)');

  // ── 6. Retrieve entries ───────────────────────────────────────────
  log('Step 6: POST /service/entry (getAll)');

  const getResult = await httpPost(
    5099,
    '/service/entry',
    { function: 'getAll', values: {} },
    token
  );

  console.log('Status:', getResult.status);
  if (getResult.body?.success && getResult.body?.data) {
    const withSummary = getResult.body.data.filter((e) => e.summary);
    console.log(`Total entries: ${getResult.body.data.length}`);
    console.log(`Entries with summary: ${withSummary.length}`);
    console.log('');
    withSummary.slice(0, 5).forEach((e) => {
      console.log(`  [${e.project_name}] ${e.summary}`);
    });
  }

  // ── 7. Direct DB verification ─────────────────────────────────────
  log('Step 7: Direct DB check');
  const dbRows = await pool.query(
    `SELECT id, project_name, entries, summary, created_at
     FROM entries WHERE user_email = $1 AND deleted = false
     ORDER BY created_at DESC LIMIT 5`,
    [testEmail]
  );
  dbRows.rows.forEach((r) => {
    console.log(`  #${r.id} [${r.project_name}] summary: "${r.summary || '(null)'}"`);
  });

  // ── Done ──────────────────────────────────────────────────────────
  log('✅ Test complete');
  console.log('');
  console.log('To backfill ALL existing entries with summaries:');
  console.log('  cd services/project-service && node scripts/backfill-summaries.js');
  console.log('');

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
