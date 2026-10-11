# Work Tracker

This page is the public, version-controlled equivalent of the team's private
Trello boards. It records the tasks, ownership, status, and the evidence that
shows each task was completed, across all four sprints of the project.

For the sprint rubrics, this file satisfies the **Work Tracker (5%)**
criterion. The private Trello boards are used for day-to-day task assignment;
the Sprint 1–3 sections below are snapshots exported from those boards at the
end of each sprint. **Sprint 4 had no Trello board** — it is reconstructed
from the Git history and pull requests, as noted in its section.

---

## Sprint 1 Overview

| Property         | Value                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint goal**  | Deliver a working vertical slice from sign-in through project creation, custom entry format, logbook entry capture, timeline view, and basic statistics. |
| **Sprint dates** | 4 August 2026 – 24 August 2026                                                                                                                           |
| **Team size**    | 6                                                                                                                                                        |
| **Scrum events** | Sprint Planning (Meeting 4), Daily standups (async/WhatsApp), Sprint Review (Meeting 7), Retrospective (captured in [Development Log](log.md))           |

---

## Sprint Backlog

### Legend

| Status      | Meaning                                     |
| ----------- | ------------------------------------------- |
| Done        | Implemented, tested, and merged into `main` |
| In Progress | Actively being worked on or under review    |
| Pending     | Not started or moved to a future sprint     |

---

### Authentication & Onboarding

