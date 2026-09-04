# Features

A comprehensive overview of all features implemented in the Digital Logbook, why they were implemented, and how they work.

---

## Authentication & User Management

The Digital Logbook uses Supabase Auth as its identity provider. Users can authenticate with existing Google or GitHub accounts, or create a dedicated email and password account. All authentication flows are protected by Cloudflare Turnstile to prevent automated abuse, and sessions are managed globally so protected pages automatically redirect unauthenticated visitors to the sign-in screen.

![Sign-in page showing the email and password form, Cloudflare Turnstile widget, and Google and GitHub OAuth buttons](assets/ui-images/Screenshot_19-8-2026_123315_digital-logbook-bxgv.onrender.com.jpeg)

### Signing Up and Signing In

Users reach the sign-in page automatically when they are not authenticated. The page presents three ways to authenticate: Google, GitHub, and email with password.

When a user chooses Google or GitHub, they are redirected to the provider to confirm consent, then returned to the application. On first visit, a profile record is created automatically so the user can immediately start using the logbook.

When a user chooses email and password, the form validates the address before sending anything to Supabase:

- The email must look like a real address (for example, name@example.com).
- Disposable or temporary email domains, such as tempmail.com or mailinator.com, are rejected.
- Common typos are caught and suggested. Typing user@gmail.comm displays a clickable "Did you mean user@gmail.com?" hint.

On sign-up, a confirmation email is sent. The user must open the link before signing in. On sign-in, the application checks whether the account is active or scheduled for deletion. If the account was soft-deleted, the user is offered a one-click restore link instead of being logged in.

![Profile setup page where a new user enters their email, full name, and username](assets/ui-images/Screenshot_19-8-2026_123344_digital-logbook-bxgv.onrender.com.jpeg)

### Using the Same Email with Google and Email-Password

Supabase Auth can automatically link identities that share the same confirmed email address. This means a user who first signed up with Google can later sign in with the same email and a password, and vice versa, as long as the email addresses match and the email provider identity is verified.

If automatic linking is disabled in the Supabase project, the second sign-in method may create a separate account or be rejected. The application does not manually merge accounts, so the project relies on Supabase Auth's default linking behavior to keep a single user record per email.

### Password Reset

Users who forget their password can request a reset link from the sign-in page or from the Account tab in settings.

The flow works as follows:

- The user enters their email and completes the CAPTCHA.
- Supabase sends a password reset link to the registered email address.
- The link opens a secure page where the user enters a new password.
- A strength meter gives immediate feedback on password quality.
- After the password is updated, the user is signed in and redirected to the dashboard.

Reset links expire after one hour for security.

### Automatic Sign-Out After Inactivity

For security and shared-device safety, the application automatically signs a user out after 30 minutes of inactivity. Any mouse movement, key press, scroll, touch, or click resets the timer, so active users are never interrupted. Once the timeout is reached, the session is ended and the user is returned to the sign-in page.

This prevents accounts from staying signed in indefinitely on public or shared computers, while still allowing users to remain logged in during normal use.

### Account Deletion and Restoration

Users can delete their account from the Account tab in the settings panel. Because deletion is destructive, the user must confirm the action in a dialog that explains the consequences.

When deletion is confirmed, the account is soft-deleted first. The user has 30 days to change their mind. During this window:

- The account cannot be used normally.
- If the user tries to sign in, they see a restore prompt instead of the dashboard.
- Clicking the restore link sends a secure one-time login email. Opening it reactivates the account and signs the user back in.
- The restore prompt and email suggest opening the link on the device where the user wants to sign in, which gives the fastest experience.
- If the restore link is opened on another device (for example, a phone), the restore prompt on the original device automatically detects the restoration within a few seconds and switches to a "Continue to sign in" state, so the user does not have to refresh the page manually.

After the 30-day grace period, a background process permanently removes the account and all related data. Until then, no data is lost.

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

### 11. Calendar View

**What it does:** Shows entries on a month or week calendar, placed on their due dates. Entries can be dragged to a different day to reschedule them.

**Why it was implemented:** Gives users a visual, time-based view of their workload and makes it easy to move deadlines without opening each entry.

**How it works:**

