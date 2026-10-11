# AI Usage README — Digital Logbook

This repository uses AI-assisted development for the frontend authentication module and related UI features. This file summarises how AI was used and points to the detailed declaration.

---

## Quick Reference

| Item                        | Location                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Detailed AI declaration** | [`frontend/AI_DECLARATION.md`](frontend/AI_DECLARATION.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Student**                 | Nasiphi Ntontela (2673619)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **AI tool**                 | Qoder (AI Coding Assistant for VS Code)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Scope of AI use**         | Frontend authentication, profile/settings UI, Supabase auth integration, guided tour & voice narration, Help Centre & bug report form, public landing page, notification system activation & troubleshooting, project pagination & multi-select, automatic email delivery, field display rendering & bug fixes, responsive design, accessibility, CI/CD pipeline documentation, non-monolithic architecture, hand-written API, authentication & security, external API integration, documentation website |

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
  - Import & Export (data portability) with JSON, CSV, Markdown, and iCalendar (.ics) round-trip support
  - Database backup/restore scripts (`npm run db:backup`, `npm run db:restore`) and versioned schema migrations (`npm run db:migrate`, `npm run db:bootstrap`)
  - OpenAPI 3.0 specification (`docs/openapi.yaml`) covering all four microservices, served as browsable Swagger UI at `/api-docs`
  - Mobile-responsive layouts for Calendar (week-strip on phones ≤480px), Kanban, Today, and Timeline views with dedicated phone breakpoints
  - Due-date notification system: hourly pg_cron scan (`generate_due_notifications()`), per-entry due-soon (24h) and overdue email alerts via Brevo API, and an in-app bell feed with unread badge in the dashboard header
  - Timer abandonment notifications: alerts when timers run >2 hours or pause >30 minutes (`generate_timer_abandonment_notifications()`), integrated into the notification cycle
  - Notification pipeline activation: resolved pg_net unavailability by replacing `run_due_notification_cycle()` with a pg_net-free version, applied migration 021 (timer abandonment schema), configured Brevo API key and IP whitelisting in Render dashboard, verified end-to-end email delivery (78 notifications sent)
  - Live password-requirements checklist on sign-up (length, uppercase, lowercase, number, explicit special-character set) with disabled submit until all rules pass
  - Guided tour (driver.js) with element-anchored steps and live navigation between views, friendly voice narration via the Web Speech API with a persisted mute toggle, and auto-advance paced to the narration finishing so speech is never cut off
  - Help Centre (`/help`) with 9 categories, 25 articles, client-side keyword search, category sidebar with emoji icons, keyboard shortcuts (`/` focus, `Esc` clear), theme-aware styling, deep-link URL params, and mobile-responsive layout
  - In-app bug report form modal that sends reports via email to admin@codacaine.com using FormSubmit.co, with auto-captured browser info, success/error states, and mobile bottom-sheet
  - Public landing page at `/` with split hero (typing demo + AI-generated dashboard illustration), interactive About and Feature cards with mouse-following spotlight and 3D tilt effects, animated stats counters, "What's New" ticker, team section, CTA, and footer — warm beige/brown palette matching the sign-in form
  - Sign-in page cleanup: removed duplicated marketing sections (About, About Us, Features) now shown on the landing page, leaving a clean split-screen auth form
  - Project pagination & multi-select: when more than 5 projects exist, show first 3 with "View N more projects" button; select mode with batch archive/delete
  - Automatic email delivery: `node-cron` scheduler in project-service sends pending emails every 15 minutes, replacing the broken `pg_net` poke
  - Field display rendering: type-safe guards against undefined `attachmentId`/`link` values, base64 file string handling, tag/entity-link CSS chip styling, markdown read-more truncation
  - Timer pause/resume/stop fix: `validateEntryDates` now preserves timer columns (`started_at`, `ended_at`, `paused_at`, `paused_ms`) so timer state survives entry updates
  - Responsive design: 8 CSS breakpoints (1200px–380px), `useIsMobile()` hook for viewport detection, dedicated mobile layouts for all views, 44px touch targets, drawer navigation on mobile
  - Accessibility: ARIA labels on interactive controls and charts, keyboard navigation (Escape closes all overlays, `/` focuses search, Space/P timer control), semantic roles (`img`, `region`, `alert`, `status`), focus management on dropdowns and modals, voice-narrated guided tour
  - CI/CD pipeline: 7 Gitea Actions workflows (main CI, backend unit/integration tests, frontend unit/integration tests, keep-alive, branch sync) mirrored on GitHub Actions, plus Render auto-deploy via `render.yaml` infrastructure-as-code (6 services) and docs deployment to GitHub Pages
  - Non-monolithic architecture: 1 React frontend + 4 independent Express microservices (auth, dashboard, project, profile), each independently deployable on Render via `render.yaml`; HTTP-only communication via `fetch()` through `frontend/src/lib/api.ts`; Supabase used for auth and database only
  - Hand-written API: 11+ manually coded route files across 4 services with RPC-style POST dispatch; Supabase never used as an API generator; all data endpoints are hand-implemented Express handlers using `node-postgres` (`pg`)
  - Authentication & security: Supabase Auth (established third-party provider) handles sign up, sign in (Google/GitHub OAuth + email/password), password reset, account deletion with 30-day grace period, session management, RLS; no custom auth code written
  - External API integration: 6 external API providers — Brevo (transactional email), OpenRouter + Gemini + Cerebras + Groq + HuggingFace (5 AI LLM providers), FormSubmit.co (bug reports), Supabase (auth + database); all keys managed via environment variables
  - Documentation website: MkDocs static site deployed on Render + GitHub Pages, publicly accessible at https://digital-logbook-documentation-site.onrender.com, no account required
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
