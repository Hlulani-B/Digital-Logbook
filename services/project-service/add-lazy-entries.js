/**
 * add-lazy-entries.js — Add 10 casual, human-like test entries via curl
 * 
 * Uses Supabase REST API with service-role key to insert directly.
 * 
 * Run:  node add-lazy-entries.js
 */

import { execFile } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const USER_EMAIL = 'baloyihlulani91@gmail.com';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// 10 lazy, human-like entries across existing projects
const lazyEntries = [
  {
    project_name: 'Rihanyo',
    entries: { what_i_worked_on: 'fixed some stuff', bugs_fixed: 2, module_touched: 'misc' },
    due_date: null,
    priority: null,
  },
  {
    project_name: 'COMS3011A Assignment',
    entries: { topic_studied: 'did some reading', confidence_level: 4 },
    due_date: null,
    priority: null,
  },
  {
    project_name: 'Gym Log',
    entries: { workout_type: 'went to the gym', duration_minutes: 45 },
    due_date: null,
    priority: null,
  },
  {
    project_name: 'Wits SRC Budget Tracker',
    entries: { meeting_topic: 'chatted about things', amount_discussed: 500 },
    due_date: null,
    priority: null,
  },
  {
    project_name: 'Rihanyo',
    entries: { what_i_worked_on: 'debugged things', bugs_fixed: 1, module_touched: 'api' },
    due_date: null,
    priority: null,
  },
  {
    project_name: 'Laundry',
    entries: { notes: 'did laundry stuff' },
    due_date: null,
    priority: null,
  },
  {
    project_name: 'COMS3011A Assignment',
    entries: { topic_studied: 'looked at some notes', confidence_level: 3 },
    due_date: null,
    priority: null,
  },
  {
    project_name: 'Gym Log',
    entries: { workout_type: 'cardio or something', duration_minutes: 30 },
    due_date: null,
    priority: null,
  },
  {
    project_name: 'Rihanyo',
    entries: { what_i_worked_on: 'worked on things', bugs_fixed: 3, module_touched: 'frontend' },
    due_date: null,
    priority: null,
  },
  {
    project_name: 'Wits SRC Budget Tracker',
    entries: { meeting_topic: 'quick sync', amount_discussed: 200 },
    due_date: null,
    priority: null,
  },
];

function curlInsert(entry) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      user_email: USER_EMAIL,
      project_name: entry.project_name,
      entries: entry.entries,
      due_date: entry.due_date,
      priority: entry.priority,
    });

    const args = [
      '-s',
      '-w', '\n%{http_code}',
      '-X', 'POST',
      `${SUPABASE_URL}/rest/v1/entries`,
      '-H', `apikey: ${SERVICE_KEY}`,
      '-H', `Authorization: Bearer ${SERVICE_KEY}`,
      '-H', 'Content-Type: application/json',
      '-H', 'Prefer: return=representation',
      '-d', body,
    ];

    execFile('curl', args, { timeout: 10000 }, (err, stdout) => {
      if (err) return reject(err);
      const lines = stdout.trim().split('\n');
      const httpCode = lines.pop();
      resolve({ httpCode: parseInt(httpCode, 10), body: lines.join('\n') });
    });
  });
}

async function main() {
  console.log(`\n⏳  Adding ${lazyEntries.length} lazy entries for ${USER_EMAIL}...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < lazyEntries.length; i++) {
    const entry = lazyEntries[i];
    const num = String(i + 1).padStart(2, ' ');
    
    try {
      const res = await curlInsert(entry);
      if (res.httpCode === 201) {
        console.log(`  [${num}] ✅  ${entry.project_name} — ${JSON.stringify(entry.entries).slice(0, 50)}...`);
        success++;
      } else {
        console.log(`  [${num}] ❌  ${entry.project_name} — HTTP ${res.httpCode}: ${res.body.slice(0, 100)}`);
        failed++;
      }
    } catch (err) {
      console.log(`  [${num}] ❌  ${entry.project_name} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊  Done: ${success} inserted, ${failed} failed\n`);
}

main();
