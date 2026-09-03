# AI Usage Declaration — COMS3011A Project 7

## Student Details

| Field              | Value                                     |
| ------------------ | ----------------------------------------- |
| **Name**           | Nasiphi Ntontela                          |
| **Student Number** | 2673619                                   |
| **Project**        | Codacaine — Digital Logbook               |
| **Date**           | 13 August 2026 (updated 3 September 2026) |

---

## AI Tool Used

| Field                | Value                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| **Tool**             | Qoder (AI Coding Assistant integrated with VS Code)                           |
| **Underlying Model** | Not disclosed by the tool                                                     |
| **Access Method**    | VS Code extension (Qoder IDE)                                                 |
| **Session Duration** | 12–13 August 2026, continued 20–23 August 2026 (extended multi-turn sessions) |

---

## Declaration

I, Nasiphi Ntontela, declare that the following AI tool was used to assist in the development of the Digital Logbook frontend authentication module for COMS3011A Project 7. I am solely responsible for this component, and all decisions regarding features, design, authentication providers, and implementation approach were taken by me. This document outlines how the AI was used, what was generated, and the extent of my oversight and direction throughout the process.

---

## How the AI Was Used

### 1. Direction and Requirements (Human-Driven)

I am the sole person responsible for the frontend authentication work. All feature requirements and design decisions were directed by me:

- I provided the project specification (PDF) outlining COMS3011A Project 7 requirements
- I shared the existing Codacaine team repository structure (backend microservices on Render, Supabase database)
- I specified that authentication should use Supabase with Google OAuth
- I requested GitHub be added as a second OAuth provider
- I requested email/password sign-in and sign-up be added to support the password reset flow
- I requested Cloudflare Turnstile CAPTCHA be integrated, and later requested it be removed from the login/auth flow
- I directed the UI redesign ("make it look like a million bucks")
- I requested the avatar-based profile menu and settings panel
- I requested the profile details be displayed in a clean, non-code-like card
- I requested the User ID be hidden from the Account tab
- I requested a 30-day account deletion grace period with restore capability
- I requested dynamic login page concepts (particle field, aurora ribbons) and ultimately chose to revert to the original video background
- I identified the "Welcome back" bug for new users
- I requested that scheduling deletion sign the user out immediately and that restoration require a secure email confirmation link
- I directed the removal of the in-dashboard "Restore Account" button so restore only happens from the sign-in page
- I requested email format and disposable-domain validation before sign-up/sign-in submission
- I requested email typo detection (for example, catching gmail.comm and suggesting gmail.com)
- I requested automatic sign-out after a period of inactivity so sessions do not stay open indefinitely
- I provided all Supabase credentials, Turnstile site keys, and Gitea repository URLs
- I decided the branch strategy (Authentication branch) and deployment approach

### 2. Code Generation (AI-Assisted)

The AI generated the following code based on my instructions:

| File                                                        | Description                                                                          | AI Contribution                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- |
| `src/pages/SignIn.tsx`                                      | Sign-in page with Google/GitHub OAuth, email/password, and original video background | AI generated from my requirements     |
| `src/pages/Dashboard.tsx`                                   | Dashboard with stats, greeting, quick actions                                        | AI generated from my requirements     |
| `src/pages/AuthCallback.tsx`                                | OAuth redirect handler                                                               | AI generated                          |
| `src/pages/ResetPassword.tsx`                               | Password reset request page                                                          | AI generated                          |
| `src/pages/UpdatePassword.tsx`                              | New password form with strength meter                                                | AI generated                          |
| `src/pages/AuthRestore.tsx`                                 | Email-link account restoration handler                                               | AI generated                          |
| `src/components/ProfileMenu.tsx`                            | Avatar dropdown menu                                                                 | AI generated from my requirements     |
| `src/components/SettingsPanel.tsx`                          | Slide-out settings panel (3 tabs)                                                    | AI generated from my requirements     |
| `src/components/ProtectedRoute.tsx`                         | Route guard for authenticated pages                                                  | AI generated                          |
| `src/components/ParticleField.tsx`                          | Interactive particle field login background concept                                  | AI generated from my direction        |
| `src/components/AuroraRibbons.tsx`                          | Flowing aurora ribbons login background concept                                      | AI generated from my direction        |
| `src/context/AuthContext.tsx`                               | Auth state management + Supabase integration                                         | AI generated                          |
| `src/lib/supabase.ts`                                       | Supabase client initialisation with `getSupabase()` helper                           | AI generated                          |
| `src/lib/api.ts`                                            | Backend API helper with auth token                                                   | AI generated                          |
| `src/lib/validation.ts`                                     | Email format, disposable-domain, and typo-correction helpers                         | AI generated from my requirements     |
| `src/hooks/useInactivityLogout.ts`                          | Automatic sign-out after user inactivity                                             | AI generated from my requirements     |
| `src/App.tsx`                                               | Router configuration with all routes                                                 | AI generated                          |
| `src/index.css`                                             | Complete premium UI stylesheet                                                       | AI generated from my design direction |
| `index.html`                                                | HTML entry with favicon and meta tags                                                | AI generated                          |
| `supabase/setup.sql`                                        | SQL for delete_user/restore_user/purge_deleted_users RPC functions                   | AI generated                          |
| `supabase/migrations/004_account_deletion_grace_period.sql` | Migration for 30-day deletion grace period                                           | AI generated                          |
| `.env.example`                                              | Environment variable template                                                        | AI generated                          |

