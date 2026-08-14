import { Fields } from '../functions/field.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');

describe('Fields', () => {
  let fields;

  beforeEach(() => {
    fields = new Fields();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    supabase.from.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('addField', () => {
    it('should add a field successfully', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const result = await fields.addField('a@b.com', 'entries', 'title', 'text', true);

      expect(result).toEqual({ success: true, message: 'Field added successfully' });
      expect(supabase.from).toHaveBeenCalledWith('fields');
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'insert failed' } } }).from(tableName)
      );

      const result = await fields.addField('a@b.com', 'entries', 'title', 'text', true);

      expect(result).toEqual({ success: false, message: 'insert failed' });
    });

    it('should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      const result = await fields.addField('a@b.com', 'entries', 'title', 'text', true);

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });
  });

  describe('editField', () => {
    it('should edit a field successfully', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ field_name: 'title', data_type: 'varchar' }] } }).from(tableName)
      );

      const result = await fields.editField('a@b.com', 'entries', 'title', 'varchar', false);

      expect(result).toEqual({
        success: true,
        message: 'Field updated successfully',
        data: [{ field_name: 'title', data_type: 'varchar' }],
      });
      expect(supabase.from).toHaveBeenCalledWith('fields');
    });

    it('should return failure when field is not found', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const result = await fields.editField('a@b.com', 'entries', 'nonexistent', 'text', true);

      expect(result).toEqual({ success: false, message: 'Field not found. Something went wrong' });
    });

    it('should return failure when data is null', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: null } }).from(tableName)
      );

      const result = await fields.editField('a@b.com', 'entries', 'title', 'text', true);

      expect(result).toEqual({ success: false, message: 'Field not found. Something went wrong' });
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'update failed' } } }).from(tableName)
      );

      const result = await fields.editField('a@b.com', 'entries', 'title', 'text', true);

      expect(result).toEqual({ success: false, message: 'update failed' });
    });

    it('should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      const result = await fields.editField('a@b.com', 'entries', 'title', 'text', true);

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });
  });

  describe('getFields', () => {
    it('should retrieve fields successfully', async () => {
      const mockData = [
        { field_name: 'title', data_type: 'text', is_required: true },
        { field_name: 'status', data_type: 'varchar', is_required: false },
      ];

      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await fields.getFields('a@b.com', 'entries');

      expect(result).toEqual({ success: true, message: 'Fields retrieved successfully', data: mockData });
      expect(supabase.from).toHaveBeenCalledWith('fields');
    });

    it('should return empty array when no fields exist', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const result = await fields.getFields('a@b.com', 'entries');

      expect(result).toEqual({ success: true, message: 'Fields retrieved successfully', data: [] });
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'select failed' } } }).from(tableName)
      );

      const result = await fields.getFields('a@b.com', 'entries');

      expect(result).toEqual({ success: false, message: 'select failed' });
    });

    it('should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      const result = await fields.getFields('a@b.com', 'entries');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });
  });
});
