import pool from '../db.js';
import { AI } from './ai.js';
import { Project } from './project.js';
import { Fields } from './field.js';
import { format, addDays, nextDay, endOfMonth, startOfDay } from 'date-fns';
import leven from 'leven';

export class Entries {
  async addEntry(user_email, project_name, entry_object, due_date, priority, status, started_at, ended_at, duration) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      const insertData = { user_email, project_name, entries: entry_object };
      if (due_date !== undefined && due_date !== null) insertData.due_date = due_date;
      if (priority !== undefined && priority !== null) insertData.priority = priority;
      if (status !== undefined && status !== null) insertData.status = status;
      if (started_at !== undefined && started_at !== null) insertData.started_at = started_at;
      if (ended_at !== undefined && ended_at !== null) insertData.ended_at = ended_at;
      if (duration !== undefined && duration !== null) insertData.duration = duration;

      console.log('[addEntry] Inserting:', JSON.stringify(insertData));

      const columns = Object.keys(insertData);
      const values = Object.values(insertData).map(v =>
        (v !== null && typeof v === 'object') ? JSON.stringify(v) : v
      );
      const placeholders = columns.map((_, i) => `$${i + 1}`);

      const { rows } = await pool.query(
        `INSERT INTO entries (${columns.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values
      );

      console.log('[addEntry] Success, id:', rows?.[0]?.id);
      return { success: true, message: 'Entry added successfully', data: rows };
    } catch (error) {
      console.error('[addEntry] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  async updateEntry(user_email, project_name, entry_id, new_entry, due_date, priority, status, started_at, ended_at, duration) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

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

      const setClauses = [];
      const params = [];
      let idx = 1;
      for (const [key, value] of Object.entries(updateData)) {
        const val = (value !== null && typeof value === 'object') ? JSON.stringify(value) : value;
        setClauses.push(`${key} = $${idx++}`);
        params.push(val);
      }
      params.push(entry_id, user_email, project_name);

      const { rows } = await pool.query(
        `UPDATE entries SET ${setClauses.join(', ')}
         WHERE id = $${idx++} AND user_email = $${idx++} AND project_name = $${idx}
         RETURNING *`,
        params
      );

      if (!rows || rows.length === 0) {
        console.error('[updateEntry] No rows matched. id:', entry_id, 'user:', user_email, 'project:', project_name);
        return { success: false, message: 'Entry not found. Check that the entry exists and belongs to this user/project.' };
      }

      console.log('[updateEntry] Success, id:', rows[0].id);
      return { success: true, message: 'Entry updated successfully', data: rows };
    } catch (error) {
      console.error('[updateEntry] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  async getEntries(user_email, project_name) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `SELECT * FROM entries
         WHERE user_email = $1 AND project_name = $2 AND deleted = false`,
        [user_email, project_name]
      );

      return { success: true, message: 'Entries retrieved successfully', data: rows };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getAllEntries(user_email) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `SELECT * FROM entries
         WHERE user_email = $1 AND deleted = false
         ORDER BY created_at DESC`,
        [user_email]
      );

      return { success: true, message: 'All entries retrieved successfully', data: rows };
    } catch (error) {
      console.log('getAllEntries error:', error);
      return { success: false, message: error.message };
    }
  }

  async deleteEntry(user_email, project_name, entry) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `UPDATE entries SET deleted = true
         WHERE user_email = $1 AND project_name = $2 AND entries = $3 AND deleted = false
         RETURNING *`,
        [user_email, project_name, JSON.stringify(entry)]
      );

      if (!rows || rows.length === 0) {
        return { success: false, message: 'Entry not found. Something went wrong' };
      }

      console.log('Entry soft-deleted successfully');
      return { success: true, message: 'Entry deleted successfully' };
    } catch (error) {
      console.log('deleteEntry error:', error);
      return { success: false, message: error.message };
    }
  }

  async deleteEntryById(user_email, entry_id) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      await pool.query(
        `UPDATE entries SET deleted = true
         WHERE id = $1 AND user_email = $2 AND deleted = false`,
        [entry_id, user_email]
      );

      console.log('Entry soft-deleted by id:', entry_id);
      return { success: true, message: 'Entry deleted successfully' };
    } catch (error) {
      console.log('deleteEntryById error:', error);
      return { success: false, message: error.message };
    }
  }

  async sortUnarchivedEntries(user_email, project_name, sort_type) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      let query = `SELECT * FROM entries
         WHERE user_email = $1 AND deleted = false AND (archived = false OR archived IS NULL)`;
      const params = [user_email];

      if (project_name) {
        params.push(project_name);
        query += ` AND project_name = $${params.length}`;
      }

      query += ` ORDER BY due_date ASC`;

      const { rows: data } = await pool.query(query, params);

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
      if (!pool) throw new Error('Database pool not initialized');

      let query = `SELECT * FROM entries
         WHERE user_email = $1 AND deleted = false AND archived = true`;
      const params = [user_email];

      if (project_name) {
        params.push(project_name);
        query += ` AND project_name = $${params.length}`;
      }

      query += ` ORDER BY due_date ASC`;

      const { rows: data } = await pool.query(query, params);

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

// ─── Date Extraction Helper ─────────────────────────────────────────
// Parses date keywords from user text and returns a calculated YYYY-MM-DD date.
// This way we NEVER rely on the AI for date math — we calculate it ourselves.

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// All known date keywords — used as the dictionary for fuzzy matching
const DATE_KEYWORDS = [
  'today', 'tomorrow', 'yesterday',
  'week', 'month',
  ...DAY_NAMES,
  ...MONTH_NAMES,
  ...MONTH_NAMES.map(m => m.substring(0, 3)), // short month names: jan, feb, mar, etc.
];

/**
 * Fuzzy-corrects misspelled date keywords in text using leven (Levenshtein distance).
 * Only corrects words that are close matches to known date keywords.
 * @param {string} text - lowercased input text
 * @returns {string} text with misspelled date keywords corrected
 */
function correctDateKeywords(text) {
  const words = text.split(/(\s+)/);
  return words.map(word => {
    const alpha = word.replace(/[^a-z]/g, '');
    if (!alpha || alpha.length < 4) return word; // skip short words (too many false positives)
    // If it's already an exact keyword, keep as-is
    if (DATE_KEYWORDS.includes(alpha)) return word;
    
    // Find the closest keyword match using Levenshtein distance
    let bestMatch = null;
    let bestDistance = Infinity;
    const maxDistance = Math.floor(alpha.length * 0.4); // Allow up to 40% edit distance (1 for 4-char, 2 for 5-7-char, 3 for 8+)
    
    for (const keyword of DATE_KEYWORDS) {
      const distance = leven(alpha, keyword);
      if (distance <= maxDistance && distance < bestDistance) {
        bestDistance = distance;
        bestMatch = keyword;
      }
    }
    
    if (bestMatch) {
      // Replace only the alpha part, preserve surrounding punctuation
      return word.replace(alpha, bestMatch);
    }
    return word;
  }).join('');
}

function toISODate(date) {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Extracts a due date from natural language text.
 * @param {string} text - The user's input text
 * @returns {{ dueDate: string|null, cleanedText: string }}
 *   dueDate: YYYY-MM-DD string if a date was found, null otherwise
 *   cleanedText: the text with date references removed (so AI doesn't re-parse them)
 */
export function getDate(text) {
  if (!text || typeof text !== 'string') {
    return { dueDate: null, cleanedText: text || '' };
  }

  const today = startOfDay(new Date());
  const lower = text.toLowerCase();
  // Fuzzy-correct misspelled date keywords before matching
  let cleaned = correctDateKeywords(lower);
  let dueDate = null;

  // ── 1. "today" ──
  if (/\btoday\b/.test(cleaned)) {
    dueDate = toISODate(today);
    cleaned = cleaned.replace(/\btoday\b/, '');
    return { dueDate, cleanedText: cleaned.trim() };
  }

  // ── 2. "tomorrow" ──
  if (/\btomorrow\b/.test(cleaned)) {
    dueDate = toISODate(addDays(today, 1));
    cleaned = cleaned.replace(/\btomorrow\b/, '');
    return { dueDate, cleanedText: cleaned.trim() };
  }

  // ── 3. "yesterday" ──
  if (/\byesterday\b/.test(cleaned)) {
    dueDate = toISODate(addDays(today, -1));
    cleaned = cleaned.replace(/\byesterday\b/, '');
    return { dueDate, cleanedText: cleaned.trim() };
  }

  // ── 4. "next week" ──
  if (/\bnext\s+week\b/.test(cleaned)) {
    dueDate = toISODate(addDays(today, 7));
    cleaned = cleaned.replace(/\bnext\s+week\b/, '');
    return { dueDate, cleanedText: cleaned.trim() };
  }

  // ── 5. "in X days" / "in X weeks" ──
  const inXMatch = cleaned.match(/\bin\s+(\d+)\s+(day|days|week|weeks)\b/);
  if (inXMatch) {
    const num = parseInt(inXMatch[1], 10);
    const unit = inXMatch[2];
    const daysToAdd = unit.startsWith('week') ? num * 7 : num;
    dueDate = toISODate(addDays(today, daysToAdd));
    cleaned = cleaned.replace(inXMatch[0], '');
    return { dueDate, cleanedText: cleaned.trim() };
  }

  // ── 6. "next monday", "next tuesday", etc. (check BEFORE bare day names) ──
  for (let i = 0; i < DAY_NAMES.length; i++) {
    const regex = new RegExp(`\\bnext\\s+${DAY_NAMES[i]}\\b`);
    if (regex.test(cleaned)) {
      dueDate = toISODate(nextDay(today, i));
      cleaned = cleaned.replace(regex, '');
      return { dueDate, cleanedText: cleaned.trim() };
    }
  }

  // ── 7. Day names: "monday", "tuesday", etc. → next occurrence ──
  for (let i = 0; i < DAY_NAMES.length; i++) {
    const regex = new RegExp(`\\b${DAY_NAMES[i]}\\b`);
    if (regex.test(cleaned)) {
      dueDate = toISODate(nextDay(today, i));
      cleaned = cleaned.replace(regex, '');
      return { dueDate, cleanedText: cleaned.trim() };
    }
  }

  // ── 8. "end of the month" / "end of month" / "end of this month" ──
  if (/\bend\s+of\s+(the\s+)?month\b/.test(cleaned)) {
    dueDate = toISODate(endOfMonth(today));
    cleaned = cleaned.replace(/\bend\s+of\s+(the\s+)?month\b/, '');
    return { dueDate, cleanedText: cleaned.trim() };
  }

  // ── 9. "end of the week" / "end of week" ──
  if (/\bend\s+of\s+(the\s+)?week\b/.test(cleaned)) {
    // End of week = next Friday (day 5)
    dueDate = toISODate(nextDay(today, 5));
    cleaned = cleaned.replace(/\bend\s+of\s+(the\s+)?week\b/, '');
    return { dueDate, cleanedText: cleaned.trim() };
  }

  // ── 10. Explicit date: "august 25", "aug 25", "25 december", "dec 25th 2025" ──
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const shortMonth = MONTH_NAMES[i].substring(0, 3);
    const monthPattern = `(?:${MONTH_NAMES[i]}|${shortMonth})`;
    // "month day" or "day month" patterns
    const mdRegex = new RegExp(`\\b(?:${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`);
    const dmRegex = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:${monthPattern})\\b`);
    const yearSuffix = `(?:\\s+(\\d{4}))?`;

    let mdMatch = cleaned.match(new RegExp(mdRegex.source + yearSuffix));
    if (mdMatch) {
      const day = parseInt(mdMatch[1], 10);
      const year = mdMatch[2] ? parseInt(mdMatch[2], 10) : today.getFullYear();
      const parsed = new Date(year, i, day);
      if (parsed.getMonth() === i && parsed.getDate() === day) {
        dueDate = toISODate(parsed);
        cleaned = cleaned.replace(mdMatch[0], '');
        return { dueDate, cleanedText: cleaned.trim() };
      }
    }

    let dmMatch = cleaned.match(new RegExp(dmRegex.source + yearSuffix));
    if (dmMatch) {
      const day = parseInt(dmMatch[1], 10);
      const year = dmMatch[2] ? parseInt(dmMatch[2], 10) : today.getFullYear();
      const parsed = new Date(year, i, day);
      if (parsed.getMonth() === i && parsed.getDate() === day) {
        dueDate = toISODate(parsed);
        cleaned = cleaned.replace(dmMatch[0], '');
        return { dueDate, cleanedText: cleaned.trim() };
      }
    }
  }

  // ── 11. No date found ──
  return { dueDate: null, cleanedText: text };
}

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

