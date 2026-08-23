import pool from "../db.js";
import { AI } from './ai.js';
import { Project } from './project.js';
import { Entries } from './entries.js';
import { Fields } from './field.js';

const PRIORITY = Object.freeze({
  0: 'Urgent and important',
  1: 'Urgent but not important',
  2: 'Not urgent, not important',
});

const project = new Project();
const entries = new Entries();
const fields = new Fields();

export class Priority {
  async setPriority(user_email, priorityValue, project_name, entry_id) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
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

      await pool.query(
        `UPDATE entries SET priority = $1
         WHERE id = $2 AND user_email = $3 AND project_name = $4`,
        [newPriority, entry_id, user_email, project_name]
      );

      const label = newPriority || 'none';
      return { success: true, message: `Priority set to ${label}` };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}

export class Natural_language {
  async entry(email, text) {
    try {
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

      // 3. Give AI everything, ask for project + filled field values
      const prompt = `
You are parsing a quick natural-language log entry into structured data.

Here are the user's projects, each with its custom fields (field_name, data_type, is_required):
${JSON.stringify(projectsWithFields, null, 2)}

User entry: "${text}"

Figure out which project this entry belongs to, then fill in values for that project's fields based on the entry text.

Return ONLY valid JSON, no markdown, no explanation, in this exact shape:
{
  "project": "<matching project_name>",
  "fields": {
    "<field_name>": "<value>",
    ...
  }
}
`.trim();

      // ai.js: takes a prompt string, returns text
      const aiResponse = await AI(prompt);

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

      // 4. Add the entry using AI's field values as the entries object
      const addResult = await entries.addEntry(
        email,
        parsed.project,
        parsed.fields
      );

      return {
        success: addResult.success,
        message: addResult.message,
        project: parsed.project,
        fields: parsed.fields,
      };
    } catch (error) {
      console.log('[Natural_language.entry] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }
}
