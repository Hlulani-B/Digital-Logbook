import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { StatsView } from '../StatsView';

type Row = Record<string, unknown>;
type Definition = { field_name: string; data_type: string; options?: Row[] };
type CacheResult = { data: Row[] };
type Listener = () => void | Promise<void>;

const mocks = vi.hoisted(() => ({
  cacheGet: vi.fn<(store: string, key: string) => Promise<CacheResult | undefined>>(),
  cacheSubscribe: vi.fn<(store: string, key: string, callback: Listener) => () => void>(),
  getFields: vi.fn<(email: string, project: string) => Promise<CacheResult>>(),
  syncAllData: vi.fn<() => Promise<void>>(),
  computeDueSoon: vi.fn<() => Row[]>(),
  fetch: vi.fn(),
}));

vi.mock('@/components/NavBar', () => ({ NavBar: () => <nav aria-label="Main navigation" /> }));
vi.mock('@/components/Header', () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'stats@example.test' } }),
}));
vi.mock('@/hooks/useNow', () => ({ useNow: () => Date.parse('2026-03-12T12:00:00Z') }));
vi.mock('@/CacheFunctions', () => ({
  syncAllData: mocks.syncAllData,
  computeDueSoon: mocks.computeDueSoon,
}));
vi.mock('@/functions/project/fields.js', () => ({ getFields: mocks.getFields }));
vi.mock('@/lib/cache', () => ({
  cacheGet: mocks.cacheGet,
  cacheSubscribe: mocks.cacheSubscribe,
  CACHE_STORES: { ALL_ENTRIES: 'all_entries', PROJECTS: 'projects', FIELDS: 'fields' },
}));

// The statistics engine and schema normalization deliberately remain real.
const EMAIL = 'stats@example.test';
const FIELD_KEY = `${EMAIL}:Alpha`;
const cache = new Map<string, CacheResult>();
const listeners = new Map<string, Set<Listener>>();
let user: ReturnType<typeof userEvent.setup>;
let nextId = 0;

function definitions(): Definition[] {
  const options = [
    { id: 'a', label: 'Research' },
    { id: 'b', label: 'Review' },
  ];
  return [
    { field_name: 'Score', data_type: 'number' },
    { field_name: 'Stage', data_type: 'select', options },
    { field_name: 'Approved', data_type: 'boolean' },
    { field_name: 'Observed', data_type: 'date' },
    { field_name: 'Notes', data_type: 'text' },
    { field_name: 'Tags', data_type: 'multiselect', options },
    { field_name: 'Attachment', data_type: 'file' },
  ];
}

function entry(values: Row = {}, date = '2026-03-10', overrides: Row = {}): Row {
  return {
    id: `synthetic-${++nextId}`,
    project_name: 'Alpha',
    created_at: `${date}T12:00:00Z`,
    entries: values,
    ...overrides,
  };
}

function put(store: string, key: string, data: Row[]) {
  cache.set(`${store}:${key}`, { data });
}

async function publish(store: string, key: string, data: Row[]) {
  put(store, key, data);
  await act(async () => {
    await Promise.all([...(listeners.get(`${store}:${key}`) || [])].map((callback) => callback()));
  });
}

function NavigationHarness() {
  const location = useLocation();
  return (
    <>
      <Link to="/stats?project=Alpha">Switch to Alpha</Link>
      <Link to="/stats?project=Beta">Switch to Beta</Link>
      <output aria-label="Current stats query">{location.search}</output>
    </>
  );
}

function mount(project = 'Alpha') {
  return render(
    <MemoryRouter
      initialEntries={[`/stats${project ? `?project=${encodeURIComponent(project)}` : ''}`]}
    >
      <NavigationHarness />
      <StatsView />
    </MemoryRouter>
  );
}

async function ready() {
  return within(await screen.findByRole('region', { name: 'Field analysis' }));
}

