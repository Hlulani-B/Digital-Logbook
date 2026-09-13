import { Notes } from '../functions/notes/notes_crud.js';
import pool from '../db.js';
import { compressFile } from '../functions/notes/compressor.js';
import { storeFile } from '../functions/notes/store.js';

jest.mock('../db.js', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../functions/notes/compressor.js', () => ({
  compressFile: jest.fn(),
}));

jest.mock('../functions/notes/store.js', () => ({
  storeFile: jest.fn(),
}));

let notes;

beforeEach(() => {
  notes = new Notes();
  pool.query.mockReset();
  compressFile.mockReset();
  storeFile.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── addNote ───────────────────────────────────────────────────────────
describe('addNote', () => {
  it('stores text value directly', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', email: 'a@b.com', entry_id: 'e1', entry_type: 'text', value: 'Hello' }],
    });

    const result = await notes.addNote('a@b.com', 'e1', 'text', 'Hello');

    expect(result.success).toBe(true);
    expect(result.data.value).toBe('Hello');
    expect(compressFile).not.toHaveBeenCalled();
    expect(storeFile).not.toHaveBeenCalled();
  });

  it('stores link value directly', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n2', entry_type: 'link', value: 'https://example.com' }],
    });

    const result = await notes.addNote('a@b.com', 'e1', 'link', 'https://example.com');

    expect(result.success).toBe(true);
    expect(result.data.value).toBe('https://example.com');
    expect(compressFile).not.toHaveBeenCalled();
  });

  it('compresses then uploads image files', async () => {
    const fileBuffer = Buffer.alloc(1024);
    const compressedBuffer = Buffer.alloc(512);
    compressFile.mockResolvedValueOnce(compressedBuffer);
    storeFile.mockResolvedValueOnce('https://storage.example.com/img.jpg');

    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n3', entry_type: 'image', value: 'https://storage.example.com/img.jpg' }],
    });

    const result = await notes.addNote('a@b.com', 'e1', 'image', fileBuffer);

    expect(result.success).toBe(true);
    expect(compressFile).toHaveBeenCalledWith(fileBuffer, 'note.jpg');
    expect(storeFile).toHaveBeenCalledWith(compressedBuffer, 'note.jpg', 'a@b.com');
    expect(result.data.value).toBe('https://storage.example.com/img.jpg');
  });

  it('compresses then uploads pdf files', async () => {
    const fileBuffer = Buffer.alloc(2048);
    const compressedBuffer = Buffer.alloc(900);
    compressFile.mockResolvedValueOnce(compressedBuffer);
    storeFile.mockResolvedValueOnce('https://storage.example.com/doc.pdf');

    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n4', entry_type: 'pdf', value: 'https://storage.example.com/doc.pdf' }],
    });

    const result = await notes.addNote('a@b.com', 'e1', 'pdf', fileBuffer);

    expect(result.success).toBe(true);
    expect(compressFile).toHaveBeenCalledWith(fileBuffer, 'note.pdf');
    expect(storeFile).toHaveBeenCalledWith(compressedBuffer, 'note.pdf', 'a@b.com');
  });

  it('returns error when storage upload fails', async () => {
    compressFile.mockResolvedValueOnce(Buffer.alloc(100));
    storeFile.mockResolvedValueOnce(null);

    const result = await notes.addNote('a@b.com', 'e1', 'image', Buffer.alloc(200));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to upload');
  });

  it('rejects invalid entry_type', async () => {
    const result = await notes.addNote('a@b.com', 'e1', 'video', 'data');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid entry_type');
  });

  it('rejects missing email', async () => {
    const result = await notes.addNote('', 'e1', 'text', 'hi');

    expect(result.success).toBe(false);
    expect(result.message).toContain('email and entry_id are required');
  });

  it('rejects missing entry_id', async () => {
    const result = await notes.addNote('a@b.com', '', 'text', 'hi');

    expect(result.success).toBe(false);
  });

  it('rejects empty value', async () => {
    const result = await notes.addNote('a@b.com', 'e1', 'text', '');

    expect(result.success).toBe(false);
    expect(result.message).toContain('value is required');
  });
});

