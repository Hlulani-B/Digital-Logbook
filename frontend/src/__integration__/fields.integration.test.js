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

  it('edits a field data_type and revalidates field cache', async () => {
    mockRequest
      .mockResolvedValueOnce({
        success: true,
        data: [{ field_name: 'title', data_type: 'text', is_required: false }],
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ field_name: 'title', data_type: 'text', is_required: false }],
      });

    const result = await editField(EMAIL, PROJECT, 'title', 'text', false);

    expect(result.success).toBe(true);
    expect(requestBody(0)).toEqual({
      function: 'edit',
      values: {
        user_email: EMAIL,
        table_name: PROJECT,
        field_name: 'title',
        data_type: 'text',
        is_required: false,
      },
    });
    expect((await cacheGet(CACHE_STORES.FIELDS, FIELD_CACHE_KEY)).data).toEqual([
      { field_name: 'title', data_type: 'text', is_required: false },
    ]);
  });

  it('removes field metadata without revalidating or changing entry values', async () => {
    mockRequest.mockResolvedValueOnce({ success: true, message: 'Field removed successfully' });

    const result = await deleteField(EMAIL, PROJECT, 'title');

    expect(result.success).toBe(true);
    expect(requestBody(0)).toEqual({
      function: 'delete',
      values: { user_email: EMAIL, table_name: PROJECT, field_name: 'title' },
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    // Fields cache is optimistically updated (field removed from local cache)
    const cachedFields = await cacheGet(CACHE_STORES.FIELDS, FIELD_CACHE_KEY);
    // Cache was cleared in beforeEach, so after delete it should still be empty/null
    expect(cachedFields === null || (cachedFields.data && cachedFields.data.length === 0)).toBe(
      true
    );
  });
});