      // ── Pre-calculate the due date from keywords BEFORE involving AI ──
      // This way the AI NEVER has to guess dates — we already know the answer.
      const { dueDate: calculatedDate, cleanedText } = getDate(text);

      const today = toISODate(new Date());

      const commentInstruction = calculatedDate
        ? `Write a warm, human comment (1-2 sentences) back to the user. Keep it natural and low-key — no need to mention the date unless it feels relevant. If matched=1, say something like "Added to [project name] — [warm comment about the task]." If matched=0, say something like "Created new project [project name] and added your first entry — [warm comment]." If matched=2, say something like "Created project [project name] for you — [warm comment about getting started]." If matched=3, summarise what was added across the projects — e.g. "Added entries to WebApp and MobileApp, and created DevOps for you."`
        : `Write a warm, human comment (2-3 sentences) back to the user. Let them know that no due date was set because no date reference (like "today", "tomorrow", "Monday", etc.) was found in their text. Suggest they can edit the entry later to add a due date if needed. If matched=1, say something like "Added to [project name] — [warm comment about the task]. I couldn't pick up a due date from your text though, so it's been left blank for now — you can always edit it to add one.". If matched=0, say something like "Created new project [project name] and added your first entry — [warm comment]. I didn't catch a due date in there, so it's unset for now — feel free to edit it later if you need one.". If matched=2, say something like "Created project [project name] for you — [warm comment]. You can start adding entries to it whenever you're ready.". If matched=3, summarise what was added across the projects and mention no due date was set.`;

