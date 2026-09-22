# Sprint 3 User Stories

## US49. Refine UI and Layout Organization

**Who:** As a user
**What:** I want the interface to be intuitively organized and grouped logically.
**Why:** So that I can navigate my logbook easily without confusion.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | The user is navigating the dashboard and entries | They look for primary actions and project modules | The layout is clearly structured, logically grouped, and easily discoverable without confusion |

## US50. Migrate Existing Entries and Infer Data

**Who:** As a system administrator
**What:** I want existing entries to migrate smoothly when a format changes, automatically filling in reasonable defaults for new fields.
**Why:** So that old data is preserved, remains readable, and conforms to new format requirements.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | A project format has been updated with new fields | The system migrates existing entries | The old entries are updated to match the new format and missing values are populated with reasonably inferred defaults |

## US51. Implement Advanced Search, Grouping, and Comparison

**Who:** As a user
**What:** I want to search, pin configurations, group entries by specific fields, and compare them.
**Why:** So that I can deeply analyze my logged data and view relevant statistics.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | The user is on the logbook view | They apply a "group by" or "compare" filter to specific fields | The entries are reorganized accordingly and relevant statistics are displayed |
| AT2 | The user has created a custom search | They click pin | The search configuration is saved for later use |

## US52. Plot Statistical Entries Over Time

**Who:** As a user
**What:** I want to plot my entries and custom fields on a graph over time.
**Why:** So that I can visually track my productivity trends and field changes.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | The user is viewing the statistics module | They select a custom field to plot over time | The system generates a graph showing the field's data points across the specified timeline |

## US53. Implement Timer Notifications and Reminders

**Who:** As a user
**What:** I want to receive notifications when my timer is paused or has been running for a long time.
**Why:** So that I am reminded to resume my work or end my active tasks.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | A timer is actively paused or running excessively long | The configured time threshold is reached | The system triggers an alert reminding the user to resume or stop the timer |

## US54. Fix Due Date Past Restriction

**Who:** As a user
**What:** I want to be able to set due dates older than one week from the current time.
**Why:** So that I can accurately log past entries and retroactively manage my tasks without system blocks.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | The user is creating or editing an entry | They select a date that is more than a week in the past | The system successfully saves the entry without throwing a date restriction error |

## US55. Fix Scrolling on Project Creation Card

**Who:** As a user
**What:** I want to be able to scroll properly inside the project creation card.
**Why:** So that I can access all form fields and the submit button when the content overflows the screen.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | The user opens the project creation card | The form content exceeds the viewport height | The user can smoothly scroll down to view and interact with all fields and buttons |

## US56. Fix Dashboard Auto-Refresh on New Entry

**Who:** As a user
**What:** I want newly created entries to appear immediately on my dashboard.
**Why:** So that I can see my updates in real-time without having to manually refresh the browser.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | The user is on the dashboard | They successfully create a new entry | The entry instantly appears in the dashboard list and related stats update automatically without a page reload |

## US57. Refine Timer with Granular Settings

**Who:** As a user
**What:** I want to set my timer duration using specific days, hours, and minutes.
**Why:** So that I can accurately track and plan for varying lengths of work sessions.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | The user is starting a timer | They input a target duration using the day, hour, and minute fields | The system calculates the correct total time and begins the countdown accurately |

## US58. Add Empty Column Validation Alert

**Who:** As a user
**What:** I want to receive an alert if I try to create an entry with empty columns.
**Why:** So that I do not accidentally save incomplete records.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | The user is filling out an entry form | They click submit while required columns are empty | The system blocks the submission and displays an alert indicating which fields must be filled |

## US59. Fix Custom Column Visibility on Entry Creation

**Who:** As a user
**What:** I want newly added custom columns to immediately appear on the entry creation form.
**Why:** So that I can input data into the new fields without them going missing.

| Test | Given | When | Then |
| :--- | :--- | :--- | :--- |
| AT1 | A project format has been updated with a new column | The user navigates to create a new entry for that project | The new custom column is visible and available for data entry |