# Digital Logbook — Frontend

A modern, premium frontend for the **Digital Logbook** application built as part of the **COMS3011A Project 7** (University of the Witwatersrand). This frontend handles user authentication, profile management, and dashboard functionality using React and Supabase.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **React 19 + TypeScript** | UI framework with type safety |
| **Vite 6** | Build tool and dev server |
| **React Router v7** | Client-side routing |
| **Supabase** | Authentication (Google OAuth, GitHub OAuth, Email/Password, magic links) |
| **Brevo** | SMTP email delivery (confirmation, reset, and restore emails) |
| **CSS (custom)** | Premium glassmorphism UI (no Tailwind dependency) |

---

## Features

### 1. Sign-In Page (`/signin`)

**What it does:** Provides a clean, secure entry point for users to authenticate using Google OAuth, GitHub OAuth, or email/password.

**Why:** The project specification requires users to sign up and sign in using established authentication libraries. Multiple providers give users flexibility while email/password supports the password reset flow end-to-end.

**Layout:**
- **Split-screen design** — left panel shows a looping video showcase of the app; right panel contains the sign-in/sign-up form
- **Video background** — two videos alternate seamlessly for a continuous loop effect
- **Post-auth routing** — after sign-in, the app checks if the user has a profile; new users are routed to `/create-profile`, returning users to `/dashboard`
- **Account restore prompt** — soft-deleted accounts (in the 30-day grace period) see a restore prompt with a secure email confirmation link instead of being logged in

**Three Authentication Methods:**

| Method | Flow | Notes |
|---|---|---|
| **Google OAuth** | One-click sign-in via Google accounts | Account created automatically on first sign-in; no separate sign-up step |
| **GitHub OAuth** | One-click sign-in via GitHub accounts | Same as Google — instant account creation |
| **Email / Password** | Sign-up with confirmation email → sign in with credentials | Supports full password reset flow |

**How Email/Password Works (End-to-End):**
1. User clicks "Create one" to switch to sign-up mode
2. Enters email, password, and confirm password (must match)
3. Clicks "Create Account" — Supabase creates the user and sends a confirmation email via Brevo SMTP
4. User clicks the confirmation link in the email
5. Returns to the sign-in page, enters email and password
6. Clicks "Sign In"
7. App checks if user profile exists → routes to dashboard or create-profile page

**Password Reset Flow:**
1. User clicks "Forgot password?" on the sign-in page
2. Enters their email
3. Receives a reset link via email (expires in 1 hour)
4. Clicks the link → sets a new password with strength meter feedback
5. Redirected to dashboard on success

**Important edge cases:**
- If an email is already registered (e.g., from a previous Google OAuth sign-in), Supabase returns success silently but does not send a duplicate confirmation email. The user should use "Forgot password?" to set a password for that account.
- OAuth users who want email/password access can use the password reset flow to link both methods.

**Key details:**
- **Confirm password field** — appears only in sign-up mode to prevent typos
- **"Forgot password?" link** — accessible entry point to the password reset flow
- **Account restore flow** — soft-deleted accounts are blocked from signing in until they confirm restoration via a magic link sent to their email

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

- **Split-screen sign-in** — video showcase on the left, form on the right for a modern, immersive first impression
- **Glassmorphism** — frosted-glass cards with backdrop blur on a deep dark background
- **Animated gradient orbs** — floating background elements for visual depth
- **Staggered animations** — content enters with sequential fade-in-up transitions
- **Gradient accents** — indigo-to-purple gradients on the logo, buttons, and greeting text
- **Theme support** — dark and light mode with automatic UI adaptation
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

### Running Tests

```bash
npm test              # run Vitest once
npm run test:watch    # run Vitest in watch mode
npm run test:coverage # run with coverage report
```

Tests live next to the code they cover, e.g. [`src/context/__tests__/AuthContext.test.tsx`](src/context/__tests__/AuthContext.test.tsx).

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
6. **Enable email confirmations:** Authentication → Sign In / Providers → Confirm email → ON
7. **Configure SMTP:** Authentication → Emails → SMTP Settings → enable custom SMTP with Brevo credentials

### External Services Configuration

#### Google Cloud Console (OAuth)
Google OAuth is required for the Google sign-in button. Configure it before enabling the Google provider in Supabase.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (or use an existing one)
2. Navigate to **APIs & Services → Credentials**
3. Click **Create Credentials → OAuth Client ID**
4. Application type: **Web application**
5. Under **Authorised JavaScript origins**, add:
   - `http://localhost:3000`
   - `https://<your-supabase-project-ref>.supabase.co`
6. Under **Authorised redirect URIs**, add:
   - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**
8. Paste them into **Supabase → Authentication → Providers → Google**

#### Brevo SMTP (Email Delivery)
Brevo sends transactional emails on behalf of Supabase: account confirmation emails on sign-up and password reset links.

