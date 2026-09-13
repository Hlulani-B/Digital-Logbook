# Sprint 1 User Stories

Sprint 1 scope is limited to the first vertical slice: demonstrating the core
flow from login through project creation, template definition, entry
capture, timeline, and basic statistics — not the whole Digital Logbook
feature set.

!!! tip "Feedback traceability"
    Stories that were *refined* in Sprint 2 in response to the quick-survey
    are marked with a **Refined by:** note pointing at the originating
    problem, Gitea issue and shipped commit/PR. Stories that were *created
    new* in Sprint 2 sit under
    [Sprint 2 Feedback-Derived Stories](#sprint-2-feedback-derived-stories)
    at the end of this file.

## Demo flow

1. User signs in.
2. Dashboard opens.
3. User creates a project.
4. User defines the project entry format.
5. User captures a logbook entry using that format.
6. User views the saved entry in the project timeline.
7. User sees basic project statistics update.
8. User logs out.
9. User archives projects.
10. User is able to see recent activity logs.

## US1. Sign in to the system

**Who:** As a registered user
**What:** I want to sign in using a secure authentication method
**Why:** So that I can access my own logbook data safely.

| Test | Given                                                 | When                                                     | Then                                                                   |
| ---- | ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| AT1  | The user is on the login page and has a valid account | The user enters valid login details and submits the form | The system authenticates the user and redirects them to the dashboard  |
| AT2  | The user is on the login page                         | The user enters invalid login details                    | The system shows a clear error message and does not open the dashboard |
| AT3  | The user is not authenticated                         | The user tries to open a protected page                  | The system redirects the user to the login page                        |

## US2. View dashboard after login

**Who:** As a signed-in user
**What:** I want to see a dashboard with my active projects and quick actions
**Why:** So that I can continue logging work without searching through the app.

| Test | Given                               | When                | Then                                                                     |
| ---- | ----------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| AT1  | The user has successfully signed in | The dashboard loads | The system displays the active projects area and a create-project action |
| AT2  | The user has no projects yet        | The dashboard loads | The system shows an empty-state message and a create-project action      |
| AT3  | The user has active projects        | The dashboard loads | The system lists the active projects with basic summary information      |

**Refined by:** Sprint 2 Quick-Survey problem 1 ("Projects, calendar, entries
and activity log feel disconnected"). The dashboard was extended with
*Recently created* and *Recently viewed* quick-jump strips (liveness-filtered
against the current projects and entries) and every data-loading page was
subscribed to `cacheSubscribe` so writes elsewhere appear without a reload.
Tracked as Gitea issue [#118](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/118)
(closed), shipped in commits `dfd6e2b`, `69e472d`, `352b5be`, `121dbae`.

## US3. Create a project

**Who:** As a signed-in user
**What:** I want to create a project with a name and optional description
**Why:** So that I can start keeping logbook entries for a specific piece of work.

| Test | Given                                       | When                                   | Then                                                                       |
| ---- | ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| AT1  | The user is on the dashboard                | The user opens the create-project form | The system displays fields for project name and description                |
| AT2  | The user enters a valid unique project name | The user saves the project             | The project is created and appears in the active projects list             |
| AT3  | The user leaves the project name empty      | The user tries to save the project     | The system rejects the form and explains that the project name is required |

**Refined by:** Sprint 2 Quick-Survey problems 1 and 5. After creation the
app now redirects straight to `/project/:projectName` so the new project's
owning surface is immediately visible (commit `7c2331e`), and the projects
list is patched directly in React state + subscribed via `cacheSubscribe`,
so downstream pages see the new project without a reload (issues
[#118](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/118),
[#122](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/122)).

## US4. Define the project entry format

**Who:** As a project owner
**What:** I want to define fields and field types for the project entry format
**Why:** So that entries in that project record the information that matters for that project.

| Test | Given                                                      | When                                     | Then                                                               |
| ---- | ---------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| AT1  | A project has been created                                 | The owner opens the entry-format builder | The system allows field names and field types to be added          |
| AT2  | The owner defines at least one valid field                 | The owner saves the format               | The system stores the format as the active format for that project |
| AT3  | The owner tries to save no fields or duplicate field names | The owner submits the format             | The system rejects the format and shows a clear validation message |

## US5. Capture a logbook entry quickly

**Who:** As a project owner
**What:** I want to create a logbook entry using the project's active format
**Why:** So that I can record what I just worked on before I forget.

| Test | Given                                                             | When                                              | Then                                                                               |
| ---- | ----------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| AT1  | The project has an active entry format                            | The owner opens quick entry for that project      | The system displays only fields defined in that project's active format            |
| AT2  | The quick-entry form is open                                      | The owner enters valid values and saves the entry | The system stores the entry against the selected project and confirms it was saved |
| AT3  | The entry format contains predictable fields or built-in metadata | The quick-entry form opens                        | The system pre-fills date/time/project where possible while still allowing edits   |

**Refined by:** Sprint 2 Quick-Survey problems 1, 4 and 5. Every task-creation
surface (Dashboard FAB, Project page, AllEntries, Calendar, Timeline,
QuickAdd, voice capture) was unified so the muscle memory transfers
between pages, and each of them now records the new task into the
*Recently created* strip. Task-creation is also protected by a sequence-ref
race guard so the project the user just created is guaranteed to be
selectable immediately. Tracked as issues
[#118](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/118),
[#121](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/121),
[#122](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/122)
(closed); shipped in commits `7c2331e`, `f8cdb96`, `db1b73f`.

## US6. View project entries in a timeline

**Who:** As a project owner
**What:** I want to view saved entries in reverse chronological order
**Why:** So that I can see the history of work done on the project.

| Test | Given                                     | When                                 | Then                                                              |
| ---- | ----------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| AT1  | The project has one or more saved entries | The owner opens the project timeline | The system displays entries from newest to oldest                 |
| AT2  | An entry appears in the timeline          | The owner scans the timeline         | The system shows enough summary information to identify the entry |
| AT3  | The owner selects a specific project      | The timeline is displayed            | The system shows only entries belonging to that project           |

## US7. View basic project statistics

**Who:** As a project owner
**What:** I want to see simple statistics calculated from the project entries
**Why:** So that I can understand how much work has been recorded for the project.

| Test | Given                                      | When                                        | Then                                                                              |
| ---- | ------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------- |
| AT1  | A project has entries with duration values | The owner opens the project statistics view | The system displays the total time spent on that project                          |
| AT2  | New entries are added or edited            | The statistics view is refreshed            | The system updates the total time and entry count                                 |
| AT3  | The owner opens the dashboard              | There are multiple projects                 | The dashboard shows simple cross-project summaries such as total time per project |

## US8. Log out securely

**Who:** As a signed-in user
**What:** I want to log out of the system
**Why:** So that another person using the same device cannot access my logbook.

| Test | Given                   | When                                       | Then                                                                 |
| ---- | ----------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| AT1  | The user is signed in   | The user selects log out                   | The system ends the session and redirects the user to the login page |
| AT2  | The user has logged out | The user tries to open the dashboard again | The system prevents access and asks the user to sign in again        |

## US9. Archive functionality

**Who:** As a registered user
**What:** I want to archive old or completed logbook projects and entries
**Why:** So that my main dashboard remains uncluttered while still keeping a historical record of my past work.

| Test | Given                                                             | When                                                       | Then                                                                                        |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| AT1  | The user is on the main dashboard and has active logbook projects | The user clicks the "Archive" button on a specific project | The system removes it from the active view and flags it as archived in the database         |
| AT2  | The user wants to review past work                                | The user navigates to the "Archived" section               | The system displays a list of all previously archived projects and entries                  |
| AT3  | The user accidentally archived a project                          | The user clicks "Restore" on an archived item              | The system removes the archive flag and moves the project back to the active dashboard view |

## US10. Implement Activity Log

**Who:** As a registered user
**What:** I want to be able to access my Activity Log
**Why:** So that I can see a trail of activities I've done before

| Test | Given                                                | When                                        | Then                                                                                                                                                                                       |
| ---- | ---------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AT1  | The user is authenticated and logged into the system | The user navigates to the Activity Log page | The system displays a chronological list of all past activities, showing the date, time, and description of the action performed, and sorted with the most recent activity displayed first |

## Sprint 2 Feedback-Derived Stories

These stories were created *new* in Sprint 2, directly from the quick-survey
findings. Each cites the originating problem number, the Gitea issue it is
tracked under, and the PR / merge commit that shipped it — closing the
feedback → story → implementation loop that the "User Feedback" and
"Bug Tracker" rubric rows both require.

### US11. See clearly what a "task" is and how it relates to a project

**Source:** Sprint 2 Quick-Survey problem 3 (unclear terminology).
**Gitea issue:** [#120](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/120) — closed.
**Shipped:** PR #113 (`Replace Entry/Entries with Task/Tasks in UI`).

**Who:** As a first-time user
**What:** I want the app to call the things by names I already understand
**Why:** So that I do not have to build a new mental model to use it.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | User is on any entry-list surface | User reads the page | Labels say "Task" / "Tasks" not "Entry" / "Entries" |
| AT2 | User opens Project Settings | User sees the format builder | Column definitions are labelled "Columns" with a tooltip |
| AT3 | User hovers a project name in a task row | A tooltip appears | The tooltip names the project and the row links to it |

### US12. See and reach the last things I created or opened

**Source:** Sprint 2 Quick-Survey problem 1 (disconnected).
**Gitea issue:** [#118](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/118) — closed.
**Shipped:** commits `dfd6e2b`, `69e472d`, `352b5be`, `d000307`, PR #116.

**Who:** As a returning user
**What:** I want the dashboard to show me my last few creations and last few views
**Why:** So that I can pick up where I left off without hunting.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | User just added a task from any surface | User lands on the Dashboard | The task appears in *Recently created* and links to its project |
| AT2 | User just visited a project | User navigates back to the Dashboard | The project appears at the top of *Recently viewed* |
| AT3 | A project or task in the recents has been deleted or archived | Dashboard re-renders | The stale recents entry is filtered out automatically |

### US13. Understand exactly what data the app stores and how AI is used

**Source:** Sprint 2 Quick-Survey problem 7 (data-privacy trust) + external
tester feedback items 6 and 7.
**Gitea issue:** [#124](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/124) — closed.
**Shipped:** commits `21d6ce1` and predecessor; new pages `DataDisclaimer.tsx`
and `DataDisclaimer2.tsx`.

**Who:** As a privacy-conscious new user
**What:** I want an upfront, honest disclosure of where my data lives and what the AI does with it
**Why:** So that I can decide whether to trust the app before entering anything.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | User just completed sign-up | Router hands off to `/data-disclaimer` | A one-time page appears listing Supabase, IndexedDB, Render, AI scope, opt-out, export, deletion grace period |
| AT2 | User accepts the disclaimer | User clicks Continue | Flag is cleared and the user lands on the dashboard |
| AT3 | User is signing in later (not a new signup) | Route runs `routeUser` | The disclaimer is skipped; the always-available `DataDisclaimer2` page is linked from the NavBar drawer |

### US14. Confirm destructive actions with an in-app dialog, not a browser pop-up

**Source:** Sprint 2 Quick-Survey problem 6 (native browser alerts) + external
tester feedback item 3.
**Gitea issue:** [#123](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/123) — closed.
**Shipped:** commits touching `NewEntry.tsx` and `Dashboard.tsx` in the
tester-feedback batch.

**Who:** As any user
**What:** I want delete/undo confirmations to look like the rest of the app
**Why:** So that the experience feels polished and does not flash a browser chrome.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | User opens the entry row menu | User clicks *Delete* | An inline "Delete? / Yes, delete / Cancel" prompt appears in the menu itself |
| AT2 | Project field-save partially fails on the dashboard | The failure returns | The message renders inline in the form; no `window.alert` |
| AT3 | User clicks *Cancel* on any inline prompt | Prompt disappears | No mutation was issued to the server |

### US15. Give each project its own colour, and pick a website theme

**Source:** Sprint 2 Quick-Survey feature requests ("different colours so
that every project can have its own colour" and "customising colours of
website").
**Gitea issues:** [#93](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/93) (themes),
project-colour work tracked with the same feedback tag; migration
`008_add_project_color.sql`.
**Shipped:** PR #93, commit `c0c9bce`.

**Who:** As a returning user with many projects
**What:** I want to colour-code projects and pick a global theme
**Why:** So that the app feels personal and I can recognise projects at a glance.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | User opens Project Settings on any project | User selects a swatch | `project_color` is stored server-side, cache is patched optimistically, all surfaces update |
| AT2 | User reopens the app on a different device | Dashboard loads | The stored colour is present cross-device (server-side persistence, not localStorage) |
| AT3 | User opens Settings → Theme | User selects a dark variant | Theme applies instantly via CSS variables and persists in preferences |

### US16. See the individual logbook record called by the same word everywhere

**Source:** Post-Sprint-2 terminology review. The Sprint-2 rename
(`Entry` → `Task`, PR #113) fixed one confusion but created another —
"task" collided with kanban "task board", with the sprint-planning sense
of the word used in course material, and with the way our own docs
described team-internal work. Internal identifiers, CSS classes and
data-key lookups were never called "task"; only the UI was, so users
still saw `entry` / `task` / `item` depending on where they looked.

**Gitea PR:** [#137](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/137) — merged as `cef84ac`.
**Shipped:** commit `ff5b77e` (19 files, 62 user-facing strings).

**Who:** As any user
**What:** I want the app to call a single logbook record an *"item"*
everywhere it appears on screen, so that the vocabulary matches the
docs, the DB, the export files, and the code
**Why:** So that I never have to translate between three words for the
same thing.

| Test | Given | When | Then |
| ---- | ----- | ---- | ---- |
| AT1 | User is on any surface that lists logbook records (Dashboard, All Items, Calendar, Kanban, Today, Timeline, Project detail, Quick Add, Add Entry) | User reads headings, buttons, tooltips, empty states and messages | The word is *"item" / "items"*; the word *"task"* does not appear anywhere user-facing |
| AT2 | User exports data or reads the Data Portability help | User inspects labels | Same *"item"* vocabulary as the UI |
| AT3 | Developer greps for user-facing "task" in `frontend/src` | Only non-user-facing contexts remain | Remaining matches are identifiers, CSS classes, `data-key` lookups, and internal comments; no UI string contains "task" |

!!! info "Scope"
    Internal identifiers (`entry`, `entries`, `task`, database columns,
    cache keys, event names, CSS classes, `data-key` attributes, AI
    prompt keys) are unchanged — this is a **UI-only** rename. The
    database still calls the row an "entry" and the code still calls
    it an "entry" in most places; only what the user sees was unified
    to "item". This avoids a costly migration for zero user benefit.

<!-- AI Attribution: Formatting and table generation provided by Gemini (Model: Gemini 1.5 Pro). Purpose: Agile user story structuring and markdown formatting. -->
