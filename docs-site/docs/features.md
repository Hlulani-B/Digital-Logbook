# Features

A comprehensive overview of all features implemented in the Digital Logbook, why they were implemented, and how they work.

---

## Authentication & User Management

### 1. OAuth Authentication (Google & GitHub)

**What it does:** Users can sign in and sign up using their Google or GitHub accounts with a single click.

**Why it was implemented:** The project specification requires integration with established authentication libraries. OAuth eliminates the need for users to remember passwords and leverages trusted identity providers for secure authentication.

**How it works:**

- Supabase Auth handles the OAuth flow with Google and GitHub providers
- On first sign-in, user accounts are automatically provisioned in the `users` table
- The `AuthContext` manages session state across the application
- An OAuth callback handler (`/auth/callback`) exchanges authorization codes for Supabase sessions
- Cloudflare Turnstile CAPTCHA protects the email/password sign-in form from bot abuse

**Key files:**

- `frontend/src/pages/SignIn.tsx` — Sign-in UI with OAuth buttons
- `frontend/src/pages/AuthCallback.tsx` — OAuth redirect handler
- `frontend/src/context/AuthContext.tsx` — Session state management
- `services/auth-service/` — Backend auth endpoints

### 2. Email/Password Authentication

**What it does:** Traditional sign-in and sign-up with email and password, protected by CAPTCHA.

**Why it was implemented:** Provides an alternative for users who prefer not to use OAuth, and supports the password reset flow required by the project specification.

**How it works:**

- Supabase Auth's built-in email/password authentication
- Cloudflare Turnstile verification required before form submission
- Email verification sent on signup
- Password reset link sent via email with 1-hour expiry

### 3. Password Reset Flow

**What it does:** Users can request a password reset link via email and set a new password with real-time validation.

**Why it was implemented:** Required by the project specification. Provides a secure way for users to regain access to their accounts.

**How it works:**

- User requests reset from sign-in page or settings panel
- CAPTCHA-protected form prevents abuse
- Supabase sends reset link to user's email
- User clicks link, redirected to `/auth/update-password`
- Real-time password strength meter and validation
- Redirects to dashboard on successful password update

**Key files:**

- `frontend/src/pages/ResetPassword.tsx` — Reset request page
- `frontend/src/pages/UpdatePassword.tsx` — Set new password page

### 4. Account Deletion

**What it does:** Permanently deletes the user's account and all associated data.

**Why it was implemented:** Required by the project specification. Provides users with full control over their data.

**How it works:**

- Confirmation dialog prevents accidental deletion
- Calls Supabase RPC function `delete_user()` which cascades to all related tables
- User is signed out and redirected to sign-in page after deletion

---

## Profile Management

### 5. User Profile Customization

**What it does:** Users can customize their profile with a preferred name, role, student number, bio, and avatar.

**Why it was implemented:** Personalizes the user experience and provides context for logbook entries (e.g., student number for academic tracking).

**How it works:**

- Profile data stored in `users` table via profile-service
- Preferred name overrides the OAuth name on the dashboard greeting
- Role selection (Student, Lecturer, Tutor, Professional) for future personalization
- Avatar selection from 18 DiceBear preset avatars (no photo uploads to keep storage simple)
- Auto-save on avatar selection for seamless UX

**Key files:**

- `frontend/src/pages/CreateProfile.tsx` — Profile creation/editing
- `frontend/src/pages/Avatar.tsx` — Avatar picker
- `services/profile-service/` — Backend profile endpoints

### 6. Settings Panel

**What it does:** Slide-out panel with three tabs for managing profile, preferences, and account settings.

**Why it was implemented:** Provides quick access to all user settings without leaving the current page, improving usability.

**How it works:**

- **Profile Tab:** Edit name, role, student number, bio
- **Preferences Tab:** Default view, week start day, time format, auto-save, compact mode, email notifications, weekly reminders
- **Account Tab:** View account info, change password, delete account
- Panel slides in from the right with smooth animation
- Closes on outside click or Escape key
- Changes save immediately with visual feedback

**Key files:**

- `frontend/src/components/SettingsPanel.tsx` — Settings UI

---

## Dashboard & Navigation

### 7. Smart Dashboard Greeting

**What it does:** Displays "Welcome" for first-time users and "Welcome back" for returning users.

**Why it was implemented:** Creates a personalized, welcoming experience that acknowledges user engagement.

**How it works:**

- Tracks first visit per user in `localStorage`
- Shows "Welcome" on first visit, "Welcome back" on subsequent visits
- Includes user's preferred name from profile

### 8. Dashboard Stats Overview

**What it does:** Shows Total Entries, This Week, and Projects stats with animated entrance.

**Why it was implemented:** Provides users with an immediate overview of their logbook activity, encouraging regular use.

**How it works:**

- Fetches real data from dashboard-service on mount
- `getProjectsByEmail()` counts user's projects
- `getAllEntries()` counts total entries and filters for this week
- Stats cards have staggered fade-in-up animations
- Loading states while data fetches

