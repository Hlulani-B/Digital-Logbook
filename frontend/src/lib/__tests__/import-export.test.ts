import { describe, expect, it } from 'vitest';
import { buildExportBundle, exportToCSV, exportToJSON, exportToMarkdown } from '@/lib/export';
import { parseCSVImport, parseJSONImport, parseMarkdownImport, parseImport } from '@/lib/import';

const SAMPLE_PROJECTS = [
  { project_name: 'Alpha', description: 'First project', archived: false },
  { project_name: 'Beta', description: 'Second project', archived: true },
];

const SAMPLE_ENTRIES = [
  {
    project_name: 'Alpha',
    entries: { title: 'Task A', dependencies: [2] },
    due_date: '2026-09-10',
    priority: null,
    status: 'up_next',
    started_at: null,
    ended_at: null,
    duration: null,
    archived: false,
  },
  {
    project_name: 'Beta',
    entries: { title: 'Task B' },
    due_date: '2026-09-12',
    priority: 'Urgent and important',
    status: 'in_motion',
    started_at: '2026-09-11T10:00:00.000Z',
    ended_at: null,
    duration: 'PT2H',
    archived: true,
  },
];

function sampleBundle() {
  return buildExportBundle('test@example.com', SAMPLE_PROJECTS, SAMPLE_ENTRIES);
}

describe('JSON round-trip', () => {
  it('export-then-import produces identical row counts', () => {
    const bundle = sampleBundle();
    const json = exportToJSON(bundle);
    const result = parseJSONImport(json);

    expect(result.rejections).toHaveLength(0);
    expect(result.projects).toHaveLength(2);
    expect(result.entries).toHaveLength(2);

    expect(result.projects[0].project_name).toBe('Alpha');
    expect(result.projects[1].archived).toBe(true);
    expect(result.entries[0].project_name).toBe('Alpha');
    expect(result.entries[0].entries).toEqual({ title: 'Task A', dependencies: [2] });
    expect(result.entries[1].status).toBe('in_motion');
    expect(result.entries[1].archived).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const result = parseJSONImport('not json');
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0].reason).toMatch(/Invalid JSON/);
  });

  it('rejects malformed entry rows by position', () => {
    const result = parseJSONImport(
      JSON.stringify({
        projects: [],
        entries: [
          { project_name: 'Alpha', status: 'up_next' },
          { project_name: '', status: 'up_next' },
          { project_name: 'Beta', status: 'bogus' },
        ],
      })
    );
    expect(result.rejections).toHaveLength(2);
    expect(result.rejections[0].line).toBe(2);
    expect(result.rejections[0].reason).toMatch(/project_name/);
    expect(result.rejections[1].line).toBe(3);
    expect(result.rejections[1].reason).toMatch(/status/);
    expect(result.entries).toHaveLength(1);
  });
});

describe('CSV round-trip', () => {
  it('export-then-import produces identical row counts', () => {
    const bundle = sampleBundle();
    const csv = exportToCSV(bundle);
    const result = parseCSVImport(csv);

    expect(result.rejections).toHaveLength(0);
    expect(result.projects).toHaveLength(2);
    expect(result.entries).toHaveLength(2);
  });

  it('reports malformed entry rows by line number', () => {
    const csv = [
      '# entries',
      'project_name,entries,due_date,priority,status,started_at,ended_at,duration,archived',
      'Alpha,"{""title"":""A""}",2026-09-10,,up_next,,,,false',
      ',"{""title"":""B""}",2026-09-11,,up_next,,,,false',
      'Beta,not-json,2026-09-12,,up_next,,,,false',
    ].join('\n');

    const result = parseCSVImport(csv);
    expect(result.entries).toHaveLength(1);
    expect(result.rejections).toHaveLength(2);
    expect(result.rejections[0].line).toBe(4);
    expect(result.rejections[0].reason).toMatch(/project_name/);
    expect(result.rejections[1].line).toBe(5);
    expect(result.rejections[1].reason).toMatch(/entries/);
  });

  it('handles commas and quotes in entries JSON', () => {
    const csv = [
      '# entries',
      'project_name,entries,due_date,priority,status,started_at,ended_at,duration,archived',
      'Alpha,"{""title"":""Has a, comma""}",2026-09-10,,up_next,,,,false',
    ].join('\n');

    const result = parseCSVImport(csv);
    expect(result.rejections).toHaveLength(0);
    expect(result.entries[0].entries).toEqual({ title: 'Has a, comma' });
  });
});

describe('Markdown round-trip', () => {
  it('export-then-import produces identical row counts', () => {
    const bundle = sampleBundle();
    const md = exportToMarkdown(bundle);
    const result = parseMarkdownImport(md);

    expect(result.rejections).toHaveLength(0);
    expect(result.projects).toHaveLength(2);
    expect(result.entries).toHaveLength(2);
  });

  it('reports malformed entry rows by line number', () => {
    const md = [
      '## Entries',
      '',
      '| project_name | entries | due_date | priority | status | started_at | ended_at | duration | archived |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| Alpha | {"title":"A"} | 2026-09-10 | | up_next | | | | false |',
      '| | {"title":"B"} | 2026-09-11 | | up_next | | | | false |',
      '| Beta | not-json | 2026-09-12 | | up_next | | | | false |',
    ].join('\n');

    const result = parseMarkdownImport(md);
    expect(result.entries).toHaveLength(1);
    expect(result.rejections).toHaveLength(2);
    expect(result.rejections[0].line).toBe(6);
    expect(result.rejections[1].line).toBe(7);
  });
});

describe('parseImport format detection', () => {
  it('routes .json files to the JSON parser', () => {
    const result = parseImport(exportToJSON(sampleBundle()), 'export.json');
    expect(result.projects).toHaveLength(2);
    expect(result.entries).toHaveLength(2);
  });

  it('routes .csv files to the CSV parser', () => {
    const result = parseImport(exportToCSV(sampleBundle()), 'export.csv');
    expect(result.projects).toHaveLength(2);
    expect(result.entries).toHaveLength(2);
  });

  it('routes .md files to the Markdown parser', () => {
    const result = parseImport(exportToMarkdown(sampleBundle()), 'export.md');
    expect(result.projects).toHaveLength(2);
    expect(result.entries).toHaveLength(2);
  });

  it('falls back to JSON when extension is missing', () => {
    const result = parseImport(exportToJSON(sampleBundle()), 'data');
    expect(result.projects).toHaveLength(2);
  });
});
