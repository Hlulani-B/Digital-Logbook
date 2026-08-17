import { supabase } from '../supabase.js';

export class Entries {
  async addEntry(user_email, project_name, entry_object, due_date, priority, status, started_at, ended_at, duration) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      const insertData = { user_email, project_name, entries: entry_object };
      if (due_date !== undefined && due_date !== null) insertData.due_date = due_date;
      if (priority !== undefined && priority !== null) insertData.priority = priority;
      if (status !== undefined && status !== null) insertData.status = status;
      if (started_at !== undefined && started_at !== null) insertData.started_at = started_at;
      if (ended_at !== undefined && ended_at !== null) insertData.ended_at = ended_at;
      if (duration !== undefined && duration !== null) insertData.duration = duration;

      console.log('[addEntry] Inserting:', JSON.stringify(insertData));

      const { data, error } = await supabase
        .from('entries')
        .insert(insertData)
        .select();

      if (error) {
        console.error('[addEntry] Supabase error:', error.message, error.details || '');
        throw error;
      }

      console.log('[addEntry] Success, id:', data?.[0]?.id);
      return { success: true, message: 'Entry added successfully', data };
    } catch (error) {
      console.error('[addEntry] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  async updateEntry(user_email, project_name, entry_id, new_entry, due_date, priority, status, started_at, ended_at, duration) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      const updateData = {};

      // Only include entries object if it was explicitly provided
      if (new_entry !== undefined && new_entry !== null) {
        updateData.entries = new_entry;
      }
      if (due_date !== undefined) updateData.due_date = due_date;
      if (priority !== undefined) updateData.priority = priority;
      if (status !== undefined) updateData.status = status;
      // Timestamp columns: only include when actually set (they may have DEFAULT constraints)
      if (started_at !== undefined && started_at !== null) updateData.started_at = started_at;
      if (ended_at !== undefined && ended_at !== null) updateData.ended_at = ended_at;
      // duration is computed by the database — never set it explicitly

      // If nothing to update, return early
      if (Object.keys(updateData).length === 0) {
        return { success: true, message: 'No changes to update' };
      }

      console.log('[updateEntry] Updating entry_id:', entry_id, 'data:', JSON.stringify(updateData));

      const { data, error } = await supabase
        .from('entries')
        .update(updateData)
        .eq('id', entry_id)
        .eq('user_email', user_email)
        .eq('project_name', project_name)
        .select();

      if (error) {
        console.error('[updateEntry] Supabase error:', error.message, error.details || '');
        throw error;
      }

      if (!data || data.length === 0) {
        console.error('[updateEntry] No rows matched. id:', entry_id, 'user:', user_email, 'project:', project_name);
        return { success: false, message: 'Entry not found. Check that the entry exists and belongs to this user/project.' };
      }

      console.log('[updateEntry] Success, id:', data[0].id);
      return { success: true, message: 'Entry updated successfully', data };
    } catch (error) {
      console.error('[updateEntry] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  async getEntries(user_email, project_name) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .eq('project_name', project_name);

      if (error) {
        throw error;
      }

      return { success: true, message: 'Entries retrieved successfully', data };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
async getAllEntries(user_email) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return { success: true, message: 'All entries retrieved successfully', data };
    } catch (error) {
      console.log('getAllEntries error:', error);
      return { success: false, message: error.message };
    }
  }
  async deleteEntry(user_email, project_name, entry) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error } = await supabase
        .from('entries')
        .delete()
        .eq('user_email', user_email)
        .eq('project_name', project_name)
        .eq('entries', entry)
        .select();

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('Entry not found for delete');
        return { success: false, message: 'Entry not found. Something went wrong' };
      }

      console.log('Entry deleted successfully');
      return { success: true, message: 'Entry deleted successfully' };
    } catch (error) {
      console.log('deleteEntry error:', error);
      return { success: false, message: error.message };
    }
  }

  async sortUnarchivedEntries(user_email, project_name, sort_type) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      let query = supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .or('archived.eq.false,archived.is.null');

      if (project_name) {
        query = query.eq('project_name', project_name);
      }

      const { data, error } = await query.order('due_date', { ascending: true });

      if (error) throw error;

      switch (sort_type) {
        case 0: // sort by due date ascending
          return { success: true, message: 'Unarchived entries sorted successfully', data };

        case 1: { // sort by priority
          const results = [];
          const priorityOrder = [
            'Urgent and important',
            'Urgent but not important',
            'Not urgent, not important',
          ];

          priorityOrder.forEach((priority) => {
            data.forEach((row) => {
              if (row.priority === priority) {
                results.push(row);
              }
            });
          });

          return { success: true, message: 'Unarchived entries sorted successfully', data: results };
        }

        default:
          return { success: true, message: 'Unarchived entries sorted successfully', data };
      }
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async sortArchivedEntries(user_email, project_name, sort_type) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      let query = supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .eq('archived', true);

      if (project_name) {
        query = query.eq('project_name', project_name);
      }

      const { data, error } = await query.order('due_date', { ascending: true });

      if (error) throw error;

      switch (sort_type) {
        case 0: // sort by due date ascending
          return { success: true, message: 'Archived entries sorted successfully', data };

        case 1: { // sort by priority
          const results = [];
          const priorityOrder = [
            'Urgent and important',
            'Urgent but not important',
            'Not urgent, not important',
          ];

          priorityOrder.forEach((priority) => {
            data.forEach((row) => {
              if (row.priority === priority) {
                results.push(row);
              }
            });
          });

          return { success: true, message: 'Archived entries sorted successfully', data: results };
        }

        default:
          return { success: true, message: 'Archived entries sorted successfully', data };
      }
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}