**Key files:**

- `frontend/src/pages/Dashboard.tsx` — Dashboard UI
- `services/dashboard-service/` — Backend stats endpoints

### 9. Quick Actions

**What it does:** Provides fast access to common actions: New Entry, View All Entries, Export Data.

**Why it was implemented:** Reduces friction for frequent tasks, improving workflow efficiency.

**How it works:**

- Buttons navigate to respective pages or trigger data export
- Export downloads entries as JSON file

### 10. Profile Menu (Avatar Dropdown)

**What it does:** Clicking the user's avatar/name in the navbar opens a dropdown with quick access to profile, settings, and sign-out.

**Why it was implemented:** Keeps the navbar clean while providing instant access to account management.

**How it works:**

- Dropdown appears on click
- Shows user's name and email at the top
- Menu items: Manage Profile, Settings, Sign Out
- Closes on outside click or Escape key

**Key files:**

- `frontend/src/components/ProfileMenu.tsx` — Dropdown menu

---

## Project & Entry Management

### 11. Project Creation & Management

**What it does:** Users can create projects, add entries to them, and manage project lifecycle.

**Why it was implemented:** Core feature of the digital logbook. Organizes entries by project for better tracking and analysis.

**How it works:**

- Create project with name and optional description
- Projects listed on Projects page with stats (entry count, last updated)
- Archive projects to hide them from active list (soft delete)
- Each project can have custom fields defined by the user

**Key files:**

- `frontend/src/pages/Project.tsx` — Project detail page
- `frontend/src/pages/ProjectsPage.tsx` — Projects list
- `services/project-service/src/functions/project.js` — Backend project functions

### 12. Custom Fields per Project

**What it does:** Each project can have its own set of custom fields (text, number, date, etc.) beyond the built-in fields.

**Why it was implemented:** Different projects have different tracking needs. Custom fields provide flexibility without bloating the core schema.

**How it works:**

- When creating a project, define 1-3 custom fields with name, data type, and required flag
- Fields stored in `fields` table linked to project
- Entries store custom field values in a JSONB column
- Field definitions retrieved when viewing project or adding entry

**Key files:**

- `services/project-service/src/functions/field.js` — Backend field functions

### 13. Quick Add (Natural Language Entry)

**What it does:** Add entries using natural language. The AI parses the text, matches it to an existing project or creates a new one, and extracts field values.

**Why it was implemented:** Speeds up data entry. Users can type naturally instead of filling out forms.

**How it works:**

- User types text like "worked on login feature for 2 hours"
- AI prompt includes list of user's projects with their fields
- AI matches text to existing project or proposes new project
- AI extracts field values from text
- Server-side `getDate()` function resolves dates from keywords (today, tomorrow, monday, etc.) before AI involvement
- Fuzzy matching corrects misspelled date keywords (e.g., "tommorow" → "tomorrow")
- AI instructed NOT to output due_date — date is handled entirely server-side
- Entry created with matched project, extracted fields, and calculated due date

**Key files:**

- `frontend/src/components/QuickAdd.tsx` — Quick Add UI
- `services/project-service/src/functions/entries.js` — `Natural_language.entry()` and `getDate()`

### 14. Manual Entry Creation

**What it does:** Traditional form-based entry creation with project selection and field inputs.

**Why it was implemented:** Provides precise control for users who prefer structured data entry.

**How it works:**

- Select project from dropdown
- Form dynamically generates fields based on project's custom fields
- Set due date, priority, status, duration
- Validate required fields before submission

**Key files:**

- `frontend/src/pages/NewEntry.tsx` — Manual entry form

### 15. Entry Timeline & All Entries View

**What it does:** View all entries in a timeline or list format, with filtering and search.

**Why it was implemented:** Provides overview of all logged work, making it easy to review past entries.

**How it works:**

- Fetches all entries for user via `getAllEntries()`
- Timeline view groups entries by date
- List view shows entries in chronological order
- Filter by project, date range, priority
- Search by entry content

**Key files:**

- `frontend/src/pages/AllEntries.tsx` — All entries view
- `frontend/src/pages/Activity.tsx` — Timeline view

### 16. Priority & Status Tracking

**What it does:** Each entry has a priority (0=urgent+important, 1=urgent, 2=not urgent, null=none) and status.

**Why it was implemented:** Helps users prioritize tasks and track completion.

**How it works:**

- Priority set during entry creation
- Status can be updated as work progresses
- Filter entries by priority or status
- Visual indicators (colors, icons) for quick identification

### 17. Soft Delete & Archives

**What it does:** Entries and projects can be soft-deleted and moved to archives instead of permanent deletion.

**Why it was implemented:** Prevents accidental data loss. Allows users to hide completed work without deleting it.

**How it works:**

- `deleted` column in database (boolean or timestamp)
- Soft-deleted items excluded from normal queries
- Archives page shows soft-deleted items
- Option to restore or permanently delete

**Key files:**