function analysis() {
  return within(screen.getByRole('region', { name: 'Field analysis' }));
}

async function choose(control: string, value: string) {
  await user.selectOptions(analysis().getByRole('combobox', { name: control, exact: true }), value);
}

function optionValues(select: HTMLElement) {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.getAttribute('value'));
}

async function completeTable(name: string) {
  await user.click(analysis().getByText('View complete data'));
  return analysis().getByRole('table', { name });
}

function cells(table: HTMLElement, rowName: string) {
  const row = within(table).getByRole('rowheader', { name: rowName, exact: true }).closest('tr');
  if (!row) throw new Error(`Missing row: ${rowName}`);
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

function cardValue(label: string) {
  const card = screen.getByText(label, { exact: true }).closest('.stat-card');
  if (!card) throw new Error(`Missing overview card: ${label}`);
  return card.querySelector('.stat-card-value')?.textContent;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  cache.clear();
  listeners.clear();
  nextId = 0;
  user = userEvent.setup();
  mocks.cacheGet.mockImplementation(async (store, key) => cache.get(`${store}:${key}`));
  mocks.cacheSubscribe.mockImplementation((store, key, callback) => {
    const id = `${store}:${key}`;
    const callbacks = listeners.get(id) || new Set<Listener>();
    callbacks.add(callback);
    listeners.set(id, callbacks);
    return vi.fn(() => {
      callbacks.delete(callback);
    });
  });
  mocks.getFields.mockResolvedValue({ data: [] });
  mocks.syncAllData.mockResolvedValue(undefined);
  mocks.computeDueSoon.mockReturnValue([]);
  mocks.fetch.mockImplementation(() => {
    throw new Error('Unexpected network request');
  });
  vi.stubGlobal('fetch', mocks.fetch);
  put('projects', EMAIL, [{ project_name: 'Alpha' }, { project_name: 'Beta' }]);
  put('fields', FIELD_KEY, definitions());
  put('fields', `${EMAIL}:Beta`, definitions());
  put('all_entries', EMAIL, [
    entry({
      Score: 4,
      Stage: 'a',
      Approved: true,
      Observed: '2026-03-05',
      Notes: 'First note',
      Tags: ['a', 'b'],
      Attachment: { name: 'synthetic.txt' },
    }),
    entry(
      {
        Score: 8,
        Stage: 'b',
        Approved: false,
        Observed: '2026-03-07',
        Notes: 'Second note',
        Tags: ['b'],
      },
      '2026-03-12'
    ),
    entry({ Score: 999, Notes: 'Outside this project' }, '2026-03-12', { project_name: 'Beta' }),
  ]);
});

