/**
 * Post-process vitest v8 coverage-summary.json to deduplicate Windows paths.
 *
 * v8 on Windows emits both `c:\...` and `C:\...` keys for the same file.
 * The uppercase variants show 0% because they are never matched to executed
 * code. This script merges them (keeping the lowercase entry) and recomputes
 * the `total` row so that thresholds and summary tables are correct.
 *
 * Usage:  node scripts/fix-coverage.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const summaryPath = resolve(__dirname, '..', 'coverage', 'coverage-summary.json');

let raw;
try {
  raw = JSON.parse(readFileSync(summaryPath, 'utf8'));
} catch {
  console.log('No coverage-summary.json found — skipping fix.');
  process.exit(0);
}

const normalised = {};     // key = lowercased path → { originalPath, data }
const metrics = ['lines', 'statements', 'functions', 'branches'];

for (const [filePath, data] of Object.entries(raw)) {
  const key = filePath.toLowerCase();
  if (!normalised[key]) {
    normalised[key] = { originalPath: filePath, data: { ...data } };
  } else {
    // Merge: keep whichever entry has more covered lines (the real one).
    const existing = normalised[key];
    if (data.lines.covered > existing.data.lines.covered) {
      normalised[key] = { originalPath: filePath, data: { ...data } };
    }
  }
}

// Recompute totals
const total = { lines: { total: 0, covered: 0, skipped: 0, pct: 0 }, statements: { total: 0, covered: 0, skipped: 0, pct: 0 }, functions: { total: 0, covered: 0, skipped: 0, pct: 0 }, branches: { total: 0, covered: 0, skipped: 0, pct: 0 } };

for (const entry of Object.values(normalised)) {
  for (const m of metrics) {
    if (entry.data[m]) {
      total[m].total += entry.data[m].total;
      total[m].covered += entry.data[m].covered;
      total[m].skipped += entry.data[m].skipped || 0;
    }
  }
}

for (const m of metrics) {
  total[m].pct = total[m].total > 0 ? Math.round((total[m].covered / total[m].total) * 10000) / 100 : 0;
}

// Build the output using original-case paths
const result = { total };
for (const entry of Object.values(normalised)) {
  result[entry.originalPath] = entry.data;
}
writeFileSync(summaryPath, JSON.stringify(result, null, 2), 'utf8');

console.log('Coverage summary fixed:');
console.log(`  Lines:      ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`);
console.log(`  Statements: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`);
console.log(`  Functions:  ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`);
console.log(`  Branches:   ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`);