      const prompt = `Parse this log entry into JSON. Today is ${today}.

Existing projects with fields:
${JSON.stringify(projectsWithFields)}

Entry: "${cleanedText}"

=== STEP 1: REASONING (MANDATORY) ===
Before responding, you MUST think step-by-step in your "comment" field. Show your reasoning:
1. What DISTINCT activities/tasks are mentioned? List each one separately.
2. For each activity, which existing project does it belong to? If NONE match clearly, say "NEW PROJECT needed".
3. Are any activities being forced together that don't belong? If yes, SPLIT them.
4. Final decision: matched=0, 1, 2, or 3?

=== STEP 2: SPLITTING RULES (STRICT) ===
You MUST split into separate entries when the input contains MULTIPLE DISTINCT activities.

SPLIT these into separate entries:
- "going to the gym and making chips" → TWO entries: Gym (going to the gym) + Cooking (making chips) — COMPLETELY DIFFERENT activities
- "fixed login bug and updated docs for WebApp" → TWO entries in same project
- "buy groceries, cook dinner, clean kitchen" → THREE entries
- "study maths and go for a run" → TWO entries: Maths + Fitness
- "call the dentist and email the professor" → TWO entries: Health + Education

DO NOT split these (single activity):
- "worked on the login feature for WebApp" → ONE entry
- "studied chapter 5 and 6 for maths" → ONE entry (studying covers both)
- "meeting with the team about API redesign" → ONE entry

HARD RULE: If two activities would naturally belong to DIFFERENT projects/categories, they MUST be separate. NEVER create combined project names like "Gym and Cooking" — that is WRONG.

=== STEP 3: PROJECT MATCHING RULES (STRICT) ===
- If you are UNSURE which existing project a task belongs to, DO NOT GUESS.
- Instead, create a NEW project for that task (use matched=3 with "new" array).
- In your comment, explain: "I wasn't sure which project this belonged to, so I created a new one."
- If the task mentions a project name EXPLICITLY (e.g., "for WebApp"), use that project.
- If the task is VAGUE and could fit multiple projects, create a NEW project.
- GUESSING IS FORBIDDEN. When in doubt, create new.

=== STEP 4: MATCHED VALUES ===
- matched=0: Single task, NO existing project matches. Create ONE new project + entry.
- matched=1: Single task, fits ONE existing project EXACTLY. You are CERTAIN it belongs there.
- matched=2: User ONLY wants to create a project (no entry). Examples: "create a project called X".
- matched=3: MULTIPLE distinct tasks OR you are UNSURE about project matching. Split into "old" (existing projects you're CERTAIN about) and "new" (new projects for tasks that don't clearly fit).

=== STEP 5: RESPONSE FORMAT ===
If matched=0: {"matched":0,"project":"NewProjectName","fields":{"field":"value"},"new_fields":[{"field_name":"...","data_type":"text","is_required":false}],"priority":null,"comment":"Your reasoning here..."}
If matched=1: {"matched":1,"project":"ExistingProjectName","fields":{"field":"value"},"priority":null,"comment":"Your reasoning here..."}
If matched=2: {"matched":2,"project":"NewProjectName","new_fields":[],"fields":{},"priority":null,"comment":"Your reasoning here..."}
If matched=3: {"matched":3,"old":[{"ExistingProject":{"field":"value"}}],"new":[{"project_name":"NewProject","fields":{"field":"value"},"new_fields":[{"field_name":"...","data_type":"text","is_required":false}]}],"priority":null,"comment":"Your reasoning here..."}

RULES:
- NEVER include "due_date", "priority", or "status" as custom fields — these are built-in.
- Priority: 0=urgent+important, 1=urgent only, 2=not urgent, null=none
- DO NOT include a "due_date" field — the system handles dates separately.
- ${commentInstruction}
- In your comment, EXPLAIN your reasoning: why you split tasks the way you did, why you chose certain projects, and why you created new ones when unsure.

Respond with ONLY this JSON, nothing else:`;

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

