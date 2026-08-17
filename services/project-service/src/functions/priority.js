import { supabase } from '../supabase.js';

const PRIORITY = Object.freeze({
  0: 'Urgent and important',
  1: 'Urgent but not important',
  2: 'Not urgent, not important',
});

export class Priority {
  async setPriority(user_email, priorityValue, project_name, entry_object) {
    try {
      switch (String(priorityValue)) {
        case '0': {
          const { error } = await supabase
            .from('entries')
            .update({ priority: PRIORITY[0] })
            .eq('user_email', user_email)
            .eq('project_name', project_name)
            .eq('entries', entry_object);
          if (error) throw error;
          return { success: true, message: 'Priority set to Urgent and important' };
        }

        case '1': {
          const { error } = await supabase
            .from('entries')
            .update({ priority: PRIORITY[1] })
            .eq('user_email', user_email)
            .eq('project_name', project_name)
            .eq('entries', entry_object);
          if (error) throw error;
          return { success: true, message: 'Priority set to Urgent but not important' };
        }

        case '2': {
          const { error } = await supabase
            .from('entries')
            .update({ priority: PRIORITY[2] })
            .eq('user_email', user_email)
            .eq('project_name', project_name)
            .eq('entries', entry_object);
          if (error) throw error;
          return { success: true, message: 'Priority set to Not urgent, not important' };
        }

        case '3': {
          // remove priority
          const { error } = await supabase
            .from('entries')
            .update({ priority: null })
            .eq('user_email', user_email)
            .eq('project_name', project_name)
            .eq('entries', entry_object);
          if (error) throw error;
          return { success: true, message: 'Priority removed' };
        }

        default:
          return { success: false, message: 'Invalid priority value' };
      }
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}