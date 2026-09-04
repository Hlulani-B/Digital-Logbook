/**
 * Regenerate ALL entry summaries from scratch.
 *
 * 1. Sets all summaries to NULL
 * 2. Fetches every non-deleted entry
 * 3. Calls AI to generate a new summary for each
 * 4. Updates the DB
 *
 * Uses the service's own AI() function.
 *
 * Usage:  node scripts/regenerate-summaries.js
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const aiPath = pathToFileURL(join(__dirname, '..', 'src', 'functions', 'ai.js')).href;
const { AI } = await import(aiPath);

const { Pool } = pg;

async function generateSummary(projectName, entryObject) {
  const hasContent = entryObject && typeof entryObject === 'object' &&
    Object.values(entryObject).some(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (!hasContent) return projectName;

  const prompt = `Summarise this logbook entry in ONE sentence of max 20 words. No first-person pronouns. Neutral factual style.

Project: ${projectName}
Entry: ${JSON.stringify(entryObject)}

You MUST respond with ONLY a JSON object in this exact format, nothing else:
{"summary": "your one sentence here"}

If the entry has no real content, use the project name as the summary.`;

  const result = await AI(prompt);
  if (!result || !result.trim()) return projectName;

  const raw = result.trim().replace(/^["']|["']$/g, '');

  try {
    const parsed = JSON.parse(raw);
    if (parsed.summary && typeof parsed.summary === 'string' && parsed.summary.trim()) {
      return parsed.summary.trim();
    }
  } catch {
    const match = raw.match(/\{[^}]*"summary"\s*:\s*"([^"]+)"[^}]*\}/);
    if (match) return match[1].trim();
  }

  try {
    const retry = await AI(prompt);
    if (retry && retry.trim()) {
      const retryRaw = retry.trim().replace(/^["']|["']$/g, '');
      try {
        const retryParsed = JSON.parse(retryRaw);
        if (retryParsed.summary) return retryParsed.summary.trim();
      } catch {
        const match = retryRaw.match(/\{[^}]*"summary"\s*:\s*"([^"]+)"[^}]*\}/);
        if (match) return match[1].trim();
      }
    }
  } catch { /* retry failed */ }

  return projectName;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // eslint-disable-line -- Supabase managed DB
  });

  await pool.query('SELECT 1');
  console.log('Connected to database.');

  const wipeResult = await pool.query('UPDATE entries SET summary = NULL WHERE deleted = false');
  console.log('Wiped ' + wipeResult.rowCount + ' summaries.');

  const { rows } = await pool.query(
    'SELECT id, project_name, entries FROM entries WHERE deleted = false ORDER BY created_at ASC'
  );
  console.log('Found ' + rows.length + ' entries to regenerate.');

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const entryObj = typeof row.entries === 'string' ? JSON.parse(row.entries) : row.entries;

    try {
      const summary = await generateSummary(row.project_name, entryObj);
      await pool.query('UPDATE entries SET summary = $1 WHERE id = $2', [summary, row.id]);
      updated++;
      console.log('[' + (i + 1) + '/' + rows.length + '] OK #' + row.id.slice(0, 8) + ': "' + summary + '"');
    } catch (err) {
      failed++;
      await pool.query('UPDATE entries SET summary = $1 WHERE id = $2', [row.project_name, row.id]);
      console.log('[' + (i + 1) + '/' + rows.length + '] FAIL #' + row.id.slice(0, 8) + ': using project name "' + row.project_name + '"');
    }

    if ((i + 1) % 10 === 0 && i + 1 < rows.length) {
      console.log('  ... pausing 1s (' + updated + ' updated, ' + failed + ' failed so far)');
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\nDone! Updated: ' + updated + ', Failed: ' + failed + ', Total: ' + rows.length);
  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
