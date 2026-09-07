# Roadmap

## Sprint 1 - Completed

Sprint 1 established the foundation of the Digital Logbook application, implementing core functionality across frontend, backend services, and infrastructure.

### Commit History

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

## Sprint 2 - In Progress

### Completed Features

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
- Key files: `frontend/src/lib/exportUtils.ts`, `frontend/src/lib/importUtils.ts`, `frontend/src/pages/ExportPage.tsx`

#### iCalendar (.ics) Export

- Export entries as `.ics` files compatible with Google Calendar, Outlook, and Apple Calendar
- Each entry becomes a calendar event with due date and priority
- Key files: `frontend/src/lib/icalExport.ts`

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

### Planned Features

- Server-side caching (Redis)
- Rate limiting middleware
- API versioning
- Background job queue for AI calls
- Comprehensive logging (Winston/Pino)
- Nudge engine implementation
- Drag-and-drop entry reordering

### Technical Debt

- Consolidate archive feature (currently placeholder)
- Add comprehensive frontend tests
- Implement API rate limiting
- Add request validation middleware
- Set up monitoring and alerting
- Convert remaining JS pages to TypeScript
