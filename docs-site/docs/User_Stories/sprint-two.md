# Sprint 2 User Stories

## US11. Implement Richer Fields

**Who:** As a project owner[cite: 1]
**What:** I want to add tags, checklists, links to other entries, project references, and computed fields to my entry formats[cite: 1].
**Why:** So that I can capture more complex and interconnected data in my logbook[cite: 1].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user is configuring an entry format[cite: 1] | The user adds support for tags, checklists, entry links, and project references[cite: 1] | The system saves and supports these new field types[cite: 1] |
| AT2 | A format includes a computed field[cite: 1] | The user captures a new entry[cite: 1] | The system automatically works out the value from other fields instead of requiring it to be typed in by hand[cite: 1] |

## US12. Change Formats Without Losing Old Data

**Who:** As a project owner[cite: 1]
**What:** I want to build features to add, remove, or rename fields in an existing entry format[cite: 1].
**Why:** So that I can adapt my logging structure over time while keeping old entries readable[cite: 1].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user edits an existing entry format[cite: 1] | The user adds, removes, or renames a field[cite: 1] | The system successfully updates the format[cite: 1] |
| AT2 | An entry format has been updated[cite: 1] | The user views old entries[cite: 1] | The system writes logic that updates old entries to match the new format with sensible defaults and keeps them readable[cite: 1] |

## US13. Statistics on Custom Fields

**Who:** As a user[cite: 1]
**What:** I want to run statistics functions to total, group, compare, and plot over time any custom field I define, not just built-in ones[cite: 1].
**Why:** So that I can generate meaningful insights specific to my project's unique data[cite: 1].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user opens the statistics view[cite: 1] | The user selects a custom field[cite: 1] | The system provides functions to total, group, or compare the selected fields[cite: 1] |
| AT2 | The user wants to view trends[cite: 1] | The user selects a custom field for plotting[cite: 1] | The system successfully plots this field over time[cite: 1] |

## US14. More Ways to View Entries

**Who:** As a user[cite: 1]
**What:** I want to view my entries using saved filters, a calendar view, or a board view (like Trello)[cite: 1].
**Why:** So that I can organize and visualize my entries according to my current workflow[cite: 1].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user sets up a filter or search[cite: 1] | The user saves the configuration[cite: 1] | The system builds saved filters so the setup can be reused later without rebuilding it[cite: 1] |
| AT2 | The user navigates to the project views[cite: 1] | The user selects the calendar or board view[cite: 1] | The system displays a calendar view or a board view grouped by whatever field the user picks[cite: 1] |

## US15. Tracking Unfinished Work

**Who:** As a user[cite: 1]
**What:** I want to log a to-do item tied to the logbook with due dates, and view everything still unfinished[cite: 1].
**Why:** So that I can manage pending project tasks efficiently alongside my logs[cite: 1].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user is in the logbook[cite: 1] | The user adds a to-do item with a due date[cite: 1] | The system successfully logs the to-do item tied to the logbook[cite: 1] |
| AT2 | The user has pending tasks[cite: 1] | The user accesses the unfinished work view[cite: 1] | The system builds a view listing everything still unfinished[cite: 1] |

## US16. Offline Use & Syncing

**Who:** As a user[cite: 1]
**What:** I want to capture entries with no internet connection and build sync logic that uploads them once a connection is back[cite: 1].
**Why:** So that I can continue my work regardless of internet connectivity without losing data[cite: 1].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user has no internet connection[cite: 1] | The user captures an entry[cite: 1] | The system makes entry capture work and saves it locally[cite: 1] |
| AT2 | The device reconnects to the internet and there are offline entries[cite: 1] | The system initiates a sync[cite: 1] | The system uploads offline entries and handles conflicts when the same entry was edited on two devices[cite: 1] |

## US17. Export & Import

