/**
 * test-entries.js — Verify entries for baloyihlulani91@gmail.com
 *
 * Uses @supabase/supabase-js to obtain a JWT, then calls the
 * project-service /service/entry endpoint via curl (child_process).
 *
 * Run:  npx nodemon test-entries.js
 *
 * Expected: 20 entries across 6 projects.
 */

import { execFile } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ── Config ──────────────────────────────────────────────
const USER_EMAIL = 'baloyihlulani91@gmail.com';
const EXPECTED_COUNT = 20;
const API_BASE = 'http://localhost:5003';
// ────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌  Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

// ── Step 1: Get a JWT via Supabase service-role client ──
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function getToken() {
  // Try 1: service-role admin generateLink
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: USER_EMAIL,
    });
    if (!error && data?.properties?.action_link) {
      const url = new URL(data.properties.action_link);
      const token = url.hash?.split('access_token=')[1]?.split('&')[0];
      if (token) return token;
    }
  } catch {}

  // Try 2: Supabase token endpoint (anonymous sign-up to get an anon session)
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ email: USER_EMAIL, password: process.env.TEST_USER_PASSWORD || '' }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.access_token) return json.access_token;
    }
  } catch {}

  return null;
}

// ── Step 2: Call API via curl ───────────────────────────
function curlEntryEndpoint(token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      function: 'getAll',
      values: {},
    });

    const args = [
      '-s',                          // silent
      '-w', '\n%{http_code}',        // append HTTP status on last line
      '-X', 'POST',
      `${API_BASE}/service/entry`,
      '-H', 'Content-Type: application/json',
      '-H', `Authorization: Bearer ${token}`,
      '-d', body,
    ];

    execFile('curl', args, { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      const lines = stdout.trim().split('\n');
      const httpCode = lines.pop();
      const responseBody = lines.join('\n');
      resolve({ httpCode: parseInt(httpCode, 10), body: responseBody });
    });
  });
}

// ── Step 3: Direct DB fallback (service-role key) ──────
async function queryDirectly() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_email', USER_EMAIL)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return { success: true, data };
}

// ── Step 4: Analyse & print ────────────────────────────
function analyse(entries) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ENTRIES REPORT FOR ${USER_EMAIL}`);
  console.log('═'.repeat(60));

  // Total count
  console.log(`\n📊  Total entries returned: ${entries.length}`);

  if (entries.length === EXPECTED_COUNT) {
    console.log(`✅  Count matches expected ${EXPECTED_COUNT}`);
  } else {
    const diff = EXPECTED_COUNT - entries.length;
    console.log(
      `❌  Expected ${EXPECTED_COUNT}, got ${entries.length} — ` +
      `${diff > 0 ? diff + ' entries missing' : Math.abs(diff) + ' extra entries'}`
    );
  }

  // Breakdown by project (table_name = project_name)
  const grouped = {};
  for (const e of entries) {
    const name = e.project_name || '(unknown)';
    grouped[name] = (grouped[name] || 0) + 1;
  }

  console.log('\n📁  Breakdown by project:');
  console.log('─'.repeat(40));
  for (const [name, count] of Object.entries(grouped).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name.padEnd(25)} ${count}`);
  }
  console.log('─'.repeat(40));
  console.log(`  ${'TOTAL'.padEnd(25)} ${entries.length}`);

  // Each entry detail
  console.log('\n📝  Entry details:');
  console.log('─'.repeat(60));
  entries.forEach((e, i) => {
    const num = String(i + 1).padStart(2, ' ');
    console.log(`\n  [${num}] project:  ${e.project_name}`);
    console.log(`      entries:  ${JSON.stringify(e.entries)}`);
    console.log(`      due_date: ${e.due_date ?? 'null'}`);
    console.log(`      priority: ${e.priority ?? 'null'}`);
    console.log(`      created:  ${e.created_at}`);
  });

  console.log('\n' + '═'.repeat(60));
  console.log('  DONE');
  console.log('═'.repeat(60) + '\n');
}

// ── Main ────────────────────────────────────────────────
async function main() {
  console.log(`\n⏳  [${new Date().toLocaleTimeString()}] Fetching entries for ${USER_EMAIL} ...`);

  let entries = null;
  let source = '';

  // Try API via curl first
  const token = await getToken();

  if (token) {
    try {
      console.log('🔑  Got JWT, calling API via curl ...');
      const res = await curlEntryEndpoint(token);

      if (res.httpCode === 200) {
        const json = JSON.parse(res.body);
        if (json.success && Array.isArray(json.data)) {
          entries = json.data;
          source = 'curl → API endpoint';
        } else {
          console.error('❌  API returned error:', json.message || json.error || JSON.stringify(json));
        }
      } else if (res.httpCode === 401) {
        console.error('❌  401 Unauthorized — JWT was rejected by the API');
      } else {
        console.error(`❌  API returned HTTP ${res.httpCode}: ${res.body.slice(0, 200)}`);
      }
    } catch (err) {
      console.error('❌  curl call failed:', err.message);
    }
  } else {
    console.log('⚠️   Could not obtain JWT (key may not be service-role)');
  }

  // Fallback: query DB directly
  if (!entries) {
    console.log('🔄  Falling back to direct Supabase query ...');
    try {
      const result = await queryDirectly();
      entries = result.data;
      source = 'direct Supabase query (bypassed API)';
    } catch (err) {
      console.error('\n❌  Direct query also failed:', err.message);
      process.exit(1);
    }
  }

  if (!entries || entries.length === 0) {
    console.error('\n❌  No entries found for this user. Response was empty.');
    process.exit(1);
  }

  console.log(`📡  Data source: ${source}`);
  analyse(entries);
}

main();