| ID  | Task                                  | Owner           | Status | User Story                                                          | Evidence                                                   |
| --- | ------------------------------------- | --------------- | ------ | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| T1  | Email/password sign-in and sign-up    | Nasiphi (Missy) | Done   | [US1](../User_Stories/sprint-one.md#us1-sign-in-to-the-system)      | `SignIn.tsx`, `AuthContext.tsx`, Supabase Auth integration |
| T2  | Google / GitHub OAuth sign-in         | Nasiphi (Missy) | Done   | [US1](../User_Stories/sprint-one.md#us1-sign-in-to-the-system)      | OAuth icon buttons in `SignIn.tsx`, `AuthCallback.tsx`     |
| T3  | Password reset flow                   | Nasiphi (Missy) | Done   | [US1](../User_Stories/sprint-one.md#us1-sign-in-to-the-system)      | `ResetPassword.tsx`, `UpdatePassword.tsx`                  |
| T4  | Create profile page                   | Hlulani         | Done   | [US2](../User_Stories/sprint-one.md#us2-view-dashboard-after-login) | `CreateProfile.tsx`, profile-service `profile.js`          |
| T5  | Avatar selection page                 | Hlulani         | Done   | Onboarding                                                          | `Avatar.tsx`, `AvatarPicker.tsx`                           |
| T6  | Tone, theme, and frequency onboarding | Hlulani         | Done   | Onboarding                                                          | `ToneSetup.tsx`, `ThemeSetup.tsx`, `FrequencySetup.tsx`    |
| T7  | Protected routes and session handling | Hlulani         | Done   | [US1](../User_Stories/sprint-one.md#us1-sign-in-to-the-system)      | `ProtectedRoute.tsx`, `AuthContext.tsx`                    |

### Dashboard & Navigation

| ID  | Task                                               | Owner   | Status | User Story                                                          | Evidence                                               |
| --- | -------------------------------------------------- | ------- | ------ | ------------------------------------------------------------------- | ------------------------------------------------------ |
| T8  | Dashboard layout and project list                  | Hlulani | Done   | [US2](../User_Stories/sprint-one.md#us2-view-dashboard-after-login) | `Dashboard.tsx`, `dashboard.js`                        |
| T9  | App drawer / navigation menu                       | Hlulani | Done   | [US2](../User_Stories/sprint-one.md#us2-view-dashboard-after-login) | Drawer component in `Dashboard.tsx`                    |
| T10 | Settings panel (profile, preferences, danger zone) | Hlulani | Done   | [US8](../User_Stories/sprint-one.md#us8-log-out-securely)           | `SettingsPanel.tsx`                                    |
| T11 | Search across projects and entries                 | Hlulani | Done   | [US2](../User_Stories/sprint-one.md#us2-view-dashboard-after-login) | `dashboard-service/src/functions/search.js`, search UI |
| T12 | Sign-out functionality                             | Hlulani | Done   | [US8](../User_Stories/sprint-one.md#us8-log-out-securely)           | `AuthContext.tsx` sign-out, settings menu              |

### Projects & Entries

| ID  | Task                                           | Owner      | Status | User Story                                                                  | Evidence                                                             |
| --- | ---------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| T13 | Create project form and API                    | Siphesihle | Done   | [US3](../User_Stories/sprint-one.md#us3-create-a-project)                   | `NewProject.tsx`, `project-service/src/functions/project.js`         |
| T14 | Define custom entry format (fields/types)      | Siphesihle | Done   | [US4](../User_Stories/sprint-one.md#us4-define-the-project-entry-format)    | `ProjectSettingsPanel.tsx`, `field.js`                               |
| T15 | Quick-entry form for capturing logbook entries | Hlulani    | Done   | [US5](../User_Stories/sprint-one.md#us5-capture-a-logbook-entry-quickly)    | `AddEntry.tsx`, `NewEntry.tsx`, `entries.js`                         |
| T16 | Project timeline / entries view                | Hlulani    | Done   | [US6](../User_Stories/sprint-one.md#us6-view-project-entries-in-a-timeline) | `Project.tsx`, entry card components                                 |
| T17 | Basic project statistics                       | Sicelo     | Done   | [US7](../User_Stories/sprint-one.md#us7-view-basic-project-statistics)      | Stats view in `Project.tsx` / dashboard                              |
| T18 | Archive support (backend + partial frontend)   | Lupa       | Done*  | [US6](../User_Stories/sprint-one.md#us6-view-project-entries-in-a-timeline) | `archives.js`, archive route and tests; frontend placeholder remains |

> *Archive backend is complete and tested; frontend archive UI was removed and
> left as a placeholder per [Roadmap](../roadmap.md) technical debt.

### Backend Services & Infrastructure

| ID  | Task                                                             | Owner                | Status | User Story | Evidence                                                                                                                              |
| --- | ---------------------------------------------------------------- | -------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T19 | Set up Express microservices (auth, project, dashboard, profile) | Siphesihle / Hlulani | Done   | N/A        | `services/*`, health routes, `render.yaml`                                                                                            |
| T20 | Database schema and migrations                                   | Team                 | Done   | N/A        | Supabase migrations, `database.md`                                                                                                    |
| T21 | CORS configuration and error handling                            | Hlulani              | Done   | N/A        | CORS middleware in all services, global error handlers                                                                                |
| T22 | CI/CD pipeline (Gitea Actions + Render)                          | Hlulani / Nasiphi    | Done   | N/A        | `.gitea/workflows/ci.yml`, `.gitea/workflows/backend-unit-tests.yml`, `.gitea/workflows/backend-integration-tests.yml`, `render.yaml` |
| T23 | Test coverage and badges                                         | Hlulani              | Done   | N/A        | Jest tests in 4 services, `badges/` directory                                                                                         |
| T24 | Documentation site (MkDocs)                                      | Team                 | Done   | N/A        | `docs-site/`, deployed docs                                                                                                           |

### Additional Features & Polish

| ID  | Task                                           | Owner             | Status | User Story                                                               | Evidence                                                   |
| --- | ---------------------------------------------- | ----------------- | ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| T25 | Activity log backend                           | Zamo              | Done   | N/A                                                                      | `project-service/src/functions/activityLog.js`, tests      |
| T26 | Natural language entry parsing with AI         | Hlulani           | Done   | [US5](../User_Stories/sprint-one.md#us5-capture-a-logbook-entry-quickly) | `ai.js`, multi-provider chain                              |
| T27 | Theming system (fonts, colours, corner styles) | Hlulani           | Done   | N/A                                                                      | Theme context, `ThemeSetup.tsx`, CSS variables             |
| T28 | Soft-delete / account recovery                 | Nasiphi / Hlulani | Done   | N/A                                                                      | `delete_user()` / `restore_user()` RPCs, `AuthRestore.tsx` |

---

## Sprint 1 Status Summary

| Metric      | Count |
| ----------- | ----- |
| Total tasks | 28    |
| Done        | 28    |
| In Progress | 0     |
| Pending     | 0     |

---

## Sprint 2 Overview

| Property         | Value                                                                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint goal**  | Expand the vertical slice into a full personal-planning workload: richer entry formats, calendar/board/today/timeline views, data portability, offline capture, and developer tooling. |
| **Sprint dates** | 2 September 2026 – c. 19 September 2026 (planning 2 September; client demos 10 & 12 September; retrospective 21 September)                                                             |
| **Team size**    | 6                                                                                                                                                                                      |
| **Scrum events** | Sprint Planning (Meeting 9), standups (7 & 9 September), client demonstrations (10 & 12 September), Retrospective (Meeting 11)                                                         |
| **Board**        | 38 cards (US11–US48) — **all 38 carry their Trello completion flag**                                                                                                                   |

## Sprint 2 Backlog

### Richer Formats & Custom-Field Statistics

| ID   | Task                                                               | Owner  | Status | User Story                                                                        | Evidence                                                                                                   |
| ---- | ------------------------------------------------------------------ | ------ | ------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| US11 | Tags, checklists, entry links, project references, computed fields | Lupa   | Done   | [US11](../User_Stories/sprint-two.md#us11-implement-richer-fields)                | Richer fields and cross-project references presented at [Meeting 12](../Meetings/sprint-three-meetings.md) |
| US12 | Add/remove/rename fields without losing old data                   | Zamo   | Done   | [US12](../User_Stories/sprint-two.md#us12-change-formats-without-losing-old-data) | Data-persistence clarification presented at Meeting 12; `frontend/src/lib/fieldVersioning.ts`              |
| US13 | Statistics over custom fields (total, group, compare, plot)        | Sicelo | Done   | [US13](../User_Stories/sprint-two.md#us13-statistics-on-custom-fields)            | Statistics dashboard with project filtering presented at Meeting 12                                        |

### Views & Offline

| ID   | Task                                             | Owner      | Status | User Story                                                           | Evidence                                                                                                          |
| ---- | ------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| US14 | Saved filters, calendar view, board view         | Hlulani    | Done   | [US14](../User_Stories/sprint-two.md#us14-more-ways-to-view-entries) | `frontend/src/pages/Calendar.tsx`, `frontend/src/pages/Kanban.tsx`                                                |
| US15 | To-do items with due dates; view unfinished work | Siphesihle | Done   | [US15](../User_Stories/sprint-two.md#us15-tracking-unfinished-work)  | Due Soon / Up Next dashboard sections; due dates on entries                                                       |
| US16 | Offline entry capture and sync                   | Hlulani    | Done   | [US16](../User_Stories/sprint-two.md#us16-offline-use-syncing)       | `frontend/src/CacheFunctions/` (`offlineQueue.js`, `queueProcessor.js`, `syncService.js`), `public/sql-wasm.wasm` |

### Calendar & Board Detail

| ID   | Task                                                  | Owner           | Status | User Story                                                                                 | Evidence                               |
| ---- | ----------------------------------------------------- | --------------- | ------ | ------------------------------------------------------------------------------------------ | -------------------------------------- |
| US18 | Month grid calendar by due date                       | Nasiphi (Missy) | Done   | [US18](../User_Stories/sprint-two.md#us18-view-tasks-on-a-monthly-calendar)                | `Calendar.tsx` month view              |
| US19 | Month navigation (previous / next / today)            | Nasiphi (Missy) | Done   | [US19](../User_Stories/sprint-two.md#us19-navigate-between-months)                         | `Calendar.tsx` navigation              |
| US20 | Month / week toggle                                   | Nasiphi (Missy) | Done   | [US20](../User_Stories/sprint-two.md#us20-switch-between-month-and-week-views)             | `Calendar.tsx` week view               |
| US21 | Drag an entry to another day to reschedule            | Nasiphi (Missy) | Done   | [US21](../User_Stories/sprint-two.md#us21-reschedule-a-task-by-dragging-it-to-another-day) | Drag-to-reschedule on the calendar     |
| US22 | Overdue in red; completed in green with strikethrough | Nasiphi (Missy) | Done   | [US22](../User_Stories/sprint-two.md#us22-identify-overdue-and-completed-tasks-visually)   | `Calendar.tsx` colour coding           |
| US23 | Tasks grouped by status columns                       | Nasiphi (Missy) | Done   | [US23](../User_Stories/sprint-two.md#us23-view-tasks-grouped-by-status)                    | `Kanban.tsx` status columns            |
| US24 | Drag a card between columns to change status          | Nasiphi (Missy) | Done   | [US24](../User_Stories/sprint-two.md#us24-move-a-task-between-columns-by-dragging)         | `Kanban.tsx` drag-to-change-status     |
| US25 | Automatic `started_at` / `ended_at` on status change  | Nasiphi (Missy) | Done   | [US25](../User_Stories/sprint-two.md#us25-automatic-timestamp-management-on-status-change) | Status-change timestamp automation     |
| US26 | Filter the board by project or search term            | Nasiphi (Missy) | Done   | [US26](../User_Stories/sprint-two.md#us26-filter-the-board-by-project-or-search-term)      | `Kanban.tsx` project filter and search |
| US27 | Overdue cards visually highlighted                    | Nasiphi (Missy) | Done   | [US27](../User_Stories/sprint-two.md#us27-identify-overdue-tasks-on-the-board)             | `Kanban.tsx` overdue indicators        |

### Timeline View

| ID   | Task                                     | Owner           | Status | User Story                                                                                     | Evidence                          |
| ---- | ---------------------------------------- | --------------- | ------ | ---------------------------------------------------------------------------------------------- | --------------------------------- |
| US28 | Tasks as horizontal bars across time     | Nasiphi (Missy) | Done   | [US28](../User_Stories/sprint-two.md#us28-view-tasks-as-horizontal-bars-across-time)           | `frontend/src/pages/Timeline.tsx` |
| US29 | Dependency arrows between linked tasks   | Nasiphi (Missy) | Done   | [US29](../User_Stories/sprint-two.md#us29-see-dependency-arrows-between-linked-tasks)          | `Timeline.tsx` dependency arrows  |
| US30 | Timeline zoom controls                   | Nasiphi (Missy) | Done   | [US30](../User_Stories/sprint-two.md#us30-zoom-in-and-out-on-the-timeline)                     | `Timeline.tsx` zoom controls      |
| US31 | Horizontal scrolling across the timeline | Nasiphi (Missy) | Done   | [US31](../User_Stories/sprint-two.md#us31-scroll-horizontally-across-the-timeline)             | `Timeline.tsx`                    |
| US32 | Helpful empty state when nothing to show | Nasiphi (Missy) | Done   | [US32](../User_Stories/sprint-two.md#us32-see-a-helpful-empty-state-when-no-dated-tasks-exist) | `Timeline.tsx` empty state        |

### Import & Export

| ID   | Task                                         | Owner           | Status | User Story                                                                                 | Evidence                                                                            |
| ---- | -------------------------------------------- | --------------- | ------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| US17 | Export entries in plain formats; import back | Nasiphi (Missy) | Done   | [US17](../User_Stories/sprint-two.md#us17-export-import)                                   | `frontend/src/lib/export.ts`, `import.ts`, `frontend/src/pages/DataPortability.tsx` |
| US33 | Export all data as JSON                      | Nasiphi (Missy) | Done   | [US33](../User_Stories/sprint-two.md#us33-export-all-data-as-json)                         | `export.ts` JSON export                                                             |
| US34 | Export all data as CSV                       | Nasiphi (Missy) | Done   | [US34](../User_Stories/sprint-two.md#us34-export-all-data-as-csv)                          | `export.ts` CSV export                                                              |
| US35 | Export all data as Markdown                  | Nasiphi (Missy) | Done   | [US35](../User_Stories/sprint-two.md#us35-export-all-data-as-markdown)                     | `export.ts` Markdown export                                                         |
| US36 | Import from a previously exported file       | Nasiphi (Missy) | Done   | [US36](../User_Stories/sprint-two.md#us36-import-data-from-a-previously-exported-file)     | `import.ts` format auto-detection                                                   |
| US37 | Report of rejected import rows               | Nasiphi (Missy) | Done   | [US37](../User_Stories/sprint-two.md#us37-receive-a-report-of-rejected-rows-during-import) | `import.ts` rejected-row reporting                                                  |
| US38 | Drag-and-drop file import                    | Nasiphi (Missy) | Done   | [US38](../User_Stories/sprint-two.md#us38-drag-and-drop-a-file-to-import)                  | Import drop zone in `DataPortability.tsx`                                           |
| US39 | Export → import round-trip safety            | Nasiphi (Missy) | Done   | [US39](../User_Stories/sprint-two.md#us39-round-trip-safety)                               | `frontend/src/lib/__tests__/import-export.test.ts`                                  |
| US40 | Export to iCalendar (.ics)                   | Nasiphi (Missy) | Done   | [US40](../User_Stories/sprint-two.md#us40-export-to-icalendar-ics)                         | `export.ts` VCALENDAR output                                                        |

### Database Operations

| ID   | Task                           | Owner           | Status | User Story                                                                | Evidence                                           |
| ---- | ------------------------------ | --------------- | ------ | ------------------------------------------------------------------------- | -------------------------------------------------- |
| US41 | One-command database backup    | Nasiphi (Missy) | Done   | [US41](../User_Stories/sprint-two.md#us41-one-command-database-backup)    | `scripts/backup.js`, `npm run db:backup`           |
| US42 | One-command database restore   | Nasiphi (Missy) | Done   | [US42](../User_Stories/sprint-two.md#us42-one-command-database-restore)   | `scripts/restore.js`, `npm run db:restore`         |
| US43 | Versioned schema migrations    | Nasiphi (Missy) | Done   | [US43](../User_Stories/sprint-two.md#us43-versioned-schema-migrations)    | `scripts/migrate.js`, `supabase/migrations/`       |
| US44 | Bootstrap an existing database | Nasiphi (Missy) | Done   | [US44](../User_Stories/sprint-two.md#us44-bootstrap-existing-database)    | `npm run db:bootstrap` (`scripts/package.json`)    |
| US45 | Baseline full-schema migration | Nasiphi (Missy) | Done   | [US45](../User_Stories/sprint-two.md#us45-baseline-full-schema-migration) | `supabase/migrations/000_baseline_full_schema.sql` |

### API Documentation

| ID   | Task                                    | Owner           | Status | User Story                                                                        | Evidence                                                           |
| ---- | --------------------------------------- | --------------- | ------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| US46 | Browsable API documentation page        | Nasiphi (Missy) | Done   | [US46](../User_Stories/sprint-two.md#us46-browse-the-api-documentation)           | Swagger UI at `/api-docs` on project-service                       |
| US47 | Try an API endpoint from the docs page  | Nasiphi (Missy) | Done   | [US47](../User_Stories/sprint-two.md#us47-try-an-api-endpoint-from-the-docs-page) | Swagger "Try it out" with CORS for localhost origins               |
| US48 | OpenAPI spec matches implemented routes | Nasiphi (Missy) | Done   | [US48](../User_Stories/sprint-two.md#us48-spec-matches-the-implemented-routes)    | `services/project-service/docs/openapi.yaml` + 12 validation tests |

## Sprint 2 Status Summary

| Metric              | Count |
| ------------------- | ----- |
| Total cards         | 38    |
| Done (flag checked) | 38    |
| In Progress         | 0     |
| Pending             | 0     |

> Sprint 2 shipped its full planned feature set, but the sprint review mark
> was disappointing because a broken automated testing pipeline had let
> failing code reach the client demonstration. The pipeline was repaired
> immediately after the review, and "every merge must pass the pipeline"
> became a standing rule — see the
> [Roadmap — Sprint 2](../roadmap.md#sprint-2-expansion-219-september-2026).

---

## Sprint 3 Overview

| Property         | Value                                                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint goal**  | Recover from the Sprint 2 review: repair the process (testing pipeline, branch protection) and refine the product — UI reorganization as the main issue, data migration, advanced search and statistics, timer completion, and six bug fixes. |
| **Sprint dates** | 21–29 September 2026 (planning 21 September; client progress review 25 September; sprint review Tuesday 29 September)                                                                                                                         |
| **Scrum events** | Planning + Sprint 2 retrospective (Meeting 11), client progress review (Meeting 12), pre-marking coordination (Meeting 13)                                                                                                                    |
| **Board**        | 11 cards (US49–US59)                                                                                                                                                                                                                          |

!!! warning "Status caveat — Sprint 3 board"
All 11 Sprint 3 cards sit in the board's **Done list, but none has its
Trello completion flag checked** (`dueComplete` is false for every card).
Status in this section therefore reflects **list position only**, not an
independently verified completion. Where the Git history or meeting
record corroborates a card, the Evidence column cites it; where it does
not, the card is recorded as done-by-list-position only.

## Sprint 3 Backlog

| ID   | Task                                                     | Owner           | Status      | User Story                                                                                     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | -------------------------------------------------------- | --------------- | ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US49 | Refine UI and layout organization                        | All six members | Done (list) | [US49](../User_Stories/sprint-three.md#us49-refine-ui-and-layout-organization)                 | PR [#382](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/382): due-soon rail, leading entry/project cards, unified Sort/View dropdowns, consolidated stats controls (merged 29 Sep) — the client criticism it answers is recorded at [Meeting 11](../Meetings/sprint-three-meetings.md)                                                                                                                                                                 |
| US50 | Migrate existing entries and infer data on format change | Nasiphi (Missy) | Done (list) | [US50](../User_Stories/sprint-three.md#us50-migrate-existing-entries-and-infer-data)           | List position only; format-migration code (`frontend/src/lib/fieldMigration.ts`) exists but was not individually demonstrated                                                                                                                                                                                                                                                                                                                                      |
| US51 | Advanced search, grouping and comparison                 | Lupa, Sicelo    | Done (list) | [US51](../User_Stories/sprint-three.md#us51-implement-advanced-search-grouping-and-comparison) | Presented at [Meeting 12](../Meetings/sprint-three-meetings.md) (advanced search with pinned configurations)                                                                                                                                                                                                                                                                                                                                                       |
| US52 | Plot statistical entries over time                       | Sicelo          | Done (list) | [US52](../User_Stories/sprint-three.md#us52-plot-statistical-entries-over-time)                | Presented at Meeting 12 (statistics filtering by project, plotting over time)                                                                                                                                                                                                                                                                                                                                                                                      |
| US53 | Timer notifications and reminders                        | Nasiphi (Missy) | Done (list) | [US53](../User_Stories/sprint-three.md#us53-implement-timer-notifications-and-reminders)       | Notification feature presented at Meeting 12; setup guide merged 28 Sep (PR [#378](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/378))                                                                                                                                                                                                                                                                                                                 |
| US54 | Remove due-date "older than a week" restriction          | Siphesihle      | Done (list) | [US54](../User_Stories/sprint-three.md#us54-fix-due-date-past-restriction)                     | List position only — no independent completion evidence                                                                                                                                                                                                                                                                                                                                                                                                            |
| US55 | Fix scrolling on the project-creation card               | Siphesihle      | Done (list) | [US55](../User_Stories/sprint-three.md#us55-fix-scrolling-on-project-creation-card)            | List position only — no independent completion evidence                                                                                                                                                                                                                                                                                                                                                                                                            |
| US56 | Fix dashboard auto-refresh on new entry                  | Hlulani         | Done (list) | [US56](../User_Stories/sprint-three.md#us56-fix-dashboard-auto-refresh-on-new-entry)           | List position only — no independent completion evidence                                                                                                                                                                                                                                                                                                                                                                                                            |
| US57 | Granular timer settings (days / hours / minutes)         | Siphesihle      | Done (list) | [US57](../User_Stories/sprint-three.md#us57-refine-timer-with-granular-settings)               | Timer enhancement wave merged 28 Sep (PRs [#323](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/323)–[#326](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/326), [#333](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/333), [#363](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/363)); the granular day/hour/minute fields are not separately identifiable in the merge history — recorded as done by list position |
| US58 | Empty-column validation alert                            | Nasiphi (Missy) | Done (list) | [US58](../User_Stories/sprint-three.md#us58-add-empty-column-validation-alert)                 | List position only — no independent completion evidence                                                                                                                                                                                                                                                                                                                                                                                                            |
| US59 | Fix custom-column visibility on entry creation           | Nasiphi (Missy) | Done (list) | [US59](../User_Stories/sprint-three.md#us59-fix-custom-column-visibility-on-entry-creation)    | List position only — no independent completion evidence                                                                                                                                                                                                                                                                                                                                                                                                            |

## Sprint 3 Status Summary

| Metric                  | Count |
| ----------------------- | ----- |
| Total cards             | 11    |
| In Done list            | 11    |
| Completion flag checked | **0** |

---

## Sprint 4 Overview

| Property         | Value                                                                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint goal**  | Final polishing and stress testing: stable, consistent behaviour rather than new features — presentation and report readiness, a public product face (landing page, rebrand), verifiable test coverage, and stress-test-driven lifecycle correctness. |
| **Sprint dates** | 30 September – 10 October 2026                                                                                                                                                                                                                        |
| **Scrum events** | Planning (Meeting 14, 1 October), stress-test review (Meeting 15, 8 October)                                                                                                                                                                          |
| **Tracking**     | **No Trello board was created for Sprint 4.** The work log below is reconstructed from the Git history and pull requests — the board evidence used for Sprints 1–3 does not exist for this sprint.                                                    |

## Sprint 4 Work Log

| Work stream                             | Work                                                                                                                                                                                                                                         | Owner           | Status   | Evidence                                                                                                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Landing page & PLANNAR rebrand          | Public landing page before sign-in (hero image, later typewriter hero video, About section, interactive feature cards, colour and brand iterations); rename to **PLANNAR**; sign-in restyled to match                                        | Nasiphi (Missy) | Done     | PRs [#397](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/397)–[#418](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/418) (6–9 Oct); rebrand = [#415](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/415) |
| Help Centre & bug reporting             | In-app Help Centre (search, guides, FAQ); dedicated `/report-bug` page with FormSubmit email delivery; SVG icons; base64 image fields as thumbnails                                                                                          | Nasiphi (Missy) | Done     | PRs [#386](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/386)–[#396](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/396) (5 Oct)                                                                                    |
| Creation-flow & mobile follow-through   | New Project modal on mobile; entry-field column names on mobile; full-screen Focus Mode with circular countdown; overdue-entry dropdown handling                                                                                             | Nasiphi (Missy) | Done     | PRs [#383](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/383)–[#384](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/384) (1 Oct); commits `469b91a`, `aab80fa`, `f85d248`, `02cb412`                                |
| Test coverage & CI                      | Frontend coverage to 87.5%; coverage table visible in Gitea Actions; testing inventory (93 files, ≈991 tests); coverage required in all CI workflows                                                                                         | Hlulani         | Done     | PRs [#410](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/410)–[#412](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/412) (7 Oct)                                                                                    |
| Stress test                             | 13-page functional and UX stress test analysing 27 screenshots; P1–P3 triage and QA scenario set adopted at Meeting 15                                                                                                                       | Team            | Done     | [Meeting 15](../Meetings/sprint-four-meetings.md) + report extracts                                                                                                                                                                        |
| P1 lifecycle fix — overdue consistency  | Overdue warnings shown consistently across views                                                                                                                                                                                             | Siphesihle      | Done     | PR [#419](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/419) (9 Oct)                                                                                                                                                           |
| P2 lifecycle fix — Due Soon eligibility | Due Soon eligibility unified across lifecycle states; archive state shared across all due-soon surfaces                                                                                                                                      | Siphesihle      | Done     | PR [#420](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/420) (9 Oct)                                                                                                                                                           |
| P1/P2 follow-up — archive & due time    | Archived entries excluded from active views; entry archive state independent of project archive/restore; due time shown alongside the due date everywhere; Total-Entries stats semantics locked by test; redundant Started At editor removed | Siphesihle      | Done     | PR [#421](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/421) (9–10 Oct)                                                                                                                                                        |
| Sprint 3 feedback publication           | 13-response survey documented with redacted screenshots                                                                                                                                                                                      | Team            | Done     | [Sprint 3 User Feedback](../Testing/user-feedback-sprint3.md)                                                                                                                                                                              |
| Timer reliability follow-up             | Abandoned-timer detection and notifications shipped in Sprint 3; **no verified full fix merged**                                                                                                                                             | —               | **Open** | Meetings 12–14; see retrospective below                                                                                                                                                                                                    |
| P3 UI polish                            | Table readability; clearer Checklist-vs-Board differentiation                                                                                                                                                                                | —               | **Open** | [Meeting 15](../Meetings/sprint-four-meetings.md)                                                                                                                                                                                          |

## Sprint 4 Retrospective

**What went well**

- The stress test turned vague cross-view-inconsistency complaints into a
  concrete P1→P2→P3 plan, and the fixes landed as small, individually
  reviewable PRs (#419–#421) within 48 hours of the review meeting.
- Test coverage became verifiable rather than aspirational: 87.5% frontend
  coverage with the table visible in CI, plus a full testing inventory.
- The product gained a public face — landing page, Help Centre, bug
  reporting, and the PLANNAR rebrand — directly aligned with the
  discoverability findings of the feedback rounds.

**What did not go well / carry-over**

- Sprint 4 had no Trello board, so task tracking lived only in Git; the work
  log above is a reconstruction from PRs (an intentional trade-off for a
  short final sprint, recorded here honestly).
- **Timer reliability was not fully resolved.** Detection and notification
  improvements shipped in Sprint 3, but no verified full fix was merged in
  Sprint 4 — the timer remains a known limitation and is **not** reported as
  fixed.
- The P3 polish items (Table readability, Checklist-vs-Board differentiation)
  were recommended by the stress test but not implemented before the sprint
  ended.
- The Gitea → GitHub mirror that feeds the Render deployments had documented
  delays, so deployment verification lagged behind merges
  ([Development Log](log.md)).

---

## How This Tracker Is Maintained

1. **Source of truth during Sprints 1–3:** private Trello boards (team access
   only).
2. **Sprint 4:** no Trello board — the Git history and pull requests on the
   Gitea remote are the source of truth, transcribed into the work log above.
3. **Public snapshot:** this file is updated at the end of each sprint, or
   whenever a major task changes status.
4. **Updates:** edit this file directly and commit it to `main`; the docs site
   will redeploy automatically.
5. **Status honesty:** _Done_ for Sprints 1–2 means the board's completion
   flag is checked; _Done (list)_ for Sprint 3 means list position only (flags
   unchecked); Sprint 4 status is derived from merged pull requests.

## Links

- [User Stories — Sprint 1](../User_Stories/sprint-one.md) ·
  [Sprint 2](../User_Stories/sprint-two.md) ·
  [Sprint 3](../User_Stories/sprint-three.md)
- [Meeting Notes — Sprint 1](../Meetings/sprint-one-meetings.md) ·
  [Sprint 2](../Meetings/sprint-two-meetings.md) ·
  [Sprint 3](../Meetings/sprint-three-meetings.md) ·
  [Sprint 4](../Meetings/sprint-four-meetings.md)
- [User Feedback — Sprint 2](../Testing/testing.md) ·
  [Sprint 3](../Testing/user-feedback-sprint3.md)
- [Development Log](log.md)
- [Roadmap](../roadmap.md)
- [Project Methodology](methodology.md)