1. Create a [Brevo account](https://app.brevo.com/) (free tier: 300 emails/day)
2. Go to **SMTP & API → SMTP** tab
3. Note your SMTP credentials:
   - **Server:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Login:** your Brevo SMTP login (e.g. `ab9b48001@smtp-brevo.com`)
4. Click **Activate for SMTP keys** (if prompted)
5. Create a new SMTP key and copy the full value
6. Go to **Senders & IPs → Senders** and add a verified sender:
   - Add your sender email (e.g. `yourname@gmail.com`)
   - Sender name: `Digital Logbook`
   - Verify the email by clicking the confirmation link Brevo sends you
7. Configure Supabase SMTP:
   - Go to **Supabase → Authentication → Emails → SMTP Settings**
   - **Enable custom SMTP:** ON
   - **Sender email:** your verified Brevo sender email
   - **Sender name:** `Digital Logbook`
   - **Host:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Username:** your Brevo SMTP login
   - **Password:** the full SMTP key value
   - Click **Save changes**

> **Tip:** If Brevo transactional logs are empty after sign-up, verify that "Enable custom SMTP" is actually toggled ON and that "Confirm email" is enabled under Sign In / Providers.

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
│   │   ├── AuthContext.tsx      # Auth state management
│   │   └── __tests__/           # AuthContext unit tests
│   ├── functions/
│   │   └── profile/
│   │       └── login.js         # checkUser helper for post-auth routing
│   ├── hooks/
│   │   └── useTheme.ts         # Dark/light theme hook
│   ├── lib/
│   │   ├── api.ts               # Backend API helper
│   │   └── supabase.ts          # Supabase client
│   ├── pages/
│   │   ├── AuthCallback.tsx     # OAuth redirect handler
│   │   ├── AuthRestore.tsx      # Email-link account restoration
│   │   ├── Dashboard.tsx        # Main dashboard
│   │   ├── ResetPassword.tsx    # Reset password request
│   │   ├── SignIn.tsx           # Sign-in page (split layout)
│   │   └── UpdatePassword.tsx   # Set new password
│   ├── App.tsx                  # Router setup
│   ├── index.css                # Premium UI styles
│   └── main.tsx                 # App entry point
├── .env.example                 # Environment template
├── index.html                   # HTML entry
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts             # Test configuration
└── src/test/setup.ts            # Test setup (matchMedia mock, jest-dom)
```

---

## Troubles Encountered

### 1. Email Confirmation Emails Not Sending
**Problem:** After sign-up, no confirmation email arrived. Resend (initial SMTP provider) logs were completely empty.
**Root cause:** Supabase's custom SMTP was not being used because either the "Enable custom SMTP" toggle was off, or the SMTP credentials were misconfigured.
**Fix:** Switched to Brevo as the SMTP provider. Configured Supabase SMTP settings with Brevo credentials (`smtp-relay.brevo.com`, port 587, username `ab9b48001@smtp-brevo.com`, and the Brevo SMTP key as password). Verified the sender email in Brevo before configuring Supabase.

### 2. Existing Users Not Receiving Confirmation Emails
**Problem:** After fixing SMTP, sign-up returned "Account created!" success but no email was sent for previously-used email addresses.
**Root cause:** Supabase's `signUp` endpoint returns HTTP 200 for already-registered emails (security measure to prevent email enumeration), but silently skips sending the confirmation email.
**Fix:** Delete the old user from Supabase → Authentication → Users and sign up fresh, or use "Forgot password?" to set a password for existing accounts.

### 3. Vite Config Precedence Issue
**Problem:** The `@/` path alias was not resolving, causing module not found errors.
**Root cause:** A duplicate `vite.config.js` existed alongside `vite.config.ts`. Vite loads `.js` before `.ts`, so the alias configuration in `.ts` was ignored.
**Fix:** Deleted the duplicate `vite.config.js` so Vite uses `vite.config.ts` with the correct path alias.

### 4. Duplicate Files After Git Merge
**Problem:** After merging the Authentication branch into main (which had unrelated histories), duplicate files (`App.jsx`, `main.jsx`) were left behind, causing Vite to resolve the wrong entry points.
**Fix:** Deleted the duplicate `.jsx` files and kept the `.tsx` versions from the Authentication branch.

---

## AI Usage Declaration

This frontend was developed with significant AI assistance using **Qoder** (an AI coding assistant integrated with VS Code). A full AI usage declaration is available in [`AI_DECLARATION.md`](./AI_DECLARATION.md).

**Summary of AI involvement:**
- **Human-directed:** All feature requirements, design decisions, authentication provider choices, and deployment strategy were decided by the student (Nasiphi Ntontela)
- **AI-assisted:** Code generation, UI styling, debugging guidance, and configuration instructions were provided by the AI under the student's direct supervision
- **Human-configured:** All external services (Supabase OAuth, Google Cloud Console, Brevo SMTP, Gitea) were configured manually by the student
- **Human-tested:** All features were manually tested in the browser after each change

The AI accelerated implementation but did not independently make product, design, or architectural decisions.
