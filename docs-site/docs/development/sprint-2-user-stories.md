# Sprint 2 User Stories

Sprint 2 scope extends the vertical slice from Sprint 1 into the Digital
Logbook's core views and platform capabilities: calendar and kanban
visualizations of entries, a dependency-aware timeline, full data import and
export (including calendar subscription), database backup/restore and
migrations, and browsable API documentation.

## 1. Calendar View

### US-C01. View tasks on a monthly calendar

**Who:** As a student
**What:** I want to see my tasks laid out on a month grid by due date
**Why:** So that I can plan my workload across the month at a glance.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The calendar view is open for a selected month | The calendar renders | The system displays a 7-column grid (Mon–Sun) for that month |
| AT2 | Entries have due dates in the visible month | The calendar renders | Each day cell shows entries whose due_date falls on that day |
| AT3 | A day has many tasks | The day cell is rendered | The system shows the first few entries plus a "+N more" indicator |
| AT4 | Archived, deleted, or dateless entries exist | The calendar renders | Only unarchived, non-deleted entries with a due date appear |

### US-C02. Navigate between months

**Who:** As a student
**What:** I want to move forward and backward through months and jump to today
**Why:** So that I can review past deadlines or plan ahead.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The calendar is showing a month | The user clicks "Previous" | The view moves one month back |
| AT2 | The calendar is showing a month | The user clicks "Next" | The view moves one month forward |
| AT3 | The calendar is showing any month | The user clicks "Today" | The view returns to the current month |
| AT4 | The visible period changes | Navigation occurs | The month/year label updates to reflect it |

### US-C03. Switch between month and week views

**Who:** As a student
**What:** I want to toggle between a month view and a week view
**Why:** So that I can zoom into a single week when I need more detail.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The calendar is open | The user activates the toggle | The layout switches between Month and Week |
| AT2 | Week mode is active | The view renders | It shows seven vertical day columns for the selected week |
| AT3 | Week mode is active | The user navigates | The view advances or retreats by one week |

### US-C04. Reschedule a task by dragging it to another day

**Who:** As a student
**What:** I want to drag an entry onto a different day in the calendar
**Why:** So that I can move a deadline without opening the entry editor.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | An entry is on the calendar | The user drags it onto another day | updateEntry() is called with the new due_date |
| AT2 | A successful drop occurs | The update completes | The entry appears on the new day immediately |
| AT3 | The server write fails | The response returns an error | The entry reverts to its original day |

### US-C05. Identify overdue and completed tasks visually

**Who:** As a student
**What:** I want overdue tasks highlighted in red and completed tasks shown in green with a strikethrough
**Why:** So that I can spot urgent work and completed items at a glance.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | An entry has a past due_date and a non-done status | The calendar renders it | It shows a red visual indicator |
| AT2 | An entry has status done_and_dusted | The calendar renders it | It shows in green with a strikethrough on the title |
| AT3 | Any status indicator is displayed | The user views it | It is accessible and not colour-only (e.g. paired with an icon or pattern) |

## 2. Kanban Board

### US-K01. View tasks grouped by status

**Who:** As a student
**What:** I want to see my tasks arranged in three columns — Up Next, In Motion, and Done & Dusted
**Why:** So that I can understand the state of my work at a glance.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The Kanban board loads | It renders | Three columns are displayed, one per status |
| AT2 | An entry is on the board | Its card renders | It shows the entry title, project name, due date, and priority |
| AT3 | Archived or deleted entries exist | The board renders | Only unarchived, non-deleted entries appear |

### US-K02. Move a task between columns by dragging

**Who:** As a student
**What:** I want to drag a card from one column to another
**Why:** So that I can update a task's status without opening an editor.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | A card is in a column | The user drags it to a different column | The local state updates optimistically |
| AT2 | A card is dropped in a new column | The drop completes | updateEntry() is called with the new status |
| AT3 | The server write fails | The response returns an error | The card reverts to its original column |

### US-K03. Automatic timestamp management on status change

**Who:** As a student
**What:** I want the system to automatically set started_at and ended_at as I move tasks between statuses
**Why:** So that I don't have to track time manually.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | A task has no started_at value | It is moved to "In Motion" | started_at is set to the current timestamp |
| AT2 | A task is moved to "Done & Dusted" | The move completes | ended_at is set to the current timestamp |
| AT3 | A task has existing timestamps | It is moved back to "Up Next" | Those timestamps are not cleared |

### US-K04. Filter the board by project or search term

