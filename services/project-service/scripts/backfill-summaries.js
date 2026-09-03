/**
 * Backfill script — generates AI summaries for existing entries.
 *
 * Usage:
 *   1. Set environment variables (or create .env in project-service root):
 *        DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
 *        OPENROUTER_API_KEY=...   (or GEMINI_API_KEY, HF_API_KEY, CEREBRAS_API_KEY, GROQ_API_KEY)
 *   2. Run from the project-service directory:
 *        node scripts/backfill-summaries.js
 *
 * The script:
 *   - Fetches all entries where summary IS NULL and deleted = false
 *   - For each entry, asks AI to write a one-sentence summary
 *   - Updates the entry's summary column
 *   - Processes in batches of 10 with a 1-second delay between batches
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project-service root
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.');
  console.error('Set it in your environment or in services/project-service/.env');
  process.exit(1);
}

// Supabase requires SSL. rejectUnauthorized:false matches the project's db.js pattern
// for connecting to Supabase's managed PostgreSQL (same as services/project-service/src/db.js).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // eslint-disable-line -- Supabase managed DB
});

/**
 * Call AI to generate a one-sentence summary.
 * Uses OpenRouter if available (same provider the service uses).
 */
async function callAI(prompt) {
  // Try OpenRouter first (primary provider)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat-v3-0324:free',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      console.warn('OpenRouter failed:', err.message);
    }
  }

  // Fallback: Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text().trim() || null;
    } catch (err) {
      console.warn('Gemini failed:', err.message);
    }
  }

  console.error('No AI provider available. Set OPENROUTER_API_KEY or GEMINI_API_KEY.');
  return null;
}

async function main() {
  console.log('Connecting to database...');

  // Verify connection
  await pool.query('SELECT 1');
  console.log('Connected.');

  // Fetch entries without summaries
  const { rows } = await pool.query(
    `SELECT id, project_name, entries, user_email
     FROM entries
     WHERE summary IS NULL AND deleted = false
     ORDER BY created_at DESC`
  );

  console.log(`Found ${rows.length} entries without summaries.`);

  if (rows.length === 0) {
    console.log('Nothing to do. All entries already have summaries.');
    await pool.end();
    return;
  }

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const entryObj = typeof row.entries === 'string' ? JSON.parse(row.entries) : row.entries;

    const prompt = `Given this logbook entry, write a single concise sentence summarising what was done. No more than 20 words. Do NOT use first-person pronouns (I, my, we). Write in a neutral, factual style.

Project: ${row.project_name}
Entry: ${JSON.stringify(entryObj)}

Respond with ONLY the summary sentence. Nothing else.`;

    try {
      const summary = await callAI(prompt);

      if (summary) {
        await pool.query(`UPDATE entries SET summary = $1 WHERE id = $2`, [summary, row.id]);
        updated++;
        console.log(`[${i + 1}/${rows.length}] ✓ Entry #${row.id}: "${summary}"`);
      } else {
        failed++;
        console.log(`[${i + 1}/${rows.length}] ✗ Entry #${row.id}: AI returned empty`);
      }
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${rows.length}] ✗ Entry #${row.id}: ${err.message}`);
    }

    // Rate-limit: pause 1 second every 10 entries
    if ((i + 1) % 10 === 0 && i + 1 < rows.length) {
      console.log(`  ... pausing for 1s (${updated} updated, ${failed} failed so far)`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}, Total: ${rows.length}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
