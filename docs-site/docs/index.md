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

| Role / Primary focus                             | Person                     |
| ------------------------------------------------ | -------------------------- |
| Documentation & project creation                 | Siphesihle                 |
| Frontend, UI/UX, fullstack & entry-side features | Hlulani-B (Hlulani Baloyi) |
| Login / auth structure                           | Nasiphi (Missy)            |
| Statistics & dashboard summaries                 | Sicelo                     |
| Activity logs                                    | Zamokuhle (Zamo)           |
| Archive functionality                            | Lupa                       |

## Quick links

- [Getting Started](getting-started.md) — set up the project locally
- [Features](features.md) — full feature documentation (35 sections)
- [Architecture Overview](architecture/overview.md) — how the system fits together
- [API Contracts](architecture/api-contracts.md) — endpoint documentation and OpenAPI spec
- [Database Schema](architecture/database.md) — how data is modeled
- [CI/CD & Deployment](architecture/cicd-deployment.md) — how code ships
- [Development Log](development/log.md) — issues we hit and how we solved them
- [Sprint 1 User Stories](development/user-stories.md) — what Sprint 1 covers
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
