import { supabase } from '../supabase.js';

const PRIORITY = Object.freeze({
  0: 'Urgent and important',
  1: 'Urgent but not important',
  2: 'Not urgent, not important',
});

export class Priority {
  async setPriority(user_email, priorityValue, project_name, entry_object) {
    try {
      let priorityToSet;

      switch (String(priorityValue)) {
        case '0':
        case '1':
        case '2':
          priorityToSet = PRIORITY[priorityValue];
          break;
        case '3': // remove priority
          priorityToSet = null;
          break;
        default:
          return { success: false, message: 'Invalid priority value' };
      }

      const { error } = await supabase
        .from('entries')
        .update({ priority: priorityToSet })
        .eq('user_email', user_email)
        .eq('project_name', project_name)
        .eq('entries', entry_object);

      if (error) {
        throw error;
      }

      return { success: true, message: 'Priority set successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}
