# Sprint 2 User Stories

## US11. Implement Richer Fields

**Who:** As a project owner
**What:** I want to add tags, checklists, links to other entries, project references, and computed fields to my entry formats.
**Why:** So that I can capture more complex and interconnected data in my logbook.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user is configuring an entry format | The user adds support for tags, checklists, entry links, and project references | The system saves and supports these new field types |
| AT2 | A format includes a computed field | The user captures a new entry | The system automatically works out the value from other fields instead of requiring it to be typed in by hand |

## US12. Change Formats Without Losing Old Data

**Who:** As a project owner
**What:** I want to build features to add, remove, or rename fields in an existing entry format.
**Why:** So that I can adapt my logging structure over time while keeping old entries readable.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user edits an existing entry format | The user adds, removes, or renames a field | The system successfully updates the format |
| AT2 | An entry format has been updated | The user views old entries | The system writes logic that updates old entries to match the new format with sensible defaults and keeps them readable |

## US13. Statistics on Custom Fields

**Who:** As a user
**What:** I want to run statistics functions to total, group, compare, and plot over time any custom field I define, not just built-in ones.
**Why:** So that I can generate meaningful insights specific to my project's unique data.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user opens the statistics view | The user selects a custom field | The system provides functions to total, group, or compare the selected fields |
| AT2 | The user wants to view trends | The user selects a custom field for plotting | The system successfully plots this field over time |

## US14. More Ways to View Entries

**Who:** As a user
**What:** I want to view my entries using saved filters, a calendar view, or a board view (like Trello).
**Why:** So that I can organize and visualize my entries according to my current workflow.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user sets up a filter or search | The user saves the configuration | The system builds saved filters so the setup can be reused later without rebuilding it |
| AT2 | The user navigates to the project views | The user selects the calendar or board view | The system displays a calendar view or a board view grouped by whatever field the user picks |

## US15. Tracking Unfinished Work

**Who:** As a user
**What:** I want to log a to-do item tied to the logbook with due dates, and view everything still unfinished.
**Why:** So that I can manage pending project tasks efficiently alongside my logs.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user is in the logbook | The user adds a to-do item with a due date | The system successfully logs the to-do item tied to the logbook |
| AT2 | The user has pending tasks | The user accesses the unfinished work view | The system builds a view listing everything still unfinished |

## US16. Offline Use & Syncing

**Who:** As a user
**What:** I want to capture entries with no internet connection and build sync logic that uploads them once a connection is back.
**Why:** So that I can continue my work regardless of internet connectivity without losing data.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user has no internet connection | The user captures an entry | The system makes entry capture work and saves it locally |
| AT2 | The device reconnects to the internet and there are offline entries | The system initiates a sync | The system uploads offline entries and handles conflicts when the same entry was edited on two devices |

## US17. Export & Import

**Who:** As a user
**What:** I want to build an export function to save entries in a plain format (CSV, JSON, Markdown) and an import function to read them back.
**Why:** So that I can securely backup my data or migrate it between systems.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user triggers an export | The user selects the export option | The system saves entries in a plain, readable file format |
| AT2 | The user has a previously exported file | The user triggers the import function | The system reads that file format back into the platform |

## US18. View tasks on a monthly calendar

**Who:** As a student
**What:** I want to see my tasks laid out on a month grid by due date.
**Why:** So that I can plan my workload across the month at a glance.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A month is selected | The calendar loads | It displays a 7-column grid (Mon-Sun) showing entries whose due date falls on each day |
| AT2 | A day has many tasks | Viewing that day | It shows the first few entries plus a "+N more" indicator |
| AT3 | The calendar is populated | The user views tasks | Only unarchived, non-deleted entries with a due date appear |

## US19. Navigate between months

**Who:** As a student
**What:** I want to move forward and backward through months and jump to today.
**Why:** So that I can review past deadlines or plan ahead.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user is on the calendar view | They click "Previous" or "Next" | The view moves one month back or forward respectively, and the month/year label updates |
| AT2 | The user is viewing a different month | They click "Today" | The view returns to the current month |

## US20. Switch between month and week views

**Who:** As a student
**What:** I want to toggle between a month view and a week view.
**Why:** So that I can zoom into a single week when I need more detail.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The calendar is open | The user toggles to week view | It shows seven vertical day columns for the selected week |
| AT2 | The calendar is in week mode | The user uses navigation controls | The calendar advances or retreats by one week |

## US21. Reschedule a task by dragging it to another day

**Who:** As a student
**What:** I want to drag an entry onto a different day in the calendar.
**Why:** So that I can move a deadline without opening the entry editor.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An entry is on the calendar | The user drags it to another day | updateEntry() is called with the new due date and the entry appears on the new day immediately |
| AT2 | A drag-and-drop reschedule occurs | The server write fails | The entry reverts to its original day |

## US22. Identify overdue and completed tasks visually

