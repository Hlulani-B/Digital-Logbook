import { supabase } from '../supabase.js';

export class Entries {
  async addEntry(user_email, project_name, entry_object, due_date) {
    try {
      // Check if an identical entry already exists before adding
      let error, data;
      ({ data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .eq('project_name', project_name));

      if (error) {
        throw error;
      }

      const duplicate = data.find((entry) => entry.entries === entry_object);
      if (duplicate) {
        console.log('Entry already exists');
        return { success: true, message: 'Entry already exists' };
      }

      ({ error } = await supabase
        .from('entries')
        .insert({ user_email, project_name, entries: entry_object, due_date })
        .select());

      if (error) {
        throw error;
      }

      console.log('Entry added successfully');
      return { success: true, message: 'Entry added successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async updateEntry(user_email, project_name, entry_id, new_entry, due_date, priority) {
    try {
      const updateData = { entries: new_entry };
      if (due_date !== undefined) updateData.due_date = due_date;
      if (priority !== undefined) updateData.priority = priority;

      const { data, error } = await supabase
        .from('entries')
        .update(updateData)
        .eq('id', entry_id)
        .eq('user_email', user_email)
        .eq('project_name', project_name)
        .select();

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('Entry not found. Something went wrong');
        return { success: false, message: 'Entry not found. Something went wrong' };
      }

      console.log('Entry updated successfully');
      return { success: true, message: 'Entry updated successfully', data };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getEntries(user_email, project_name) {
    try {
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
      console.log(error);
      return { success: false, message: error.message };
    }
  }
  async deleteEntry(user_email, project_name, entry) {
    try {
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
        console.log('Entry not found. Something went wrong');
        return { success: false, message: 'Entry not found. Something went wrong' };
      }

      console.log('Entry deleted successfully');
      return { success: true, message: 'Entry deleted successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async sortUnarchivedEntries(user_email, project_name, sort_type) {
    try {
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
