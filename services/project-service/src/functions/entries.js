import pool from '../db.js';
import { AI } from './ai.js';
import { Project } from './project.js';
import { Fields } from './field.js';
import { format, addDays, nextDay, endOfMonth, startOfDay } from 'date-fns';
import leven from 'leven';

export class Entries {
  async addEntry(
    user_email,
    project_name,
    entry_object,
    due_date,
    priority,
    status,
    started_at,
    ended_at,
    duration,
    summary
  ) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      const insertData = { user_email, project_name, entries: entry_object };
      if (due_date !== undefined && due_date !== null) insertData.due_date = due_date;
      if (priority !== undefined && priority !== null) insertData.priority = priority;
      if (status !== undefined && status !== null) insertData.status = status;
      if (started_at !== undefined && started_at !== null) insertData.started_at = started_at;
      if (ended_at !== undefined && ended_at !== null) insertData.ended_at = ended_at;
      if (duration !== undefined && duration !== null) insertData.duration = duration;
      if (summary !== undefined && summary !== null) insertData.summary = summary;

      console.log('[addEntry] Inserting:', JSON.stringify(insertData));

      const columns = Object.keys(insertData);
      const values = Object.values(insertData).map((v) =>
        v !== null && typeof v === 'object' ? JSON.stringify(v) : v
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

  async updateEntry(
    user_email,
    project_name,
    entry_id,
    new_entry,
    due_date,
    priority,
    status,
    started_at,
    ended_at,
    duration
  ) {
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

      console.log(
        '[updateEntry] Updating entry_id:',
        entry_id,
        'data:',
        JSON.stringify(updateData)
      );

      const setClauses = [];
      const params = [];
      let idx = 1;
      for (const [key, value] of Object.entries(updateData)) {
        const val = value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
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
        console.error(
          '[updateEntry] No rows matched. id:',
          entry_id,
          'user:',
          user_email,
          'project:',
          project_name
        );
        return {
          success: false,
          message: 'Entry not found. Check that the entry exists and belongs to this user/project.',
        };
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
          return {
            success: true,
            message: 'Unarchived entries sorted successfully',
            data: results,
          };
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
const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

// All known date keywords — used as the dictionary for fuzzy matching
const DATE_KEYWORDS = [
  'today',
  'tomorrow',
  'yesterday',
  'week',
  'month',
  ...DAY_NAMES,
  ...MONTH_NAMES,
  ...MONTH_NAMES.map((m) => m.substring(0, 3)), // short month names: jan, feb, mar, etc.
];

/**
 * Fuzzy-corrects misspelled date keywords in text using leven (Levenshtein distance).
 * Only corrects words that are close matches to known date keywords.
 * @param {string} text - lowercased input text
 * @returns {string} text with misspelled date keywords corrected
 */
function correctDateKeywords(text) {
  const words = text.split(/(\s+)/);
  return words
    .map((word) => {
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
    })
    .join('');
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
  /**
   * Generate a one-sentence summary for an entry using AI.
   * @param {string} projectName - The project the entry belongs to
   * @param {object} entryObject - The entry fields (key-value pairs)
   * @returns {Promise<string|null>} One-sentence summary, or null on failure
   */
  async generateSummary(projectName, entryObject) {
    try {
      const prompt = `Given this logbook entry, write a single concise sentence summarising what was done. No more than 20 words. Do NOT use first-person pronouns (I, my, we). Write in a neutral, factual style.

Project: ${projectName}
Entry: ${JSON.stringify(entryObject)}

Respond with ONLY the summary sentence. Nothing else.`;

      const result = await AI(prompt);
      if (!result || !result.trim()) return null;
      return result.trim().replace(/^["']|["']$/g, '');
    } catch (err) {
      console.error('[generateSummary] Failed:', err.message);
      return null;
    }
  }

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

      const projectList = (projectsResult.projects || []).filter((p) => !p.archived);

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
        ? `The "comment" field is a MESSAGE shown to the user as a notification. Write it as a friendly message they'll read on screen — 1-2 sentences, casual and warm, like a text from a friend. NEVER say "The user" — talk TO them directly.\n- CORRECT: "Skydiving and cooking lessons — both sorted! Created new projects for each."\n- WRONG: "The user wants to engage in two distinct activities. I created new projects for each activity."\n- CORRECT: "Added to WebApp — looks like a solid bug fix."\n- WRONG: "The user mentioned a bug fix so I added it to the WebApp project."\nIf matched=1: "Added to [project] — [friendly comment]." If matched=0: "Created [project] and added your first entry — [friendly comment]." If matched=2: "Created [project] for you — [friendly comment]." If matched=3: briefly say what was added in a natural way.`
        : `The "comment" field is a MESSAGE shown to the user as a notification. Write it as a friendly message they'll read on screen — 2-3 sentences, casual and warm. Let them know no due date was set. NEVER say "The user" — talk TO them directly.\n- CORRECT: "Added to WebApp — nice bug fix! Didn't catch a due date though, so it's blank for now. You can edit it later."\n- WRONG: "The user wants to fix a bug in WebApp. I added the entry but no due date was set."\nIf matched=1: "Added to [project] — [friendly comment]. No due date picked up, feel free to edit." If matched=0: "Created [project] — [friendly comment]. No due date set, you can add one later." If matched=2: "Created [project] for you — [friendly comment]." If matched=3: briefly say what was added and mention no due date.`;

      const prompt = `Parse this log entry into JSON. Today is ${today}.

Existing projects with fields:
${JSON.stringify(projectsWithFields)}

Entry: "${cleanedText}"

=== STEP 0: UNDERSTAND THE INPUT (CRITICAL) ===
Read the ENTIRE user input carefully. PARAPHRASE neatly into clear, well-written task descriptions.
- Do NOT just extract random words or copy the raw text verbatim. REWRITE it as a clean, concise description that captures the full meaning.
- If the user says "gonna grab some food real quick", write "Grabbed a quick meal" — NOT "gonna grab some food" (raw copy) and NOT "food" (too short).
- If the user says "Make sure it's done and send the email to John", write "Ensure task is completed and send email to John" — NOT "Make sure it's" (truncated).
- Use COMMON SENSE. Think about what the user actually means and express it clearly.
- Do NOT be lazy. Read every word, understand the full context, then write a neat description.

=== STEP 1: REASONING (MANDATORY) ===
Before responding, you MUST think step-by-step in your "comment" field. Show your reasoning:
1. What did the user ACTUALLY say? Quote the full intent, not just keywords.
2. What DISTINCT activities/tasks are mentioned? List each one separately.
3. For each activity, which existing project does it belong to? If NONE match clearly, say "NEW PROJECT needed".
4. Are any activities being forced together that don't belong? If yes, SPLIT them.
5. Final decision: matched=0, 1, 2, or 3?

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

=== STEP 5: FIELD NAMES AND VALUES — PARAPHRASE NEATLY (STRICT) ===

FIELD NAMES: You MUST choose meaningful, descriptive field names that describe what the value represents. NEVER use generic names like "field", "value", "data", "text", "content", "entry", or "item".
- Think about what the value IS. Is it a task? A description? A note? An activity? A goal? A decision?
- CORRECT field names: "task", "description", "activity", "note", "goal", "decision", "outcome", "topic", "subject", "discussion"
- WRONG field names: "field", "value", "data", "text", "content", "entry", "item", "info", "stuff"
- If the project already has fields, USE those existing field names. Only invent new ones for new projects.

FIELD VALUES: You MUST write clean, well-phrased descriptions. This is NOT optional.
- DO NOT just copy the user's raw words. DO NOT just extract keywords. REWRITE as a clear, neat description.
- NEVER use first-person pronouns (I, my, me, mine, we, us, our) in field values. Write in a neutral, impersonal style — as if someone else is reading the log later.
  - CORRECT: {"task": "Finish the report and email it to John"}
  - WRONG: {"task": "I need to finish my report and email John"} ← contains "I" and "my"
  - CORRECT: {"activity": "Gym session followed by preparing chips for dinner"}
  - WRONG: {"activity": "I went to the gym and then I made chips"} ← contains "I"
- If the user mentions ANOTHER person, pronouns for that person are fine (e.g., "he", "she", "they", "his", "her").
  - CORRECT: {"task": "Call John and remind him about his presentation"}
- CORRECT: {"task": "Ensure the report is finished and email it to John"}
- WRONG: {"field": "make sure its done and send the email to john"} ← generic field name + raw copy
- WRONG: {"task": "send email"} ← lost meaning, too short
- CORRECT: {"activity": "Gym session followed by preparing chips for dinner"}
- WRONG: {"data": "gym and chips"} ← generic field name + too vague

The field value must be a COMPLETE, WELL-WRITTEN sentence or phrase that someone reading it later will immediately understand.

=== STEP 6: HANDLING NONSENSE OR INCOMPLETE INPUT ===
Sometimes the user's input may be incomplete, garbled, or nonsensical (e.g., "I need to go and.Make sure it's and then after that I have t" — a run-on sentence that cuts off mid-word).
- If part of the input is clearly incomplete or doesn't make sense, you should STILL try to extract what you can.
- In your "comment" field, EXPLAIN what you did: e.g., "The input appears to be cut off mid-sentence. I extracted 'I need to go and' as the task, but the rest ('Make sure it's and then after that I have t') was incomplete/garbled so I left it out."
- If the ENTIRE input is nonsensical and you cannot extract any meaningful task, still create the entry but explain in the comment: "The input did not contain a clear, complete task. I created the entry with the raw text as-is because..."
- NEVER silently discard text. If you leave something out, say WHY in the comment.

=== STEP 7: RESPONSE FORMAT ===
IMPORTANT: Replace "task" with a MEANINGFUL field name (see Step 5). Never use "field" as a key.
If matched=0: {"matched":0,"project":"NewProjectName","fields":{"task":"Paraphrased description"},"new_fields":[{"field_name":"task","data_type":"text","is_required":false}],"priority":null,"comment":"Your reasoning here..."}
If matched=1: {"matched":1,"project":"ExistingProjectName","fields":{"task":"Paraphrased description"},"priority":null,"comment":"Your reasoning here..."}
If matched=2: {"matched":2,"project":"NewProjectName","new_fields":[],"fields":{},"priority":null,"comment":"Your reasoning here..."}
If matched=3: {"matched":3,"old":[{"ExactProjectName":{"task":"Paraphrased description"}}],"new":[{"project_name":"BrandNewProject","fields":{"task":"Paraphrased description"},"new_fields":[{"field_name":"task","data_type":"text","is_required":false}]}],"priority":null,"comment":"Your reasoning here..."}

CRITICAL FORMAT FOR matched=3:
- "old" array: Each item is an object with ONE key = the EXACT existing project name, value = fields object. Example: [{"WebApp":{"task":"fixed login bug"}},{"Gym":{"task":"ran 5km"}}]
- "new" array: Each item has "project_name" and "fields" keys. Example: [{"project_name":"Cooking","fields":{"recipe":"pasta"},"new_fields":[]}]
- DO NOT use "project_name" as a key inside "old" items. The key MUST be the actual project name string.

RULES:
- NEVER include "due_date", "priority", or "status" as custom fields — these are built-in.
- Priority: 0=urgent+important, 1=urgent only, 2=not urgent, null=none
- DO NOT include a "due_date" field — the system handles dates separately.
- ${commentInstruction}
- In your comment, EXPLAIN your reasoning: what the user meant, why you split tasks the way you did, why you chose certain projects, why you created new ones when unsure, and if you left out any part of the input, explain WHY it was nonsense/incomplete.

Respond with ONLY this JSON, nothing else:`;

      const aiResponse = await AI(prompt);

      if (!aiResponse || aiResponse.trim() === '') {
        return {
          success: false,
          message:
            'All AI providers failed. Please check that API keys are configured and try again.',
        };
      }

      let parsed;
      try {
        const cleaned = aiResponse.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (err) {
        return { success: false, message: 'AI returned invalid JSON: ' + aiResponse };
      }

      console.log('[Natural_language] AI response parsed:', JSON.stringify(parsed, null, 2));
      console.log(
        '[Natural_language] matched =',
        parsed.matched,
        '(type:',
        typeof parsed.matched + ')'
      );

      const priorityLabel =
        parsed.priority !== null && parsed.priority !== undefined
          ? PRIORITY_LABELS[parsed.priority]
          : null;

      // ── Case: matched an existing project ──
      if (parsed.matched === 1) {
        console.log('[Natural_language] Taking matched=1 branch');
        const matchedProject = projectsWithFields.find((p) => p.project_name === parsed.project);
        if (!matchedProject) {
          return {
            success: false,
            message: 'AI claimed a match but the project was not found.',
            suggestion: parsed,
          };
        }

        const summary = await this.generateSummary(parsed.project, parsed.fields);
        const addResult = await entries.addEntry(
          email,
          parsed.project,
          parsed.fields,
          calculatedDate || null,
          priorityLabel,
          null, // status
          null, // started_at
          null, // ended_at
          null, // duration
          summary
        );

        return {
          success: addResult.success,
          message: addResult.message,
          project: parsed.project,
          fields: parsed.fields,
          priority: priorityLabel,
          due_date: calculatedDate || null,
          summary,
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
          return {
            success: false,
            message: 'AI could not determine a project name.',
            suggestion: parsed,
          };
        }

        console.log('[Natural_language] Creating project only:', newProjectName);
        const createProjectResult = await project.addProject(email, newProjectName, null);
        console.log('[Natural_language] Create project result:', createProjectResult);
        if (!createProjectResult.success) {
          return {
            success: false,
            message: 'Failed to create project: ' + createProjectResult.message,
          };
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
            !!f.is_required
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
          // Handle both formats:
          // Format A (expected): [{"ProjectName": {field: value}}] — key is the project name
          // Format B (AI sometimes returns): [{"project_name": "ProjectName", "fields": {field: value}}]
          let projName, fieldValues;

          if (item.project_name && item.fields !== undefined) {
            // Format B: AI returned {project_name: "...", fields: {...}}
            projName = item.project_name;
            fieldValues = item.fields || {};
          } else {
            // Format A: AI returned {"ProjectName": {field: value}}
            const projectNames = Object.keys(item);
            if (projectNames.length === 0) continue;
            projName = projectNames[0];
            fieldValues = item[projName] || {};
          }

          const matchedProject = projectsWithFields.find((p) => p.project_name === projName);
          if (!matchedProject) {
            results.errors.push(`Project "${projName}" not found, skipping.`);
            continue;
          }
          try {
            const summary = await this.generateSummary(projName, fieldValues);
            const addResult = await entries.addEntry(
              email,
              projName,
              fieldValues,
              calculatedDate || null,
              priorityLabel,
              null, // status
              null, // started_at
              null, // ended_at
              null, // duration
              summary
            );
            if (addResult.success) {
              results.old.push({ project_name: projName, fields: fieldValues, summary });
            } else {
              results.errors.push(`Failed to add entry to "${projName}": ${addResult.message}`);
            }
          } catch (err) {
            results.errors.push(`Error adding entry to "${projName}": ${err.message}`);
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
            // Check if project already exists — if so, add entry to existing project instead
            const existingProject = projectsWithFields.find((p) => p.project_name === projName);
            if (existingProject) {
              // Project already exists, just add the entry
              const summary = await this.generateSummary(projName, fieldValues);
              const addResult = await entries.addEntry(
                email,
                projName,
                fieldValues,
                calculatedDate || null,
                priorityLabel,
                null, // status
                null, // started_at
                null, // ended_at
                null, // duration
                summary
              );
              if (addResult.success) {
                results.old.push({ project_name: projName, fields: fieldValues, summary });
              } else {
                results.errors.push(
                  `Project "${projName}" already exists but failed to add entry: ${addResult.message}`
                );
              }
              continue;
            }

            // Create the new project
            const createProjectResult = await project.addProject(email, projName, null);
            if (!createProjectResult.success) {
              results.errors.push(
                `Failed to create project "${projName}": ${createProjectResult.message}`
              );
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
                !!f.is_required
              );
            }

            // Add the entry
            const summary = await this.generateSummary(projName, fieldValues);
            const addResult = await entries.addEntry(
              email,
              projName,
              fieldValues,
              calculatedDate || null,
              priorityLabel,
              null, // status
              null, // started_at
              null, // ended_at
              null, // duration
              summary
            );
            if (addResult.success) {
              results.new.push({
                project_name: projName,
                fields: fieldValues,
                summary,
                new_fields: newFields,
              });
            } else {
              results.errors.push(
                `Created project "${projName}" but failed to add entry: ${addResult.message}`
              );
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
        return {
          success: false,
          message: 'AI could not determine a project for this entry.',
          suggestion: parsed,
        };
      }

      console.log('[Natural_language] Creating new project:', newProjectName);
      const createProjectResult = await project.addProject(email, newProjectName, null);
      console.log('[Natural_language] Create project result:', createProjectResult);
      if (!createProjectResult.success) {
        return {
          success: false,
          message: 'Failed to create new project: ' + createProjectResult.message,
        };
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
          !!f.is_required
        );
        console.log('[Natural_language] Add field', f.field_name, 'result:', addFieldResult);
      }

      const summary = await this.generateSummary(newProjectName, parsed.fields);
      const addResult = await entries.addEntry(
        email,
        newProjectName,
        parsed.fields,
        calculatedDate || null,
        priorityLabel,
        null, // status
        null, // started_at
        null, // ended_at
        null, // duration
        summary
      );

      return {
        success: addResult.success,
        message: addResult.message,
        project: newProjectName,
        fields: parsed.fields,
        priority: priorityLabel,
        due_date: calculatedDate || null,
        summary,
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