**Who:** As a student
**What:** I want overdue tasks to be highlighted in red and completed tasks to appear in green with a strikethrough.
**Why:** So that I can spot urgent work and completed items at a glance.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An entry has a past due date and non-done status | It renders on the calendar | It displays with an accessible red visual indicator |
| AT2 | An entry has a status of done_and_dusted | It renders | It displays in green with a strikethrough on the title |

## US23. View tasks grouped by status

**Who:** As a student
**What:** I want to see my tasks arranged in three columns - Up Next, In Motion, and Done & Dusted.
**Why:** So that I can understand the state of my work at a glance.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The Kanban board loads | Unarchived and non-deleted entries exist | Three columns are displayed (one per status) containing cards that show the entry title, project name, due date, and priority |

## US24. Move a task between columns by dragging

**Who:** As a student
**What:** I want to drag a card from one column to another.
**Why:** So that I can update a task's status without opening an editor.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A task card is on the board | The user drags it to a different column | Local state updates optimistically and updateEntry() is called with the new status |
| AT2 | A task is moved to a new column | The server write fails | The card reverts to its original column |

## US25. Automatic timestamp management on status change

**Who:** As a student
**What:** I want the system to automatically set started_at and ended_at timestamps when moving tasks.
**Why:** So that I don't have to track time manually.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A card is moved to "In Motion" | started_at is not set | The system sets it to the current timestamp |
| AT2 | A card is moved to "Done & Dusted" | The move occurs | The system sets ended_at to the current timestamp |
| AT3 | A card is moved back to "Up Next" | The move occurs | Existing timestamps are not cleared |

## US26. Filter the board by project or search term

**Who:** As a student
**What:** I want to filter the Kanban board by project or type a search query.
**Why:** So that I can focus on a specific project or find a task quickly.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user uses the project dropdown | A project is selected | The board narrows to entries for that project in real time without a page reload |
| AT2 | The user types in the search input | They enter a query | The board filters cards matching the title or description |
| AT3 | A filter is applied | It is cleared | The full board is restored |

## US27. Identify overdue tasks on the board

**Who:** As a student
**What:** I want overdue cards to be visually highlighted.
**Why:** So that I can prioritise them while working on the board.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A card has a past due date and non-done status | It renders on the board | It is highlighted with a red visual indicator visible in light and dark themes |

## US28. View tasks as horizontal bars across time

**Who:** As a student
**What:** I want to see my tasks as bars spanning their start date to their due date on a horizontal timeline.
**Why:** So that I can visualise how my work is distributed over time.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | Valid dated entries exist | The timeline renders | Each is a bar from its resolved start date to resolved end date, skipping those that cannot be placed |
| AT2 | The timeline is viewed | Rendering the temporal context | A red dashed line marks today, and grid lines with month-start markers are shown |

## US29. See dependency arrows between linked tasks

**Who:** As a student
**What:** I want to see curved arrows drawn from a predecessor task to its successor.
**Why:** So that I can understand which tasks depend on others and plan accordingly.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | Linked tasks exist in the JSONB payload | They render on the timeline | A Bézier arrow is drawn from the predecessor's right edge to the successor's left edge |
| AT2 | A task chain exists | They are placed on the timeline | They are put on separate rows to keep arrows legible and appear connected |

## US30. Zoom in and out on the timeline

**Who:** As a student
**What:** I want to zoom the timeline from 50% to 400%.
**Why:** So that I can see fine detail for a busy week or the big picture across a month.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user adjusts zoom controls | Levels between 0.5x and 4x are selected | The view updates, remains horizontally scrollable, and individual day labels become visible at higher zooms |

## US31. Scroll horizontally across the timeline

**Who:** As a student
**What:** I want to scroll left and right across the timeline.
**Why:** So that I can navigate to tasks in the past or future without changing zoom.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The timeline container is populated | The user scrolls horizontally | Scrolling is smooth and does not break the grid or bar rendering |

## US32. See a helpful empty state when no dated tasks exist

**Who:** As a new student
**What:** I want to see a friendly message when the timeline has nothing to show.
**Why:** So that I understand what I need to do to populate it.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | No unarchived entries have a placable date | The user opens the timeline | An empty state is shown explaining how to add tasks with dates and set dependencies |

## US33. Export all data as JSON

**Who:** As a student
**What:** I want to download all my projects and entries as a JSON file.
**Why:** So that I have a machine-readable backup of my entire logbook.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user clicks export to JSON | The action completes | It automatically downloads a file containing version, timestamp, email, and all active/archived projects and entries |
| AT2 | A downloaded JSON export | It is imported into an empty database | It is round-trip safe and reproduces the original row count |

## US34. Export all data as CSV

**Who:** As a student
**What:** I want to download all my projects and entries as a CSV file.
**Why:** So that I can open the data in a spreadsheet for analysis or reporting.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user triggers a CSV export | The file is generated | Projects and entries emit as separate sections with headers, properly serializing the JSONB field with escaped characters |
| AT2 | The generated CSV | Opened in standard spreadsheet software | It opens correctly without layout breakage |

