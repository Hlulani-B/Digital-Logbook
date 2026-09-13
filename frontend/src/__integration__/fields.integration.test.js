import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheDelete, cacheGet, CACHE_STORES } from '@/lib/cache';

const mockRequest = vi.fn();
vi.mock('@/lib/api', () => ({
  request: (...args) => mockRequest(...args),
  PROJECT_URL: 'http://localhost:5003',
}));

const { addField, deleteField, editField } = await import('@/functions/project/fields.js');

const EMAIL = 'fields@test.com';
const PROJECT = 'Format test';
const FIELD_CACHE_KEY = `${EMAIL}:${PROJECT}`;

function requestBody(callIndex) {
  return JSON.parse(mockRequest.mock.calls[callIndex][1].body);
}

describe('Field format mutations', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await Promise.all([
      cacheDelete(CACHE_STORES.FIELDS, FIELD_CACHE_KEY),
      cacheDelete(CACHE_STORES.ENTRIES, FIELD_CACHE_KEY),
      cacheDelete(CACHE_STORES.ALL_ENTRIES, EMAIL),
    ]);
  });

  it('adds a field and refreshes active field metadata', async () => {
    mockRequest
      .mockResolvedValueOnce({ success: true, message: 'Field added successfully' })
      .mockResolvedValueOnce({
        success: true,
        data: [{ field_name: 'summary', data_type: 'text', is_required: false }],
      });

    const result = await addField(EMAIL, PROJECT, 'summary', 'text', false);

    expect(result.success).toBe(true);
    expect(requestBody(0)).toEqual({
      function: 'add',
      values: {
        user_email: EMAIL,
        table_name: PROJECT,
        field_name: 'summary',
        data_type: 'text',
        is_required: false,
      },
    });
    expect((await cacheGet(CACHE_STORES.FIELDS, FIELD_CACHE_KEY)).data).toEqual([
      { field_name: 'summary', data_type: 'text', is_required: false },
    ]);
  });

  it('renames a field and revalidates field and entry caches', async () => {
    const renamedEntry = {
      id: 'entry-id',
      user_email: EMAIL,
      project_name: PROJECT,
      entries: { summary: 'Existing value' },
    };
    mockRequest
      .mockResolvedValueOnce({
        success: true,
        migrated_entry_count: 1,
        data: [{ field_name: 'summary' }],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ field_name: 'summary', data_type: 'text', is_required: false }],
      })
      .mockResolvedValueOnce({ success: true, data: [renamedEntry] })
      .mockResolvedValueOnce({ success: true, data: [renamedEntry] });

    const result = await editField(EMAIL, PROJECT, 'title', 'summary', 'text', false);

    expect(result.success).toBe(true);
    expect(requestBody(0)).toEqual({
      function: 'edit',
      values: {
        user_email: EMAIL,
        table_name: PROJECT,
        old_field_name: 'title',
        field_name: 'summary',
        data_type: 'text',
        is_required: false,
      },
    });
    expect((await cacheGet(CACHE_STORES.ENTRIES, FIELD_CACHE_KEY)).data).toEqual([renamedEntry]);
    expect((await cacheGet(CACHE_STORES.ALL_ENTRIES, EMAIL)).data).toEqual([renamedEntry]);
  });

  it('removes field metadata without revalidating or changing entry values', async () => {
    mockRequest
      .mockResolvedValueOnce({ success: true, message: 'Field removed successfully' })
      .mockResolvedValueOnce({ success: true, data: [] });

    const result = await deleteField(EMAIL, PROJECT, 'title');

    expect(result.success).toBe(true);
    expect(requestBody(0)).toEqual({
      function: 'delete',
      values: { user_email: EMAIL, table_name: PROJECT, field_name: 'title' },
    });
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect((await cacheGet(CACHE_STORES.FIELDS, FIELD_CACHE_KEY)).data).toEqual([]);
  });
});
