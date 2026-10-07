import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

const mockGetSession = vi.fn();
const mockFetch = vi.fn();

vi.mock('../supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: mockGetSession },
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: (key: string) => ({ data: { publicUrl: `https://cdn.example.com/${key}` } }),
      }),
    },
  }),
}));

import {
  createAttachmentLease,
  uploadAttachment,
  finalizeAttachment,
  getAttachment,
  getAttachmentDownloadUrl,
  uploadAndFinalize,
  type AttachmentLease,
} from '../attachmentApi';

const mockFile = { name: 'test.png', type: 'image/png', size: 1024 } as File;

const mockLease: AttachmentLease = {
  id: 'lease-1',
  storage_key: 'uploads/test.png',
  upload_token: 'token-abc',
  lease_until: '2025-12-31T00:00:00Z',
  name: 'test.png',
  mime_type: 'image/png',
  expected_size: 1024,
};

describe('attachmentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('createAttachmentLease', () => {
    it('sends POST with file metadata and auth header', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockLease) });
      const result = await createAttachmentLease(1, 'field-1', mockFile);
      expect(result).toEqual(mockLease);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/service/attachments/projects/1/fields/field-1/leases'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      );
    });

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });
      await expect(createAttachmentLease(1, 'f', mockFile)).rejects.toThrow('Not authenticated');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Bad request' }),
      });
      await expect(createAttachmentLease(1, 'f', mockFile)).rejects.toThrow('Bad request');
    });
  });

  describe('finalizeAttachment', () => {
    it('sends POST to finalize endpoint', async () => {
      const attachment = { id: 'att-1', status: 'finalized' };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(attachment) });
      const result = await finalizeAttachment('att-1', 'entry-1', 'token-abc');
      expect(result).toEqual(attachment);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/service/attachments/att-1/finalize'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('throws when not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });
      await expect(finalizeAttachment('a', 'e', 't')).rejects.toThrow('Not authenticated');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      });
      await expect(finalizeAttachment('a', 'e', 't')).rejects.toThrow('Not found');
    });
  });

  describe('getAttachment', () => {
    it('fetches attachment by id', async () => {
      const attachment = { id: 'att-1', name: 'file.png' };
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(attachment) });
      const result = await getAttachment('att-1');
      expect(result).toEqual(attachment);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(getAttachment('att-1')).rejects.toThrow('Attachment not found');
    });
  });

  describe('getAttachmentDownloadUrl', () => {
    it('returns a public URL', () => {
      const url = getAttachmentDownloadUrl('uploads/test.png');
      expect(url).toContain('test.png');
      expect(typeof url).toBe('string');
    });
  });

  describe('uploadAndFinalize', () => {
    it('chains lease, upload and finalize', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockLease) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'att-1', status: 'finalized' }) });
      const result = await uploadAndFinalize(1, 'field-1', 'entry-1', mockFile);
      expect(result).toEqual({ attachmentId: 'att-1' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