- `frontend/src/pages/Archives.tsx` — Archives view
- `services/project-service/src/functions/entries.js` — `deleteEntryById()`

---

## Analytics & Insights

### 18. Project Statistics

**What it does:** Shows stats for each project: total entries, time spent, completion rate.

**Why it was implemented:** Provides insights into project progress and time allocation.

**How it works:**

- `getProjectStats()` aggregates entry data
- Calculates total entries, sum of durations, average priority
- Displayed on project detail page and projects list

**Key files:**

- `services/project-service/src/functions/stats.js` — Backend stats functions

### 19. Streak Tracking

**What it does:** Tracks consecutive days of logging activity.

**Why it was implemented:** Gamification encourages regular use and habit formation.

**How it works:**

- Query entries grouped by date
- Count consecutive days with at least one entry
- Display current streak and best streak on dashboard

**Key files:**

- `frontend/src/pages/StreakView.tsx` — Streak visualization

### 20. Dashboard Stats Service

**What it does:** Cross-project summaries for the dashboard.

**Why it was implemented:** Dashboard needs aggregated data from all projects, not just one.

**How it works:**

- `dashboard-service` queries across all user's projects
- Returns total entries, this week count, project count
- Separate from `project-service` to maintain architecture boundary (dashboard doesn't read entry tables directly)

**Key files:**

- `services/dashboard-service/` — Dashboard-specific endpoints

---

## Advanced Features

### 21. Voice Recording

**What it does:** Record audio notes and attach them to entries.

**Why it was implemented:** Provides an alternative input method for users who prefer speaking over typing. Useful for capturing thoughts on the go.

**How it works:**

- Browser MediaRecorder API captures audio
- Audio stored as base64 or uploaded to Supabase storage
- Playback controls on entry detail page
- Optional transcription (future enhancement)

**Key files:**

- `frontend/src/pages/VoiceFeature.jsx` — Voice recording UI
- `docs-site/docs/architecture/voice-feature.md` — Voice feature documentation

### 22. Data Export

**What it does:** Export all entries as JSON for backup or external analysis.

**Why it was implemented:** Gives users ownership of their data. Enables external analysis or migration.

**How it works:**

- Fetches all entries for user
- Formats as JSON
- Triggers browser download

### 23. Responsive Design

**What it does:** UI works seamlessly on mobile, tablet, and desktop.

**Why it was implemented:** Users access the logbook from various devices. Mobile support is essential for on-the-go logging.

**How it works:**

- CSS media queries and flexible layouts
- Touch-friendly buttons and controls
- Collapsible navigation on mobile
- Settings panel adapts to screen size

---

## Security & Privacy

### 24. Row-Level Security (RLS)

**What it does:** Ensures users can only access their own data.

**Why it was implemented:** Multi-tenant application requires strict data isolation.

**How it works:**

- Supabase RLS policies on all tables
- Policies check `user_email` against authenticated user
- Applied to SELECT, INSERT, UPDATE, DELETE operations
- Backend services use service role key for admin access

**Key files:**

- `supabase/setup.sql` — RLS policy definitions

### 25. Environment Variable Management

**What it does:** Secrets (API keys, database credentials) stored in environment variables, never committed to repo.

**Why it was implemented:** Security best practice. Prevents credential leakage.

**How it works:**

- `.env` files listed in `.gitignore`
- Each service has its own `.env` file
- `dotenv` package loads variables at runtime
- Render dashboard manages production environment variables

---

## Developer Experience

### 26. Hot Module Replacement (HMR)

**What it does:** Frontend updates instantly without full page reload during development.

**Why it was implemented:** Speeds up development iteration.

**How it works:**

- Vite's built-in HMR
- React Fast Refresh preserves component state

### 27. Comprehensive Test Coverage

**What it does:** Unit tests for backend functions, integration tests for API endpoints.

**Why it was implemented:** Ensures code quality and prevents regressions.

**How it works:**

- Jest test framework with Babel for ESM support
- Coverage reports generated on every CI run
- Badges auto-updated and committed back to repo
- 33 tests for `getDate()` alone, plus tests for all other backend functions

**Key files:**

- `services/project-service/src/__tests__/` — Test files
- `.gitea/workflows/test.yml` — CI test workflow

### 28. CI/CD Pipeline

**What it does:** Automated testing, coverage reporting, and deployment on every push.

**Why it was implemented:** Ensures code quality and automates deployment.

**How it works:**

- Gitea Actions workflow runs on push to main
- Tests run for all services in parallel
- Coverage badges generated and committed
- Render auto-deploys from main branch

**Key files:**

- `.gitea/workflows/ci.yml` — CI workflow
- `.gitea/workflows/test.yml` — Test workflow with badge generation
- `render.yaml` — Render deployment manifest

---

## Summary

The Digital Logbook implements a comprehensive set of features covering authentication, profile management, project tracking, natural language entry, analytics, and developer experience. Each feature was designed with user experience, security, and maintainability in mind, following microservices architecture principles and modern web development best practices.
