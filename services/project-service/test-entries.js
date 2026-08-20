/**
 * test-entries.js — Verify entries for baloyihlulani91@gmail.com
 *
 * Uses curl (via child_process) with the Supabase service-role key
 * to query the entries table directly, then calls the project-service
 * API endpoint to compare.
 *
 * Run:  npx nodemon test-entries.js
 *
 * Expected: 20 entries across 6 projects.
 */

import { execFile } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

// ── Config ──────────────────────────────────────────────
const USER_EMAIL = 'baloyihlulani91@gmail.com';
const EXPECTED_COUNT = 20;
const API_BASE = 'http://localhost:5003';
// ────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// ── curl helper ─────────────────────────────────────────
function curl(url, headers = [], body = null) {
  return new Promise((resolve, reject) => {
    const args = [
      '-s',
      '-w', '\n%{http_code}',
      '-X', 'GET',
      ...url.split(' ').length > 1 ? [] : [],
    ];

    // Build args properly
    const finalArgs = ['-s', '-w', '\n%{http_code}'];

    if (body) {
      finalArgs.push('-X', 'POST');
    }

    finalArgs.push(url);

    for (const h of headers) {
      finalArgs.push('-H', h);
    }

    if (body) {
      finalArgs.push('-d', body);
    }

    execFile('curl', finalArgs, { timeout: 15000 }, (err, stdout) => {
      if (err) return reject(err);
      const lines = stdout.trim().split('\n');
      const httpCode = lines.pop();
      const responseBody = lines.join('\n');
      resolve({ httpCode: parseInt(httpCode, 10), body: responseBody });
    });
  });
}

// ── Step 1: Query Supabase REST API directly ────────────
async function querySupabaseDirect() {
  const url = `${SUPABASE_URL}/rest/v1/entries?user_email=eq.${encodeURIComponent(USER_EMAIL)}&order=created_at.desc`;
  const res = await curl(url, [
    `apikey: ${SERVICE_KEY}`,
    `Authorization: Bearer ${SERVICE_KEY}`,
  ]);

  if (res.httpCode !== 200) {
    throw new Error(`Supabase REST returned ${res.httpCode}: ${res.body.slice(0, 300)}`);
  }
  return JSON.parse(res.body);
}

// ── Step 2: Call project-service API via curl ───────────
async function queryAPI() {
  const body = JSON.stringify({ function: 'getAll', values: {} });
  const res = await curl(`${API_BASE}/service/entry`, [
    'Content-Type: application/json',
    `Authorization: Bearer ${SERVICE_KEY}`,
  ], body);

  if (res.httpCode === 200) {
    const json = JSON.parse(res.body);
    if (json.success && Array.isArray(json.data)) return json.data;
    throw new Error(json.message || json.error || JSON.stringify(json));
  }
  // Service-role JWT isn't a user JWT — API will reject with 401
  return null;
}

// ── Step 3: Analyse & print ────────────────────────────
function analyse(entries, source) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ENTRIES REPORT FOR ${USER_EMAIL}`);
  console.log('═'.repeat(60));

  console.log(`\n📡  Data source: ${source}`);
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

  // Breakdown by project
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

  // Try 1: project-service API via curl
  try {
    console.log('🔑  Calling project-service API via curl ...');
    const data = await queryAPI();
    if (data) {
      entries = data;
      source = 'curl → project-service API (JWT auth)';
    }
  } catch (err) {
    console.log(`⚠️   API call failed: ${err.message}`);
  }

  // Try 2: Supabase REST API via curl (service-role bypasses RLS)
  if (!entries) {
    try {
      console.log('🔄  Falling back to Supabase REST API via curl (service-role) ...');
      entries = await querySupabaseDirect();
      source = 'curl → Supabase REST API (service-role key)';
    } catch (err) {
      console.error(`\n❌  Supabase REST also failed: ${err.message}`);
      process.exit(1);
    }
  }

  if (!entries || entries.length === 0) {
    console.error('\n❌  No entries found for this user. Response was empty.');
    process.exit(1);
  }

  analyse(entries, source);
}

main();
