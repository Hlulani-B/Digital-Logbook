## Link to the Documentation site

https://digital-logbook-documentation-site.onrender.com


## AI Usage

This project uses AI-assisted development for the frontend authentication module. See [`AI_USAGE.md`](AI_USAGE.md) for a summary and [`frontend/AI_DECLARATION.md`](frontend/AI_DECLARATION.md) for the full declaration.


## Test Coverage

> Badges are auto-updated by CI on every push to `main`.

| Service | Lines | Statements | Functions | Branches |
| :--- | :---: | :---: | :---: | :---: |
| **Auth Service** | ![Lines](badges/auth-service/lines.svg) | ![Statements](badges/auth-service/statements.svg) | ![Functions](badges/auth-service/functions.svg) | ![Branches](badges/auth-service/branches.svg) |
| **Dashboard Service** | ![Lines](badges/dashboard-service/lines.svg) | ![Statements](badges/dashboard-service/statements.svg) | ![Functions](badges/dashboard-service/functions.svg) | ![Branches](badges/dashboard-service/branches.svg) |
| **Profile Service** | ![Lines](badges/profile-service/lines.svg) | ![Statements](badges/profile-service/statements.svg) | ![Functions](badges/profile-service/functions.svg) | ![Branches](badges/profile-service/branches.svg) |
| **Project Service** | ![Lines](badges/project-service/lines.svg) | ![Statements](badges/project-service/statements.svg) | ![Functions](badges/project-service/functions.svg) | ![Branches](badges/project-service/branches.svg) |


##  Deployed Live Services

The backend microservices are deployed on Render:

