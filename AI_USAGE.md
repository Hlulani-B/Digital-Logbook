# AI Usage README — Digital Logbook

This repository uses AI-assisted development for the frontend authentication module and related UI features. This file summarises how AI was used and points to the detailed declaration.

---

## Quick Reference

| Item                        | Location                                                                |
| --------------------------- | ----------------------------------------------------------------------- |
| **Detailed AI declaration** | [`frontend/AI_DECLARATION.md`](frontend/AI_DECLARATION.md)              |
| **Student**                 | Nasiphi Ntontela (2673619)                                              |
| **AI tool**                 | Qoder (AI Coding Assistant for VS Code)                                 |
| **Scope of AI use**         | Frontend authentication, profile/settings UI, Supabase auth integration |

---

## What Was Built with AI Assistance

The following frontend features were implemented with AI acting as a code-generation and technical-guidance tool under the student's direct supervision:

- **Authentication flows**
  - Google and GitHub OAuth sign-in
  - Email/password sign-in and sign-up
  - Password reset and update-password flows
  - Account deletion with a 30-day grace period and restore capability
  - Restore via secure email confirmation link on the sign-in page
  - Auto-redirect of soft-deleted users to the sign-in restore prompt
  - Email format and disposable-domain validation on sign-up and sign-in
  - Email typo detection with a "Did you mean?" suggestion
  - Automatic sign-out after 30 minutes of inactivity
- **UI components**
  - Sign-in page with split-screen video background and account-restore prompt
  - Dedicated `/auth/restore` page for email-link restoration
  - Dashboard with personalised greeting and stats
  - Profile menu, settings panel (Profile / Preferences / Account)
  - Protected routes
  - Calendar page with month/week views, drag-to-reschedule, and overdue/completed visual indicators
  - Kanban board with status columns, drag-to-change-status, project/search filters, and optimistic update with revert on failure
  - Today view with deliberate ordering (overdue → due today → in progress) and empty state
  - Timeline view with horizontal bars, dependency arrows, zoom/scroll, and empty state
- **Supabase integration**
  - Auth context and client setup
  - RPC functions for account scheduling/restoration/purging (`delete_user`, `restore_user`, `purge_deleted_users`)
- **Experiments (not in final UI)**
  - Interactive particle field login background
  - Flowing aurora ribbons login background
  - Both were reverted in favour of the original video background

---

## Important Configuration Changes

### Email Provider: Resend → Brevo

The project initially used **Resend** for SMTP email delivery (account confirmation and password reset emails). This was later switched to **Brevo** because Resend logs showed no email activity and emails were not being delivered.

Current setup:

- **Provider:** Brevo SMTP
- **Host:** `smtp-relay.brevo.com`
- **Port:** `587`
- **Use case:** Supabase transactional emails (sign-up confirmation, password reset)

> See the detailed setup instructions in [`frontend/README.md`](frontend/README.md#brevo-smtp-email-delivery).

### CAPTCHA Removal

Cloudflare Turnstile was originally integrated into the sign-in, sign-up, and password-reset flows. It was later removed from the auth UI and method signatures at the student's request.

---

## Human Oversight

All AI-generated code was reviewed, tested manually in the browser, and deployed under the student's control. The student made every product, design, and configuration decision, including:

- Choosing Supabase for authentication
- Selecting Google and GitHub as OAuth providers
- Choosing Brevo over Resend for SMTP
- Directing the UI redesign and feature scope
- Deciding when to push code and merge branches

---

## Full Declaration

For the complete AI usage declaration — including the full file list, debugging history, and responsibility statement — see [`frontend/AI_DECLARATION.md`](frontend/AI_DECLARATION.md).