// ─── getNotesByEntryID ─────────────────────────────────────────────────
describe('getNotesByEntryID', () => {
  it('returns non-deleted notes ordered by created_at DESC', async () => {
    const mockRows = [
      { id: 'n2', entry_type: 'text', value: 'second', deleted: false },
      { id: 'n1', entry_type: 'link', value: 'https://x.com', deleted: false },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await notes.getNotesByEntryID('e1');

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('deleted = false OR deleted IS NULL'),
      ['e1']
    );
  });

  it('returns empty array when no notes exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await notes.getNotesByEntryID('e1');

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it('rejects missing entry_id', async () => {
    const result = await notes.getNotesByEntryID('');

    expect(result.success).toBe(false);
    expect(result.message).toContain('entry_id is required');
  });
});

// ─── viewNote ──────────────────────────────────────────────────────────
describe('viewNote', () => {
  it('returns text note value directly', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', entry_type: 'text', value: 'Hello world', deleted: false }],
    });

    const result = await notes.viewNote('n1');

    expect(result.success).toBe(true);
    expect(result.data.value).toBe('Hello world');
    expect(result.data.file_data).toBeUndefined();
  });

  it('returns link note value directly', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', entry_type: 'link', value: 'https://example.com', deleted: false }],
    });

    const result = await notes.viewNote('n1');

    expect(result.success).toBe(true);
    expect(result.data.value).toBe('https://example.com');
  });

  it('fetches file data for image notes', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', entry_type: 'image', value: 'https://storage.example.com/img.jpg', deleted: false }],
    });

    const fileBytes = new Uint8Array([0xff, 0xd8, 0xff]);
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fileBytes.buffer,
      headers: { get: () => 'image/jpeg' },
    });

    const result = await notes.viewNote('n1');

    expect(result.success).toBe(true);
    expect(result.data.file_data).toBeTruthy();
    expect(result.data.content_type).toBe('image/jpeg');
    expect(global.fetch).toHaveBeenCalledWith('https://storage.example.com/img.jpg');
  });

  it('fetches file data for pdf notes', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', entry_type: 'pdf', value: 'https://storage.example.com/doc.pdf', deleted: false }],
    });

    const fileBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fileBytes.buffer,
      headers: { get: () => 'application/pdf' },
    });

    const result = await notes.viewNote('n1');

    expect(result.success).toBe(true);
    expect(result.data.file_data).toBeTruthy();
    expect(result.data.content_type).toBe('application/pdf');
  });

  it('returns file_error when fetch fails', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', entry_type: 'image', value: 'https://storage.example.com/broken.jpg', deleted: false }],
    });

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await notes.viewNote('n1');

    expect(result.success).toBe(true);
    expect(result.data.file_error).toContain('404');
  });

  it('returns file_error when network throws', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', entry_type: 'image', value: 'https://storage.example.com/down.jpg', deleted: false }],
    });

    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network down'));

    const result = await notes.viewNote('n1');

    expect(result.success).toBe(true);
    expect(result.data.file_error).toContain('Network down');
  });

  it('returns not found for deleted notes', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await notes.viewNote('n1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('rejects missing note_id', async () => {
    const result = await notes.viewNote('');

    expect(result.success).toBe(false);
  });
});

// ─── updateNote ────────────────────────────────────────────────────────
describe('updateNote', () => {
  it('updates a text note', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'n1', entry_type: 'text', value: 'old', deleted: false }] })
      .mockResolvedValueOnce({ rows: [{ id: 'n1', entry_type: 'text', value: 'new', deleted: false }] });

    const result = await notes.updateNote('n1', 'new');

    expect(result.success).toBe(true);
    expect(result.data.value).toBe('new');
  });

  it('rejects update for non-text notes', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', entry_type: 'image', value: 'https://url.com', deleted: false }],
    });

    const result = await notes.updateNote('n1', 'new text');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Only text notes');
  });

  it('rejects update for link notes', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', entry_type: 'link', value: 'https://url.com', deleted: false }],
    });

    const result = await notes.updateNote('n1', 'new text');

    expect(result.success).toBe(false);
  });

  it('returns not found for deleted notes', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await notes.updateNote('n1', 'new text');

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('rejects missing note_id', async () => {
    const result = await notes.updateNote('', 'text');

    expect(result.success).toBe(false);
  });

  it('rejects null new_value', async () => {
    const result = await notes.updateNote('n1', null);

    expect(result.success).toBe(false);
  });
});

// ─── deleteNote ────────────────────────────────────────────────────────
describe('deleteNote', () => {
  it('soft-deletes a note (sets deleted = true)', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const result = await notes.deleteNote('n1');

    expect(result.success).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('SET deleted = true'),
      ['n1']
    );
  });

  it('returns not found when note does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });

    const result = await notes.deleteNote('n1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('returns not found for already-deleted notes', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });

    const result = await notes.deleteNote('n1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('already deleted');
  });

  it('rejects missing note_id', async () => {
    const result = await notes.deleteNote('');

    expect(result.success).toBe(false);
  });
});