afterEach(() => {
  cleanup();
  try {
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect([...listeners.values()].every((callbacks) => callbacks.size === 0)).toBe(true);
  } finally {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});

describe('StatsView field analysis', () => {
  it.each([
    { field: 'Score', type: 'number', view: 'bars', views: ['bars', 'trend', 'grouped'] },
    { field: 'Stage', type: 'select', view: 'bars', views: ['bars', 'donut', 'grouped'] },
    { field: 'Approved', type: 'boolean', view: 'donut', views: ['donut', 'bars', 'grouped'] },
    { field: 'Observed', type: 'date', view: 'trend', views: ['trend'] },
    { field: 'Notes', type: 'text', view: 'search', views: ['search'] },
    { field: 'Tags', type: 'multiselect', view: 'bars', views: ['bars'] },
    { field: 'Attachment', type: 'file', view: 'summary', views: ['summary'] },
  ])(
    'offers only eligible views and the correct default for $type',
    async ({ field, type, view, views }) => {
      mount();
      await ready();
      expect(analysis().getByRole('option', { name: `${field} (${type})` })).toBeInTheDocument();
      await choose('Field', field);
      const selector = analysis().getByRole('combobox', { name: 'View', exact: true });
      expect(selector).toHaveValue(view);
      expect(optionValues(selector)).toEqual(views);
      expect(analysis().queryByRole('combobox', { name: 'Compare by' })).not.toBeInTheDocument();
      if (type === 'number') {
        const aggregation = analysis().getByRole('combobox', { name: 'Aggregation' });
        expect(aggregation).toHaveValue('sum');
        expect(optionValues(aggregation)).toEqual(['sum', 'average']);
      } else {
        expect(analysis().queryByRole('combobox', { name: 'Aggregation' })).not.toBeInTheDocument();
      }
      if (view === 'summary') {
        expect(analysis().getByText(/Coverage only:/)).toBeInTheDocument();
        expect(analysis().queryByRole('img')).not.toBeInTheDocument();
        expect(analysis().queryByRole('table')).not.toBeInTheDocument();
      }
    }
  );

  it('keeps custom fields out of the global activity selector and does not load global definitions', async () => {
    put('all_entries', EMAIL, [
      entry({ Score: 4 }, '2026-03-10', {
        started_at: '2026-03-10T10:00:00Z',
        ended_at: '2026-03-10T11:00:00Z',
      }),
    ]);
    mount('');
    const selector = await screen.findByRole('combobox', { name: 'Series to plot over time' });
    expect(optionValues(selector)).toEqual(['activity:entries', 'activity:time']);
    expect(
      within(selector)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Entries per day', 'Time tracked per day']);
    await user.selectOptions(selector, 'activity:time');
    expect(selector).toHaveValue('activity:time');
    expect(screen.getByRole('heading', { name: 'My Stats' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Field analysis' })).not.toBeInTheDocument();
    expect(mocks.cacheGet.mock.calls.some(([store]) => store === 'fields')).toBe(false);
    expect(mocks.getFields).not.toHaveBeenCalled();
    expect(mocks.syncAllData).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Switch to Alpha' }));
    await ready();
    expect(
      optionValues(screen.getByRole('combobox', { name: 'Series to plot over time' }))
    ).toEqual(['activity:entries', 'activity:time']);
  });

  it('shows daily sums, averages, and genuine gaps without joining the trend across missing days', async () => {
    put('all_entries', EMAIL, [
      entry({ Score: 4 }),
      entry({ Score: 8 }),
      entry({ Score: -6 }, '2026-03-12'),
      entry({}, '2026-03-11'),
      entry({ Score: 'invalid' }, '2026-03-11'),
      entry({ Score: 20 }, '2026-03-10', { created_at: 'not-a-date' }),
      entry({ Score: 999 }, '2026-03-12', { project_name: 'Beta' }),
    ]);
    mount();
    await ready();
    expect(
      analysis().getByText(/Full project: 5 filled of 6 entries · 1 missing · 1 invalid/)
    ).toBeInTheDocument();
    expect(analysis().getByText(/1 valid values excluded from daily charts/)).toBeInTheDocument();
    const table = await completeTable('Score daily values');
    expect(within(table).getAllByRole('row')).toHaveLength(61);
    expect(cells(table, '2026-03-10')).toEqual(['12']);
    expect(cells(table, '2026-03-11')).toEqual(['0']);
    expect(cells(table, '2026-03-12')).toEqual(['-6']);
    await choose('Aggregation', 'average');
    expect(cells(table, '2026-03-10')).toEqual(['6']);
    expect(cells(table, '2026-03-11')).toEqual(['No observations']);
    expect(cells(table, '2026-03-12')).toEqual(['-6']);
    expect(analysis().getByText(/Gaps mean no observations, not zero/)).toBeInTheDocument();
    await choose('View', 'trend');
    const chart = analysis().getByRole('img', { name: 'Score — Trend' });
    const path = chart.querySelector('path.trend-line')?.getAttribute('d') || '';
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path).not.toContain('L');
    expect(path).not.toMatch(/NaN|Infinity/);
    expect(chart.querySelectorAll('circle')).toHaveLength(2);
    expect(within(chart).getByText('2026-03-10: 6')).toBeInTheDocument();
    expect(within(chart).getByText('2026-03-12: -6')).toBeInTheDocument();
  });

  it('gates comparison partners and renders negative grouped sums and averages below zero', async () => {
    put('all_entries', EMAIL, [
      entry({ Score: -8, Stage: 'a' }),
      entry({ Score: 4, Stage: 'a' }),
      entry({ Score: 6, Stage: 'b' }, '2026-03-12'),
      entry({ Score: 2 }),
      entry({ Score: 3, Stage: {} }),
      entry({ Score: 7, Stage: 'a' }, '', { created_at: null }),
    ]);
    mount();
    await ready();
    await choose('View', 'grouped');
    const partner = analysis().getByRole('combobox', { name: 'Compare by' });
    expect(optionValues(partner)).toEqual(['Stage', 'Approved']);
    expect(partner).toHaveValue('Stage');
    expect(
      analysis().getByText(/3 entries excluded for missing or invalid comparison values or dates/)
    ).toBeInTheDocument();
    const table = await completeTable('Score by Stage');
    expect(cells(table, '2026-03-10')).toEqual(['-4', '0']);
    expect(cells(table, '2026-03-12')).toEqual(['0', '6']);
    const chart = analysis().getByRole('img', { name: 'Score — Grouped comparison' });
    const negativeBar = within(chart).getByText('2026-03-10 · Research: -4').parentElement!;
    const zeroY = Number(chart.querySelector('line.analysis-zero')?.getAttribute('y1'));
    expect(Number(negativeBar.getAttribute('y'))).toBeCloseTo(zeroY);
    expect(Number(negativeBar.getAttribute('height'))).toBeGreaterThan(0);
    await choose('Aggregation', 'average');
    expect(cells(table, '2026-03-10')).toEqual(['-2', 'No observations']);
    await choose('Field', 'Stage');
    expect(analysis().getByRole('combobox', { name: 'View', exact: true })).toHaveValue('bars');
    expect(analysis().queryByRole('combobox', { name: 'Compare by' })).not.toBeInTheDocument();
    await choose('View', 'grouped');
    expect(optionValues(analysis().getByRole('combobox', { name: 'Compare by' }))).toEqual([
      'Approved',
    ]);
  });

  it('enables grouping only with a valid partner and resets when that partner changes type', async () => {
    put('fields', FIELD_KEY, [{ field_name: 'Score', data_type: 'number' }]);
    put('all_entries', EMAIL, [entry({ Score: 4 })]);
    mount();
    await ready();
    expect(optionValues(analysis().getByRole('combobox', { name: 'View', exact: true }))).toEqual([
      'bars',
      'trend',
    ]);
    await publish('fields', FIELD_KEY, definitions().slice(0, 2));
    await choose('View', 'grouped');
    expect(analysis().getByRole('combobox', { name: 'Compare by' })).toHaveValue('Stage');
    await publish('fields', FIELD_KEY, [
      { field_name: 'Score', data_type: 'number' },
      { field_name: 'Stage', data_type: 'text' },
    ]);
    expect(analysis().getByRole('combobox', { name: 'View', exact: true })).toHaveValue('bars');
    expect(optionValues(analysis().getByRole('combobox', { name: 'View', exact: true }))).toEqual([
      'bars',
      'trend',
    ]);
    expect(analysis().queryByRole('combobox', { name: 'Compare by' })).not.toBeInTheDocument();
  });

  it('caps category charts while retaining every category in the expandable complete table', async () => {
    put(
      'all_entries',
      EMAIL,
      Array.from({ length: 8 }, (_, index) => entry({ Stage: `Category ${index + 1}` }))
    );
    mount();
    await ready();
    await choose('Field', 'Stage');
    await choose('View', 'donut');
    const legend = analysis().getByRole('list', { name: 'Chart legend' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(6);
    expect(within(legend).getByText('Other (remaining): 3 (37.5%)')).toBeInTheDocument();
    expect(within(legend).queryByText(/Category 8/)).not.toBeInTheDocument();
    const summary = analysis().getByText('View complete data');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    const table = await completeTable('Stage frequencies');
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(within(table).getAllByRole('row')).toHaveLength(9);
    expect(cells(table, 'Category 8')).toEqual(['1']);
    expect(
      within(table).queryByRole('rowheader', { name: 'Other (remaining)' })
    ).not.toBeInTheDocument();
  });

  it('uses Yes/No labels and excludes missing and invalid booleans from composition percentages', async () => {
    put('all_entries', EMAIL, [
      entry({ Approved: true }),
      entry({ Approved: false }),
      entry({ Approved: 'true' }),
      entry({}),
      entry({ Approved: null }),
      entry({ Approved: 'maybe' }),
    ]);
    mount();
    await ready();
    await choose('Field', 'Approved');
    expect(
      analysis().getByText(/Full project: 4 filled of 6 entries · 2 missing · 1 invalid/)
    ).toBeInTheDocument();
    const legend = analysis().getByRole('list', { name: 'Chart legend' });
    expect(within(legend).getByText('Yes: 2 (66.7%)')).toBeInTheDocument();
    expect(within(legend).getByText('No: 1 (33.3%)')).toBeInTheDocument();
    expect(cells(await completeTable('Approved frequencies'), 'No')).toEqual(['1']);
    await publish('all_entries', EMAIL, [entry({ Approved: true }), entry({})]);
    expect(
      within(analysis().getByRole('list', { name: 'Chart legend' })).getByText('No: 0 (0.0%)')
    ).toBeInTheDocument();
  });

  it('buckets date fields by their UTC field value rather than the entry creation date', async () => {
    put('all_entries', EMAIL, [
      entry({ Observed: '2026-01-01T23:30:00-02:00' }),
      entry({ Observed: '2026-01-02' }),
      entry({ Observed: '2026-02-30' }),
      entry({}),
    ]);
    mount();
    await ready();
    await choose('Field', 'Observed');
    expect(
      analysis().getByText(/Entry counts by Observed value \(UTC\), not entry creation date/)
    ).toBeInTheDocument();
    expect(
      analysis().getByText(/Full project: 3 filled of 4 entries · 1 missing · 1 invalid/)
    ).toBeInTheDocument();
    const table = await completeTable('Observed daily values');
    expect(
      within(table).getByRole('columnheader', { name: 'Field date (UTC)' })
    ).toBeInTheDocument();
    expect(cells(table, '2026-01-02')).toEqual(['2']);
    expect(cells(table, '2026-01-01')).toEqual(['0']);
    expect(within(table).queryByRole('rowheader', { name: '2026-03-10' })).not.toBeInTheDocument();
  });

  it('searches all text values literally and case-insensitively, renders markup safely, and resets per field', async () => {
    const markup = '<img src=x onerror="alert(1)">';
    put('all_entries', EMAIL, [
      ...Array.from({ length: 8 }, (_, index) =>
        entry({ Notes: `Frequent ${index}`, OtherNotes: 'Other text' })
      ),
      entry({ Notes: 'z Rare [a+b].* Needle' }),
      entry({ Notes: markup }),
      entry({ Notes: 'z Rare [a+b].* Needle' }, '2026-03-10', { project_name: 'Beta' }),
    ]);
    mount();
    await ready();
    await choose('Field', 'Notes');
    const input = analysis().getByRole('searchbox', { name: 'Search values' });
    expect(analysis().getByRole('status')).toHaveTextContent('10 matching values');
    const results = analysis().getByRole('region', { name: 'Notes search results' });
    expect(within(results).getByRole('rowheader', { name: markup })).toHaveTextContent(markup);
    expect(results.querySelector('img, script')).toBeNull();
    await user.type(input, '[[A+B].* nEeDlE');
    expect(input).toHaveValue('[A+B].* nEeDlE');
    expect(analysis().getByRole('status')).toHaveTextContent('1 matching values');
    expect(
      cells(analysis().getByRole('table', { name: 'Notes values' }), 'z Rare [a+b].* Needle')
    ).toEqual(['1']);
    await user.clear(input);
    await user.type(input, 'not present');
    expect(analysis().getByText('No matching values.')).toBeInTheDocument();
    await choose('Field', 'OtherNotes');
    expect(analysis().getByRole('searchbox', { name: 'Search values' })).toHaveValue('');
    expect(analysis().getByRole('rowheader', { name: 'Other text' })).toBeInTheDocument();
    await choose('Field', 'Notes');
    expect(analysis().getByRole('searchbox', { name: 'Search values' })).toHaveValue('');
  });

  it('counts multiselect entries once per option without presenting overlapping selections as a donut', async () => {
    put('all_entries', EMAIL, [
      entry({ Tags: ['a', 'a', 'b'] }),
      entry({ Tags: ['b'] }),
      entry({ Tags: [] }),
      entry({ Tags: 'a' }),
    ]);
    mount();
    await ready();
    await choose('Field', 'Tags');
    expect(
      analysis().getByText(/selections overlap, so counts are not composition percentages/)
    ).toBeInTheDocument();
    expect(
      analysis().getByText(/Full project: 3 filled of 4 entries · 1 missing · 1 invalid/)
    ).toBeInTheDocument();
    expect(optionValues(analysis().getByRole('combobox', { name: 'View', exact: true }))).toEqual([
      'bars',
    ]);
    const table = await completeTable('Tags frequencies');
    expect(cells(table, 'Research')).toEqual(['1']);
    expect(cells(table, 'Review')).toEqual(['2']);
  });

  it('retains every declared field when all values are missing, including projects with no entries', async () => {
    put('all_entries', EMAIL, [entry({}), entry({})]);
    mount();
    await ready();
    expect(optionValues(analysis().getByRole('combobox', { name: 'Field', exact: true }))).toEqual(
      definitions().map((def) => def.field_name)
    );
    for (const def of definitions()) {
      await choose('Field', def.field_name);
      expect(
        analysis().getByText(/Full project: 0 filled of 2 entries · 2 missing · 0 invalid/)
      ).toBeInTheDocument();
    }
    expect(screen.queryByText('No stats yet')).not.toBeInTheDocument();
    await publish('all_entries', EMAIL, []);
    expect(
      analysis().getByText(/Full project: 0 filled of 0 entries · 0 missing · 0 invalid/)
    ).toBeInTheDocument();
    expect(
      optionValues(analysis().getByRole('combobox', { name: 'Field', exact: true }))
    ).toHaveLength(7);
    expect(screen.queryByText('No stats yet')).not.toBeInTheDocument();
  });

  it('reinitializes the detail when a same-name field changes type through its cache subscription', async () => {
    mount();
    await ready();
    await choose('Aggregation', 'average');
    await choose('View', 'trend');
    await publish(
      'fields',
      FIELD_KEY,
      definitions().map((def) => (def.field_name === 'Score' ? { ...def, data_type: 'text' } : def))
    );
    expect(analysis().getByRole('combobox', { name: 'Field', exact: true })).toHaveDisplayValue(
      'Score (text)'
    );
    expect(analysis().getByRole('combobox', { name: 'View', exact: true })).toHaveValue('search');
    expect(analysis().queryByRole('combobox', { name: 'Aggregation' })).not.toBeInTheDocument();
    await user.type(analysis().getByRole('searchbox', { name: 'Search values' }), '4');
    await publish('fields', FIELD_KEY, definitions());
    expect(analysis().getByRole('combobox', { name: 'View', exact: true })).toHaveValue('bars');
    expect(analysis().getByRole('combobox', { name: 'Aggregation' })).toHaveValue('sum');
    expect(analysis().queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('refreshes option labels without losing the selected field or compatible view', async () => {
    mount();
    await ready();
    await choose('Field', 'Stage');
    await choose('View', 'donut');
    await publish(
      'fields',
      FIELD_KEY,
      definitions().map((def) =>
        def.field_name === 'Stage'
          ? {
              ...def,
              options: [
                { id: 'a', label: 'Discovery' },
                { id: 'b', label: 'Validation' },
              ],
            }
          : def
      )
    );
    expect(analysis().getByRole('combobox', { name: 'Field', exact: true })).toHaveValue('Stage');
    expect(analysis().getByRole('combobox', { name: 'View', exact: true })).toHaveValue('donut');
    const legend = analysis().getByRole('list', { name: 'Chart legend' });
    expect(within(legend).getByText('Discovery: 1 (50.0%)')).toBeInTheDocument();
    expect(within(legend).getByText('Validation: 1 (50.0%)')).toBeInTheDocument();
    expect(within(legend).queryByText(/Research|Review/)).not.toBeInTheDocument();
    expect(mocks.getFields).not.toHaveBeenCalled();
  });

  it('recomputes the selected analysis and overview from entry cache updates without mixing scopes', async () => {
    mount();
    await ready();
    await choose('View', 'trend');
    await choose('Aggregation', 'average');
    await publish('all_entries', EMAIL, [
      entry({ Score: 10 }),
      entry({ Score: 20 }),
      entry({ Score: 900 }, '2026-03-10', { project_name: 'Beta' }),
    ]);
    expect(analysis().getByRole('combobox', { name: 'View', exact: true })).toHaveValue('trend');
    expect(analysis().getByRole('combobox', { name: 'Aggregation' })).toHaveValue('average');
    expect(cells(await completeTable('Score daily values'), '2026-03-10')).toEqual(['15']);
    expect(cardValue('Total Entries')).toBe('2');
    expect(analysis().getByText(/Full project: 2 filled of 2 entries/)).toBeInTheDocument();
  });

  it('updates active project totals when the keyed projects cache changes', async () => {
    mount('');
    await screen.findByText('Active Projects');
    expect(cardValue('Active Projects')).toBe('2');
    await publish('projects', EMAIL, [
      { project_name: 'Alpha' },
      { project_name: 'Beta', archived: true },
      { project_name: 'Gamma', archived: true },
    ]);
    expect(cardValue('Active Projects')).toBe('1');
    expect(mocks.cacheSubscribe).toHaveBeenCalledWith('projects', EMAIL, expect.any(Function));
    expect(mocks.getFields).not.toHaveBeenCalled();
  });

  it('resets same-name field controls on scope changes and ignores late responses from the old scope', async () => {
    const lateFields = deferred<CacheResult>();
    mount();
    await ready();
    await choose('Field', 'Notes');
    await user.type(analysis().getByRole('searchbox', { name: 'Search values' }), 'First');
    cache.delete(`fields:${FIELD_KEY}`);
    mocks.getFields.mockReturnValueOnce(lateFields.promise);
    // Start a refresh without awaiting it so navigation can overtake the response.
    await act(async () => {
      for (const callback of listeners.get(`fields:${FIELD_KEY}`) || []) void callback();
    });
    expect(mocks.getFields).toHaveBeenCalledWith(EMAIL, 'Alpha');
    await user.click(screen.getByRole('link', { name: 'Switch to Beta' }));
    await ready();
    expect(screen.getByRole('heading', { name: 'Beta — Stats' })).toBeInTheDocument();
    expect(analysis().getByRole('combobox', { name: 'Field', exact: true })).toHaveValue('Score');
    await choose('Field', 'Notes');
    expect(analysis().getByRole('searchbox', { name: 'Search values' })).toHaveValue('');
    expect(analysis().getByRole('rowheader', { name: 'Outside this project' })).toBeInTheDocument();
    expect(listeners.get(`fields:${FIELD_KEY}`)?.size).toBe(0);
    await act(async () => {
      lateFields.resolve({ data: [{ field_name: 'Stale field', data_type: 'boolean' }] });
      await lateFields.promise;
    });
    expect(
      analysis().queryByRole('option', { name: 'Stale field (boolean)' })
    ).not.toBeInTheDocument();
    expect(analysis().getByRole('rowheader', { name: 'Outside this project' })).toBeInTheDocument();
  });

  it('subscribes by store and owner key and cleans up every listener on unmount', async () => {
    const page = mount();
    await ready();
    expect(mocks.cacheSubscribe.mock.calls.map(([store, key]) => `${store}:${key}`)).toEqual([
      `all_entries:${EMAIL}`,
      `projects:${EMAIL}`,
      `fields:${FIELD_KEY}`,
    ]);
    const reads = mocks.cacheGet.mock.calls.length;
    await publish('fields', `${EMAIL}:Beta`, [{ field_name: 'Unrelated', data_type: 'text' }]);
    await publish('all_entries', 'another@example.test', [entry({ Score: 1000 })]);
    expect(mocks.cacheGet).toHaveBeenCalledTimes(reads);
    expect(analysis().queryByRole('option', { name: 'Unrelated (text)' })).not.toBeInTheDocument();
    const unsubscribes = mocks.cacheSubscribe.mock.results.map((result) => result.value);
    page.unmount();
    for (const unsubscribe of unsubscribes) expect(unsubscribe).toHaveBeenCalledTimes(1);
    await publish('fields', FIELD_KEY, definitions());
    await publish('all_entries', EMAIL, []);
    await publish('projects', EMAIL, []);
    expect(mocks.cacheGet).toHaveBeenCalledTimes(reads);
  });

  it('waits for missing field definitions from the mocked fallback before selecting a type-aware view', async () => {
    const pending = deferred<CacheResult>();
    cache.delete(`fields:${FIELD_KEY}`);
    mocks.getFields.mockReturnValueOnce(pending.promise);
    mount();
    expect(await screen.findByText('Loading field definitions...')).toHaveAttribute(
      'role',
      'status'
    );
    expect(screen.queryByRole('region', { name: 'Field analysis' })).not.toBeInTheDocument();
    expect(mocks.getFields).toHaveBeenCalledWith(EMAIL, 'Alpha');
    await act(async () => {
      pending.resolve({ data: definitions() });
      await pending.promise;
    });
    await ready();
    expect(analysis().getByRole('combobox', { name: 'Field', exact: true })).toHaveDisplayValue(
      'Score (number)'
    );
    expect(analysis().getByRole('combobox', { name: 'View', exact: true })).toHaveValue('bars');
    expect(mocks.getFields).toHaveBeenCalledTimes(1);
    expect(mocks.syncAllData).not.toHaveBeenCalled();
  });

  it('clears project scope through the page control and removes the field subscription', async () => {
    mount();
    await ready();
    expect(cardValue('Total Entries')).toBe('2');
    await user.click(screen.getByRole('button', { name: 'All projects' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'My Stats' })).toBeInTheDocument()
    );
    expect(screen.getByLabelText('Current stats query')).toBeEmptyDOMElement();
    expect(screen.queryByRole('region', { name: 'Field analysis' })).not.toBeInTheDocument();
    expect(cardValue('Total Entries')).toBe('3');
    expect(listeners.get(`fields:${FIELD_KEY}`)?.size).toBe(0);
    expect(listeners.get(`all_entries:${EMAIL}`)?.size).toBe(1);
    expect(listeners.get(`projects:${EMAIL}`)?.size).toBe(1);
  });
});
