import { describe, expect, it, vi } from 'vitest';
import {
  buildExportBundle,
  attachmentKey,
  exportToCSV,
  exportToICS,
  exportToJSON,
  exportToMarkdown,
} from '@/lib/export';
import {
  parseCSVImport,
  parseJSONImport,
  parseMarkdownImport,
  parseImport,
  restoreImport,
  type ImportAdapters,
} from '@/lib/import';

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

  it('rejects malformed entry rows by position while preserving new status values', () => {
    const result = parseJSONImport(
      JSON.stringify({
        projects: [],
        entries: [
          { project_name: 'Alpha', status: 'up_next' },
          { project_name: '', status: 'up_next' },
          { project_name: 'Beta', status: 'future_status' },
        ],
      })
    );
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0].line).toBe(2);
    expect(result.rejections[0].reason).toMatch(/project_name/);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[1].status).toBe('future_status');
  });

  it('round-trips v2 backup-only fields and opaque legacy payloads', () => {
    const bundle = buildExportBundle(
      'test@example.com',
      [{ project_name: 'Archived', description: 'Preserved description', archived: true }],
      [
        {
          project_name: 'Archived',
          entries: { title: 'Task', unknown_key: { nested: ['value'] } },
          status: 'future_status',
          summary: 'Saved summary',
          duration: '01:30:00',
          archived: true,
        },
        {
          project_name: 'Archived',
          entries: 'legacy unstructured payload',
          status: 'up_next',
        },
        {
          project_name: 'Archived',
          entries: null,
          status: 'up_next',
        },
      ],
      [{ table_name: 'Archived', field_name: 'risk', data_type: 'text', is_required: true }]
    );

    const result = parseJSONImport(exportToJSON(bundle));

    expect(bundle.version).toBe(3);
    expect(result.rejections).toHaveLength(0);
    expect(result.projects).toEqual([
      { project_name: 'Archived', description: 'Preserved description', archived: true },
    ]);
    expect(result.fields).toEqual([
      { table_name: 'Archived', field_name: 'risk', data_type: 'text', is_required: true },
    ]);
    expect(result.entries[0]).toMatchObject({
      entries: { title: 'Task', unknown_key: { nested: ['value'] } },
      summary: 'Saved summary',
      duration: '01:30:00',
      archived: true,
      status: 'future_status',
    });
    expect(result.entries[1].entries).toBe('legacy unstructured payload');
    expect(result.entries[2].entries).toBeNull();
  });

  it('migrates v1 JSON bundles to the v2 in-memory shape', () => {
    const result = parseJSONImport(
      JSON.stringify({
        version: 1,
        projects: [{ project_name: 'Legacy', description: 'Old format', archived: false }],
        entries: [
          {
            project_name: 'Legacy',
            entries: 'legacy payload',
            status: 'up_next',
            archived: false,
          },
        ],
      })
    );

    expect(result.rejections).toHaveLength(0);
    expect(result.fields).toEqual([]);
    expect(result.entries[0]).toMatchObject({
      entries: 'legacy payload',
      summary: null,
      duration: null,
    });
  });

  it('refuses unsupported future backup versions', () => {
    const result = parseJSONImport(JSON.stringify({ version: 4, projects: [], entries: [] }));

    expect(result.projects).toEqual([]);
    expect(result.fields).toEqual([]);
    expect(result.entries).toEqual([]);
    expect(result.rejections).toEqual([{ line: 'N/A', reason: 'Unsupported export version: 4' }]);
  });
});