**Who:** As a student
**What:** I want to filter the Kanban board by project or type a search query
**Why:** So that I can focus on a specific project or find a task quickly.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | A project is selected in the dropdown | The filter applies | The board narrows to entries belonging to that project |
| AT2 | A search query is entered | The filter applies | Cards whose title or description match the query are shown |
| AT3 | Any filter change occurs | It is applied | It takes effect in real time without a page reload |
| AT4 | An active filter exists | The user clears it | The full board is restored |

### US-K05. Identify overdue tasks on the board

**Who:** As a student
**What:** I want overdue cards to be visually highlighted
**Why:** So that I can prioritise them while working on the board.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | A card has a past due_date and a non-done status | The board renders it | It shows a red visual indicator |
| AT2 | The highlight is displayed | The theme is light or dark | It remains visible in both |

## 3. Timeline

### US-T01. View tasks as horizontal bars across time

**Who:** As a student
**What:** I want to see my tasks as bars spanning their start date to their due date on a horizontal timeline
**Why:** So that I can visualise how my work is distributed over time.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | An entry has resolvable dates | The timeline renders | The entry appears as a bar from its resolved start date to its resolved end date |
| AT2 | An entry's start date is being resolved | Resolution runs | The system uses started_at → created_at → one day before due_date, in that order |
| AT3 | An entry's end date is being resolved | Resolution runs | The system uses due_date → one day after the resolved start |
| AT4 | An entry has no placeable date | The timeline renders | The entry is skipped |
| AT5 | The timeline is displayed | It renders | A red dashed "today" line marks the current date, with grid lines and month-start markers for context |

### US-T02. See dependency arrows between linked tasks

**Who:** As a student
**What:** I want to see curved arrows drawn from a predecessor task to its successor
**Why:** So that I can understand which tasks depend on others and plan accordingly.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | An entry's JSONB payload contains dependencies | Dependencies are read | They come from entries.dependencies or entries.depends_on |
| AT2 | A predecessor and successor pair exists | The timeline renders | A Bézier arrow is drawn from the predecessor's right edge to the successor's left edge |
| AT3 | A three-task chain (A → B → C) exists | The timeline renders | It appears as three connected bars with arrows, not three unrelated bars |
| AT4 | A dependency chain is rendered | The layout is calculated | Tasks in the chain are placed on separate rows to keep arrows legible |

### US-T03. Zoom in and out on the timeline

**Who:** As a student
**What:** I want to zoom the timeline from 50% to 400%
**Why:** So that I can see fine detail for a busy week or the big picture across a month.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The zoom controls are available | The user selects a level | At least 0.5x, 1x, 2x, 3x, and 4x are available |
| AT2 | A higher zoom level is selected | The timeline renders | Individual day labels become visible |
| AT3 | Any zoom level is active | The user views the timeline | It remains horizontally scrollable |

### US-T04. Scroll horizontally across the timeline

**Who:** As a student
**What:** I want to scroll left and right across the timeline
**Why:** So that I can navigate to tasks in the past or future without changing zoom.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The timeline container is displayed | The user scrolls | Horizontal scrolling is supported |
| AT2 | The user is scrolling | The view moves | The scroll is smooth and does not break the grid or bar rendering |

### US-T05. See a helpful empty state when no dated tasks exist

**Who:** As a new student
**What:** I want to see a friendly message when the timeline has nothing to show
**Why:** So that I understand what I need to do to populate it.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | No unarchived entries have a placeable date | The timeline renders | An empty state is shown |
| AT2 | The empty state is shown | The user reads it | It explains how to add tasks with start/due dates and how to set dependencies |

## 4. Import & Export (Data Portability)

### US-D01. Export all data as JSON

**Who:** As a student
**What:** I want to download all my projects and entries as a JSON file
**Why:** So that I have a machine-readable backup of my entire logbook.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The export is triggered | The file is generated | It includes all projects (active and archived) and all entries (active and archived) |
| AT2 | The JSON export is generated | It is inspected | It contains a version field, export timestamp, user email, projects array, and entries array |
| AT3 | The export button is clicked | Generation completes | The file downloads automatically |
| AT4 | The exported file exists | It is imported into an empty database | It reproduces the original row count (round-trip safe) |

### US-D02. Export all data as CSV

