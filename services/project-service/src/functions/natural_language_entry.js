import { AI } from './ai.js';
import { Entries } from './entries.js';
import { Project } from './project.js';

export class NaturalLanguage {
  async parseAndCreateEntry(user_email, natural_text) {
    try {
      // First, get user's projects to help AI pick the right one
      const projectHandler = new Project();
      const projectsResult = await projectHandler.getProjects(user_email);
      const projectNames = (projectsResult?.data || []).map(p => p.project_name);

      if (projectNames.length === 0) {
        return { success: false, message: 'No projects found. Create a project first.' };
      }

      // Ask AI to parse the natural language text
      const prompt = `You are a logbook entry parser. Given the user's natural language text and their list of projects, extract structured entry data.

User's projects: ${JSON.stringify(projectNames)}

User's text: "${natural_text}"

Return JSON with these fields:
{
  "project_name": "the matching project name from the list",
  "entry_object": { "key": "value pairs for any content/description fields" },
  "due_date": "ISO date string or null",
  "priority": "Urgent and important" | "Urgent but not important" | "Not urgent, not important" | null,
  "status": "up_next" | "in_motion" | "done_and_dusted"
}

Rules:
- Match the project name as closely as possible from the user's projects list
- Put the main description/content into entry_object with a "description" key
- If the user mentions a date, convert to ISO format for due_date
- If the user mentions urgency/priority, map to the closest priority label
- If the user mentions status (done, in progress, etc), map accordingly
- Default status to "up_next" if not clear
- Keep entry_object simple - just {"description": "the main content"}
- Return ONLY valid JSON, no explanation`;

      const aiResponse = await AI(prompt);
      if (!aiResponse) {
        return { success: false, message: 'AI could not parse the entry. Try being more specific.' };
      }

      let parsed;
      try {
        // Strip markdown code blocks if present
        const cleaned = aiResponse.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.error('Failed to parse AI response:', aiResponse);
        return { success: false, message: 'AI response could not be parsed. Try again.' };
      }

      // Validate project name exists
      if (!parsed.project_name || !projectNames.includes(parsed.project_name)) {
        return { 
          success: false, 
          message: `Could not match project "${parsed.project_name}". Your projects: ${projectNames.join(', ')}` 
        };
      }

      // Create the entry
      const entriesHandler = new Entries();
      const result = await entriesHandler.addEntry(
        user_email,
        parsed.project_name,
        parsed.entry_object || { description: natural_text },
        parsed.due_date || null,
        parsed.priority || null,
        parsed.status || 'up_next',
        null, // started_at
        null, // ended_at
        null  // duration
      );

      return {
        success: true,
        message: 'Entry created successfully',
        data: {
          ...result,
          parsed: {
            project_name: parsed.project_name,
            priority: parsed.priority,
            status: parsed.status,
            due_date: parsed.due_date,
          }
        }
      };
    } catch (error) {
      console.error('Natural language entry error:', error);
      return { success: false, message: error.message };
    }
  }
}
