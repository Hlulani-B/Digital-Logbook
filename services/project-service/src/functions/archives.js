import { supabase } from '../supabase.js';

export class Archives {
  async archive_project(user_email, project_name) {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ archived: true })
        .eq('user_email', user_email)
        .eq('project_name', project_name);

      if (error) throw error;

      console.log('Project archived successfully');
      return { success: true, message: 'Project archived successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async unarchive_project(user_email, project_name) {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ archived: false })
        .eq('user_email', user_email)
        .eq('project_name', project_name);

      if (error) throw error;

      console.log('Project unarchived successfully');
      return { success: true, message: 'Project unarchived successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async archive_entry(user_email, project_name, entry_id) {
    try {
      const { error } = await supabase
        .from('entries')
        .update({ archived: true })
        .eq('id', entry_id)
        .eq('user_email', user_email)
        .eq('project_name', project_name);

      if (error) throw error;

      console.log('Entry archived successfully');
      return { success: true, message: 'Entry archived successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async unarchive_entry(user_email, project_name, entry_id) {
    try {
      const { error } = await supabase
        .from('entries')
        .update({ archived: false })
        .eq('id', entry_id)
        .eq('user_email', user_email)
        .eq('project_name', project_name);

      if (error) throw error;

      console.log('Entry unarchived successfully');
      return { success: true, message: 'Entry unarchived successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getArchives(user_email, project_name) {
    try {
      let query = supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .eq('archived', true);

      if (project_name) {
        query = query.eq('project_name', project_name);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getUnarchived(user_email, project_name) {
    try {
      let query = supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .or('archived.eq.false,archived.is.null');

      if (project_name) {
        query = query.eq('project_name', project_name);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}