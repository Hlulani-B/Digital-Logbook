import pool from '../../db.js';
import { compressFile } from './compressor.js';
import { storeFile } from './store.js';

const VALID_TYPES = ['text', 'image', 'pdf', 'link'];

export class Notes {
  /**
   * Add a note to an entry.
   *
   * - text / link  → value is stored directly
   * - image / pdf  → file is compressed then uploaded to Supabase Storage;
   *                  the resulting public URL is stored as value
   *
   * @param {string} email        Owner email
   * @param {string} entry_id     Parent entry UUID
   * @param {string} entry_type   One of 'text', 'image', 'pdf', 'link'
   * @param {string|Buffer} value Text content, URL, or file Buffer / base64
   * @returns {{success: boolean, message: string, data?: object}}
   */
  async addNote(email, entry_id, entry_type, value) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      if (!VALID_TYPES.includes(entry_type)) {
        return { success: false, message: `Invalid entry_type "${entry_type}". Must be one of: ${VALID_TYPES.join(', ')}` };
      }
      if (!email || !entry_id) {
        return { success: false, message: 'email and entry_id are required' };
      }
      if (value === undefined || value === null || value === '') {
        return { success: false, message: 'value is required' };
      }

      let storedValue = value;

      // For file types (image/pdf), compress then upload
      if (entry_type === 'image' || entry_type === 'pdf') {
        const filename = typeof value === 'string' && !Buffer.isBuffer(value)
          ? `note.${entry_type === 'image' ? 'jpg' : 'pdf'}`
          : `note.${entry_type === 'image' ? 'jpg' : 'pdf'}`;

        console.log('[addNote] FILE TYPE detected, entry_type=', entry_type, 'filename=', filename, 'value type=', typeof value, 'value length=', typeof value === 'string' ? value.length : 'N/A');

        // 1. Compress
        console.log('[addNote] Step 1: compressing...');
        const compressed = await compressFile(value, filename);
        console.log('[addNote] Step 1 done: compressed buffer length=', compressed.length);

        // 2. Upload to Supabase Storage
        console.log('[addNote] Step 2: uploading to storage...');
        const url = await storeFile(compressed, filename, email);
        console.log('[addNote] Step 2 done: url=', url);
        if (!url) {
          console.error('[addNote] Storage upload returned null — aborting');
          return { success: false, message: 'Failed to upload file to storage' };
        }

        storedValue = url;
        console.log('[addNote] storedValue set to URL:', storedValue);
      }

      const { rows } = await pool.query(
        `INSERT INTO notes (email, entry_id, entry_type, value)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [email, entry_id, entry_type, storedValue]
      );

      console.log('[addNote] Success, id:', rows?.[0]?.id);
      return { success: true, message: 'Note added', data: rows[0] };
    } catch (err) {
      console.error('[addNote] FAILED:', err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * Get all non-deleted notes for a given entry.
   *
   * @param {string} entry_id  Parent entry UUID
   * @returns {{success: boolean, message: string, data?: Array}}
   */
  async getNotesByEntryID(entry_id) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      if (!entry_id) {
        return { success: false, message: 'entry_id is required' };
      }

      const { rows } = await pool.query(
        `SELECT * FROM notes
         WHERE entry_id = $1 AND (deleted = false OR deleted IS NULL)
         ORDER BY created_at DESC`,
        [entry_id]
      );

      return { success: true, data: rows };
    } catch (err) {
      console.error('[getNotesByEntryID] FAILED:', err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * View a single note.
   * - text notes  → returns the text value directly
   * - file notes  → fetches the actual file from the stored URL and returns
   *                 the raw bytes so the frontend can cache it in IndexedDB
   *
   * @param {string} note_id  Note UUID
   * @returns {{success: boolean, message: string, data?: object}}
   */
  async viewNote(note_id) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      if (!note_id) {
        return { success: false, message: 'note_id is required' };
      }

      const { rows } = await pool.query(
        `SELECT * FROM notes
         WHERE id = $1 AND (deleted = false OR deleted IS NULL)`,
        [note_id]
      );

      if (rows.length === 0) {
        return { success: false, message: 'Note not found' };
      }

      const note = rows[0];

      // For text and link types, return value as-is
      if (note.entry_type === 'text' || note.entry_type === 'link') {
        return { success: true, data: note };
      }

      // For file types (image/pdf), fetch the actual file from the URL
      try {
        const response = await fetch(note.value);
        if (!response.ok) {
          return {
            success: true,
            data: { ...note, file_error: `HTTP ${response.status}` },
          };
        }
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        return {
          success: true,
          data: {
            ...note,
            file_data: base64,
            content_type: contentType,
          },
        };
      } catch (fetchErr) {
        return {
          success: true,
          data: { ...note, file_error: fetchErr.message },
        };
      }
    } catch (err) {
      console.error('[viewNote] FAILED:', err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * Update a note — only allowed for text notes.
   *
   * @param {string} note_id    Note UUID
   * @param {string} new_value  New text content
   * @returns {{success: boolean, message: string, data?: object}}
   */
  async updateNote(note_id, new_value) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      if (!note_id || new_value === undefined || new_value === null) {
        return { success: false, message: 'note_id and new_value are required' };
      }

      // Check the note exists and is a text type
      const { rows: existing } = await pool.query(
        `SELECT * FROM notes
         WHERE id = $1 AND (deleted = false OR deleted IS NULL)`,
        [note_id]
      );

      if (existing.length === 0) {
        return { success: false, message: 'Note not found' };
      }

      if (existing[0].entry_type !== 'text') {
        return { success: false, message: 'Only text notes can be updated' };
      }

      const { rows } = await pool.query(
        `UPDATE notes SET value = $1 WHERE id = $2 RETURNING *`,
        [new_value, note_id]
      );

      console.log('[updateNote] Updated:', note_id);
      return { success: true, message: 'Note updated', data: rows[0] };
    } catch (err) {
      console.error('[updateNote] FAILED:', err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * Soft-delete a note (sets deleted = true).
   *
   * @param {string} note_id  Note UUID
   * @returns {{success: boolean, message: string}}
   */
  async deleteNote(note_id) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      if (!note_id) {
        return { success: false, message: 'note_id is required' };
      }

      const { rowCount } = await pool.query(
        `UPDATE notes SET deleted = true WHERE id = $1 AND (deleted = false OR deleted IS NULL)`,
        [note_id]
      );

      if (rowCount === 0) {
        return { success: false, message: 'Note not found or already deleted' };
      }

      console.log('[deleteNote] Soft-deleted:', note_id);
      return { success: true, message: 'Note deleted' };
    } catch (err) {
      console.error('[deleteNote] FAILED:', err.message);
      return { success: false, message: err.message };
    }
  }
}

export default Notes;