- Fetches all unarchived entries with a due date using `getAllEntries()`
- Month view shows a full 7-column grid; week view shows seven vertical day columns
- Days are navigated with Previous, Next, and Today controls
- Overdue entries are highlighted in red and completed entries are shown in green with a strikethrough
- Dragging an entry onto another day calls `updateEntry()` with the new due date and updates the local list immediately
- Days with many tasks show the first few entries plus a "+N more" indicator and remain scrollable

**Key files:**

- `frontend/src/pages/Calendar.tsx` — Calendar page
- `frontend/src/lib/calendar.ts` — Date utilities and entry grouping
- `frontend/src/pages/Calendar.css` — Calendar styles

### 12. Kanban Board

**What it does:** Shows entries as cards in three columns based on their status: Up Next, In Motion, and Done & Dusted. Cards can be dragged between columns to change status, and the change is saved immediately.

**Why it was implemented:** Provides a task-board view of work in progress and makes it easy to advance or complete entries without opening each one.

**How it works:**

- Fetches all unarchived entries using `getAllEntries()`
- Columns are rendered for each status and display matching entries
- Cards show the entry title, project, due date, and priority
- Overdue entries are highlighted in red; completed entries appear in the Done & Dusted column
- Project and search filters narrow the cards on the board
- Dragging a card onto a different column optimistically updates the local state, calls `updateEntry()` with the new status, and reverts the card if the write fails
- Moving a card to In Motion automatically sets `started_at`; moving it to Done & Dusted automatically sets `ended_at`

**Key files:**

- `frontend/src/pages/Kanban.tsx` — Kanban board page
- `frontend/src/lib/kanban.ts` — Status grouping, filtering, and update helpers
- `frontend/src/pages/Kanban.css` — Kanban styles

### 13. Today View

**What it does:** A single focused screen for starting work. It shows overdue entries first, then entries due today, then anything currently in progress.

**Why it was implemented:** Helps users decide what to work on next without browsing the full dashboard or calendar.

**How it works:**

- Fetches all unarchived, incomplete entries using `getAllEntries()`
- Partitions entries into three sections using `getTodaySections()`
- **Overdue** appears first because missed deadlines are the most urgent
- **Due today** appears second because today's commitments must be honoured before loose in-progress work
- **In progress** appears third so started work remains visible, but does not hide deadlines
- Sections only render when they have entries
- When nothing requires attention, a friendly empty state is shown instead of a blank panel

**Key files:**

- `frontend/src/pages/Today.tsx` — Today page
- `frontend/src/lib/today.ts` — Section partitioning and date helpers
- `frontend/src/pages/Today.css` — Today styles

---

## Project & Entry Management

### 12. Project Creation & Management

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

### 13. Custom Fields per Project

**What it does:** Each project can have its own set of custom fields (text, number, date, etc.) beyond the built-in fields.

**Why it was implemented:** Different projects have different tracking needs. Custom fields provide flexibility without bloating the core schema.

**How it works:**

- When creating a project, define 1-3 custom fields with name, data type, and required flag
- Fields stored in `fields` table linked to project
- Entries store custom field values in a JSONB column
- Field definitions retrieved when viewing project or adding entry

**Key files:**

- `services/project-service/src/functions/field.js` — Backend field functions

### 14. Quick Add (Natural Language Entry)

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

### 15. Manual Entry Creation

**What it does:** Traditional form-based entry creation with project selection and field inputs.

**Why it was implemented:** Provides precise control for users who prefer structured data entry.

**How it works:**

- Select project from dropdown
- Form dynamically generates fields based on project's custom fields
- Set due date, priority, status, duration
- Validate required fields before submission

**Key files:**

- `frontend/src/pages/NewEntry.tsx` — Manual entry form

### 16. Entry Timeline & All Entries View

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

### 17. Priority & Status Tracking

**What it does:** Each entry has a priority (0=urgent+important, 1=urgent, 2=not urgent, null=none) and status.

**Why it was implemented:** Helps users prioritize tasks and track completion.

**How it works:**

- Priority set during entry creation
- Status can be updated as work progresses
- Filter entries by priority or status
- Visual indicators (colors, icons) for quick identification

### 18. Soft Delete & Archives

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

### 19. Project Statistics

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