### 3. Configuration and DevOps (AI-Executed Under My Direction)

I made all configuration decisions and directed the AI to execute the following:

- **Supabase OAuth setup**: I decided to use Google and GitHub OAuth; AI provided step-by-step instructions and I performed the configuration in the Supabase dashboard
- **Google Cloud Console**: I decided the redirect URIs; AI provided the correct values and I entered them manually
- **Cloudflare Turnstile**: I decided to integrate CAPTCHA; AI guided the widget setup and I created the widget and provided the site key. I later directed the AI to remove Turnstile from the auth UI and method signatures
- **SMTP email provider**: I initially decided to use Resend, then switched to **Brevo** for auth emails. I configured the integration in both Brevo and Supabase
- **Gitea push**: I directed the branch strategy; AI initialised the git repo, created the .gitignore, and executed the push under my supervision
- **Branch management**: I decided to use the Authentication branch; AI created it and cleaned up the erroneous master push

### 4. Debugging and Fixes (Collaborative)

| Issue                                                           | Who Identified                   | Who Fixed                                                                  |
| --------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| "Welcome back" showing for new users                            | Me (student)                     | AI (changed from useEffect to useMemo for synchronous check)               |
| Supabase permissions (couldn't edit redirect URLs)              | Me (student)                     | AI (advised asking project admin or creating own Supabase project)         |
| Google Cloud Console redirect URIs                              | Me (student, asked)              | AI (provided correct values)                                               |
| GitHub provider addition                                        | Me (student, requested)          | AI (added signInWithGitHub to AuthContext and SignIn page)                 |
| Email/password auth addition                                    | Me (student, requested)          | AI (added signInWithEmail and signUpWithEmail forms to SignIn page)        |
| Reset password inaccessible from UI                             | Me (student, identified)         | AI (added "Trouble signing in?" link and settings panel option)            |
| Profile details displayed as raw JSON/code                      | Me (student)                     | AI (redesigned into a clean profile summary card)                          |
| User ID visible in Account tab                                  | Me (student)                     | AI (removed the User ID row)                                               |
| Account deletion had no grace period                            | Me (student, requested)          | AI (implemented 30-day grace period with schedule/restore/purge)           |
| Ambiguous `user_email` in `delete_user()` RPC                   | Me (student, observed 400 error) | AI (renamed variable to `v_email`, qualified column references)            |
| Soft-deleted users could not sign back in cleanly               | Me (student, requested)          | AI (added auto-restore on sign-in in SignIn.tsx)                           |
| Soft-deleted users remained signed in after scheduling deletion | Me (student, identified)         | AI (changed `deleteAccount` to sign out, moved restore to email-link flow) |
| Invalid and disposable email addresses accepted on sign-up      | Me (student, requested)          | AI (added `validation.ts` helpers and integrated them into `SignIn.tsx`)   |
| Typos in common email domains (e.g., gmail.comm)                | Me (student, requested)          | AI (added `suggestEmailCorrection` and a clickable hint in `SignIn.tsx`)   |
| Sessions remained signed in indefinitely on shared devices      | Me (student, requested)          | AI (added `useInactivityLogout` with 30-minute timeout)                    |

---

## What Was NOT AI-Generated

The following were entirely human-directed and not generated by AI:

- **Project requirements and specification** — provided by the university (COMS3011A Project 7 PDF)
- **Team architecture decisions** — the microservices backend (auth, dashboard, project services) was built by the Codacaine team independently
- **Supabase database schema** — configured by the team; I configured only the frontend authentication-related settings (OAuth providers, SMTP, CAPTCHA)
- **Render deployment** — backend services deployed by the team
- **All credentials and API keys** — provided by me
- **UI preferences and design direction** — all aesthetic choices were directed by me
- **Gitea repository setup** — created by the team on the Wits SDP platform; I pushed the frontend code to the Authentication branch and then merged it into main
- **Testing and validation** — I tested all features manually in the browser

---

## Human Oversight

I am solely responsible for the frontend authentication component of this project. At every stage, I maintained full oversight of the AI-generated code:

1. **Reviewed all generated code** before accepting it
2. **Tested features manually** in the browser after each change
3. **Made all design decisions** — directed the premium UI aesthetic, chose feature scope, and selected all third-party services
4. **Identified bugs and feature gaps** — caught the "Welcome back" greeting issue, missing reset password access, ambiguous `user_email` error, soft-delete restore flow (including the need to sign out immediately after scheduling deletion), lack of email validation on sign-up/sign-in, and sessions remaining open indefinitely on inactive devices
5. **Configured external services** — manually set up Supabase providers, Google Cloud Console, Cloudflare Turnstile, and **Brevo SMTP** (after switching from Resend)
6. **Controlled deployment** — decided when and where to push code, and managed the merge into main myself

---

## Summary

The AI was used as a **code generation and technical guidance tool** under my direct and sole supervision. I am the only person responsible for this frontend authentication work. All architectural decisions, feature requirements, design choices, authentication provider selections, and deployment decisions were made by me. The AI accelerated the implementation of features I specified but did not independently make product, design, or configuration decisions.

---

**Signed:** Nasiphi Ntontela  
**Date:** 3 September 2026