describe('JSON v3 schema and atomic restore', () => {
  function fixture() {
    return buildExportBundle(
      'foreign@example.com',
      [
        {
          project_name: 'P',
          schema_revision: 7,
          template: { id: 'template', revision: 3, kind: 'personal' },
        },
      ],
      [
        {
          project_name: 'P',
          entries: {
            Tags: ['old-option'],
            Amount: { amount: '9007199254740993.001', currency: 'USD' },
          },
        },
      ],
      [
        {
          table_name: 'P',
          id: 'old-field',
          field_name: 'Tags',
          data_type: 'multiselect',
          is_required: true,
          is_unique: false,
          rules: {},
          has_default: true,
          default_value: ['old-option'],
          display_order: 4,
          options: [{ id: 'old-option', label: 'Work', value: 'work' }],
        },
      ]
    );
  }
  function adapters(): ImportAdapters {
    return {
      isOnline: () => true,
      addProject: vi
        .fn()
        .mockResolvedValue({
          success: true,
          data: {
            schema_revision: 1,
            fields: [
              {
                field_name: 'Tags',
                id: 'new-field',
                data_type: 'multiselect',
                options: [{ id: 'new-option', label: 'Work', value: 'work' }],
                default_value: ['new-option'],
              },
            ],
          },
        }),
      addEntry: vi.fn().mockResolvedValue({ success: true, data: { id: 'new-entry' } }),
      archiveEntry: vi.fn().mockResolvedValue({ success: true }),
      archiveProject: vi.fn().mockResolvedValue({ success: true }),
      uploadFieldAttachment: vi
        .fn()
        .mockResolvedValue({ success: true, data: { attachmentId: 'new-asset' } }),
    };
  }
  it('preserves every declared type, rules, defaults, options, order and provenance exactly', () => {
    const bundle = fixture();
    const types = [
      'text',
      'markdown',
      'integer',
      'float',
      'number',
      'date',
      'timestamp',
      'boolean',
      'select',
      'multiselect',
      'geolocation',
      'currency',
      'file',
      'image',
    ];
    types.forEach((data_type, index) =>
      bundle.fields.push({
        table_name: 'P',
        field_name: `f${index}`,
        data_type,
        is_required: false,
        is_unique: false,
        has_default: false,
        default_value: null,
        display_order: index,
        rules: { min: '0.001', max: 100, minLength: 0, maxLength: 20, pattern: '[a-z]+' },
      })
    );
    bundle.fields.push({
      table_name: 'P',
      field_name: 'null-default',
      data_type: 'text',
      is_required: false,
      has_default: true,
      default_value: null,
    });
    const result = parseJSONImport(exportToJSON(bundle));
    expect(result.rejections).toEqual([]);
    expect(result.fields).toEqual(bundle.fields);
    expect(result.projects).toEqual(bundle.projects);
    expect(result.entries).toEqual(bundle.entries);
  });
  it.each([null, false, 0, 'opaque', ['opaque', { nested: 4 }]])(
    'keeps opaque payload %j unchanged',
    (entries) => {
      const bundle = buildExportBundle(
        'a',
        [{ project_name: 'P' }],
        [{ project_name: 'P', entries }]
      );
      expect(parseJSONImport(exportToJSON(bundle)).entries[0].entries).toEqual(entries);
    }
  );
  it('still reads explicit v2 and rejects malformed rows without throwing', () => {
    const result = parseJSONImport(
      JSON.stringify({ version: 2, projects: [null], fields: [null], entries: [null, 1, []] })
    );
    expect(result.rejections).toHaveLength(5);
    expect(parseJSONImport(JSON.stringify({ ...fixture(), version: 2 })).fields).toHaveLength(1);
  });
  it('creates project and schema once, maps option IDs and uses the signed-in owner', async () => {
    const result = parseJSONImport(exportToJSON(fixture()));
    const api = adapters();
    const outcome = await restoreImport(result, 'local@example.com', api);
    expect(outcome).toMatchObject({ projects: 1, fields: 1, entries: 1, failures: [] });
    expect(api.addProject).toHaveBeenCalledExactlyOnceWith(
      'local@example.com',
      'P',
      '',
      expect.objectContaining({ fields: result.fields, schema_revision: 7 })
    );
    expect(api.addEntry).toHaveBeenCalledWith(
      'local@example.com',
      expect.objectContaining({
        entries: {
          Tags: ['new-option'],
          Amount: { amount: '9007199254740993.001', currency: 'USD' },
        },
      }),
      1
    );
    expect(result.entries[0].entries).toMatchObject({ Tags: ['old-option'] });
  });
  it('blocks a partially invalid schema rather than silently dropping its fields', async () => {
    const bundle = fixture();
    const result = parseJSONImport(
      JSON.stringify({ ...bundle, fields: [...bundle.fields, { table_name: 'P', field_name: '' }] })
    );
    const api = adapters();
    const outcome = await restoreImport(result, 'local', api);
    expect(api.addProject).not.toHaveBeenCalled();
    expect(api.addEntry).not.toHaveBeenCalled();
    expect(outcome.notRestored).toHaveLength(1);
  });
  it('keeps successful counts when another entry fails with field errors', async () => {
    const result = parseJSONImport(exportToJSON(fixture()));
    result.entries.push({ ...result.entries[0] });
    const api = adapters();
    vi.mocked(api.addEntry).mockResolvedValueOnce({
      success: false,
      errors: { Tags: [{ code: 'unique', message: 'Already used' }] },
    });
    const outcome = await restoreImport(result, 'local', api);
    expect(outcome.entries).toBe(1);
    expect(outcome.notRestored[0].errors).toEqual({
      Tags: [{ code: 'unique', message: 'Already used' }],
    });
    expect(outcome.failures[0]).toContain('Already used');
  });
  it('never counts optimistic or queued results as persisted', async () => {
    const api = adapters();
    vi.mocked(api.addEntry).mockResolvedValue({
      success: true,
      queued: true,
      data: { id: 'optimistic-1' },
    });
    const outcome = await restoreImport(parseJSONImport(exportToJSON(fixture())), 'local', api);
    expect(outcome.entries).toBe(0);
    expect(outcome.notRestored).toHaveLength(1);
  });
  it('does not write while offline', async () => {
    const api = adapters();
    api.isOnline = () => false;
    const outcome = await restoreImport(parseJSONImport(exportToJSON(fixture())), 'local', api);
    expect(api.addProject).not.toHaveBeenCalled();
    expect(outcome.failures).toHaveLength(1);
  });
  it('exports a credential-free manifest and requires explicit reupload to new field IDs', async () => {
    const bundle = buildExportBundle(
      'foreign',
      [{ project_name: 'P' }],
      [
        {
          project_name: 'P',
          entries: {
            Receipt: {
              attachmentId: 'foreign-id',
              signedUrl: 'secret-url',
              storage_key: 'private-key',
              bytes: 'base64',
            },
          },
        },
      ],
      [{ table_name: 'P', field_name: 'Receipt', data_type: 'file', id: 'old-field' }]
    );
    const json = exportToJSON(bundle);
    expect(json).not.toMatch(/secret-url|private-key|base64/);
    expect(bundle.attachments[0]).toMatchObject({
      binary_included: false,
      attachment_id: 'foreign-id',
    });
    const result = parseJSONImport(JSON.stringify({ ...bundle, attachments: [] }));
    const api = adapters();
    vi.mocked(api.addProject).mockResolvedValue({
      success: true,
      fields: [
        {
          table_name: 'P',
          field_name: 'Receipt',
          data_type: 'file',
          is_required: false,
          id: 'new-field',
        },
      ],
    });
    const missing = await restoreImport(result, 'local', api);
    expect(missing.notRestored[0].reason).toContain('reupload required');
    expect(api.addEntry).not.toHaveBeenCalled();
    const file = new File(['receipt'], 'receipt.txt');
    const restored = await restoreImport(
      result,
      'local',
      api,
      new Map([[attachmentKey(result.attachments![0]), file]])
    );
    expect(restored.entries).toBe(1);
    expect(api.uploadFieldAttachment).toHaveBeenCalledWith({
      email: 'local',
      projectName: 'P',
      fieldId: 'new-field',
      file,
    });
    expect(api.addEntry).toHaveBeenCalledWith(
      'local',
      expect.objectContaining({ entries: { Receipt: { attachmentId: 'new-asset' } } }),
      undefined
    );
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

  it('keeps opaque historical payloads readable in event titles', () => {
    const bundle = buildExportBundle(
      'test@example.com',
      [],
      [
        {
          project_name: 'Test',
          entries: 0,
          due_date: '2026-09-10',
          priority: null,
          status: 'up_next',
          started_at: null,
          ended_at: null,
          duration: null,
          archived: false,
        },
        {
          project_name: 'Test',
          entries: false,
          due_date: '2026-09-11',
          priority: null,
          status: 'up_next',
          started_at: null,
          ended_at: null,
          duration: null,
          archived: false,
        },
        {
          project_name: 'Test',
          entries: ['Legacy task'],
          due_date: '2026-09-12',
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

    expect(ics).toContain('SUMMARY:0');
    expect(ics).toContain('SUMMARY:false');
    expect(ics).toContain('SUMMARY:["Legacy task"]');
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
