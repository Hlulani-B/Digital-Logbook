/**
 * Generate a combined Markdown coverage summary table for all backend services
 * and print it to stdout (visible in Gitea Actions step logs).
 *
 * Usage:  node scripts/backend-coverage-summary.js
 *
 * Reads coverage-summary.json from each service's coverage/ directory.
 */

import { readFileSync, appendFileSync, existsSync } from 'fs';
import { resolve, dirname, relative, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const SERVICES = ['auth-service', 'dashboard-service', 'profile-service', 'project-service'];

// Collect coverage data per service
const serviceData = {};
let grandTotal = { statements: { covered: 0, total: 0 }, branches: { covered: 0, total: 0 }, functions: { covered: 0, total: 0 }, lines: { covered: 0, total: 0 } };

for (const service of SERVICES) {
  const summaryPath = resolve(rootDir, 'services', service, 'coverage', 'coverage-summary.json');
  if (!existsSync(summaryPath)) {
    console.log(` No coverage-summary.json found for ${service} — skipping.`);
    continue;
  }
  const data = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const total = data.total;
  serviceData[service] = { total, files: Object.entries(data).filter(([k]) => k !== 'total') };

  // Accumulate grand totals
  for (const metric of ['statements', 'branches', 'functions', 'lines']) {
    grandTotal[metric].covered += total[metric]?.covered ?? 0;
    grandTotal[metric].total += total[metric]?.total ?? 0;
  }
}

// Helper: colour-code a percentage with emoji
function pct(p) {
  const n = typeof p === 'number' ? p : parseFloat(p);
  if (isNaN(n)) return '—';
  const icon = n >= 80 ? '\u{1F7E2}' : n >= 60 ? '\u{1F7E1}' : '\u{1F534}';
  return `${icon} ${n.toFixed(1)}%`;
}

function pctVal(metric) {
  const { covered, total } = grandTotal[metric];
  if (total === 0) return { pct: 0, covered, total };
  return { pct: (covered / total) * 100, covered, total };
}

// Build Markdown
const lines = [];
lines.push('## Backend Code Coverage (All Services)');
lines.push('');

// Overall totals
const stmts = pctVal('statements');
const branch = pctVal('branches');
const funcs = pctVal('functions');
const ln = pctVal('lines');

lines.push('| Metric | Coverage |');
lines.push('| --- | --- |');
lines.push(`| Statements | ${pct(stmts.pct)} (${stmts.covered}/${stmts.total}) |`);
lines.push(`| Branches | ${pct(branch.pct)} (${branch.covered}/${branch.total}) |`);
lines.push(`| Functions | ${pct(funcs.pct)} (${funcs.covered}/${funcs.total}) |`);
lines.push(`| Lines | ${pct(ln.pct)} (${ln.covered}/${ln.total}) |`);
lines.push('');

// Per-service summary
lines.push('<details>');
lines.push('<summary>Per-service breakdown</summary>');
lines.push('');
lines.push('| Service | % Stmts | % Branch | % Funcs | % Lines |');
lines.push('| --- | --- | --- | --- | --- |');
for (const [service, data] of Object.entries(serviceData)) {
  const t = data.total;
  const sPct = t.statements?.total ? (t.statements.covered / t.statements.total) * 100 : 0;
  const bPct = t.branches?.total ? (t.branches.covered / t.branches.total) * 100 : 0;
  const fPct = t.functions?.total ? (t.functions.covered / t.functions.total) * 100 : 0;
  const lPct = t.lines?.total ? (t.lines.covered / t.lines.total) * 100 : 0;
  lines.push(`| ${service} | ${pct(sPct)} | ${pct(bPct)} | ${pct(fPct)} | ${pct(lPct)} |`);
}
lines.push('');
lines.push('</details>');
lines.push('');

// Per-file breakdown (all services combined, sorted worst-first)
const allFiles = [];
for (const [service, data] of Object.entries(serviceData)) {
  for (const [filePath, metrics] of data.files) {
    const rel = relative(resolve(rootDir, 'services', service), filePath).replace(/\\/g, '/');
    const short = `${service}/${rel}`;
    allFiles.push({
      file: short,
      stmts: metrics.statements?.pct ?? 0,
      branch: metrics.branches?.pct ?? 0,
      funcs: metrics.functions?.pct ?? 0,
      lines: metrics.lines?.pct ?? 0,
    });
  }
}
allFiles.sort((a, b) => a.lines - b.lines);

lines.push('<details>');
lines.push('<summary>Per-file breakdown</summary>');
lines.push('');
lines.push('| File | % Stmts | % Branch | % Funcs | % Lines |');
lines.push('| --- | --- | --- | --- | --- |');
for (const f of allFiles) {
  lines.push(`| ${f.file} | ${pct(f.stmts)} | ${pct(f.branch)} | ${pct(f.funcs)} | ${pct(f.lines)} |`);
}
lines.push('');
lines.push('</details>');
lines.push('');

const markdown = lines.join('\n');

// Always print to stdout (visible in step logs for both GitHub and Gitea)
console.log(markdown);

// Also write to step summary if the env var is set (GitHub Actions)
const stepSummary = process.env.GITHUB_STEP_SUMMARY;
if (stepSummary) {
  appendFileSync(stepSummary, markdown);
}
