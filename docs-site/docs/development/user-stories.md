# Sprint 1 User Stories

Sprint 1 scope is limited to the first vertical slice: demonstrating the core
flow from login through project creation, template definition, entry
capture, timeline, and basic statistics — not the whole Digital Logbook
feature set.

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

## US3. Create a project

**Who:** As a signed-in user
**What:** I want to create a project with a name and optional description
**Why:** So that I can start keeping logbook entries for a specific piece of work.

| Test | Given                                       | When                                   | Then                                                                       |
| ---- | ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| AT1  | The user is on the dashboard                | The user opens the create-project form | The system displays fields for project name and description                |
| AT2  | The user enters a valid unique project name | The user saves the project             | The project is created and appears in the active projects list             |
| AT3  | The user leaves the project name empty      | The user tries to save the project     | The system rejects the form and explains that the project name is required |

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

<!-- AI Attribution: Formatting and table generation provided by Gemini (Model: Gemini 1.5 Pro). Purpose: Agile user story structuring and markdown formatting. -->