      console.log('[Natural_language] AI response parsed:', JSON.stringify(parsed, null, 2));
      console.log('[Natural_language] matched =', parsed.matched, '(type:', typeof parsed.matched + ')');

      const priorityLabel = parsed.priority !== null && parsed.priority !== undefined
        ? PRIORITY_LABELS[parsed.priority]
        : null;

      // ── Case: matched an existing project ──
      if (parsed.matched === 1) {
        console.log('[Natural_language] Taking matched=1 branch');
        const matchedProject = projectsWithFields.find(p => p.project_name === parsed.project);
        if (!matchedProject) {
          return { success: false, message: 'AI claimed a match but the project was not found.', suggestion: parsed };
        }

        const addResult = await entries.addEntry(
          email,
          parsed.project,
          parsed.fields,
          calculatedDate || null,
          priorityLabel,
        );

        return {
          success: addResult.success,
          message: addResult.message,
          project: parsed.project,
          fields: parsed.fields,
          priority: priorityLabel,
          due_date: calculatedDate || null,
          comment: parsed.comment || null,
          created_new_project: false,
        };
      }

      // ── Case: matched=2, user only wants to create a project (no entry) ──
      if (parsed.matched === 2) {
        // ── Case: user only wants to create a project (no entry) ──
        console.log('[Natural_language] Taking matched=2 (create project only) branch');
        const newProjectName = parsed.project;
        if (!newProjectName) {
          return { success: false, message: 'AI could not determine a project name.', suggestion: parsed };
        }

        console.log('[Natural_language] Creating project only:', newProjectName);
        const createProjectResult = await project.addProject(email, newProjectName, null);
        console.log('[Natural_language] Create project result:', createProjectResult);
        if (!createProjectResult.success) {
          return { success: false, message: 'Failed to create project: ' + createProjectResult.message };
        }

        const newFields = Array.isArray(parsed.new_fields) ? parsed.new_fields : [];
        console.log('[Natural_language] Creating', newFields.length, 'fields:', newFields);
        for (const f of newFields) {
          if (!f.field_name) continue;
          const addFieldResult = await fields.addField(
            email,
            newProjectName,
            f.field_name,
            f.data_type || 'text',
            !!f.is_required,
          );
          console.log('[Natural_language] Add field', f.field_name, 'result:', addFieldResult);
        }

        return {
          success: true,
          message: `Project "${newProjectName}" created successfully.`,
          project: newProjectName,
          fields: {},
          priority: null,
          due_date: null,
          comment: parsed.comment || `Created project "${newProjectName}" for you.`,
          created_new_project: true,
          project_only: true,
          new_fields: newFields,
        };
      }

