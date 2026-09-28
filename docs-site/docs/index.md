# Digital Logbook

**COMS3011A Project 7 — University of the Witwatersrand**

## What is this?

Digital Logbook is a web application that replaces a physical project logbook.
A user creates **projects**, defines the **shape of an entry** for each project
themselves (which fields it has, and what type each field is), and then quickly
captures entries against that format over time. The system then gives them a
timeline of their work and simple statistics calculated from those entries.

The core design challenge — and the reason this isn't a simple CRUD app — is
that **the owner decides the shape of their own data**. Everything else
(entry capture, timeline, statistics, search) has to work generically against
whatever fields a project owner has defined, rather than against a fixed,
predetermined schema.

## Team

| Team member       | Main contribution areas                                                                                               | Representative work across Sprints 1–3                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Siphesihle Merile | Project workflows, dashboard, task/timer functionality, UI fixes, documentation                                       | Dashboard and project creation; unfinished-work tracking; due-date support; project creation UX fixes; granular timer controls; collaborative Sprint 3 UI refinement                 |
| Hlulani Baloyi    | Entry workflows, dynamic formats, entry views, offline support, frontend integration                                  | Entry-format builder; quick entry; project timeline; alternative entry views; offline syncing; dashboard auto-refresh; collaborative Sprint 3 UI refinement                          |
| Nasiphi Ntontela  | Authentication, task planning/views, data portability, database tooling, API documentation, timer/validation features | Authentication; calendar/Kanban/timeline functionality; import/export; backup and restore; schema migrations; API documentation; timer notifications; entry validation and migration |
| Sicelo Vanyelwa   | Statistics, custom-field analysis, search/grouping, comparison and visualization                                      | Project statistics; statistics on custom fields; advanced search/grouping/comparison; plotting statistical data over time; collaborative Sprint 3 UI refinement                      |
| Zamokuhle Maziya  | Activity tracking, entry-format evolution, data preservation and UI collaboration                                     | Activity log; changing formats without losing existing data; collaborative Sprint 3 UI refinement                                                                                    |
| Lupa Martins      | Archive workflows, richer fields, search/comparison and UI organization                                               | Archive functionality; dashboard/archive presentation; richer field support; advanced search/grouping/comparison; collaborative Sprint 3 UI refinement                               |

> Contribution summaries reflect work recorded in the [project work tracker](Project_Management/work-tracker.md) across Sprints 1–3 and are intended to represent the breadth of each member's involvement beyond their original primary focus.

## Quick links

- [Getting Started](getting-started.md) — set up the project locally
- [Features](features.md) — full feature documentation (35 sections)
- [Architecture Overview](Architecture/overview.md) — how the system fits together
- [API Contracts](Architecture/api-contracts.md) — endpoint documentation and OpenAPI spec
- [Database Schema](Architecture/database.md) — how data is modeled
- [CI/CD & Deployment](Architecture/cicd-deployment.md) — how code ships
- [Development Log](Project_Management/log.md) — issues we hit and how we solved them
- [Sprint 1 User Stories](User_Stories/sprint-one.md) — what Sprint 1 covers
- [Roadmap](roadmap.md) — Sprint 1 summary and Sprint 2 progress

## Tech stack

- **Frontend:** React (Vite), React Router, Supabase Auth
- **Backend:** Node.js / Express, split into services (auth, dashboard, project, profile)
- **Database:** PostgreSQL via Supabase (accessed only through our own API — never directly from the frontend)
- **Version control:** Gitea (`sdp.ms.wits.ac.za`) with a GitHub mirror for Render deployment
- **CI/CD:** Gitea Actions workflow definition; Render deploys from the mirrored GitHub repo
- **Hosting:** Render (frontend + all backend services); documentation built with MkDocs

!!! note "Course requirement"
Supabase is used only as a hosted Postgres database, accessed exclusively
through our own hand-written Express API. The frontend never queries
Supabase directly — this satisfies the brief's "hand-written API" requirement,
which explicitly disallows auto-generated backend endpoints (e.g. querying
Firestore or Supabase directly from the client).
