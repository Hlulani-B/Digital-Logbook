# Roadmap

This page tracks the **Digital Logbook** — rebranded **PLANNAR** during
Sprint 4 — across the four development sprints of the course project, from the
first vertical slice in August 2026 to the final polishing and stress-testing
sprint in October 2026. Each sprint section records the sprint objective,
planned scope, key activities, verified achievements, problems and challenges,
stakeholder feedback and resulting changes, the sprint outcome, and links to
the supporting evidence.

| Sprint | Theme                            | Dates                                 | Outcome                                                                                              |
| ------ | -------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1      | Foundation                       | 4–24 August 2026                      | Completed — working vertical slice from sign-in to timeline and basic statistics                     |
| 2      | Expansion                        | 2–19 September 2026 (end approximate) | Completed — major feature expansion; sprint review marred by a broken testing pipeline               |
| 3      | Refinement                       | 21–29 September 2026                  | Completed — client-driven refinement, pipeline recovery, UI reorganization                           |
| 4      | Final Polishing & Stress Testing | 30 September – 10 October 2026        | Completed — PLANNAR rebrand, coverage push, stress-test-driven lifecycle fixes; presentation pending |

!!! note "Naming"
The application was developed as the **Digital Logbook** and rebranded to
**PLANNAR** during Sprint 4 (PR
[#415](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/415)).
Earlier sprints and their evidence refer to it by its original name.

## Sprint 1 — Foundation (4–24 August 2026)

**Sprint objective.** Deliver a working vertical slice of the application:
sign in, create a project, define a custom entry format, capture logbook
entries quickly, view them on a timeline, and see basic statistics.

**Planned scope.** The full-stack foundation — a monorepo with four Express
microservices (auth, project, dashboard, profile) around a Supabase
(PostgreSQL) database, a React + TypeScript + Vite frontend, CI/CD on Gitea
Actions with Render deployment, and the MkDocs documentation site. 28 tasks
(T1–T28) were tracked on the Sprint 1 board.

**Key activities.** Authentication with email/password plus Google and GitHub
OAuth; profile, avatar and preference onboarding; the dashboard with drawer
navigation and search; projects with custom fields and quick entry;
natural-language entry parsing through a multi-provider AI chain; activity
logging; the theming system; responsive and mobile work; and the archive
backend.

**Verified achievements.** All 28 tracked tasks were completed with their
board flags checked — see the [Work Tracker](Project_Management/work-tracker.md)
and the Sprint 1 summary below for the consolidated list.

**Problems and challenges.** Express 5 broke the standard CORS middleware
pattern and required several rounds of fixes (visible in the commit record
below); a `public.users` foreign-key issue surfaced with Google OAuth users;
Render builds failed on TypeScript errors; services clashed over ports until
explicit per-service `PORT` configuration was introduced; and the frontend
archive UI was removed and left as a placeholder after integration problems —
the backend and its tests remained in place (T18 in the
[Work Tracker](Project_Management/work-tracker.md)).

**Stakeholder feedback and resulting changes.** The Sprint 1 client review
asked for a more prominent entry button, smaller entry cards (the card was
"taking up half the screen"), and a toggleable dashboard view. Those items
were pulled into Sprint 2 as quick wins and verified in the 10 September
client demonstration
([Sprint 2 meetings](Meetings/sprint-two-meetings.md)).

**Sprint outcome.** Completed. The application ran end-to-end on Render with
CI/CD green and the documentation site live. Remaining technical debt — the
archive frontend placeholder, frontend test coverage, rate limiting — was
logged for later sprints (see [Known Outstanding
Limitations](#known-outstanding-limitations) and the detailed record below).

**Evidence.** [Work Tracker (T1–T28)](Project_Management/work-tracker.md) ·
[Sprint 1 user stories (US1–US10)](User_Stories/sprint-one.md) ·
[Sprint 1 meetings (Meetings 1–8)](Meetings/sprint-one-meetings.md) ·
[Development Log](Project_Management/log.md) · commit record below

### Detailed Commit Record

#### Infrastructure & Deployment

- `088cf84` - initial backend services setup
- `cb1aab7` - add README with setup instructions and project structure
- `0dfb300` - Initial setup
- `c96f863` - fix: flatten frontend folder
- `200169d` - Project setup
- `da642ed` - Move files to root
- `c7177e0` - Configure GitHub Pages deployment setup
- `4859dbf` - Organize frontend into frontend/ folder
- `d61d050` - Organize backend into project-service/ folder
- `a5ea2ce` - add README with setup instructions and project structure
- `6c2b30b` - Update README.md
- `26d650a` - Updated it in order to use gitea pages
- `9ff0b20` - To set up Gitea pages
- `6a270dd` - Merge services branch contents into project-service directory
- `d4a6d18` - fix: update Vite base path to root for Render deployment
- `d1745bc` - Update README.md
- `7c64764` - ci: add Gitea Actions workflow for frontend and microservices
- `2eaf2ea` - ci: add Render Blueprint configuration
- `7f8b0c8` - fix: update render.yaml services to free tier plan
- `d9a6706` - fix: specify rootDir for each microservice in render.yaml
- `5e1a0da` - refactor: rename project-service parent folder to services
- `bc49152` - docs: add deployed microservice live URLs to README
- `0f2167f` - docs: add deployed microservice live URLs to README
- `34d66ea` - ci(render): configure microservices deployment and environment variables in render.yaml
- `d9623c4` - docs: add MkDocs documentation site
- `91d2661` - chore: remove Zone.Identifier files

#### Backend Services Setup

- `e3965e5` - feat(services): add Express server setup and health routes to index.js
- `8c61030` - fix: add start script to microservice package.json files
- `fdd93e1` - feat(services): add Express server setup and health routes to index.js
- `4547e81` - fix: add start script to microservice package.json files
- `16ac687` - feat(services): add Express server setup and health routes to index.js
- `c5fb7f7` - fix: add start script to microservice package.json files
- `c4fafc4` - fix: update package.json entry point path to src/index.js
- `1086530` - fix: update package.json entry point path to src/index.js
- `330dc37` - fix: update package.json entry point path to src/index.js
- `15a00e7` - style: polish sign-in page UI

#### Database Schema

- `fccffab` - added users and projects table
- `61f7b20` - Added fields and entries table
- `44c4d8b` - Added due date column on entries table
- `1751599` - docs: update schema users.email as PK, projects.user_id → user_email FK
- `191ac36` - schema: add priority enum to entries; sync docs with users/projects PK-to-email migration
- `5e44bf8` - feat: add users table SQL and update delete_user RPC to clean profile data
- `352a5b1` - Fix delete_user RPC: cascade delete entries, fields, projects before user deletion

#### Authentication System

- `ba20871` - feat: Digital Logbook frontend with auth, dashboard, settings and CAPTCHA
- `b9d5671` - feat: add reset password access from sign-in page and settings panel
- `130e5c5` - docs: add frontend README and AI declaration document
- `a689a8d` - feat: add email-password sign-in/sign-up to support password reset flow; update docs
- `1f3ec96` - fix: pass Turnstile captcha token to Supabase auth calls
- `3a7f2bf` - fix: use refs for Turnstile token to avoid state timing issues on auth submit
- `ce1ad53` - style: convert Google/GitHub sign-in buttons to round icon buttons
- `ed8349b` - Merge Authentication branch into main
- `ff4f7bf` - fix: remove duplicate App.jsx and main.jsx leftover from merge
- `7a61190` - fix: remove duplicate vite.config.js so @ alias resolves correctly
- `d6194c1` - style: move OAuth buttons below email-password form on sign-in page
- `c129c1a` - Add meeting notes for 13 August 2026
- `4c4b0b9` - config: allow JS/JSX files alongside TS in tsconfig
- `7d3dc58` - Added architectural rules
- `28a8679` - Update frontend/.oxlintrc.json
- `cfc0a9a` - Added more rules
- `f1e3d4e` - fix: load dotenv before imports, connect project/entry/priority/field routes, add SUPABASE_KEY fallback

#### CORS & Security

- `1d2eec4` - fix: explicit CORS config on all 4 backend services (origin, methods, allowedHeaders + OPTIONS preflight)
- `cb181c3` - fix: remove app.options('*', cors()) — Express 5 path-to-regexp doesn't support bare wildcard
- `5074223` - fix: replace cors() package with manual CORS middleware for Express 5 compatibility
- `44df03d` - fix: remove unused cors imports from all services
- `9f8aa39` - fix: use cors() package with specific origin and credentials for all services
- `1ac877e` - fix: on checkUser error, default to dashboard instead of create-profile
- `a118b05` - fix: dynamic CORS origin checking + global error handler with CORS headers on all services
- `7ef7f31` - fix: add Express 5 safe preflight wildcard handler using regex /(._)/ instead of '_'
- `9279eb3` - fix: add robust error handling to all route handlers across all services (try/catch, safe instantiation, parameter validation, JSON error responses)
- `ab3fe21` - fix: remove throw in supabase.js that crashed services on startup - use null client + warnings instead

#### Profile Service

- `8f7f457` - feat: complete profile-service with routes, tests, and frontend functions
- `600e8d1` - feat: integrate profile service into settings, add AvatarPicker, fix SignIn useEffect
- `d576704` - fix: convert CreateProfile to tsx, fix Avatar page, add routing for /create-profile and /avatar
- `f20bcc1` - feat: add pink, blue, purple, green themes alongside light and dark
- `5035356` - feat: add getProjectsByEmail function across full stack (service, route, frontend)
- `529b642` - fix: remove unused variables in SettingsPanel (displayName, setProfile, theme)
- `fd2de57` - fix: split Theme type import for verbatimModuleSyntax compatibility
- `ee62693` - feat: modern UI redesign - Plus Jakarta Sans font, book icon logo, polished styling
- `16a596f` - feat: replace emoji avatars with React Icons (Feather icons) in AvatarPicker
- `812688a` - fix: correct navigation flow - checkUser response, remove PublicRoute race, fix AuthCallback routing
- `b931ecd` - fix: replace SVG favicon with notebook.jpeg
- `87d29a0` - fix: replace SVG logo with notebook.jpeg in SignIn
- `7107a54` - fix: fit SignIn within 100vh - reduce padding, margins, logo size, spacing
- `a3c8134` - fix: remove purple gradient border from auth logo
- `e4088d7` - fix: replace SVG icon with notebook.jpeg on all auth pages (CreateProfile, ResetPassword, UpdatePassword, Avatar)
- `2e5cec0` - fix: CreateProfile now inserts user row before updating name/username

#### UI/UX - Themes & Styling

- `ed654de` - feat: add video background to SignIn + font picker in Settings (Playfair, Lora, Crimson Text, EB Garamond)
- `6edb5e6` - feat: split-screen SignIn layout — video left panel, form right panel
- `6795305` - feat: add brown vintage theme + corner style picker (rounded/soft/sharp)
- `f19bdd9` - feat: make Lora the default font across the entire app
- `9e6abd9` - fix: ensure font applies to all elements including form controls on every page
- `6714248` - feat: replace all themes with softer pastel-vintage palettes (ivory, blush, powder blue, pale lilac, sage mist, soft tan)
- `4a42659` - feat: pair all themes with dark vintage button tones (espresso, navy ink, deep plum, forest, terracotta, walnut)
- `c7e5c95` - fix: restore auth-container/auth-card/auth-logo CSS for onboarding pages (CreateProfile, Avatar, ResetPassword, UpdatePassword, AuthCallback)
- `3735299` - fix: dark theme to pure black/white/grey, auto-create profile if missing
- `4eb2c50` - debug: show getProfile response in settings panel
- `9b3356a` - chore: remove test file, update import paths
- `a4c25b7` - fix: checkUser failure now navigates to create-profile instead of dashboard
- `4790842` - refactor: dashboard with entries feed, drawer, search, FAB
- `82667a8` - fix: dark theme buttons use black text on light backgrounds for visibility
- `c9e24c9` - update: Avatar page changes
- `1ad3cc9` - fix: theme persists from localStorage - settings panel reads current theme from useTheme hook instead of hardcoded 'light' default
- `3132024` - style: apply vintage notebook aesthetic to dashboard
- `35bd98b` - style: warm earth-tone palette for sign-in right panel to match nature LHS
- `95f76ee` - fix: ensure post-sign-in redirect always navigates away from /signin
- `f1b4533` - style: revert right panel to classic dark theme
- `da342d0` - fix: add null checks to profile functions + fix CreateProfile error handling to match backend response format
- `c7bc54e` - docs: update README with auth methods, email flow, AI usage, and troubles encountered
- `09956d0` - docs: add external services setup guide (Google Cloud, Turnstile, Brevo SMTP)
- `20d9686` - feat: add confirm password field to signup form
- `3df6376` - fix: correct profile-service URL in frontend (was pointing to non-existent domain) + add to README

#### Archive Feature

- `9f88146` - feat: archive support end-to-end (backend, route, frontend, tests, schema)
- `6321d94` - docs+fix: sync schema with Supabase, use is_archived for projects
- `3000025` - Merge branch 'main' of https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook
- `dfb0958` - Merge branch 'main' of https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook
- `40556dd` - Update README.md
- `dd2afd6` - Update README.md
- `ae56102` - feat: add Archives section to drawer menu
- `ded1da5` - feat: wire up archive functions across backend and frontend
- `c6eff19` - fix: archive entry uses id instead of JSONB object
- `09c25b3` - fix: entry update uses id, due soon/upnext NULL fix
- `23fd7f2` - refactor: remove colored section wrappers, simplify headers
- `cc12325` - align AddEntry + EntryBox with entries table schema

#### Dashboard & Entries

- `f0a2d9e` - refactor: split dashboard into Due Soon and Up Next sections
- `4d2e00e` - feat: wire dashboard.js and EntryBox into Dashboard
- `4245903` - Use provided functions: search, sort, archives + fix sections visibility
- `2d6dc65` - Replace custom new entry modal with user-provided AddEntry component
- `178e2cc` - Add My Stats to drawer + fix unused variable build errors
- `508abf6` - Due Soon top-left, Up Next top-right + full EntryBox styling
- `e93043c` - Notion-style EntryBox: bold project title, colored priority/status tags, table fields
- `5913d92` - feat: themed section backgrounds, search-aware sections, remove entries feed
- `4d416d9` - feat: compact sections, AddEntry uses getFields
- `38e9b45` - Bigger three-dots button, themed ProjectSettingsPanel with field badges and panel footer
- `ded1da5` - feat: wire up archive functions across backend and frontend

#### Testing & Verification

- `940ecf6` - Add test-entries.js verification script with curl and Supabase fallback
- `1c52ace` - Update test-entries.js to use curl with Supabase service-role key
- `5b681d5` - Add test-entries.js verification script with curl and Supabase fallback
- `1c57b02` - Update test-entries.js to use curl with Supabase service-role key
- `4b700ff` - Add tsconfig.json to silence casing warning on Windows
- `f36200d` - Add tsconfig.json to silence casing warning on Windows
- `1af5b15` - Fix CSS warnings: remove empty ruleset, add standard line-clamp property
- `5ce7a2d` - Add lazy entries script: 10 casual human-like test entries via curl
- `0b77a1a` - Merge hlulani to main
- `fc65db7` - Sign out user after successful account deletion

#### Bug Fixes & Improvements

- `e11fd64` - Fix priority.js imports: AI named export and field.js filename
- `431e9c6` - Fix Dashboard.tsx: remove duplicated trailing code causing build failure
- `634db8f` - Remove unused sortArchivedEntries import
- `20e540f` - Fix natural language entry: proper error handling and AI key config
- `d8ddb10` - Wire up unused backend functions to frontend
- `07b08b4` - Add nodemon as dev dependency to project-service

#### AI Integration

- `783bc76` - Fix natural language prompt: shorter, stricter JSON-only response with better cleaning
- `42e2e11` - Fixes: avatar sync, username display, NL prompt, priority wiring, AI.js updates
- `c8e5beb` - Fix supabase import in ai.js: use named import
- `b21a500` - Merge branch 'hlulani'
- `d0b09c7` - Add comprehensive debug logging to ai.js
- `a1aeea1` - Merge branch 'hlulani'
- `1454d59` - Fix supabase import path in ai.js: ../supabase.js not ./supabase.js
- `4c6db91` - Add auto-create project feature to natural language entry + updated tests

#### Activity Logging

- `25909a8` - feat: add activity log to track user actions
- `f221369` - Merge pull request 'feat: add activity log to track user actions' (#4) from feature/activity-log into main

#### Accessibility & Mobile

- `b0a9938` - Increase base font size for accessibility: 18px desktop, 20px mobile
- `27d7c21` - Merge branch 'hlulani'
- `79fc70f` - Reduce mobile font size: 17px instead of 20px
- `070a197` - Merge branch 'hlulani'
- `5bf0b38` - Fix sign-in page on mobile: reduce video height, compact form, scrollable right panel
- `f680f2b` - Merge branch 'hlulani'

#### UI Polish

- `a05b73f` - Fix dark theme button text color + close settings on save
- `ccae9cf` - Merge branch 'hlulani'
- `f074f5b` - Add AI comment to natural language entry + pretty toast notification
- `c92cfc4` - Fix dark theme button text: black text on light buttons (quick-entry, auth-submit, panel-close)
- `8797675` - Merge branch 'hlulani'
- `883b9d5` - Merge branch 'main' of https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook

#### Testing Infrastructure

- `158465e` - Add test workflow with coverage badges + install coverage-badges-cli

#### Archive Feature Removal

- `8b7eaa4` - Remove archive feature from frontend, leave placeholders
- `3c7e1f2` - Fix TypeScript errors: remove archive references

### Sprint 1 Summary

**Total Commits**: 200+

**Key Achievements**:

1. ✅ Full-stack monorepo architecture with 4 microservices
2. ✅ Supabase authentication with email/password and OAuth
3. ✅ Project and entry management with custom fields
4. ✅ Natural language entry parsing with AI provider chain
5. ✅ Activity logging for user actions
6. ✅ Responsive UI with vintage notebook aesthetic
7. ✅ Multiple themes (light, dark, pastel, brown vintage)
8. ✅ CI/CD pipeline with Gitea Actions and Render deployment
9. ✅ Comprehensive error handling and CORS configuration
10. ✅ Testing infrastructure with coverage badges

**Technologies Used**:

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express
- Database: Supabase (PostgreSQL)
- AI: Multi-provider chain (HuggingFace, OpenRouter, Cerebras, Gemini, Groq)
- Deployment: Render, Gitea Actions
- Documentation: MkDocs

**Live Services**:

- Frontend: `https://digital-logbook-bxgv.onrender.com`
- Auth Service: `https://auth-service-hl52.onrender.com`
- Project Service: `https://project-service-96ml.onrender.com`
- Dashboard Service: `https://dashboard-service-bpc5.onrender.com`

## Sprint 2 — Expansion (2–19 September 2026)

!!! note "Status correction"
This section previously read "Sprint 2 – In Progress". Sprint 2 was
completed and reviewed in September 2026; the record below is the final
state. The end date is approximate: the sprint review preceded the
21 September retrospective recorded as Meeting 11.

**Sprint objective.** Expand the vertical slice into a full personal-planning
workload: richer entry formats and statistics over custom fields, additional
ways to view entries (calendar, board, today, timeline), data portability
(import/export, backups, migrations), offline capture, developer tooling
(OpenAPI/Swagger), and a guided onboarding experience.

**Planned scope.** 38 user stories (US11–US48) tracked on the Sprint 2 board;
sprint planning took place at Meeting 9 (2 September 2026).

**Key activities.** Building the four new views; the export/import stack
(JSON/CSV/Markdown, iCalendar, drag-and-drop import, rejected-row reporting,
round-trip safety); one-command backup/restore and versioned schema
migrations; the OpenAPI 3 specification with Swagger UI; soft-delete and
account recovery; the theme/frequency onboarding pages; timer/stats
integration; entry-card UI refinements from the Sprint 1 feedback; two client
demonstrations (10 and 12 September); and a user-testing session.

**Verified achievements.** All 38 board cards carry their Trello completion
flag — see the
[Work Tracker — Sprint 2](Project_Management/work-tracker.md#sprint-2-backlog).
The guided tour with live navigation and voice narration addressed the
Sprint 2 quick-survey's onboarding problem (problem 2, issue
[#119](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/119) —
PRs #158, #161–165; the intro-video request remains tracked in
[#126](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/126)).
The full feature-level record follows below.

**Problems and challenges.**

- The automated testing pipeline was broken for much of the sprint and let
  failing code through to the client demonstration — the primary cause of the
  disappointing Sprint 2 review mark. Nasiphi debugged and repaired the
  pipeline immediately after the review (confirmed at
  [Meeting 11](Meetings/sprint-three-meetings.md)).
- A port conflict between the dashboard and project services was diagnosed
  and fixed during the 7 September standup (explicit `PORT` per service).
- Postgres interval formatting in duration displays, a UTF-16-encoded
  `supabase.js` crash, drawer overflow clipping navigation links, and the
  natural-language prompt creating custom fields for built-in attributes were
  all fixed (see the bug-fix record below).
- Timer edge cases for entries started before the pause/resume fix remained
  open at the end of the sprint.

**Stakeholder feedback and resulting changes.** The 10 September client
demonstration (Discussion Room 3, Wartenweiler Library) was positive — the
toggleable dashboard, the more prominent entry button and the entry-card
sizing fixes were specifically praised. The user-testing session run straight
after produced small UI wording issues and a request for clearer timer labels;
quick wins were completed within the sprint at the 12 September replan, while
larger items moved to the Sprint 3 backlog. The Sprint 2 quick-survey (13
responses, seven usability problems) led to the guided tour and onboarding
improvements — see
[Testing & User Feedback](Testing/testing.md#user-feedback-session-quick-survey-13-responses).

**Sprint outcome.** Completed with the full planned feature set shipped, but a
low sprint-review mark caused by the broken testing pipeline. Two lasting
process changes resulted: every future merge must pass the repaired pipeline
before reaching `main` (Meeting 11), and pipeline health became a first-class
concern in Sprints 3 and 4.

**Evidence.**
[Work Tracker — Sprint 2 backlog](Project_Management/work-tracker.md#sprint-2-backlog) ·
[Sprint 2 user stories (US11–US48)](User_Stories/sprint-two.md) ·
[Sprint 2 meetings (Meeting 9, standups, client meetings)](Meetings/sprint-two-meetings.md) ·
[Testing & User Feedback](Testing/testing.md) · feature record below

### Detailed Feature Record

#### Soft-Delete & Account Recovery

- `005_add_soft_delete_column.sql` — migration adding `deleted` column to all tables, `delete_user()` and `restore_user()` RPC functions
- `checkUser` now returns `{ exists, deleted }` instead of boolean
- Frontend auto-restores soft-deleted users on sign-in (SignIn.tsx, AuthCallback.tsx)
- Fixed PL/pgSQL variable ambiguity: renamed `user_email` → `v_email` in `delete_user()` and `restore_user()` to prevent "column reference is ambiguous" Postgres error

#### Onboarding Enhancements

- Theme Setup page — 7 colour themes, 5 fonts, 3 corner styles with live preview
- Frequency Setup page — nudge frequency picker (silent / gentle / daily / active)
- Tone Setup now navigates to ThemeSetup instead of dashboard
- Full onboarding flow: CreateProfile → Avatar → ToneSetup → ThemeSetup → FrequencySetup → Dashboard

#### Calendar View

- Month and week calendar views showing entries on their due dates
- Drag-to-reschedule entries directly on the calendar
- Colour-coded entries by priority
- Key files: `frontend/src/pages/Calendar.tsx`, `frontend/src/pages/Calendar.css`

#### Kanban Board

- Status columns (Not Started, In Progress, Blocked, Done) with drag-to-change-status
- Entries grouped by status with visual priority indicators
- Click-to-edit entries inline from the board
- Key files: `frontend/src/pages/Kanban.tsx`, `frontend/src/pages/Kanban.css`

#### Today View

- Prioritized daily work list showing entries due today or overdue
- Grouped by urgency (overdue, today, this week)
- Quick status toggles and inline editing
- Key files: `frontend/src/pages/Today.tsx`, `frontend/src/pages/Today.css`

#### Timeline View

- Horizontal Gantt-style view showing entries on a time axis
- Dependency arrows between linked entries
- Zoom levels (day, week, month)
- Key files: `frontend/src/pages/Timeline.tsx`, `frontend/src/pages/Timeline.css`

#### Import & Export

- Export all project data as JSON, CSV, or Markdown
- Import from JSON to restore or migrate data between instances
- Drawer menu links for quick access
- Key files: `frontend/src/lib/export.ts`, `frontend/src/lib/import.ts`
  (paths updated after the Sprint 3 reorganization; originally
  `exportUtils.ts` / `importUtils.ts` / `ExportPage.tsx`)

#### iCalendar (.ics) Export

- Export entries as `.ics` files compatible with Google Calendar, Outlook, and Apple Calendar
- Each entry becomes a calendar event with due date and priority
- Key files: `frontend/src/lib/export.ts` (the iCalendar export now lives
  here; originally a separate `icalExport.ts`)

#### Backup, Restore & Versioned Schema Migrations

- CLI tools for full database backup and restore (`npm run db:backup`, `npm run db:restore`)
- Versioned migration files in `supabase/migrations/` applied in order
- `npm run db:migrate` applies pending migrations
- Key files: `scripts/backup.js`, `scripts/restore.js`, `scripts/migrate.js`

#### OpenAPI 3 Specification & Swagger UI

- 985-line OpenAPI 3.0 YAML specification covering all 15 endpoint paths across 4 microservices
- Browsable Swagger UI served at `/api-docs` on project-service
- 12 validation tests ensuring spec matches implemented routes
- CORS updated on all services to allow localhost origins for cross-service "Try it out"
- Key files: `services/project-service/docs/openapi.yaml`, `services/project-service/src/index.js`

#### Bug Fixes

- Entry card dropdown positioning — added `position: relative` to `.entry-box__menu-wrap`
- Duration formatting — `durationToMs()` now parses Postgres interval format (e.g. "2 days 06:27:39.557")
- Natural language AI prompt — added rule to never create `due_date`, `priority`, or `status` as custom fields
- Login route double-wrap fix — `res.json(result)` instead of `res.json({ exists: result })`
- project-service `supabase.js` UTF-16 encoding crash — converted to UTF-8
- AuthCallback TypeScript build error — added null guard for `email` parameter
- Drawer overflow — Timeline and Import/Export links were clipped by `overflow: hidden` on the navigation drawer; fixed with `overflow-y: auto`

#### Guided Tour with Live Navigation & Voice Narration

- Interactive walkthrough (driver.js) anchored to real UI elements across all views; the tour really navigates — it changes routes and opens/closes the navigation drawer for the user
- Friendly voice narration via the browser SpeechSynthesis API, with a persisted speaker mute/unmute toggle in the popover
- Hands-free auto-advance paced by the narration end event (speech is never cut off), with a draining progress bar, hover pause, and a hard cap
- Offered automatically on the first dashboard visit; replayable from the dashboard banner and navbar; completion persists in localStorage
- Addresses Sprint 2 survey problem 2 (no onboarding or in-app guidance, issue #119); intro video remains tracked in #126
- Key files: `frontend/src/lib/tour.ts`, `frontend/src/index.css`
- PRs #158, #161–165

## Sprint 3 — Refinement (21–29 September 2026)

**Sprint objective.** Recover from the Sprint 2 review — fix the process
(testing pipeline, branch protection) and refine the product: reorganize the
UI around the client's criticism that it "isn't intuitive enough for new
users", migrate legacy data safely, deepen search and statistics, and finish
the timer feature set.

**Planned scope.** 11 user stories (US49–US59) agreed at Meeting 11
(21 September 2026): UI/UX reorganization (the main issue), data migration,
advanced search/grouping/comparison, time plotting, timer notifications, and
six concrete bug fixes (due-date past restriction, project-card scrolling,
dashboard auto-refresh, granular timer inputs, empty-column validation,
custom-column visibility).

**Key activities.** Sprint 3 planning and Sprint 2 retrospective (Meeting 11,
21 September); a client progress review with live demonstrations (Meeting 12,
25 September); pre-marking coordination including a temporary
branch-protection rule (Meeting 13, 28 September); a large merge wave in the
final 48 hours of the sprint (28–29 September); the Sprint 3 user-feedback
survey; and the sprint review on Tuesday 29 September 2026.

**Verified achievements.**

- **Process recovery:** the repaired testing pipeline gated every merge
  (the standing decision from Meeting 11), and a temporary branch-protection
  rule requiring at least one approval was applied before the marking session
  (Meeting 13).
- **UI reorganization (US49, all six members):** the dashboard was rebuilt
  around a due-soon rail, collapsible entry cards and leading entry/project
  cards; project headers moved to unified Sort/View dropdowns and the
  scattered statistics buttons were consolidated
  (PR [#382](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/382),
  commits `9a18ea6`, `319e98b`, `afbd72d`, merged 29 September).
- **Timer feature set (US53, US57):** granular day/hour/minute countdown
  settings, batch pause-all/stop-all actions
  ([#325](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/325)),
  idle detection with a warning badge
  ([#324](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/324)),
  paused-duration display
  ([#323](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/323)),
  timer start/pause/resume/stop events in the activity log
  ([#333](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/333)),
  timer-data CSV export
  ([#326](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/326)),
  and a circular SVG progress-ring timer
  ([#363](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/363)).
- **Statistics and search (US51, US52):** advanced search with pinned
  configurations, grouping and comparison, statistics filtering by project,
  and plotting entries and custom fields over time — demonstrated to the
  client at Meeting 12.
- **Data migration (US50):** existing entries migrate when a format changes,
  with reasonably inferred defaults for new fields.
- **Notifications (US53 / Meeting 12):** due-date emails and in-app
  badge-only notifications with history limited to 15 items.
- **Bug fixes (US54–US56, US58, US59):** due dates older than a week can be
  set; the project-creation card scrolls correctly; new entries appear on the
  dashboard without a manual refresh; empty required columns block submission
  with an alert; newly added custom columns appear immediately on the
  entry-creation form.
- **Auth hygiene:** unconfirmed signups purged and password requirements
  enforced in the UI (Nasiphi, presented at Meeting 12; migration
  `010_purge_unconfirmed_signups.sql`).
- **Activity feed:** infinite-scroll pagination
  ([#337](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/337))
  and filtering by action type
  ([#335](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/335));
  bulk select and delete of entries
  ([#365](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/365),
  [#377](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/377)).
- **Documentation:** UML architecture diagrams added to the documentation site
  (Siphesihle, Meeting 12) and Sprint 3 pages added to the MkDocs navigation
  ([#376](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/376)).
- **User feedback:** the Sprint 3 survey round (13 responses) was run with
  screenshot evidence captured — see
  [Sprint 3 User Feedback](Testing/user-feedback-sprint3.md).

**Problems and challenges.**

- **Timer reliability was still open at the sprint boundary.** Merge
  conflicts and deployment failures around the timer work were being resolved
  the day before marking (Meeting 13). The abandoned/indefinitely-running
  timer issue was improved (idle detection, notifications) but was never
  verified as fully fixed — it remains a known limitation through Sprint 4.
- The UI reorganization merged on the review day itself (29 September), so
  much of it landed after the client had formed their Sprint 3 impressions;
  its benefits only became measurable in Sprint 4.
- Archive visibility and cross-view lifecycle inconsistencies were observed
  by users but not yet diagnosed — they became the focus of the Sprint 4
  stress test.
- On the Sprint 3 Trello board, all 11 cards sit in the Done list but none
  has its completion flag checked — list position is the only status evidence
  (see the [Work Tracker](Project_Management/work-tracker.md)).

**Stakeholder feedback and resulting changes.** The client's Sprint 2-review
criticism that the UI "isn't intuitive enough for new users" made UI
reorganization the main issue of the sprint (Meeting 11). At the 25 September
progress review, the client (Jashil) advised cleaning up password validation
and error messaging, adopting badge-only in-app notifications with limited
history, and adding an onboarding flow for new users — all adopted as Meeting
12 decisions. The Sprint 3 user-feedback survey confirmed the discoverability
problem (Kanban and Statistics were found by only 2 of 13 first-time users)
and produced the "+ New Project button" bug report; both fed into Sprint 4's
landing page and creation-flow rework.

**Sprint outcome.** Completed — 11/11 cards in the board's Done list, the
sprint review held on Tuesday 29 September 2026, and the lesson recorded at
the next planning meeting: late-breaking regressions and inconsistent
behaviour damage a demonstration more than a missing feature does, so the
final sprint would prioritize stable, consistent behaviour over new scope
(Meeting 14).

**Evidence.**
[Work Tracker — Sprint 3 backlog](Project_Management/work-tracker.md#sprint-3-backlog) ·
[Sprint 3 user stories (US49–US59)](User_Stories/sprint-three.md) ·
[Sprint 3 meetings (Meetings 11–13)](Meetings/sprint-three-meetings.md) ·
[Sprint 3 User Feedback](Testing/user-feedback-sprint3.md) ·
git history 21–29 September 2026

## Sprint 4 — Final Polishing & Stress Testing (30 September – 10 October 2026)

**Sprint objective.** Stabilize, polish, and prepare for final submission: no
new feature-expansion phase — consistent behaviour end-to-end, a public face
for the product (landing page, rebrand), verifiable test coverage, and
stress-test-driven lifecycle correctness.

**Planned scope.** Agreed at Meeting 14 (1 October 2026): final-presentation
preparation with a verified demo environment; whole-workflow regression
testing rather than isolated screens; outstanding Sprint 3 follow-ups (timer
reliability, notifications, documentation); the final user-feedback round
with published evidence; and accurate individual contribution records
consistent with the Git history, Trello boards, meetings and feedback records.

**Key activities.** Sprint 4 planning (Meeting 14, 1 October); a 13-page
functional and UX stress test of the application analysing 27 screenshots
(7 October); the stress-test review meeting that adopted its P1→P2→P3 fix
order and QA scenario set (Meeting 15, 8 October); implementation of the
P1/P2 lifecycle fixes (9–10 October); and publication of the Sprint 3 user
feedback. Sprint 4 was tracked in Git and pull requests only — no Trello
board was created for it.

**Verified achievements.**

- **Landing page and PLANNAR rebrand (Nasiphi, PRs
  [#383](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/383)–[#418](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/418)):
  a public landing page before sign-in with hero image and later hero video,
  an About section and interactive feature cards (#397–#409); the rename from
  Digital Logbook to **PLANNAR**
  ([#415](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/415),
  8 October); a restyled sign-in form matching the landing brand (#418); plus
  a full-screen Focus Mode with circular countdown timer, mobile fixes for
  the New Project modal and entry-field columns, and overdue-entry dropdown
  handling (#383–#384, 1 October).
- **Help Centre and bug reporting (Nasiphi, PRs
  [#386](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/386)–[#396](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/396)):
  an in-app Help Centre with search, guides and FAQ; a dedicated bug-report
  page with email delivery; base64 image fields rendered as thumbnails.
- **Test coverage (Hlulani, PRs
  [#410](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/410)–[#412](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/412),
  7 October): frontend coverage raised to 87.5%; a coverage table surfaced in
  Gitea Actions; a comprehensive testing inventory (93 test files, ≈991
  tests); coverage requirements added to all CI workflows.
- **Stress-test-driven lifecycle fixes (Siphesihle, PRs
  [#419](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/419)–[#421](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/421),
  9–10 October):
  - #419 — overdue warnings shown consistently across views;
  - #420 — Due Soon eligibility unified across lifecycle states, with the
    archive state shared across all due-soon surfaces;
  - #421 — archived entries excluded from active views, entry archive state
    made independent of project archive/restore, the saved due time shown
    alongside the due date everywhere, Total-Entries statistics semantics
    locked by test, and the redundant manual Started At editor removed.
- **Sprint 3 feedback published:** the 13-response survey round documented
  with redacted screenshots
  ([Sprint 3 User Feedback](Testing/user-feedback-sprint3.md)), completing
  the commitment made at Meeting 14.

**Problems and challenges.**

- The stress test (7 October) documented cross-view lifecycle
  inconsistencies — the same entry behaving differently in the Cards, Table,
  Checklist and Board views — plus overdue-editing traps, Due Soon persistence
  after completion, and archive-visibility problems. These were triaged into
  P1/P2/P3 priorities at Meeting 15; the P1/P2 fixes merged 9–10 October, but
  **the P3 items (Table readability, Checklist-vs-Board differentiation)
  were not merged** and remain open.
- **Timer reliability remains an outstanding limitation.** Sprint 4 shipped
  abandoned-timer detection and Focus Mode, but no verified full fix of the
  indefinitely-running timer was merged — the timer should not be reported
  as fully fixed.
- The Gitea → GitHub mirror that feeds the Render deployments had documented
  delays, so live-deployment verification lagged behind merges
  ([Development Log](Project_Management/log.md)).

**Stakeholder feedback and resulting changes.** Two inputs shaped the sprint.
First, the stress-test report (7 October, reviewed at Meeting 15): its
P1→P2→P3 fix order and controlled QA scenario set were adopted as the
stabilization plan and the regression checklist for final validation. Second,
the Sprint 3 user-feedback survey (13 responses, captured 9 October): the
discoverability findings aligned with the landing-page and navigation rework,
and the tour-length and native-app requests were logged as backlog or
out-of-scope rather than silently ignored
([Sprint 3 User Feedback](Testing/user-feedback-sprint3.md)).

**Sprint outcome.** Completed on 10 October 2026, with the P1/P2 lifecycle
fixes merged (#419–#421), frontend coverage at 87.5%, the PLANNAR rebrand
live, and this documentation site updated to cover all four sprints. The
final presentation and the group/individual reports were the remaining
milestones at the time of writing.

**Evidence.**
[Sprint 4 meetings (Meetings 14–15)](Meetings/sprint-four-meetings.md) ·
[Work Tracker — Sprint 4 work log](Project_Management/work-tracker.md#sprint-4-work-log) ·
[Sprint 3 User Feedback](Testing/user-feedback-sprint3.md) ·
PRs [#383](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/383)–[#421](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/pulls/421) ·
git history 30 September – 10 October 2026

## Retrospective — Four Sprints in Brief

| Sprint | What the team learned                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------- |
| 1      | A vertical slice beats breadth: end-to-end deployment, CI/CD and docs from day one                    |
| 2      | A broken test pipeline quietly ships failing code — process failures cost more than feature gaps      |
| 3      | Client-facing refinement needs lead time: a reorganization merged on review day arrives too late      |
| 4      | Stability, honest evidence and a single lifecycle model matter more than new scope at the finish line |

The archive feature traces the arc: a backend-only placeholder at the end of
Sprint 1, a rebuilt flow during Sprint 2, and lifecycle-correct visibility
(excluded from active views, independent of project restore) locked down by
#421 in Sprint 4.

### Deferred and Dropped Items

Items logged as possible future work during Sprint 2 planning — server-side
caching (Redis), rate limiting, API versioning, a background job queue for AI
calls, structured logging (Winston/Pino), the nudge engine, and drag-and-drop
entry reordering — were consciously **not pursued**: Sprints 3 and 4
prioritized refinement, stability and polish over new scope (Meetings 11 and
14).

### Known Outstanding Limitations

| Item                           | Status at 10 October 2026                                                                                                                | Evidence                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Timer reliability              | Abandoned-timer detection and notifications shipped; **no verified full fix merged** — the timer must not be reported as fully fixed     | Meetings 12–14; no full timer-reliability fix in Sprint 4 PRs                |
| P3 UI polish                   | Table readability and Checklist-vs-Board differentiation recommended by the stress test; not merged                                      | [Meeting 15](Meetings/sprint-four-meetings.md)                               |
| Project-archive restore retest | Archive-state independence implemented and tested (#421); the stress test's controlled restore-preservation retest remains a QA scenario | [Meeting 15](Meetings/sprint-four-meetings.md)                               |
| Guided-tour length             | "Tour is long" survey feedback logged; no shortening merged                                                                              | [Sprint 3 feedback](Testing/user-feedback-sprint3.md)                        |
| Native application             | Requested by a survey respondent; out of scope for a web-based course project                                                            | [Sprint 3 feedback](Testing/user-feedback-sprint3.md)                        |
| Intro video                    | Onboarding-video request from the Sprint 2 survey still open                                                                             | [Issue #126](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/issues/126) |
