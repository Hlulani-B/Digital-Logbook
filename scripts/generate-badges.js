/**
 * Generates shields.io-style badge SVGs from coverage-summary.json files.
 * Run from repo root: node scripts/generate-badges.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const SERVICES = ['auth-service', 'dashboard-service', 'profile-service', 'project-service'];
const METRICS = [
  { key: 'lines', label: 'lines' },
  { key: 'statements', label: 'statements' },
  { key: 'functions', label: 'functions' },
  { key: 'branches', label: 'branches' },
];

function colorForPct(pct) {
  if (pct >= 90) return '#49c31a';
  if (pct >= 80) return '#97c40f';
  if (pct >= 70) return '#a0a127';
  if (pct >= 60) return '#cba317';
  if (pct >= 50) return '#df8a0e';
  return '#d94e1f';
}

function generateSVG(label, pctStr, color) {
  const labelWidth = Math.max(label.length * 62 + 60, 200);
  const valueWidth = Math.max(pctStr.length * 75 + 60, 200);
  const totalWidth = labelWidth + valueWidth;

  return `<svg width="${totalWidth / 10}" height="20" viewBox="0 0 ${totalWidth} 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}: ${pctStr}">
  <title>${label}: ${pctStr}</title>
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0" stop-opacity=".1" stop-color="#EEE"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="m"><rect width="${totalWidth}" height="200" rx="30" fill="#FFF"/></mask>
  <g mask="url(#m)">
    <rect width="${labelWidth}" height="200" fill="#555"/>
    <rect width="${valueWidth}" height="200" fill="${color}" x="${labelWidth}"/>
    <rect width="${totalWidth}" height="200" fill="url(#g)"/>
  </g>
  <g aria-hidden="true" fill="#fff" text-anchor="start" font-family="Verdana,DejaVu Sans,sans-serif" font-size="110">
    <text x="60" y="148" textLength="${labelWidth - 100}" fill="#000" opacity="0.25">${label}</text>
    <text x="50" y="138" textLength="${labelWidth - 100}">${label}</text>
    <text x="${labelWidth + 55}" y="148" textLength="${valueWidth - 100}" fill="#000" opacity="0.25">${pctStr}</text>
    <text x="${labelWidth + 45}" y="138" textLength="${valueWidth - 100}">${pctStr}</text>
  </g>
</svg>`;
}

for (const service of SERVICES) {
  const coveragePath = join(repoRoot, 'services', service, 'coverage', 'coverage-summary.json');
  const badgeDir = join(repoRoot, 'badges', service);

  let coverage;
  try {
    coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
  } catch {
    console.log(`[SKIP] ${service}: no coverage-summary.json found`);
    continue;
  }

  mkdirSync(badgeDir, { recursive: true });

  for (const metric of METRICS) {
    const pct = coverage.total[metric.key]?.pct;
    if (pct == null) continue;
    const pctStr = typeof pct === 'number' ? `${pct}%` : `${pct}`;
    const color = colorForPct(typeof pct === 'number' ? pct : parseFloat(pct));
    const svg = generateSVG(metric.label, pctStr, color);
    writeFileSync(join(badgeDir, `${metric.key}.svg`), svg);
    console.log(`[OK] ${service}/${metric.key}: ${pctStr}`);
  }
}

console.log('\nDone!');