      // ── Case: matched=3, multiple entries across different projects ──
      if (parsed.matched === 3) {
        console.log('[Natural_language] Taking matched=3 (multi-project) branch');

        const oldEntries = Array.isArray(parsed.old) ? parsed.old : [];
        const newEntries = Array.isArray(parsed.new) ? parsed.new : [];
        const results = { old: [], new: [], errors: [] };

        // Process entries for existing projects
        for (const item of oldEntries) {
          const projectNames = Object.keys(item);
          for (const projName of projectNames) {
            const matchedProject = projectsWithFields.find(p => p.project_name === projName);
            if (!matchedProject) {
              results.errors.push(`Project "${projName}" not found, skipping.`);
              continue;
            }
            const fieldValues = item[projName] || {};
            try {
              const addResult = await entries.addEntry(
                email,
                projName,
                fieldValues,
                calculatedDate || null,
                priorityLabel,
              );
              if (addResult.success) {
                results.old.push({ project_name: projName, fields: fieldValues });
              } else {
                results.errors.push(`Failed to add entry to "${projName}": ${addResult.message}`);
              }
            } catch (err) {
              results.errors.push(`Error adding entry to "${projName}": ${err.message}`);
            }
          }
        }

        // Process entries for new projects
        for (const item of newEntries) {
          const projName = item.project_name;
          if (!projName) {
            results.errors.push('New project entry missing project_name, skipping.');
            continue;
          }
          const fieldValues = item.fields || {};
          const newFields = Array.isArray(item.new_fields) ? item.new_fields : [];

          try {
            // Create the project
            const createProjectResult = await project.addProject(email, projName, null);
            if (!createProjectResult.success) {
              results.errors.push(`Failed to create project "${projName}": ${createProjectResult.message}`);
              continue;
            }

            // Create fields for the new project
            for (const f of newFields) {
              if (!f.field_name) continue;
              await fields.addField(
                email,
                projName,
                f.field_name,
                f.data_type || 'text',
                !!f.is_required,
              );
            }

            // Add the entry
            const addResult = await entries.addEntry(
              email,
              projName,
              fieldValues,
              calculatedDate || null,
              priorityLabel,
            );
            if (addResult.success) {
              results.new.push({ project_name: projName, fields: fieldValues, new_fields: newFields });
            } else {
              results.errors.push(`Created project "${projName}" but failed to add entry: ${addResult.message}`);
            }
          } catch (err) {
            results.errors.push(`Error processing "${projName}": ${err.message}`);
          }
        }

        const totalOld = results.old.length;
        const totalNew = results.new.length;
        const successCount = totalOld + totalNew;

        if (successCount === 0 && results.errors.length > 0) {
          return { success: false, message: results.errors.join('; ') };
        }

        return {
          success: true,
          message: `Added ${successCount} ${successCount === 1 ? 'entry' : 'entries'} across ${totalNew > 0 ? totalNew + ' new project' + (totalNew > 1 ? 's' : '') + ' and ' : ''}${totalOld > 0 ? totalOld + ' existing project' + (totalOld > 1 ? 's' : '') : ''}.`,
          multi: true,
          results,
          priority: priorityLabel,
          due_date: calculatedDate || null,
          comment: parsed.comment || null,
          created_new_project: totalNew > 0,
        };
      }

