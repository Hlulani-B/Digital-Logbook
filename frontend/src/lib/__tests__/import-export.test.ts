import { describe, expect, it } from 'vitest';
import {
  buildExportBundle,
  exportToCSV,
  exportToICS,
  exportToJSON,
  exportToMarkdown,
} from '@/lib/export';
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

describe('iCalendar export', () => {
  it('generates valid VCALENDAR structure', () => {
    const bundle = sampleBundle();
    const ics = exportToICS(bundle);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//Digital Logbook//EN');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('creates VEVENT for entries with dates', () => {
    const bundle = sampleBundle();
    const ics = exportToICS(bundle);

    // Both sample entries have dates (due_date or started_at)
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('SUMMARY:Task A');
    expect(ics).toContain('SUMMARY:Task B');
  });

  it('uses all-day format for entries with only due_date', () => {
    const bundle = sampleBundle();
    const ics = exportToICS(bundle);

    // Task A has only due_date, so it should be all-day (VALUE=DATE)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260910');
    expect(ics).toContain('DTEND;VALUE=DATE:20260911');
  });

  it('uses datetime format for entries with started_at', () => {
    const bundle = sampleBundle();
    const ics = exportToICS(bundle);

    // Task B has started_at, so it should use datetime format
    expect(ics).toContain('DTSTART:20260911T100000Z');
  });

  it('maps status to iCalendar STATUS', () => {
    const bundle = sampleBundle();
    const ics = exportToICS(bundle);

    // up_next -> TENTATIVE, in_motion -> CONFIRMED
    expect(ics).toContain('STATUS:TENTATIVE');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('maps priority to iCalendar PRIORITY', () => {
    const bundle = sampleBundle();
    const ics = exportToICS(bundle);

    // "Urgent and important" -> PRIORITY:1
    expect(ics).toContain('PRIORITY:1');
  });

  it('includes project name as CATEGORIES', () => {
    const bundle = sampleBundle();
    const ics = exportToICS(bundle);

    expect(ics).toContain('CATEGORIES:Alpha');
    expect(ics).toContain('CATEGORIES:Beta');
  });

  it('escapes special characters per RFC 5545', () => {
    const bundle = buildExportBundle(
      'test@example.com',
      [],
      [
        {
          project_name: 'Test;Project',
          entries: { title: 'Meeting, with commas', description: 'Line 1\nLine 2' },
          due_date: '2026-09-10',
          priority: null,
          status: 'up_next',
          started_at: null,
          ended_at: null,
          duration: null,
          archived: false,
        },
      ]
    );

    const ics = exportToICS(bundle);

    // Semicolons, commas, and newlines should be escaped
    expect(ics).toContain('CATEGORIES:Test\\;Project');
    expect(ics).toContain('SUMMARY:Meeting\\, with commas');
    expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2');
  });

  it('skips entries without any date', () => {
    const bundle = buildExportBundle(
      'test@example.com',
      [],
      [
        {
          project_name: 'Test',
          entries: { title: 'No date task' },
          due_date: null,
          priority: null,
          status: 'up_next',
          started_at: null,
          ended_at: null,
          duration: null,
          archived: false,
        },
      ]
    );

    const ics = exportToICS(bundle);

    // Should not contain a VEVENT for the dateless entry
    expect(ics).not.toContain('BEGIN:VEVENT');
    expect(ics).not.toContain('No date task');
  });

  it('uses CRLF line endings', () => {
    const bundle = sampleBundle();
    const ics = exportToICS(bundle);

    // iCalendar requires CRLF
    expect(ics).toContain('\r\n');
    expect(ics).not.toMatch(/[^\r]\n/);
  });
});