| Service | Environment / Type | Live URL |
| :--- | :--- | :--- |
| **Auth Service** | Backend API | [https://auth-service-hl52.onrender.com](https://auth-service-hl52.onrender.com) |
| **Dashboard Service** | Backend API | [https://dashboard-service-bpc5.onrender.com](https://dashboard-service-bpc5.onrender.com) |
| **Project Service** | Backend API | [https://project-service-96ml.onrender.com](https://project-service-96ml.onrender.com) |
| **Profile Service** | Backend API | [https://profile-service-0zk7.onrender.com](https://profile-service-0zk7.onrender.com) |


test: https://digital-logbook-hlulani.onrender.com






# Backend

```markdown
# Codacaine - Digital Logbook

A microservices-based digital logbook app built with React (frontend) and Node.js/Express (backend services), using Supabase for auth and database.

## Architecture

This is a monorepo containing independent backend services and a React frontend. Each service runs as its own process on its own port.

```
codacaine/
├── frontend/                  # React app (Vite)
│   └── src/
├── services/
│   ├── auth-service/          # Handles login/signup via Supabase Auth
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   ├── dashboard-service/     # Cross-project summaries (dashboard only)
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   └── project-service/       # Project entries, timeline, search, stats
│       ├── index.js
│       ├── package.json
│       └── .env
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js (LTS) and npm
- A Supabase project (URL + API key)
- Git

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
cd ..\..
```

### 3. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

## Environment Variables

Each backend service needs its own `.env` file in its root folder. These are not pushed to Gitea (listed in `.gitignore`) since they contain secret keys, so every teammate must create their own locally.

Create a `.env` file inside each service folder:

- `services/auth-service/.env`
- `services/dashboard-service/.env`
- `services/project-service/.env`

Each file should contain:

```
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=your_supabase_key
PORT=4001
```

Use the same `SUPABASE_URL` and `SUPABASE_KEY` across all three services (shared database), but give each service a different `PORT`:

| Service | Port |
|---|---|
| auth-service | 4001 |
| dashboard-service | 4002 |
| project-service | 4003 |

Get the Supabase URL and key from the team lead or Supabase project settings — do not commit these values to the repo.

## Running the Project

Run each service in its own terminal:

```powershell
cd services\auth-service
node index.js
```

```powershell
cd services\dashboard-service
node index.js
```

```powershell
cd services\project-service
node index.js
```

Run the frontend:

```powershell
cd frontend
npm run dev
```

# Digital Logbook — Frontend

A modern, premium frontend for the **Digital Logbook** application built as part of the **COMS3011A Project 7** (University of the Witwatersrand). This frontend handles user authentication, profile management, and dashboard functionality using React and Supabase.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 19 + TypeScript** | UI framework with type safety |
| **Vite 6** | Build tool and dev server |
| **React Router v7** | Client-side routing |
| **Supabase** | Authentication (Google & GitHub OAuth, email/password, magic links) |
| **CSS (custom)** | Premium glassmorphism UI (no Tailwind dependency) |

---

## Features

### 1. Sign-In Page (`/signin`)

**What it does:** Provides a clean, secure entry point for users to authenticate using their Google or GitHub accounts.

**Why:** The project specification requires users to sign up and sign in using established authentication libraries. OAuth eliminates the need for users to remember passwords and leverages trusted identity providers.

**Key details:**
- **Google OAuth** — one-click sign-in/sign-up via Google accounts
- **GitHub OAuth** — alternative provider for developer-friendly authentication
- **Email / Password** — traditional sign-in and sign-up; supports the password reset flow end-to-end
- **Account restore prompt** — soft-deleted accounts (in the 30-day grace period) see a restore prompt on sign-in with a secure email confirmation link
- **"Forgot password?" link** — accessible entry point to the password reset flow
- Split-screen video background with glassmorphism card design
- OAuth accounts are created automatically on first sign-in (no separate sign-up step)

### 2. OAuth Callback Handler (`/auth/callback`)

**What it does:** Handles the redirect from Google/GitHub after authentication, exchanges the authorization code for a Supabase session, and redirects the user to the dashboard.

**Why:** OAuth flows require a callback URL to complete authentication. This handler ensures a seamless transition from the identity provider back to the application.

### 3. Dashboard (`/dashboard`)

**What it does:** The main authenticated landing page showing a personalized greeting, stats overview, and quick actions.

**Why:** Provides users with an immediate overview of their logbook activity and fast access to common actions.

**Key details:**
- **Smart greeting** — displays "Welcome" for first-time users and "Welcome back" for returning users, tracked per-user in `localStorage`
- **Stats cards** — Total Entries, This Week, and Projects with animated entrance and hover effects
- **Quick actions** — New Entry, View All Entries, Export Data buttons
- **Gradient text** on the greeting heading for visual impact

### 4. Profile Menu (Avatar Dropdown)

**What it does:** Clicking the user's avatar/name in the navbar opens a dropdown menu with quick access to profile management, settings, and sign-out.

**Why:** Keeps the navbar clean while providing instant access to account management without navigating away from the current page.

**Key details:**
- Shows user's name and email at the top
- **Manage Profile** — opens the Profile tab in the settings panel
- **Settings** — opens the Preferences tab
- **Sign Out** — securely ends the session
- Closes on outside click or Escape key

### 5. Settings Panel (Slide-Out)

**What it does:** A full-featured slide-out panel from the right side of the screen with three tabs for managing the user's account and preferences.

**Why:** Allows users to personalise their logbook experience without leaving the dashboard, making the app easier to use over time.

#### Profile Tab
- **Preferred Name** — customise how the app greets you (overrides the Google/GitHub name on the dashboard)
- **Role** — Student, Lecturer, Tutor, or Professional
- **Student Number** — for Wits student identification
- **Bio / Notes** — private notes visible only to the user

#### Preferences Tab
- **Default View** — choose where you land after sign-in (Dashboard, Entries, Projects, Calendar)
- **Week Starts On** — Monday, Sunday, or Saturday
- **Time Format** — 24-hour or 12-hour clock
- **Auto-save entries** — toggle automatic draft saving
- **Compact mode** — tighter layout to see more data at once
- **Email notifications** — toggle account update emails
- **Weekly log reminder** — toggle Friday nudges to log hours

#### Account Tab
- **Account information** — email and sign-in method (Google/GitHub/email)
- **Password reset** — send a reset link to your email (sets up email-based auth alongside OAuth)
- **Danger Zone** — schedule account deletion (starts a 30-day grace period); restore is handled via the sign-in page email-link flow

### 6. Reset Password Flow (`/reset-password`)

**What it does:** Allows users to request a password reset link via email.

**Why:** The project specification requires password reset functionality. This serves users who need email-based authentication alongside their OAuth provider.

**Key details:**
- Accessible from the sign-in page ("Forgot password?") and the Settings panel Account tab
- Reset link expires in 1 hour
- Success confirmation shows which email received the link

### 7. Update Password (`/auth/update-password`)

**What it does:** After clicking a reset link, users set a new password with real-time feedback.

**Why:** Provides a secure, user-friendly password update experience with visual guidance.

**Key details:**
- **Password strength meter** — 4-bar indicator (Weak → Fair → Good → Strong) with colour coding
- **Live validation** — real-time "Passwords do not match" / "Passwords match" indicators
- Submit button disables until passwords match and meet minimum length
- Redirects to dashboard on success

### 8. Protected Routes

**What it does:** Ensures only authenticated users can access the dashboard. Unauthenticated users are redirected to the sign-in page.

**Why:** Prevents unauthorised access to protected resources.

### 9. Delete Account

**What it does:** Schedules the user's account for deletion and starts a 30-day grace period. During the grace period, the user can sign back in and restore the account via a secure email confirmation link. After 30 days, the account and all associated data are permanently purged by a scheduled Supabase RPC function.

**Why:** The project specification requires account deletion capability. The grace period gives users a chance to recover accidentally deleted accounts, and the email confirmation step protects against unauthorized restoration.

**Key details:**
- Clicking **"Delete Account"** immediately signs the user out
- Attempting to sign in during the grace period shows a restore prompt instead of logging the user in
- Restoring requires clicking a confirmation link sent to the account email
- Data is hard-deleted only after the 30-day window expires

---

## UI Design Philosophy

- **Glassmorphism** — frosted-glass cards with backdrop blur on a deep dark background
- **Animated gradient orbs** — floating background elements for visual depth
- **Staggered animations** — content enters with sequential fade-in-up transitions
- **Gradient accents** — indigo-to-purple gradients on the logo, buttons, and greeting text
- **Responsive** — works on mobile (full-width panels) and desktop
- **Custom favicon** — SVG-based "DL" badge matching the brand colour

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project with Google and GitHub OAuth providers enabled

### Setup

```bash
cd frontend
cp .env.example .env
# Fill in your credentials in .env
npm install
npm run dev
```

### Environment Variables

See `.env.example` for all required variables:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anonymous key
- `VITE_AUTH_SERVICE_URL` — auth microservice URL
- `VITE_DASHBOARD_SERVICE_URL` — dashboard microservice URL
- `VITE_PROJECT_SERVICE_URL` — project microservice URL

### Supabase Configuration

1. Enable **Google** provider: Authentication → Providers → Google (paste Client ID + Secret)
2. Enable **GitHub** provider: Authentication → Providers → GitHub (paste Client ID + Secret)
3. Set **Site URL** to `http://localhost:3000`
4. Add `http://localhost:3000/**` to **Redirect URLs**
5. Run `supabase/setup.sql` to create the `delete_user()`, `restore_user()`, and `purge_deleted_users()` RPC functions

---

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ProfileMenu.tsx      # Avatar dropdown menu
│   │   ├── ProtectedRoute.tsx   # Route guard component
│   │   └── SettingsPanel.tsx    # Slide-out settings panel
│   ├── context/
│   │   └── AuthContext.tsx      # Auth state management
│   ├── lib/
│   │   ├── api.ts               # Backend API helper
│   │   └── supabase.ts          # Supabase client
│   ├── pages/
│   │   ├── AuthCallback.tsx     # OAuth redirect handler
│   │   ├── AuthRestore.tsx      # Email-link account restoration
│   │   ├── Dashboard.tsx        # Main dashboard
│   │   ├── ResetPassword.tsx    # Reset password request
│   │   ├── SignIn.tsx           # Sign-in page
│   │   └── UpdatePassword.tsx   # Set new password
│   ├── App.tsx                  # Router setup
│   ├── index.css                # Premium UI styles
│   └── main.tsx                 # App entry point
├── .env.example                 # Environment template
├── index.html                   # HTML entry
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts             # Test configuration
```




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

The [`.gitea/workflows/ci.yml`](.gitea/workflows/ci.yml) pipeline runs lint, build, and tests for the frontend and all four services on every push and pull request. The [`.gitea/workflows/test.yml`](.gitea/workflows/test.yml) pipeline generates coverage badges and commits them to the `badges/` directory on `main`.

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

## Rule: Dashboard vs Project Data








## Architecture Boundary

**Frontend owns UI and auth orchestration.** It uses Supabase Auth directly for sign-in, sign-up, OAuth, password reset, and account restoration. It never:
- Holds database credentials or service-specific secrets
- Contains backend business logic (validation, data shaping, access rules)
- Directly queries the database outside of Supabase Auth RPC calls

**Backend owns all data access.** If the frontend needs new data or a new
capability, the fix is always in `services/`:
- Missing endpoint → add a new route + service function in Express
- Wrong response shape → change the service function, not the frontend
- New feature needing data → build it as a backend service first, then
  call it from the frontend like everything else

If you're editing frontend code and find yourself reaching for a database
client, a service secret, or writing a query — stop, that logic belongs
in `services/`.


## Before Pushing to `main`

1. `git pull origin main` — get the latest changes
2. Run the app locally and confirm it builds/runs without errors
3. Only then push

Never push straight to `main` without pulling and testing first.

- Project entries and their statistics stay scoped to that project (`project-service`).
- The dashboard (`dashboard-service`) only shows cross-project summaries — it does not read individual entry tables directly.
```