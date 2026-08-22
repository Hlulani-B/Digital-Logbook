import { supabase } from '../supabase.js';

export class Search {
  async searchAll(user_email, keyword) {
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .or('deleted.eq.false,deleted.is.null')

      if (error) {
        throw error;
      }

      const lowerKeyword = keyword.toLowerCase();
      const results = data.filter((row) =>
        JSON.stringify(row.entries).toLowerCase().includes(lowerKeyword)
      );

      return { success: true, message: 'Entries retrieved successfully', data: results };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async searchProject(user_email, project_name, keyword) {
    try {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_email', user_email)
        .eq('project_name', project_name)
        .or('deleted.eq.false,deleted.is.null')

      if (error) {
        throw error;
      }

      const lowerKeyword = keyword.toLowerCase();
      const results = data.filter((row) =>
        JSON.stringify(row.entries).toLowerCase().includes(lowerKeyword)
      );

      return { success: true, message: 'Entries retrieved successfully', data: results };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async searchProjects(user_email, keyword) {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_email', user_email)
        .or('deleted.eq.false,deleted.is.null')

      if (error) {
        throw error;
      }

      const lowerKeyword = keyword.toLowerCase();
      const matchingProjects = projects.filter((project) =>
        project.project_name.toLowerCase().includes(lowerKeyword)
      );

      const results = [];
      for (const project of matchingProjects) {
        const { data: entries, error: entriesError } = await supabase
          .from('entries')
          .select('*')
          .eq('user_email', user_email)
          .eq('project_name', project.project_name)
          .or('deleted.eq.false,deleted.is.null')

        if (entriesError) {
          throw entriesError;
        }

        results.push(...entries);
      }

      return { success: true, message: 'Entries retrieved successfully', data: results };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}