## US35. Export all data as Markdown

**Who:** As a student
**What:** I want to download all my projects and entries as a Markdown file.
**Why:** So that I can paste the data into documentation, a wiki, or a README.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user exports to Markdown | The file generates | It contains a metadata header and tables for Projects and Entries with pipe characters safely escaped |

## US36. Import data from a previously exported file

**Who:** As a student
**What:** I want to upload a JSON, CSV, or Markdown export file and have it recreate my projects and entries.
**Why:** So that I can restore a backup or migrate to a new account.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An export file is uploaded | The import runs | The format is auto-detected, projects and entries are created sequentially, archived status is re-applied, and a summary report is shown |
| AT2 | Data is successfully imported | Navigating views | The imported data appears across the platform without a page refresh |

## US37. Receive a report of rejected rows during import

**Who:** As a student
**What:** I want the import to report which rows it rejected and why (with line numbers).
**Why:** So that I can fix malformed data and re-import without losing valid rows.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An import file contains malformed data | The import completes | Invalid rows are skipped rather than causing a hard failure, and a rejection list displays the 1-based line numbers and reasons |

## US38. Drag and drop a file to import

**Who:** As a student
**What:** I want to drag a file onto the import area instead of clicking through a file picker.
**Why:** So that importing feels fast and natural.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A user drags a file over the import area | Hovering | The area highlights |
| AT2 | A user drops a file | The action completes | It triggers the same parse-and-import flow as the standard file picker |

## US39. Round-trip safety

**Who:** As a student
**What:** I want an export-then-import cycle to reproduce my data exactly.
**Why:** So that I can trust the backup and restore process.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An empty database | A previously exported file is imported | It produces the exact same row counts, preserves archive states, and maintains all entry fields |

## US40. Export to iCalendar (.ics)

**Who:** As a student
**What:** I want to export my tasks as an iCalendar (.ics) file.
**Why:** So that I can open or subscribe to them in Google Calendar, Outlook, or Apple Calendar.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | Tasks have dates | Exported to .ics | The file is RFC 5545 compliant, maps fields correctly, escapes special characters, and successfully skips undated entries |

## US41. One-command database backup

**Who:** As a student
**What:** I want to back up my entire database with a single command.
**Why:** So that I can recover my data if something goes wrong.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The developer runs npm run db:backup | The script executes | It creates a PostgreSQL custom-format dump file that includes all app tables, saved with a timestamp or at a provided custom path |

## US42. One-command database restore

**Who:** As a student
**What:** I want to restore my database from a backup with a single command.
**Why:** So that I can recover after data loss.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The developer runs npm run db:restore | The command executes | It shows a 3-second warning before overwriting data and restores from the most recent backup or a designated file |
| AT2 | A restore is complete | npm run db:migrate is run | It brings the schema up to date |

## US43. Versioned schema migrations

**Who:** As a developer
**What:** I want to run versioned schema migrations that upgrade an existing database.
**Why:** So that I never have to drop and recreate tables when the schema changes.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | npm run db:migrate is executed | Pending migrations exist | They run in order, are tracked in schema_migrations, skip already applied ones, and stop execution transactionally upon failure |

## US44. Bootstrap existing database

**Who:** As a developer with a database created before the migration system
**What:** I want to mark existing migrations as already applied.
**Why:** So that the migration runner doesn't try to re-run them.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | npm run db:bootstrap is executed | Files exist | It marks all migration files as applied without executing them, ensuring subsequent migrations only run new changes |

## US45. Baseline full schema migration

**Who:** As a developer setting up a fresh Supabase project
**What:** I want a single baseline migration that creates the entire current schema.
**Why:** So that I don't have to run 8 separate migration files manually.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | 000_baseline_full_schema.sql is run against a fresh database | It completes | It produces a fully working schema using idempotent statements |
| AT2 | The baseline runs against an existing database | It executes | It operates as a no-op |

## US46. Browse the API documentation

**Who:** As a developer
**What:** I want to open a browsable page that shows all API endpoints.
**Why:** So that I can understand the API without reading source code.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user navigates to /api-docs on the project service | It loads | A Swagger UI page displays listing all endpoints across all microservices along with methods, paths, and request/response schemas |

## US47. Try an API endpoint from the docs page

**Who:** As a developer
**What:** I want to execute an API call directly from the docs page.
**Why:** So that I can verify the API works without switching to Postman.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user is on the docs page | They provide a Bearer JWT token and click "Try it out" | It sends a real request to the running service and displays the response body, status code, and headers |

## US48. Spec matches the implemented routes

**Who:** As a developer
**What:** I want the OpenAPI spec to match the implemented routes exactly.
**Why:** So that the docs page is a reliable source of truth.

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The API codebase is complete | Comparing it to the OpenAPI spec | The paths, routes, status codes, and error bodies match exactly, backed by automated verification tests |
