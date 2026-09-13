import pool from '../db.js';
import { Fields } from '../functions/field.js';

jest.mock('../db.js');

describe('Fields', () => {
  let fields;
  let client;

  beforeEach(() => {
    fields = new Fields();
    client = { query: jest.fn(), release: jest.fn() };
    jest.spyOn(console, 'log').mockImplementation(() => {});
    pool.query.mockReset();
    pool.connect = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('addField', () => {
    it('should add a field successfully without changing entries', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await fields.addField('a@b.com', 'entries', 'title', 'text', true);

      expect(result).toEqual({ success: true, message: 'Field added successfully' });
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('insert failed'));

      const result = await fields.addField('a@b.com', 'entries', 'title', 'text', true);

      expect(result).toEqual({ success: false, message: 'insert failed' });
    });
  });

  describe('editField', () => {
    it('should edit field metadata when the name is unchanged', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ field_name: 'title', data_type: 'varchar' }] });

      const result = await fields.editField(
        'a@b.com',
        'entries',
        'title',
        'title',
        'varchar',
        false
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ field_name: 'title', data_type: 'varchar' }]);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('should rename a field and move all stored values in one transaction', async () => {
      pool.connect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: 'field-id' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'entry-id', entries: { title: 'Old value' } }] })
        .mockResolvedValueOnce({ rows: [{ id: 'entry-id' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'field-id', field_name: 'summary' }] })
        .mockResolvedValueOnce({});

      const result = await fields.editField('a@b.com', 'entries', 'title', 'summary', 'text', true);

      expect(result).toEqual({
        success: true,
        message: 'Field renamed successfully',
        data: [{ id: 'field-id', field_name: 'summary' }],
        migrated_entry_count: 1,
      });
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'SET entries = (entries - $1) || jsonb_build_object($2, entries -> $1)'
        ),
        ['title', 'summary', 'a@b.com', 'entries']
      );
      expect(client.query).toHaveBeenLastCalledWith('COMMIT');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('should preserve all data by rejecting a destination field that already exists', async () => {
      pool.connect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: 'field-id' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'other-field-id' }] })
        .mockResolvedValueOnce({});

      const result = await fields.editField(
        'a@b.com',
        'entries',
        'title',
        'summary',
        'text',
        false
      );

      expect(result).toEqual({ success: false, message: 'A field with that name already exists' });
      expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('should roll back when an entry already contains both field names', async () => {
      pool.connect.mockResolvedValueOnce(client);
      client.query
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ id: 'field-id' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ id: 'entry-id', entries: { title: 'Old', summary: 'New' } }],
        })
        .mockResolvedValueOnce({});

      const result = await fields.editField(
        'a@b.com',
        'entries',
        'title',
        'summary',
        'text',
        false
      );

      expect(result).toEqual({
        success: false,
        message: 'Some entries already contain the new field name. Rename them first.',
      });
      expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('should release the client after a transactional failure', async () => {
      pool.connect.mockResolvedValueOnce(client);
      client.query.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('select failed'));

      const result = await fields.editField(
        'a@b.com',
        'entries',
        'title',
        'summary',
        'text',
        false
      );

      expect(result).toEqual({ success: false, message: 'select failed' });
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteField', () => {
    it('should soft-delete field metadata without touching entry values', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ field_name: 'title', deleted: true }] });

      const result = await fields.deleteField('a@b.com', 'entries', 'title');

      expect(result).toEqual({
        success: true,
        message: 'Field removed successfully',
        data: [{ field_name: 'title', deleted: true }],
      });
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE fields SET deleted = true'),
        ['a@b.com', 'entries', 'title']
      );
    });

    it('should return failure when field metadata is not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await fields.deleteField('a@b.com', 'entries', 'title');

      expect(result).toEqual({ success: false, message: 'Field not found' });
    });
  });

  describe('getFields', () => {
    it('should retrieve fields successfully', async () => {
      const mockData = [
        { field_name: 'title', data_type: 'text', is_required: true },
        { field_name: 'status', data_type: 'varchar', is_required: false },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockData });

      const result = await fields.getFields('a@b.com', 'entries');

      expect(result).toEqual({
        success: true,
        message: 'Fields retrieved successfully',
        data: mockData,
      });
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('select failed'));

      const result = await fields.getFields('a@b.com', 'entries');

      expect(result).toEqual({ success: false, message: 'select failed' });
    });
  });
});
