---
marp: true
theme: default
paginate: true
backgroundColor: #0f172a
color: #f8fafc
style: |
  section {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
  }
  h1 {
    color: #818cf8;
    font-weight: 700;
    margin-bottom: 0.5em;
  }
  h2 {
    color: #c084fc;
    font-weight: 600;
  }
  strong {
    color: #a5b4fc;
  }
  table {
    font-size: 0.85em;
  }
  th {
    background: rgba(99, 102, 241, 0.2);
    color: #c084fc;
  }
  td {
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  code {
    background: rgba(255,255,255,0.1);
    color: #f472b6;
    padding: 0.1em 0.3em;
    border-radius: 0.25em;
  }
  blockquote {
    border-left: 4px solid #6366f1;
    background: rgba(99, 102, 241, 0.1);
    padding: 0.75em 1em;
    color: #e2e8f0;
  }
---

<!-- _class: lead -->

# Authentication & Profile Management

## Sprint 1 Presentation

**Team Codacaine** — Nasiphi Ntontela

COMS3011A Project 7

---

# What we were asked to deliver

From the Sprint 1 backlog and project brief:

- Secure **sign-in / sign-up**
- Multiple **authentication providers**
- **Password reset** capability
- **Protected routes**
- **User profile** management
- **Account deletion**

---

# Authentication providers

| Provider             | Flow                                           |
| -------------------- | ---------------------------------------------- |
| **Google OAuth**     | One-click sign-in; account auto-created        |
| **GitHub OAuth**     | One-click sign-in; account auto-created        |
| **Email / Password** | Sign-up → confirmation email → sign-in         |
| **Magic link**       | Used for account restoration after soft delete |

**Tech stack:** Supabase Auth + Brevo SMTP

---

# Sign-in UX

- Split-screen design with video showcase
- Glassmorphism cards on dark background
- OAuth buttons + email/password form
- Smart post-auth routing:
  - **New user** → `/create-profile`
  - **Returning user** → `/dashboard`

---

# Email confirmation flow

1. User enters email + password
2. Supabase creates the account
3. **Brevo SMTP** sends confirmation email
4. User clicks the confirmation link
5. Account activated → user can sign in

> We fixed an early issue where confirmation emails were not sending because custom SMTP was not enabled in Supabase.

---

# Password reset flow

1. User clicks **"Forgot password?"**
2. Enters their email
3. Receives reset link (**1-hour expiry**)
4. Clicks link → `/auth/update-password`
5. Sets new password with **strength meter**
6. Redirected to dashboard on success

---

# Protected routes

- `ProtectedRoute.tsx` guards authenticated pages
- Unauthenticated users are redirected to `/signin`
- Session managed globally via `AuthContext.tsx`
- Auth state persists across reloads

---

# Profile menu & settings

**Avatar dropdown gives quick access to:**

- Name / email display
- Manage Profile
- Settings
- Sign out

**Settings panel has three tabs:**

1. **Profile** — preferred name, role, student number, bio
2. **Preferences** — default view, week start, time format, auto-save, compact mode, notifications
3. **Account** — email, sign-in method, password reset, delete account

---

# Account deletion & restoration

- User clicks **"Delete Account"** in Settings
- Account is **soft-deleted**
- **30-day grace period** begins
- User is **signed out immediately**
- During grace period, sign-in shows a **restore prompt**
- Restore requires clicking a confirmation link sent to the account email
- After 30 days, a scheduled Supabase function **permanently purges** the account

---

# Architecture & code quality

| Layer           | Technology                   |
| --------------- | ---------------------------- |
| Frontend        | React 19 + TypeScript + Vite |
| Auth            | Supabase Auth                |
| Backend service | `auth-service` (Express)     |
| SMTP            | Brevo                        |

**Tests added in Sprint 1:**

- `auth-service` routes — Jest + Supertest
- `AuthContext` — Vitest + React Testing Library

**CI/CD:**

- Gitea Actions runs lint, build, and tests on every push
- Coverage badges auto-generated

---

# Live demo

1. Show the sign-in page design
2. Sign in with email/password or OAuth
3. Show the dashboard greeting
4. Open profile menu → Settings
5. Walk through Profile, Preferences, and Account tabs
6. Mention password reset and account-deletion grace period

---

<!-- _class: lead -->

# Questions?

## Thank you

**Digital Logbook — Team Codacaine**
