import { supabase } from '../supabase.js';
import { AI } from './ai.js';
import { Project } from './project.js';
import { Fields } from './field.js';

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

      if (new_entry !== undefined && new_entry !== null) {
        updateData.entries = new_entry;
      }
      if (due_date !== undefined) updateData.due_date = due_date;
      if (priority !== undefined) updateData.priority = priority;
      if (status !== undefined) updateData.status = status;
      if (started_at !== undefined && started_at !== null) updateData.started_at = started_at;
      if (ended_at !== undefined && ended_at !== null) updateData.ended_at = ended_at;

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
        case 0:
          return { success: true, message: 'Unarchived entries sorted successfully', data };
        case 1: {
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
        case 0:
          return { success: true, message: 'Archived entries sorted successfully', data };
        case 1: {
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

  // Legacy alias used by some routes
  async sortEntries(user_email, project_name, sort_type) {
    return this.sortUnarchivedEntries(user_email, project_name, sort_type);
  }
}

// ─── Natural Language Entry ──────────────────────────────────────────

const PRIORITY_LABELS = {
  0: 'Urgent and important',
  1: 'Urgent but not important',
  2: 'Not urgent, not important',
};

export class Natural_language {
  async entry(email, text) {
    try {
      const project = new Project();
      const entries = new Entries();
      const fields = new Fields();

      // 1. Get user's projects
      const projectsResult = await project.getProjectsByEmail(email);
      if (!projectsResult.success) {
        return { success: false, message: 'Could not fetch projects: ' + projectsResult.message };
      }

      const projectList = (projectsResult.projects || []).filter(p => !p.archived);
      if (projectList.length === 0) {
        return { success: false, message: 'No projects found. Create a project first.' };
      }

      // 2. Get fields for every project
      const projectsWithFields = [];
      for (const p of projectList) {
        const fieldsResult = await fields.getFields(email, p.project_name);
        projectsWithFields.push({
          project_name: p.project_name,
          description: p.description,
          fields: fieldsResult.success ? fieldsResult.data : [],
        });
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // 3. Give AI everything, ask for project + filled field values + priority + due date
      const prompt = `
You are parsing a quick natural-language log entry into structured data.

Today's date is ${today}.

Here are the user's projects, each with its custom fields (field_name, data_type, is_required):
${JSON.stringify(projectsWithFields, null, 2)}

User entry: "${text}"

Figure out which project this entry belongs to, then fill in values for that project's fields based on the entry text.

Also check if the entry text implies a priority level:
- 0 = Urgent and important
- 1 = Urgent but not important
- 2 = Not urgent, not important
If no priority is implied or stated, set "priority" to null.

Also check if the entry text implies a due date (e.g. "by Friday", "due tomorrow", "next week", an explicit date).
Resolve relative dates using today's date above. Return it in YYYY-MM-DD format.
If no due date is implied or stated, set "due_date" to null.

Return ONLY valid JSON, no markdown, no explanation, in this exact shape:
{
  "project": "<matching project_name>",
  "fields": {
    "<field_name>": "<value>",
    ...
  },
  "priority": <0, 1, 2, or null>,
  "due_date": "<YYYY-MM-DD or null>"
}
`.trim();

      // ai.js: takes a prompt string, returns text
      const aiResponse = await AI(prompt);

      if (!aiResponse || aiResponse.trim() === '') {
        return { success: false, message: 'All AI providers failed. Please check that API keys are configured and try again.' };
      }

      let parsed;
      try {
        const cleaned = aiResponse.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (err) {
        return { success: false, message: 'AI returned invalid JSON: ' + aiResponse };
      }

      const matchedProject = projectsWithFields.find(p => p.project_name === parsed.project);
      if (!matchedProject) {
        return { success: false, message: 'AI could not match a valid project.', suggestion: parsed };
      }

      const priorityLabel = parsed.priority !== null && parsed.priority !== undefined
        ? PRIORITY_LABELS[parsed.priority]
        : null;

      // 4. Add the entry using AI's field values as the entries object
      const addResult = await entries.addEntry(
        email,
        parsed.project,
        parsed.fields,
        parsed.due_date || null,  // due_date
        priorityLabel,            // priority
      );

      return {
        success: addResult.success,
        message: addResult.message,
        project: parsed.project,
        fields: parsed.fields,
        priority: priorityLabel,
        due_date: parsed.due_date || null,
      };
    } catch (error) {
      console.log('[Natural_language.entry] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }
}
