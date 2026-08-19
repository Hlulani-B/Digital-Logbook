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

      // 2. Get fields for every existing project
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

      // 3. Give AI everything, ask it to match or propose a new project
      const prompt = `Parse this log entry into JSON. Today is ${today}.

Existing projects with fields:
${JSON.stringify(projectsWithFields)}

Entry: "${text}"

Rules:
- Try to match this entry to one of the existing projects above.
- Set "matched" to 1 if you found a matching project, or 0 if none of the existing projects fit.
- If matched=1: set "project" to the matching project_name, and "fields" to an object of field_name:value pairs filled from the entry text using that project's existing fields.
- If matched=0: invent a short sensible new project name in "project", and return "new_fields" as an array of field definitions this new project should have, each shaped like {"field_name":"...", "data_type":"text", "is_required":false}. Keep it to 1-3 fields that make sense for this kind of entry. Also return "fields" as an object of field_name:value pairs filled in for this entry, matching the field_names in new_fields.
- Priority: 0=urgent+important, 1=urgent only, 2=not urgent, null=none
- Due date: YYYY-MM-DD or null
- Write a short, soft, human comment back to the user about this entry. One sentence, warm and low-key, not robotic praise. Base it on what they logged. Do not repeat the entry text verbatim.

Respond with ONLY this JSON structure, nothing else:
{"matched":1,"project":"name","fields":{"field":"value"},"new_fields":[],"priority":0,"due_date":"2024-01-01","comment":"Nice progress on the design work — those late sessions are really adding up."}`;

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

      const priorityLabel = parsed.priority !== null && parsed.priority !== undefined
        ? PRIORITY_LABELS[parsed.priority]
        : null;

      // ── Case: matched an existing project ──
      if (parsed.matched === 1) {
        const matchedProject = projectsWithFields.find(p => p.project_name === parsed.project);
        if (!matchedProject) {
          return { success: false, message: 'AI claimed a match but the project was not found.', suggestion: parsed };
        }

        const addResult = await entries.addEntry(
          email,
          parsed.project,
          parsed.fields,
          parsed.due_date || null,
          priorityLabel,
        );

        return {
          success: addResult.success,
          message: addResult.message,
          project: parsed.project,
          fields: parsed.fields,
          priority: priorityLabel,
          due_date: parsed.due_date || null,
          comment: parsed.comment || null,
          created_new_project: false,
        };
      }

      // ── Case: no match, create a new project + its fields, then add the entry ──
      const newProjectName = parsed.project;
      if (!newProjectName) {
        return { success: false, message: 'AI could not determine a project for this entry.', suggestion: parsed };
      }

      const createProjectResult = await project.addProject(email, newProjectName, null);
      if (!createProjectResult.success) {
        return { success: false, message: 'Failed to create new project: ' + createProjectResult.message };
      }

      const newFields = Array.isArray(parsed.new_fields) ? parsed.new_fields : [];
      for (const f of newFields) {
        if (!f.field_name) continue;
        await fields.addField(
          email,
          newProjectName,
          f.field_name,
          f.data_type || 'text',
          !!f.is_required,
        );
      }

      const addResult = await entries.addEntry(
        email,
        newProjectName,
        parsed.fields,
        parsed.due_date || null,
        priorityLabel,
      );

      return {
        success: addResult.success,
        message: addResult.message,
        project: newProjectName,
        fields: parsed.fields,
        priority: priorityLabel,
        due_date: parsed.due_date || null,
        comment: parsed.comment || null,
        created_new_project: true,
        new_fields: newFields,
      };
    } catch (error) {
      console.log('[Natural_language.entry] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }
}