**Who:** As a student
**What:** I want to download all my projects and entries as a CSV file
**Why:** So that I can open the data in a spreadsheet for analysis or reporting.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The CSV export is generated | The file is created | Projects and entries are emitted as separate sections, each with a header row |
| AT2 | An entry's JSONB field is present | It is serialised | It appears as a JSON string within the cell |
| AT3 | Values contain commas, quotes, or newlines | The CSV is written | They are properly escaped |
| AT4 | The exported file exists | It is opened in Excel, Google Sheets, or LibreOffice Calc | It displays correctly |

### US-D03. Export all data as Markdown

**Who:** As a student
**What:** I want to download all my projects and entries as a Markdown file
**Why:** So that I can paste the data into documentation, a wiki, or a README.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The Markdown export is generated | The file is created | It contains a metadata header (user, date, counts), a Projects table, and an Entries table |
| AT2 | Values contain pipe characters | The file is written | They are escaped to preserve table structure |
| AT3 | The exported file exists | It is viewed on GitHub or a standard Markdown viewer | It renders correctly |

### US-D04. Import data from a previously exported file

**Who:** As a student
**What:** I want to upload a JSON, CSV, or Markdown export file and have it recreate my projects and entries
**Why:** So that I can restore a backup or migrate to a new account.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | A file is uploaded | It is processed | Its format is auto-detected from the extension (.json, .csv, .md) |
| AT2 | A valid import file is provided | The import runs | Projects are created first, then entries, then archived entries are re-archived |
| AT3 | An import completes | The report is shown | It displays the count of projects created, entries created, and rows rejected |
| AT4 | Imported data exists | The import finishes | It appears in the Dashboard, Calendar, Kanban, Timeline, and Today views without a page refresh |

### US-D05. Receive a report of rejected rows during import

**Who:** As a student
**What:** I want the import to report which rows it rejected and why, with line numbers
**Why:** So that I can fix malformed data and re-import without losing valid rows.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | An invalid row exists in the import file | It is encountered | It is skipped rather than causing a hard failure |
| AT2 | A row is rejected | It is reported | It includes a 1-based line number and a reason (e.g. "Missing or empty project_name," "Invalid status: bogus") |
| AT3 | Some rows are rejected | The import runs | Valid rows are still imported |
| AT4 | The import completes | The report is displayed | The rejection list is shown |

### US-D06. Drag and drop a file to import

**Who:** As a student
**What:** I want to drag a file onto the import area instead of clicking through a file picker
**Why:** So that importing feels fast and natural.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | A file is dragged over the import area | It hovers | The area highlights |
| AT2 | A file is dropped | The drop occurs | It triggers the same parse-and-import flow as the file picker |
| AT3 | The file picker label is present | The user clicks it | The standard file picker opens and works as expected |

### US-D07. Round-trip safety

**Who:** As a student
**What:** I want an export-then-import cycle to reproduce my data exactly
**Why:** So that I can trust the backup and restore process.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | An export is followed by import into an empty database | The cycle completes | It produces the same number of project rows and entry rows |
| AT2 | An archived project exists | It is exported and re-imported | It remains archived |
| AT3 | An archived entry exists | It is exported and re-imported | It is re-archived |
| AT4 | An entry has fields (title, due date, priority, status, timestamps, JSONB payload) | The round trip completes | All fields are preserved |

### US-D08. Export to iCalendar (.ics)

**Who:** As a student
**What:** I want to export my tasks as an iCalendar (.ics) file
**Why:** So that I can open or subscribe to them in Google Calendar, Outlook, or Apple Calendar.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The .ics file is exported | It is opened in a major calendar application | It is RFC 5545 compliant and opens correctly |
| AT2 | An entry has only a due_date | It is exported | It appears as an all-day event (DTSTART;VALUE=DATE) |
| AT3 | An entry has a started_at timestamp | It is exported | It appears as a timed event (DTSTART with time) |
| AT4 | An entry is exported | The mapping is applied | Its title maps to SUMMARY, project name to CATEGORIES, and status to STATUS (TENTATIVE/CONFIRMED/COMPLETED) |
| AT5 | An entry's priority is exported | The mapping is applied | It maps to the iCalendar PRIORITY field (1–9 scale) |
| AT6 | Special characters (semicolons, commas, newlines, backslashes) are present | The entry is exported | They are escaped per RFC 5545 |
| AT7 | An entry has no date at all | It is exported | It is skipped and does not appear in the calendar |

## 5. Backup, Restore & Migrations

### US-B01. One-command database backup

