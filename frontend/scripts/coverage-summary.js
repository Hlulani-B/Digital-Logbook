/**
 * Generate a Markdown coverage summary table from coverage-summary.json
 * and write it to $GITHUB_STEP_SUMMARY (works in both GitHub and Gitea Actions).
 *
 * Usage:  node scripts/coverage-summary.js
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { resolve, dirname, relative, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const summaryPath = resolve(__dirname, '..', 'coverage', 'coverage-summary.json');

if (!existsSync(summaryPath)) {
  console.log('No coverage-summary.json found — skipping.');
  process.exit(0);
}

const data = JSON.parse(readFileSync(summaryPath, 'utf8'));
const total = data.total;
const projectRoot = resolve(__dirname, '..');

// Build the per-file rows (skip the 'total' key)
const files = Object.entries(data)
  .filter(([k]) => k !== 'total')
  .map(([filePath, metrics]) => {
    // Use a short relative path for readability
    const rel = relative(projectRoot, filePath).replace(/\\/g, '/');
    const short = rel.startsWith('src/') ? rel : basename(filePath);
    return {
      file: short,
      stmts: metrics.statements?.pct ?? 0,
      branch: metrics.branches?.pct ?? 0,
      funcs: metrics.functions?.pct ?? 0,
      lines: metrics.lines?.pct ?? 0,
    };
  })
  .sort((a, b) => a.lines - b.lines); // worst coverage first

// Helper: colour-code a percentage with emoji
function pct(p) {
  const n = typeof p === 'number' ? p : parseFloat(p);
  if (isNaN(n)) return '—';
  const icon = n >= 80 ? '\u{1F7E2}' : n >= 60 ? '\u{1F7E1}' : '\u{1F534}';
  return `${icon} ${n.toFixed(1)}%`;
}

// Build Markdown table
const lines = [];
lines.push('## Frontend Code Coverage');
lines.push('');
lines.push('| Metric | Coverage |');
lines.push('| --- | --- |');
lines.push(`| Statements | ${pct(total.statements?.pct)} (${total.statements?.covered}/${total.statements?.total}) |`);
lines.push(`| Branches | ${pct(total.branches?.pct)} (${total.branches?.covered}/${total.branches?.total}) |`);
lines.push(`| Functions | ${pct(total.functions?.pct)} (${total.functions?.covered}/${total.functions?.total}) |`);
lines.push(`| Lines | ${pct(total.lines?.pct)} (${total.lines?.covered}/${total.lines?.total}) |`);
lines.push('');
lines.push('<details>');
lines.push('<summary>Per-file breakdown</summary>');
lines.push('');
lines.push('| File | % Stmts | % Branch | % Funcs | % Lines |');
lines.push('| --- | --- | --- | --- | --- |');
for (const f of files) {
  lines.push(`| ${f.file} | ${pct(f.stmts)} | ${pct(f.branch)} | ${pct(f.funcs)} | ${pct(f.lines)} |`);
}
lines.push('');
lines.push('</details>');
lines.push('');

const markdown = lines.join('\n');

// Write to step summary if the env var is set (CI environment)
const stepSummary = process.env.GITHUB_STEP_SUMMARY;
if (stepSummary) {
  appendFileSync(stepSummary, markdown);
  console.log('Coverage table written to $GITHUB_STEP_SUMMARY');
} else {
  // Local mode — just print it
  console.log(markdown);
}
