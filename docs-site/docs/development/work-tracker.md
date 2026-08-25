# Work Tracker

This page is the public, version-controlled equivalent of the team's private
Trello board. It records Sprint 1 tasks, ownership, status, and the evidence
that shows each task was completed.

For the Sprint 1 rubric, this file satisfies the **Work Tracker (5%)**
criterion. The private Trello board is still used for day-to-day task
assignment; this page is a snapshot exported from it at the end of Sprint 1.

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

| ID  | Task                                  | Owner           | Status | User Story                                            | Evidence                                                   |
| --- | ------------------------------------- | --------------- | ------ | ----------------------------------------------------- | ---------------------------------------------------------- |
| T1  | Email/password sign-in and sign-up    | Nasiphi (Missy) | Done   | [US1](user-stories.md#us1-sign-in-to-the-system)      | `SignIn.tsx`, `AuthContext.tsx`, Supabase Auth integration |
| T2  | Google / GitHub OAuth sign-in         | Nasiphi (Missy) | Done   | [US1](user-stories.md#us1-sign-in-to-the-system)      | OAuth icon buttons in `SignIn.tsx`, `AuthCallback.tsx`     |
| T3  | Password reset flow                   | Nasiphi (Missy) | Done   | [US1](user-stories.md#us1-sign-in-to-the-system)      | `ResetPassword.tsx`, `UpdatePassword.tsx`                  |
| T4  | Create profile page                   | Hlulani         | Done   | [US2](user-stories.md#us2-view-dashboard-after-login) | `CreateProfile.tsx`, profile-service `profile.js`          |
| T5  | Avatar selection page                 | Hlulani         | Done   | Onboarding                                            | `Avatar.tsx`, `AvatarPicker.tsx`                           |
| T6  | Tone, theme, and frequency onboarding | Hlulani         | Done   | Onboarding                                            | `ToneSetup.tsx`, `ThemeSetup.tsx`, `FrequencySetup.tsx`    |
| T7  | Protected routes and session handling | Hlulani         | Done   | [US1](user-stories.md#us1-sign-in-to-the-system)      | `ProtectedRoute.tsx`, `AuthContext.tsx`                    |

### Dashboard & Navigation

| ID  | Task                                               | Owner   | Status | User Story                                            | Evidence                                               |
| --- | -------------------------------------------------- | ------- | ------ | ----------------------------------------------------- | ------------------------------------------------------ |
| T8  | Dashboard layout and project list                  | Hlulani | Done   | [US2](user-stories.md#us2-view-dashboard-after-login) | `Dashboard.tsx`, `dashboard.js`                        |
| T9  | App drawer / navigation menu                       | Hlulani | Done   | [US2](user-stories.md#us2-view-dashboard-after-login) | Drawer component in `Dashboard.tsx`                    |
| T10 | Settings panel (profile, preferences, danger zone) | Hlulani | Done   | [US8](user-stories.md#us8-log-out-securely)           | `SettingsPanel.tsx`                                    |
| T11 | Search across projects and entries                 | Hlulani | Done   | [US2](user-stories.md#us2-view-dashboard-after-login) | `dashboard-service/src/functions/search.js`, search UI |
| T12 | Sign-out functionality                             | Hlulani | Done   | [US8](user-stories.md#us8-log-out-securely)           | `AuthContext.tsx` sign-out, settings menu              |

### Projects & Entries

| ID  | Task                                           | Owner      | Status | User Story                                                    | Evidence                                                             |
| --- | ---------------------------------------------- | ---------- | ------ | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| T13 | Create project form and API                    | Siphesihle | Done   | [US3](user-stories.md#us3-create-a-project)                   | `NewProject.tsx`, `project-service/src/functions/project.js`         |
| T14 | Define custom entry format (fields/types)      | Siphesihle | Done   | [US4](user-stories.md#us4-define-the-project-entry-format)    | `ProjectSettingsPanel.tsx`, `field.js`                               |
| T15 | Quick-entry form for capturing logbook entries | Hlulani    | Done   | [US5](user-stories.md#us5-capture-a-logbook-entry-quickly)    | `AddEntry.tsx`, `NewEntry.tsx`, `entries.js`                         |
| T16 | Project timeline / entries view                | Hlulani    | Done   | [US6](user-stories.md#us6-view-project-entries-in-a-timeline) | `Project.tsx`, entry card components                                 |
| T17 | Basic project statistics                       | Sicelo     | Done   | [US7](user-stories.md#us7-view-basic-project-statistics)      | Stats view in `Project.tsx` / dashboard                              |
| T18 | Archive support (backend + partial frontend)   | Lupa       | Done*  | [US6](user-stories.md#us6-view-project-entries-in-a-timeline) | `archives.js`, archive route and tests; frontend placeholder remains |

> *Archive backend is complete and tested; frontend archive UI was removed and
> left as a placeholder per [Roadmap](../roadmap.md) technical debt.

### Backend Services & Infrastructure

| ID  | Task                                                             | Owner                | Status | User Story | Evidence                                                              |
| --- | ---------------------------------------------------------------- | -------------------- | ------ | ---------- | --------------------------------------------------------------------- |
| T19 | Set up Express microservices (auth, project, dashboard, profile) | Siphesihle / Hlulani | Done   | N/A        | `services/*`, health routes, `render.yaml`                            |
| T20 | Database schema and migrations                                   | Team                 | Done   | N/A        | Supabase migrations, `database.md`                                    |
| T21 | CORS configuration and error handling                            | Hlulani              | Done   | N/A        | CORS middleware in all services, global error handlers                |
| T22 | CI/CD pipeline (Gitea Actions + Render)                          | Hlulani / Nasiphi    | Done   | N/A        | `.gitea/workflows/ci.yml`, `.gitea/workflows/test.yml`, `render.yaml` |
| T23 | Test coverage and badges                                         | Hlulani              | Done   | N/A        | Jest tests in 3 services, `badges/` directory                         |
| T24 | Documentation site (MkDocs)                                      | Team                 | Done   | N/A        | `docs-site/`, deployed docs                                           |

### Additional Features & Polish

| ID  | Task                                           | Owner             | Status | User Story                                                 | Evidence                                                   |
| --- | ---------------------------------------------- | ----------------- | ------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| T25 | Activity log backend                           | Zamo              | Done   | N/A                                                        | `project-service/src/functions/activityLog.js`, tests      |
| T26 | Natural language entry parsing with AI         | Hlulani           | Done   | [US5](user-stories.md#us5-capture-a-logbook-entry-quickly) | `ai.js`, multi-provider chain                              |
| T27 | Theming system (fonts, colours, corner styles) | Hlulani           | Done   | N/A                                                        | Theme context, `ThemeSetup.tsx`, CSS variables             |
| T28 | Soft-delete / account recovery                 | Nasiphi / Hlulani | Done   | N/A                                                        | `delete_user()` / `restore_user()` RPCs, `AuthRestore.tsx` |

---

## Sprint 1 Status Summary

| Metric      | Count |
| ----------- | ----- |
| Total tasks | 28    |
| Done        | 28    |
| In Progress | 0     |
| Pending     | 0     |

---

## How This Tracker Is Maintained

1. **Source of truth during the sprint:** private Trello board (team access only).
2. **Public snapshot:** this file is updated at the end of each sprint, or whenever a major task changes status.
3. **Updates:** edit this file directly and commit it to `main`; the docs site will redeploy automatically.

## Links

- [User Stories](user-stories.md)
- [Meeting Notes](meetings.md)
- [Development Log](log.md)
- [Roadmap](../roadmap.md)
- [Project Methodology](methodology.md)
