/**
 * Fix JSON-wrapped summaries — unwrap {"summary": "..."} into plain text.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // eslint-disable-line -- Supabase managed DB
});

const { rows } = await pool.query(
  `SELECT id, summary FROM entries WHERE summary LIKE '{%%' AND deleted = false`
);
console.log(`Found ${rows.length} entries with JSON-wrapped summaries.`);

for (const r of rows) {
  try {
    const parsed = JSON.parse(r.summary);
    const clean = parsed.summary || parsed.text || r.summary;
    await pool.query('UPDATE entries SET summary = $1 WHERE id = $2', [clean, r.id]);
    console.log(`  Fixed #${r.id.slice(0, 8)}: "${clean}"`);
  } catch {
    console.log(`  Skip #${r.id.slice(0, 8)}: not valid JSON`);
  }
}

console.log('Done.');
await pool.end();
