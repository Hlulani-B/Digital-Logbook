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

  async updateEntry(user_email, project_name, old_entry, new_entry) {
    try {
      const { data, error } = await supabase
        .from('entries')
        .update({ entries: new_entry })
        .eq('user_email', user_email)
        .eq('project_name', project_name)
        .eq('entries', old_entry)
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

  async sortEntries(user_email, project_name, sort_type) {
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .eq('project_name', project_name)
        .order('due_date', { ascending: true });

      if (error) {
        throw error;
      }

      switch (sort_type) {
        case 0: // sort by due date ascending
          return { success: true, message: 'Entries sorted successfully', data };

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

          return { success: true, message: 'Entries sorted successfully', data: results };
        }

        default:
          return { success: true, message: 'Entries sorted successfully', data };
      }
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}