      // ── Case: matched=0, no match — create a new project + its fields, then add the entry ──
      console.log('[Natural_language] Taking matched=0 (create new project) branch');
      const newProjectName = parsed.project;
      if (!newProjectName) {
        return { success: false, message: 'AI could not determine a project for this entry.', suggestion: parsed };
      }

      console.log('[Natural_language] Creating new project:', newProjectName);
      const createProjectResult = await project.addProject(email, newProjectName, null);
      console.log('[Natural_language] Create project result:', createProjectResult);
      if (!createProjectResult.success) {
        return { success: false, message: 'Failed to create new project: ' + createProjectResult.message };
      }

      const newFields = Array.isArray(parsed.new_fields) ? parsed.new_fields : [];
      console.log('[Natural_language] Creating', newFields.length, 'fields:', newFields);
      for (const f of newFields) {
        if (!f.field_name) continue;
        const addFieldResult = await fields.addField(
          email,
          newProjectName,
          f.field_name,
          f.data_type || 'text',
          !!f.is_required,
        );
        console.log('[Natural_language] Add field', f.field_name, 'result:', addFieldResult);
      }

      const addResult = await entries.addEntry(
        email,
        newProjectName,
        parsed.fields,
        calculatedDate || null,
        priorityLabel,
      );

      return {
        success: addResult.success,
        message: addResult.message,
        project: newProjectName,
        fields: parsed.fields,
        priority: priorityLabel,
        due_date: calculatedDate || null,
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
