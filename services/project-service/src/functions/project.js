import { supabase } from '../supabase.js';

export class Project {
  async addProject(user_email, project_name) {
    try {
      const { error } = await supabase
        .from('projects')
        .insert({ user_email, project_name })
        .select();

      if (error) {
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
    // Also update all the project entries that have this project name
    try {
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

  async deleteProject(user_email, project_name) {
    // When deleting a project, also delete all of its entries
    try {
      let error;

      ({ error } = await supabase
        .from('entries')
        .delete()
        .eq('project_name', project_name)
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
