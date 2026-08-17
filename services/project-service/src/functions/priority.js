import { supabase } from '../supabase.js';

const PRIORITY = Object.freeze({
  0: 'Urgent and important',
  1: 'Urgent but not important',
  2: 'Not urgent, not important',
});

export class Priority {
  async setPriority(user_email, priorityValue, project_name, entry_id) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      let newPriority;
      switch (String(priorityValue)) {
        case '0':
          newPriority = PRIORITY[0];
          break;
        case '1':
          newPriority = PRIORITY[1];
          break;
        case '2':
          newPriority = PRIORITY[2];
          break;
        case '3':
          newPriority = null;
          break;
        default:
          return { success: false, message: 'Invalid priority value' };
      }

      const { error } = await supabase
        .from('entries')
        .update({ priority: newPriority })
        .eq('id', entry_id)
        .eq('user_email', user_email)
        .eq('project_name', project_name);

      if (error) throw error;

      const label = newPriority || 'none';
      return { success: true, message: `Priority set to ${label}` };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}