**Who:** As a student
**What:** I want to back up my entire database with a single command
**Why:** So that I can recover my data if something goes wrong.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The backup command is available | `npm run db:backup` runs | It creates a PostgreSQL custom-format dump file |
| AT2 | The backup runs | It completes | It includes all app tables (users, projects, entries, fields, activity_log, health_ping, ai_provider_cooldowns) |
| AT3 | The backup file is created | It is saved | It is timestamped and stored in scripts/backups/ |
| AT4 | A custom path is provided | `npm run db:backup -- ./my-backup.dump` runs | The backup is saved there instead |

### US-B02. One-command database restore

**Who:** As a student
**What:** I want to restore my database from a backup with a single command
**Why:** So that I can recover after data loss.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | Backups exist in scripts/backups/ | `npm run db:restore` runs | It restores from the most recent backup |
| AT2 | A specific file is provided | `npm run db:restore -- ./my-backup.dump` runs | That file is restored instead |
| AT3 | A restore is initiated | It is about to overwrite data | A 3-second warning is shown first |
| AT4 | A restore completes | `npm run db:migrate` is run afterward | The schema is brought up to date |

### US-B03. Versioned schema migrations

**Who:** As a developer
**What:** I want to run versioned schema migrations that upgrade an existing database
**Why:** So that I never have to drop and recreate tables when the schema changes.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | Pending migrations exist | `npm run db:migrate` runs | They are all run in order |
| AT2 | A migration runs | It completes | It is tracked in a schema_migrations table with version and checksum |
| AT3 | Migrations are already applied | The migrate command runs again | They are skipped |
| AT4 | A migration fails | Execution stops | The database is left in a consistent state (transactional) |
| AT5 | The migration state is queried | `npm run db:status` runs | It shows which migrations are applied and pending |

### US-B04. Bootstrap existing database

**Who:** As a developer with a database created before the migration system
**What:** I want to mark existing migrations as already applied
**Why:** So that the migration runner doesn't try to re-run them.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | An existing database is present | `npm run db:bootstrap` runs | All migration files are marked as applied without being executed |
| AT2 | Bootstrap has run | `npm run db:migrate` runs afterward | Only new migrations going forward are executed |
| AT3 | A database was made before recent schema changes | It is opened under the current build | It works with data intact |

### US-B05. Baseline full schema migration

**Who:** As a developer setting up a fresh Supabase project
**What:** I want a single baseline migration that creates the entire current schema
**Why:** So that I don't have to run 8 separate migration files manually.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The baseline migration exists | `000_baseline_full_schema.sql` runs | It creates all tables, types, indexes, functions, triggers, and cron jobs |
| AT2 | Every statement in the migration is written | It runs | It is idempotent (IF NOT EXISTS guards) |
| AT3 | An existing database is present | The baseline migration is run against it | It is a no-op |
| AT4 | A fresh database is present | The baseline migration is run against it | It produces a fully working schema |

## 6. OpenAPI 3 & Swagger UI

### US-A01. Browse the API documentation

**Who:** As a developer
**What:** I want to open a browsable page that shows all API endpoints
**Why:** So that I can understand the API without reading source code.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The project service is running | The user navigates to /api-docs | A Swagger UI page is shown |
| AT2 | The docs page loads | It renders | It lists all endpoints across all four microservices (project, dashboard, profile, auth) |
| AT3 | An endpoint entry is displayed | The user views it | It shows its HTTP method, path, request body, and response schemas |

### US-A02. Try an API endpoint from the docs page

**Who:** As a developer
**What:** I want to execute an API call directly from the docs page
**Why:** So that I can verify the API works without switching to Postman.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The "Authorize" button is present | A Bearer JWT token is entered | It is accepted |
| AT2 | An endpoint is displayed | The user clicks "Try it out" | A real request is sent to the running service |
| AT3 | A request is sent | The response returns | The response body, status code, and headers are displayed on the docs page |
| AT4 | A request is made from the docs page | It targets the running application | It succeeds |

### US-A03. Spec matches the implemented routes

**Who:** As a developer
**What:** I want the OpenAPI spec to match the implemented routes exactly
**Why:** So that the docs page is a reliable source of truth.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | The OpenAPI spec exists | It is compared against the code | It has no path that the code does not implement |
| AT2 | The implemented code exists | It is compared against the spec | It has no route that the spec does not document |
| AT3 | Status codes and error bodies exist | They are compared | The spec matches what the code returns |
| AT4 | The spec and routes are complete | The automated test suite runs | 12 tests verify spec structure, paths, and response schemas |

---
