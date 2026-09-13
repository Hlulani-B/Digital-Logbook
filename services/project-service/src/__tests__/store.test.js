import { storeFile } from '../functions/notes/store.js';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Set env vars for tests
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_STORAGE_BUCKET = 'test-bucket';

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── storeFile ─────────────────────────────────────────────────────────
describe('storeFile', () => {
  const testBuffer = Buffer.from('hello world file content');
  const email = 'user@example.com';

  it('uploads a file and returns the public URL on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ publicUrl: 'https://test.supabase.co/storage/v1/object/public/test-bucket/user@example.com/abc.png' }),
      text: async () => '',
    });

    const url = await storeFile(testBuffer, 'photo.png', email);

    expect(url).toContain('test-bucket');
    expect(url).toContain(email);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify the fetch call shape
    const [calledUrl, opts] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain('test.supabase.co/storage/v1/object/test-bucket');
    expect(calledUrl).toContain(email);
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('Bearer test-service-role-key');
    expect(opts.headers['Content-Type']).toBe('image/png');
    expect(opts.headers['x-upsert']).toBe('true');
    expect(opts.body).toBe(testBuffer);
  });

  it('derives correct MIME type from filename extension', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ publicUrl: 'https://example.com/file.pdf' }),
      text: async () => '',
    });

    await storeFile(testBuffer, 'report.pdf', email);

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/pdf');
  });

  it('defaults to application/octet-stream for unknown extensions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ publicUrl: 'https://example.com/file.xyz' }),
      text: async () => '',
    });

    await storeFile(testBuffer, 'mystery.xyz', email);

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/octet-stream');
  });

  it('accepts base64 string input', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ publicUrl: 'https://example.com/file.txt' }),
      text: async () => '',
    });

    const base64 = testBuffer.toString('base64');
    const url = await storeFile(base64, 'note.txt', email);

    expect(url).toBeTruthy();
    const [, opts] = mockFetch.mock.calls[0];
    expect(Buffer.isBuffer(opts.body)).toBe(true);
  });

  it('returns null when upload fails (non-ok response)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    const url = await storeFile(testBuffer, 'photo.png', email);

    expect(url).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      '[storeFile] Upload failed:',
      403,
      expect.any(String)
    );
  });

  it('returns null when fetch throws (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));

    const url = await storeFile(testBuffer, 'photo.png', email);

    expect(url).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      '[storeFile] Error:',
      'Network down'
    );
  });

  it('throws TypeError for empty buffer', async () => {
    await expect(storeFile(Buffer.alloc(0), 'file.txt', email)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when filename is missing', async () => {
    await expect(storeFile(testBuffer, '', email)).rejects.toThrow(TypeError);
  });

  it('throws TypeError when userEmail is missing', async () => {
    await expect(storeFile(testBuffer, 'file.txt', '')).rejects.toThrow(TypeError);
  });

  it('generates a unique path with userEmail folder and UUID filename', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
      text: async () => '',
    });

    await storeFile(testBuffer, 'doc.txt', email);

    const [calledUrl] = mockFetch.mock.calls[0];
    // URL should contain userEmail/uuid.ext pattern
    expect(calledUrl).toMatch(new RegExp(`${email}/[a-f0-9-]+\\.txt`));
  });

  it('falls back to constructed public URL when response has no publicUrl', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // no publicUrl key
      text: async () => '',
    });

    const url = await storeFile(testBuffer, 'photo.jpg', email);

    expect(url).toBe(
      `https://test.supabase.co/storage/v1/object/public/test-bucket/${email}/${url.split('/').pop()}`
    );
  });
});
