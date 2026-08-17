import { supabase } from '../supabase.js';

export class Project {
  async addProject(user_email, project_name, description) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { error } = await supabase
        .from('projects')
        .insert({ user_email, project_name, description })
        .select();

      if (error) {
        // 23505 = unique_violation (e.g. duplicate project name for this user)
        if (error.code === '23505') {
          return { success: false, message: 'A project with this name already exists for your account.' };
        }
        throw error;
      }

      console.log('Project added successfully');
      return { success: true, message: 'Project added successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async editProjectName(user_email, new_project_name, old_project_name) {
    // Also update all the project entries and custom fields that have this project name
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      let error;

      // Update related entries first
      ({ error } = await supabase
        .from('entries')
        .update({ project_name: new_project_name })
        .eq('project_name', old_project_name)
        .eq('user_email', user_email));

      if (error) {
        throw error;
      }

      // Update the custom fields tied to this project (table_name == project_name)
      ({ error } = await supabase
        .from('fields')
        .update({ table_name: new_project_name })
        .eq('table_name', old_project_name)
        .eq('user_email', user_email));

      if (error) {
        throw error;
      }

      // Then update the project record
      ({ error } = await supabase
        .from('projects')
        .update({ project_name: new_project_name })
        .eq('project_name', old_project_name)
        .eq('user_email', user_email));

      if (error) {
        throw error;
      }

      console.log('Project name updated successfully');
      return { success: true, message: 'Project name updated successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getProjectsByEmail(user_email) {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      const { data, error } = await supabase
        .from('projects')
        .select('project_name, description, created_at, archived')
        .eq('user_email', user_email)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return { success: true, projects: data || [] };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async deleteProject(user_email, project_name) {
    // When deleting a project, also delete all of its entries and custom fields
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      let error;

      ({ error } = await supabase
        .from('entries')
        .delete()
        .eq('project_name', project_name)
        .eq('user_email', user_email));

      if (error) {
        throw error;
      }

      // Delete custom fields tied to this project (table_name == project_name)
      ({ error } = await supabase
        .from('fields')
        .delete()
        .eq('table_name', project_name)
        .eq('user_email', user_email));

      if (error) {
        throw error;
      }

      ({ error } = await supabase
        .from('projects')
        .delete()
        .eq('project_name', project_name)
        .eq('user_email', user_email));

      if (error) {
        throw error;
      }

      console.log('Project deleted successfully');
      return { success: true, message: 'Project deleted successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}
