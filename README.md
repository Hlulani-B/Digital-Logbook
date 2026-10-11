## Link to the Documentation site

https://digital-logbook-documentation-site.onrender.com

## AI Usage

This project uses AI-assisted development for the frontend authentication module. See [`AI_USAGE.md`](AI_USAGE.md) for a summary and [`frontend/AI_DECLARATION.md`](frontend/AI_DECLARATION.md) for the full declaration.

## Deployed Live Services

The backend microservices are deployed on Render:

| Service               | Environment / Type | Live URL                                                                                   |
| :-------------------- | :----------------- | :----------------------------------------------------------------------------------------- |
| **Auth Service**      | Backend API        | [https://auth-service-ml5n.onrender.com](https://auth-service-ml5n.onrender.com)           |
| **Dashboard Service** | Backend API        | [https://dashboard-service-r32v.onrender.com](https://dashboard-service-r32v.onrender.com) |
| **Project Service**   | Backend API        | [https://project-service-e41q.onrender.com](https://project-service-e41q.onrender.com)     |
| **Profile Service**   | Backend API        | [https://profile-service-489p.onrender.com](https://profile-service-489p.onrender.com)     |
| **API Gateway**       | Backend API        | [https://api-gateway-xeim.onrender.com](https://api-gateway-xeim.onrender.com)             |

**Test application:** [https://digital-logbook-dhtq.onrender.com](https://digital-logbook-dhtq.onrender.com)

# Codacaine - Planner

A microservices-based digital planning app built with React (frontend) and Node.js/Express (backend services), using Supabase for auth and database.

## Architecture

This is a monorepo containing independent backend services and a React frontend. Each service runs as its own process on its own port.

```text
codacaine/
├── frontend/                     # React app (Vite)
│   └── src/
├── api-gateway/                  # API routing (port 4000)
│   ├── src/
│   │   └── index.js
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   └── .env
├── services/
│   ├── auth-service/             # Authentication (port 5001)
│   │   ├── src/
│   │   │   └── index.js
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── .env
│   ├── dashboard-service/        # Cross-project summaries and search (port 5002)
│   │   ├── src/
│   │   │   └── index.js
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── .env
│   ├── project-service/          # Entries, timeline, search, stats, AI (port 5003)
│   │   ├── src/
│   │   │   └── index.js
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── .env
│   └── profile-service/          # User profiles and preferences (port 5004)
│       ├── src/
│       │   └── index.js
│       ├── Dockerfile
│       ├── package.json
│       └── .env
├── scripts/                      # Database backup, restore and migration tools
├── supabase/
│   ├── setup.sql                 # Initial Supabase setup
│   └── migrations/               # Versioned SQL migrations (000–007+)
├── docs/                         # Project documentation and user stories
├── docs-site/                    # MkDocs documentation source
├── badges/                       # Generated coverage badges
├── render.yaml                   # Render deployment configuration
├── package.json                  # Root monorepo scripts
├── .gitignore
└── README.md
```

## Authentication & Security

The frontend uses Supabase Auth for identity management and supports multiple sign-in methods:

- **OAuth:** Google and GitHub one-click sign-in

- **Email/password:** Sign-up with email confirmation and password reset

- **Email validation:** Malformed addresses, disposable domains, and common typos are rejected before submission

- **Session management:** Users remain signed in until they manually sign out

- **Account deletion:** Soft-deleted accounts enter a 30-day grace period with email-link restoration

## Features

- **Calendar view:** Month and week calendars place entries on their due dates, with overdue entries highlighted and completed entries shown in green. Entries can be dragged to another day to reschedule them, and days with many tasks collapse gracefully into a "+N more" indicator.

- **Kanban board:** Three status columns (Up Next, In Motion, Done & Dusted) show entries as cards that can be dragged between columns to change status. The board supports project and search filters, and a failed save reverts the card to its original column.

- **Timeline:** Horizontal time view with bars spanning start to due date, dependency arrows between linked tasks, zoom/scroll controls, and an empty state when no dated tasks exist.

- **Import & Export:** Export all projects and entries (including archived) to JSON, CSV, Markdown, or iCalendar (.ics), and import them back in. Round-trip safe with malformed-row reporting. iCalendar export opens in Google Calendar, Outlook, and Apple Calendar.

- **Backup, Restore & Migrations:** One-command `pg_dump`/`pg_restore` backup and restore, plus versioned schema migrations that upgrade an existing database without dropping and recreating it.

- **OpenAPI 3 & Swagger UI:** Full REST API documented with an OpenAPI 3.0 specification covering all four microservices. Browsable interactive docs page at `/api-docs` on the project service with "Try it out" support.

- **Mobile responsive:** Calendar auto-switches to week-strip layout on phones (≤480px). Kanban and Timeline views have dedicated phone breakpoints with reduced padding and touch-friendly sizing.

- **Guided tour with voice narration:** First-time users are offered an interactive walkthrough that really navigates the app — it opens the drawer, visits every view, and spotlights the notification bell, profile menu, and quick-entry bar. A friendly voice narrates each stop via the browser's speech synthesis with hands-free auto-advance paced to the narration finishing, plus a persisted mute toggle. Replayable from the dashboard or navbar.

- **Public landing page:** A standalone marketing page at `/` with a split hero (typing demo + AI-generated dashboard illustration), interactive About and Feature cards with mouse-following spotlight and 3D tilt effects, animated stats counters, a "What's New" ticker, team section, and CTA. Warm beige/brown palette matches the sign-in form. The sign-in page (`/signin`) is a clean split-screen auth form with no duplicated marketing content.

- **Enhanced notifications:** Snooze (1h / 4h / tomorrow) or dismiss individual notifications without completing the entry. Filter the history page by unread, due-soon, or overdue. Configure how far in advance to receive due-soon alerts (1 hour to 1 week). Rich HTML emails with entry cards and deep-link buttons. Browser toast notifications when new alerts arrive during an active session. Timer abandonment alerts notify users when a session timer runs >2 hours or pauses >30 minutes.

- **Help Centre:** Searchable knowledge base at `/help` with 9 categories and 25 articles covering Getting Started, How-To Guides, Troubleshooting, FAQ, and more. Accessible from the drawer navigation on every page. Features client-side search, keyboard shortcuts, theme-aware styling, and mobile-responsive layout.

- **In-app bug report form:** Modal form in the Help Centre that sends bug reports via email to the team. Captures title, description, steps to reproduce, and auto-attaches browser info. Uses FormSubmit.co for email delivery with no backend changes required.

- **Project pagination & multi-select:** When there are more than 5 projects on the home page, only the first 3 are shown with a "View N more projects" button. A multi-select mode allows batch archive and delete operations across multiple projects at once.

- **Automatic email delivery:** An in-process `node-cron` scheduler sends pending notification emails every 15 minutes while the project-service is running, replacing the broken `pg_net` poke and eliminating the need for manual PowerShell invocation.

- **Field display rendering fixes:** Type-safe guards prevent crashes on undefined attachment/link values, file fields now render base64 strings stored during creation, tags and entity-links display as styled pill-shaped chips, and long markdown fields truncate with a "Read more" button.

- **Responsive design:** The UI adapts across desktop, tablet, and phone screens using CSS media queries at 8 breakpoints (1200px–380px). A `useIsMobile()` hook switches the Calendar to a week-strip layout on phones (≤480px). Grid layouts collapse from multi-column to single-column, navigation drawers replace inline menus, and touch targets meet the 44px minimum.

- **Accessibility:** ARIA labels on interactive controls and charts. Keyboard navigation: Escape closes every modal/drawer/dropdown; `/` focuses Help Centre search; Space/P control the timer. Semantic roles (`img`, `region`, `alert`, `status`) for screen readers. Voice-narrated guided tour via Web Speech API. Focus management on dropdowns and modals.

- **CI/CD pipeline:** 7 Gitea Actions workflows (main CI, backend unit tests, backend integration tests, frontend unit tests, frontend integration tests, keep-alive, branch sync) plus GitHub Actions mirror. Every push and PR triggers format checks, linting, unit tests, integration tests, and a production build. Render auto-deploys from main via `render.yaml` infrastructure-as-code (6 services). Docs deploy to GitHub Pages on merge.

- **Non-monolithic architecture:** One React frontend + four independent Express microservices (auth, dashboard, project, profile), each running as its own process on its own port with its own `package.json` and Render deployment. No shared code between services; HTTP-only communication via `fetch()` through `frontend/src/lib/api.ts`.

- **Hand-written API:** 11+ manually coded route files across 4 services with RPC-style POST dispatch (`{ function, values }` body). Supabase provides auth and database only — the frontend never calls Supabase's auto-generated `/rest/v1/` for data. All data endpoints are hand-implemented Express handlers using `node-postgres` (`pg`). OpenAPI 3 spec is documentation, not code generation.

- **External API integration:** Integrates with 6 external API providers — Brevo (transactional email), OpenRouter + Gemini + Cerebras + Groq + HuggingFace (5 AI LLM providers), FormSubmit.co (bug report email), and Supabase (auth + database). All API keys managed via environment variables.

- **Documentation website:** Publicly available at [https://digital-logbook-documentation-site.onrender.com](https://digital-logbook-documentation-site.onrender.com). Built with MkDocs (markdown-based docs tool), deployed via static hosting on Render and GitHub Pages. No account required to access.

See the full documentation at [https://digital-logbook-documentation-site.onrender.com/features/](https://digital-logbook-documentation-site.onrender.com/features/).

## Prerequisites

- Node.js (LTS) and npm

- A Supabase project (URL + anon key + JWKS URL)

- A PostgreSQL database (or Supabase's built-in Postgres)

- Git

- (Optional) AI provider API keys for natural-language features

## Getting Started

### 1. Clone the repo

```powershell
git clone https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook.git
cd Digital-Logbook
```

### 2. Install dependencies for each service

```powershell
cd services\auth-service
npm install
cd ..\dashboard-service
npm install
cd ..\project-service
npm install
cd ..\profile-service
npm install
cd ..\..

# API gateway is at the repository root
cd api-gateway
npm install
cd ..
```

### 3. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

### 4. Configure environment variables

Create a `.env` file in each service folder, in `api-gateway/` (using `api-gateway/.env.example` as a guide), and in `frontend/` (see [Environment Variables](#environment-variables) below).

### 5. Set up the database

#### Option A: Automated (recommended)

Install the migration tools and run the baseline migration:

```powershell
cd scripts
npm install
npm run db:migrate
```

This creates all tables, indexes, functions, triggers, and cron jobs idempotently. For an existing database where migrations were applied manually, use `npm run db:bootstrap` instead to mark them as already applied.

#### Option B: Manual

Run the SQL files in `supabase/migrations/` in order (000–007) in the Supabase SQL Editor:

[https://supabase.com/dashboard/project/\_/sql](https://supabase.com/dashboard/project/_/sql)

#### Backup and restore

```powershell
cd scripts
npm run db:backup       # backup to scripts/backups/
npm run db:restore      # restore from latest backup
npm run db:status       # show applied/pending migrations
```

### 6. Run the project

Run each service in its own terminal:

```powershell
cd services\auth-service
npm start
```

```powershell
cd services\dashboard-service
npm start
```

```powershell
cd services\project-service
npm start
```

```powershell
cd services\profile-service
npm start
```

Run the API gateway in its own terminal from the repository root:

```powershell
cd api-gateway
npm start
```

The gateway listens on `http://localhost:4000` and routes frontend requests to the appropriate backend service. Start it alongside the four services.

Run the frontend:

```powershell
cd frontend
npm run dev
```

The frontend runs on `http://localhost:3000` by default.

## Environment Variables

Each service, the API gateway, and the frontend need their own `.env` file. These are listed in `.gitignore` because they contain secrets — every developer must create their own locally.

### Frontend (`frontend/.env`)

```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_ANON_JWT=your_supabase_anon_jwt
VITE_API_GATEWAY_URL=http://localhost:4000
```

| Variable                 | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL (used by the frontend Supabase client)     |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (used for auth operations)               |
| `VITE_SUPABASE_ANON_JWT` | Supabase anon JWT (used for direct REST calls)                  |
| `VITE_API_GATEWAY_URL`   | API gateway URL; the frontend sends backend requests through it |
| `VITE_DEV_BYPASS`        | (Optional) Set to `"true"` in dev to bypass auth for testing    |

### API Gateway (`api-gateway/.env`)

The gateway lives at the repository root and is the single entry point for frontend backend requests. Use `api-gateway/.env.example` as the reference for the actual configuration. For local development:

```dotenv
PORT=4000
AUTH_SERVICE_URL=http://localhost:5001
DASHBOARD_SERVICE_URL=http://localhost:5002
PROJECT_SERVICE_URL=http://localhost:5003
PROFILE_SERVICE_URL=http://localhost:5004
```

| Variable                | Default             | Purpose                  |
| ----------------------- | ------------------- | ------------------------ |
| `PORT`                  | `4000`              | Gateway HTTP port        |
| `AUTH_SERVICE_URL`      | Set for environment | Auth service origin      |
| `DASHBOARD_SERVICE_URL` | Set for environment | Dashboard service origin |
| `PROJECT_SERVICE_URL`   | Set for environment | Project service origin   |
| `PROFILE_SERVICE_URL`   | Set for environment | Profile service origin   |

For Render, set `VITE_API_GATEWAY_URL=https://api-gateway-xeim.onrender.com` on the frontend and configure the gateway's four service URLs with the corresponding deployed backend origins listed above.

### Backend services — all services (`services/*/.env`)

Every backend service shares the same database connection:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

| Variable       | Used by      | Purpose                                                          |
| -------------- | ------------ | ---------------------------------------------------------------- |
| `DATABASE_URL` | All services | PostgreSQL connection string (Supabase Postgres or any Postgres) |
| `PORT`         | All services | Port the service listens on (defaults: 5001–5004)                |

### Auth Service (`services/auth-service/.env`)

```
PORT=5001
DATABASE_URL=postgresql://user:password@host:5432/dbname
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=your_supabase_key
```

### Dashboard Service (`services/dashboard-service/.env`)

```
PORT=5002
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### Project Service (`services/project-service/.env`)

```
PORT=5003
DATABASE_URL=postgresql://user:password@host:5432/dbname
SUPABASE_JWKS_URL=https://yourproject.supabase.co/auth/v1/.well-known/jwks.json
# AI provider keys (at least one required for natural-language features)
OPENROUTER_API_KEY=
HF_API_KEY=
GEMINI_API_KEY=
CEREBRAS_API_KEY=
GROQ_API_KEY=
```

| Variable             | Purpose                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `SUPABASE_JWKS_URL`  | (Optional) Supabase JWKS endpoint for JWT verification. Auto-fetched if not set. |
| `OPENROUTER_API_KEY` | OpenRouter API key — primary AI provider for natural-language parsing            |
| `HF_API_KEY`         | HuggingFace inference API key (fallback AI provider)                             |
| `GEMINI_API_KEY`     | Google Gemini API key (fallback AI provider)                                     |
| `CEREBRAS_API_KEY`   | Cerebras API key (fallback AI provider)                                          |
| `GROQ_API_KEY`       | Groq API key (fallback AI provider)                                              |

### Profile Service (`services/profile-service/.env`)

```
PORT=5004
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### Port Summary

| Service                    | Default Port |
| -------------------------- | ------------ |
| api-gateway                | 4000         |
| auth-service               | 5001         |
| dashboard-service          | 5002         |
| project-service            | 5003         |
| profile-service            | 5004         |
| frontend (Vite dev server) | 3000         |

Get the Supabase URL, keys, and database connection string from the team lead or Supabase project settings — **do not commit these values to the repo**.

## API Gateway Routing

The API gateway runs at `http://localhost:4000` and forwards frontend requests to the corresponding backend services:

| Frontend route   | Destination       |
| ---------------- | ----------------- |
| `/api/auth`      | Auth service      |
| `/api/dashboard` | Dashboard service |
| `/api/project`   | Project service   |
| `/api/profile`   | Profile service   |

Run its tests from the repository root with `cd api-gateway` followed by `npm test`.

## Running Tests

Each service and the frontend have their own test suites.

### Frontend

```bash
cd frontend
npm test              # run Vitest once
npm run test:watch    # run Vitest in watch mode
npm run test:coverage # run with coverage report
```

### Backend services

```bash
cd services/auth-service      && npm test
cd services/dashboard-service && npm test
cd services/profile-service   && npm test
cd services/project-service   && npm test
```

### CI

The [`.gitea/workflows/ci.yml`](.gitea/workflows/ci.yml) pipeline runs lint, build, and tests for the frontend and all four services on every push and pull request. Separate workflows run dedicated [backend unit tests](.gitea/workflows/backend-unit-tests.yml), [backend integration tests](.gitea/workflows/backend-integration-tests.yml), [frontend unit tests](.gitea/workflows/frontend-unit-tests.yml), and [frontend integration tests](.gitea/workflows/frontend-integration-tests.yml). All workflows run with code coverage and print a coverage table in the job step logs.

---

## Branching Rules

- `main` and `services` branches are protected — no direct pushes, changes must go through a pull request with required approvals.

- Create a feature branch for your work:

```powershell
git checkout -b feature/your-feature-name
git add .
git commit -m "describe your change"
git push -u origin feature/your-feature-name
```

Then open a pull request on Gitea into `main` (or `services` for backend-only work).

## Architecture Rules

- Project entries and their statistics stay scoped to that project (`project-service`).

- The dashboard (`dashboard-service`) only shows cross-project summaries — it does not read individual entry tables directly.