**Who:** As a user[cite: 1]
**What:** I want to build an export function to save entries in a plain format (CSV, JSON, Markdown) and an import function to read them back[cite: 1].
**Why:** So that I can securely backup my data or migrate it between systems[cite: 1].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user triggers an export[cite: 1] | The user selects the export option[cite: 1] | The system saves entries in a plain, readable file format[cite: 1] |
| AT2 | The user has a previously exported file[cite: 1] | The user triggers the import function[cite: 1] | The system reads that file format back into the platform[cite: 1] |

## US18. View tasks on a monthly calendar

**Who:** As a student[cite: 4]
**What:** I want to see my tasks laid out on a month grid by due date[cite: 4].
**Why:** So that I can plan my workload across the month at a glance[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A month is selected[cite: 4] | The calendar loads[cite: 4] | It displays a 7-column grid (Mon-Sun) showing entries whose due date falls on each day[cite: 4] |
| AT2 | A day has many tasks[cite: 4] | Viewing that day[cite: 4] | It shows the first few entries plus a "+N more" indicator[cite: 4] |
| AT3 | The calendar is populated[cite: 4] | The user views tasks[cite: 4] | Only unarchived, non-deleted entries with a due date appear[cite: 4] |

## US19. Navigate between months

**Who:** As a student[cite: 4]
**What:** I want to move forward and backward through months and jump to today[cite: 4].
**Why:** So that I can review past deadlines or plan ahead[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user is on the calendar view[cite: 4] | They click "Previous" or "Next"[cite: 4] | The view moves one month back or forward respectively, and the month/year label updates[cite: 4] |
| AT2 | The user is viewing a different month[cite: 4] | They click "Today"[cite: 4] | The view returns to the current month[cite: 4] |

## US20. Switch between month and week views

**Who:** As a student[cite: 4]
**What:** I want to toggle between a month view and a week view[cite: 4].
**Why:** So that I can zoom into a single week when I need more detail[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The calendar is open[cite: 4] | The user toggles to week view[cite: 4] | It shows seven vertical day columns for the selected week[cite: 4] |
| AT2 | The calendar is in week mode[cite: 4] | The user uses navigation controls[cite: 4] | The calendar advances or retreats by one week[cite: 4] |

## US21. Reschedule a task by dragging it to another day

**Who:** As a student[cite: 4]
**What:** I want to drag an entry onto a different day in the calendar[cite: 4].
**Why:** So that I can move a deadline without opening the entry editor[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An entry is on the calendar[cite: 4] | The user drags it to another day[cite: 4] | updateEntry() is called with the new due date and the entry appears on the new day immediately[cite: 4] |
| AT2 | A drag-and-drop reschedule occurs[cite: 4] | The server write fails[cite: 4] | The entry reverts to its original day[cite: 4] |

## US22. Identify overdue and completed tasks visually

**Who:** As a student[cite: 4]
**What:** I want overdue tasks to be highlighted in red and completed tasks to appear in green with a strikethrough[cite: 4].
**Why:** So that I can spot urgent work and completed items at a glance[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An entry has a past due date and non-done status[cite: 4] | It renders on the calendar[cite: 4] | It displays with an accessible red visual indicator[cite: 4] |
| AT2 | An entry has a status of done_and_dusted[cite: 4] | It renders[cite: 4] | It displays in green with a strikethrough on the title[cite: 4] |

## US23. View tasks grouped by status

**Who:** As a student[cite: 4]
**What:** I want to see my tasks arranged in three columns - Up Next, In Motion, and Done & Dusted[cite: 4].
**Why:** So that I can understand the state of my work at a glance[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The Kanban board loads[cite: 4] | Unarchived and non-deleted entries exist[cite: 4] | Three columns are displayed (one per status) containing cards that show the entry title, project name, due date, and priority[cite: 4] |

## US24. Move a task between columns by dragging

**Who:** As a student[cite: 4]
**What:** I want to drag a card from one column to another[cite: 4].
**Why:** So that I can update a task's status without opening an editor[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A task card is on the board[cite: 4] | The user drags it to a different column[cite: 4] | Local state updates optimistically and updateEntry() is called with the new status[cite: 4] |
| AT2 | A task is moved to a new column[cite: 4] | The server write fails[cite: 4] | The card reverts to its original column[cite: 4] |

## US25. Automatic timestamp management on status change

**Who:** As a student[cite: 4]
**What:** I want the system to automatically set started_at and ended_at timestamps when moving tasks[cite: 4].
**Why:** So that I don't have to track time manually[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A card is moved to "In Motion"[cite: 4] | started_at is not set[cite: 4] | The system sets it to the current timestamp[cite: 4] |
| AT2 | A card is moved to "Done & Dusted"[cite: 4] | The move occurs[cite: 4] | The system sets ended_at to the current timestamp[cite: 4] |
| AT3 | A card is moved back to "Up Next"[cite: 4] | The move occurs[cite: 4] | Existing timestamps are not cleared[cite: 4] |

## US26. Filter the board by project or search term

**Who:** As a student[cite: 4]
**What:** I want to filter the Kanban board by project or type a search query[cite: 4].
**Why:** So that I can focus on a specific project or find a task quickly[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user uses the project dropdown[cite: 4] | A project is selected[cite: 4] | The board narrows to entries for that project in real time without a page reload[cite: 4] |
| AT2 | The user types in the search input[cite: 4] | They enter a query[cite: 4] | The board filters cards matching the title or description[cite: 4] |
| AT3 | A filter is applied[cite: 4] | It is cleared[cite: 4] | The full board is restored[cite: 4] |

## US27. Identify overdue tasks on the board

**Who:** As a student[cite: 4]
**What:** I want overdue cards to be visually highlighted[cite: 4].
**Why:** So that I can prioritise them while working on the board[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A card has a past due date and non-done status[cite: 4] | It renders on the board[cite: 4] | It is highlighted with a red visual indicator visible in light and dark themes[cite: 4] |

## US28. View tasks as horizontal bars across time

**Who:** As a student[cite: 4]
**What:** I want to see my tasks as bars spanning their start date to their due date on a horizontal timeline[cite: 4].
**Why:** So that I can visualise how my work is distributed over time[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | Valid dated entries exist[cite: 4] | The timeline renders[cite: 4] | Each is a bar from its resolved start date to resolved end date, skipping those that cannot be placed[cite: 4] |
| AT2 | The timeline is viewed[cite: 4] | Rendering the temporal context[cite: 4] | A red dashed line marks today, and grid lines with month-start markers are shown[cite: 4] |

## US29. See dependency arrows between linked tasks

**Who:** As a student[cite: 4]
**What:** I want to see curved arrows drawn from a predecessor task to its successor[cite: 4].
**Why:** So that I can understand which tasks depend on others and plan accordingly[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | Linked tasks exist in the JSONB payload[cite: 4] | They render on the timeline[cite: 4] | A Bézier arrow is drawn from the predecessor's right edge to the successor's left edge[cite: 4] |
| AT2 | A task chain exists[cite: 4] | They are placed on the timeline[cite: 4] | They are put on separate rows to keep arrows legible and appear connected[cite: 4] |

## US30. Zoom in and out on the timeline

**Who:** As a student[cite: 4]
**What:** I want to zoom the timeline from 50% to 400%[cite: 4].
**Why:** So that I can see fine detail for a busy week or the big picture across a month[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user adjusts zoom controls[cite: 4] | Levels between 0.5x and 4x are selected[cite: 4] | The view updates, remains horizontally scrollable, and individual day labels become visible at higher zooms[cite: 4] |

## US31. Scroll horizontally across the timeline

**Who:** As a student[cite: 4]
**What:** I want to scroll left and right across the timeline[cite: 4].
**Why:** So that I can navigate to tasks in the past or future without changing zoom[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The timeline container is populated[cite: 4] | The user scrolls horizontally[cite: 4] | Scrolling is smooth and does not break the grid or bar rendering[cite: 4] |

## US32. See a helpful empty state when no dated tasks exist

**Who:** As a new student[cite: 4]
**What:** I want to see a friendly message when the timeline has nothing to show[cite: 4].
**Why:** So that I understand what I need to do to populate it[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | No unarchived entries have a placable date[cite: 4] | The user opens the timeline[cite: 4] | An empty state is shown explaining how to add tasks with dates and set dependencies[cite: 4] |

## US33. Export all data as JSON

**Who:** As a student[cite: 4]
**What:** I want to download all my projects and entries as a JSON file[cite: 4].
**Why:** So that I have a machine-readable backup of my entire logbook[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user clicks export to JSON[cite: 4] | The action completes[cite: 4] | It automatically downloads a file containing version, timestamp, email, and all active/archived projects and entries[cite: 4] |
| AT2 | A downloaded JSON export[cite: 4] | It is imported into an empty database[cite: 4] | It is round-trip safe and reproduces the original row count[cite: 4] |

## US34. Export all data as CSV

**Who:** As a student[cite: 4]
**What:** I want to download all my projects and entries as a CSV file[cite: 4].
**Why:** So that I can open the data in a spreadsheet for analysis or reporting[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user triggers a CSV export[cite: 4] | The file is generated[cite: 4] | Projects and entries emit as separate sections with headers, properly serializing the JSONB field with escaped characters[cite: 4] |
| AT2 | The generated CSV[cite: 4] | Opened in standard spreadsheet software[cite: 4] | It opens correctly without layout breakage[cite: 4] |

## US35. Export all data as Markdown

**Who:** As a student[cite: 4]
**What:** I want to download all my projects and entries as a Markdown file[cite: 4].
**Why:** So that I can paste the data into documentation, a wiki, or a README[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user exports to Markdown[cite: 4] | The file generates[cite: 4] | It contains a metadata header and tables for Projects and Entries with pipe characters safely escaped[cite: 4] |

## US36. Import data from a previously exported file

**Who:** As a student[cite: 4]
**What:** I want to upload a JSON, CSV, or Markdown export file and have it recreate my projects and entries[cite: 4].
**Why:** So that I can restore a backup or migrate to a new account[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An export file is uploaded[cite: 4] | The import runs[cite: 4] | The format is auto-detected, projects and entries are created sequentially, archived status is re-applied, and a summary report is shown[cite: 4] |
| AT2 | Data is successfully imported[cite: 4] | Navigating views[cite: 4] | The imported data appears across the platform without a page refresh[cite: 4] |

## US37. Receive a report of rejected rows during import

**Who:** As a student[cite: 4]
**What:** I want the import to report which rows it rejected and why (with line numbers)[cite: 4].
**Why:** So that I can fix malformed data and re-import without losing valid rows[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An import file contains malformed data[cite: 4] | The import completes[cite: 4] | Invalid rows are skipped rather than causing a hard failure, and a rejection list displays the 1-based line numbers and reasons[cite: 4] |

## US38. Drag and drop a file to import

**Who:** As a student[cite: 4]
**What:** I want to drag a file onto the import area instead of clicking through a file picker[cite: 4].
**Why:** So that importing feels fast and natural[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | A user drags a file over the import area[cite: 4] | Hovering[cite: 4] | The area highlights[cite: 4] |
| AT2 | A user drops a file[cite: 4] | The action completes[cite: 4] | It triggers the same parse-and-import flow as the standard file picker[cite: 4] |

## US39. Round-trip safety

**Who:** As a student[cite: 4]
**What:** I want an export-then-import cycle to reproduce my data exactly[cite: 4].
**Why:** So that I can trust the backup and restore process[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | An empty database[cite: 4] | A previously exported file is imported[cite: 4] | It produces the exact same row counts, preserves archive states, and maintains all entry fields[cite: 4] |

## US40. Export to iCalendar (.ics)

**Who:** As a student[cite: 4]
**What:** I want to export my tasks as an iCalendar (.ics) file[cite: 4].
**Why:** So that I can open or subscribe to them in Google Calendar, Outlook, or Apple Calendar[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | Tasks have dates[cite: 4] | Exported to .ics[cite: 4] | The file is RFC 5545 compliant, maps fields correctly, escapes special characters, and successfully skips undated entries[cite: 4] |

## US41. One-command database backup

**Who:** As a student[cite: 4]
**What:** I want to back up my entire database with a single command[cite: 4].
**Why:** So that I can recover my data if something goes wrong[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The developer runs npm run db:backup[cite: 4] | The script executes[cite: 4] | It creates a PostgreSQL custom-format dump file that includes all app tables, saved with a timestamp or at a provided custom path[cite: 4] |

## US42. One-command database restore

**Who:** As a student[cite: 4]
**What:** I want to restore my database from a backup with a single command[cite: 4].
**Why:** So that I can recover after data loss[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The developer runs npm run db:restore[cite: 4] | The command executes[cite: 4] | It shows a 3-second warning before overwriting data and restores from the most recent backup or a designated file[cite: 4] |
| AT2 | A restore is complete[cite: 4] | npm run db:migrate is run[cite: 4] | It brings the schema up to date[cite: 4] |

## US43. Versioned schema migrations

**Who:** As a developer[cite: 4]
**What:** I want to run versioned schema migrations that upgrade an existing database[cite: 4].
**Why:** So that I never have to drop and recreate tables when the schema changes[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | npm run db:migrate is executed[cite: 4] | Pending migrations exist[cite: 4] | They run in order, are tracked in schema_migrations, skip already applied ones, and stop execution transactionally upon failure[cite: 4] |

## US44. Bootstrap existing database

**Who:** As a developer with a database created before the migration system[cite: 4]
**What:** I want to mark existing migrations as already applied[cite: 4].
**Why:** So that the migration runner doesn't try to re-run them[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | npm run db:bootstrap is executed[cite: 4] | Files exist[cite: 4] | It marks all migration files as applied without executing them, ensuring subsequent migrations only run new changes[cite: 4] |

## US45. Baseline full schema migration

**Who:** As a developer setting up a fresh Supabase project[cite: 4]
**What:** I want a single baseline migration that creates the entire current schema[cite: 4].
**Why:** So that I don't have to run 8 separate migration files manually[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | 000_baseline_full_schema.sql is run against a fresh database[cite: 4] | It completes[cite: 4] | It produces a fully working schema using idempotent statements[cite: 4] |
| AT2 | The baseline runs against an existing database[cite: 4] | It executes[cite: 4] | It operates as a no-op[cite: 4] |

## US46. Browse the API documentation

**Who:** As a developer[cite: 4]
**What:** I want to open a browsable page that shows all API endpoints[cite: 4].
**Why:** So that I can understand the API without reading source code[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user navigates to /api-docs on the project service[cite: 4] | It loads[cite: 4] | A Swagger UI page displays listing all endpoints across all microservices along with methods, paths, and request/response schemas[cite: 4] |

## US47. Try an API endpoint from the docs page

**Who:** As a developer[cite: 4]
**What:** I want to execute an API call directly from the docs page[cite: 4].
**Why:** So that I can verify the API works without switching to Postman[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The user is on the docs page[cite: 4] | They provide a Bearer JWT token and click "Try it out"[cite: 4] | It sends a real request to the running service and displays the response body, status code, and headers[cite: 4] |

## US48. Spec matches the implemented routes

**Who:** As a developer[cite: 4]
**What:** I want the OpenAPI spec to match the implemented routes exactly[cite: 4].
**Why:** So that the docs page is a reliable source of truth[cite: 4].

| Test | Given | When | Then |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1 | The API codebase is complete[cite: 4] | Comparing it to the OpenAPI spec[cite: 4] | The paths, routes, status codes, and error bodies match exactly, backed by automated verification tests[cite: 4] |
