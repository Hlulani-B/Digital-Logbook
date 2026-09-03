# Entry Summaries

Each logbook entry stores an AI-generated one-sentence summary alongside the full structured data. Summaries provide a quick scannable overview for calendar views, activity feeds, and dashboard cards without needing to parse the full entry fields.

---

## Overview

When a user adds an entry (via natural language or direct add), the system:

1. Parses the entry into structured fields (project, task, due date, priority)
2. Sends the project name + entry object to the AI
3. Receives a single concise sentence (≤ 20 words)
4. Stores it in the `summary` column of the `entries` table

The summary is written in neutral, factual style — no first-person pronouns.

| Input | Summary |
|---|---|
| Project: "WebApp", Entry: `{"task": "Fixed login authentication bug"}` | "Fixed login authentication bug in WebApp." |
| Project: "Gym", Entry: `{"activity": "Ran 5km on treadmill"}` | "Completed a 5km treadmill run at the gym." |
| Project: "COS3011A", Entry: `{"task": "Finished sprint 2 documentation"}` | "Completed sprint 2 documentation for COS3011A project." |

---

## Database Schema

Migration `007_add_summary_column.sql` adds the column:

```sql
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS summary TEXT;
```

The column is nullable — entries created before this feature (or if the AI fails) will have `summary = NULL`.

---

## How It Works

### New Entries (Natural Language Flow)

```
User types: "fixed login bug for WebApp, urgent, due tomorrow"
     │
     ▼
AI parses → project: "WebApp", fields: {"task": "Fixed login bug"}
     │
     ▼
Separate AI call → generateSummary("WebApp", {"task": "Fixed login bug"})
     │
     ▼
AI returns: "Fixed login authentication bug in WebApp."
     │
     ▼
INSERT INTO entries (..., summary) VALUES (..., 'Fixed login authentication bug in WebApp.')
```

The `generateSummary()` method on `Natural_language` class makes a lightweight AI call:

```javascript
async generateSummary(projectName, entryObject) {
  const prompt = `Given this logbook entry, write a single concise sentence
summarising what was done. No more than 20 words...

Project: ${projectName}
Entry: ${JSON.stringify(entryObject)}

Respond with ONLY the summary sentence.`;

  const result = await AI(prompt);
  return result?.trim() || null;
}
```

### Direct Add (POST /service/entry)

The `addEntry()` method accepts an optional `summary` parameter. When adding entries directly (not via natural language), the caller can provide a summary or leave it null.

```javascript
await entries.addEntry(
  email,
  project_name,
  entry_object,
  due_date,
  priority,
  null,    // status
  null,    // started_at
  null,    // ended_at
  null,    // duration
  summary  // ← new optional parameter
);
```

---

## Backfill Script

Existing entries (created before this feature) have `summary = NULL`. The backfill script generates summaries for all of them:

```bash
# 1. Set DATABASE_URL and AI keys in services/project-service/.env
# 2. Run from the project-service directory:
cd services/project-service
node scripts/backfill-summaries.js
```

The script:
- Fetches all entries where `summary IS NULL AND deleted = false`
- For each entry, calls the AI with the project name + entry object
- Updates the `summary` column
- Processes in batches of 10 with a 1-second delay between batches (rate limiting)
- Reports progress: `[3/47] ✓ Entry #123: "Fixed login bug in WebApp."`

---

## Retrieval

All existing retrieval methods (`getEntries`, `getAllEntries`, `sortUnarchivedEntries`) use `SELECT *`, so the `summary` column is automatically included in the response.

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "user_email": "user@example.com",
      "project_name": "WebApp",
      "entries": {"task": "Fixed login authentication bug"},
      "summary": "Fixed login authentication bug in WebApp.",
      "due_date": "2026-09-03",
      "priority": "Urgent and important",
      "created_at": "2026-09-02T10:30:00Z"
    }
  ]
}
```

---

## SSE Integration

The summary is included in the SSE `entry_parsed` event pushed to the frontend immediately after AI parsing completes:

```javascript
sendToUser(user_email, 'entry_parsed', {
  success: true,
  project: 'WebApp',
  fields: { task: 'Fixed login bug' },
  summary: 'Fixed login authentication bug in WebApp.',
  // ... other fields
});
```

---

## Cost & Performance

| Metric | Value |
|---|---|
| Extra AI calls per entry | 1 (lightweight, ≤ 20 words output) |
| Latency added | ~500ms–1s per entry (after main parsing completes) |
| Token cost | ~50 input + ~20 output tokens per summary |
| Storage | ~50–100 bytes per entry (TEXT column) |

The summary generation runs sequentially after the main AI parsing, so it does not slow down the primary entry creation flow. If the summary AI call fails, the entry is still created — the `summary` field is simply `null`.

---

## Files

| File | Purpose |
|---|---|
| `supabase/migrations/007_add_summary_column.sql` | Adds `summary TEXT` column |
| `services/project-service/src/functions/entries.js` | `addEntry()` accepts summary; `generateSummary()` method |
| `services/project-service/src/Routes/entries.js` | SSE push includes summary |
| `services/project-service/scripts/backfill-summaries.js` | Backfill script for existing entries |
