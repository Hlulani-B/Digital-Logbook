# AI Usage Declaration — COMS3011A Project 7

## Student Details

| Field | Value |
|---|---|
| **Name** | Nasiphi Ntontela |
| **Student Number** | 2673619 |
| **Project** | Codacaine — Digital Logbook |
| **Date** | 13 August 2026 |

---

## AI Tool Used

| Field | Value |
|---|---|
| **Tool** | Qoder (AI Coding Assistant integrated with VS Code) |
| **Underlying Model** | Not disclosed by the tool |
| **Access Method** | VS Code extension (Qoder IDE) |
| **Session Duration** | 12–13 August 2026 (extended multi-turn session) |

---

## Declaration

I, Nasiphi Ntontela, declare that the following AI tool was used to assist in the development of the Digital Logbook frontend for COMS3011A Project 7. This document outlines how the AI was used, what was generated, and the extent of human oversight and direction throughout the process.

---

## How the AI Was Used

### 1. Direction and Requirements (Human-Driven)

All feature requirements and design decisions were directed by me (the student):

- I provided the project specification (PDF) outlining COMS3011A Project 7 requirements
- I shared the existing Codacaine team repository structure (backend microservices on Render, Supabase database)
- I specified that authentication should use Supabase with Google OAuth
- I requested GitHub be added as a second OAuth provider
- I requested email/password sign-in and sign-up be added to support the password reset flow
- I requested Cloudflare Turnstile CAPTCHA be integrated
- I directed the UI redesign ("make it look like a million bucks")
- I requested the avatar-based profile menu and settings panel
- I identified the "Welcome back" bug for new users
- I provided all Supabase credentials, Turnstile site keys, and Gitea repository URLs
- I decided the branch strategy (Authentication branch) and deployment approach

### 2. Code Generation (AI-Assisted)

The AI generated the following code based on my instructions:

| File | Description | AI Contribution |
|---|---|---|
| `src/pages/SignIn.tsx` | Sign-in page with Google/GitHub OAuth, email/password, and CAPTCHA | AI generated from my requirements |
| `src/pages/Dashboard.tsx` | Dashboard with stats, greeting, quick actions | AI generated from my requirements |
| `src/pages/AuthCallback.tsx` | OAuth redirect handler | AI generated |
| `src/pages/ResetPassword.tsx` | Password reset request page | AI generated |
| `src/pages/UpdatePassword.tsx` | New password form with strength meter | AI generated |
| `src/components/ProfileMenu.tsx` | Avatar dropdown menu | AI generated from my requirements |
| `src/components/SettingsPanel.tsx` | Slide-out settings panel (3 tabs) | AI generated from my requirements |
| `src/components/ProtectedRoute.tsx` | Route guard for authenticated pages | AI generated |
| `src/context/AuthContext.tsx` | Auth state management + Supabase integration | AI generated |
| `src/lib/supabase.ts` | Supabase client initialisation | AI generated |
| `src/lib/api.ts` | Backend API helper with auth token | AI generated |
| `src/App.tsx` | Router configuration with all routes | AI generated |
| `src/index.css` | Complete premium UI stylesheet | AI generated from my design direction |
| `index.html` | HTML entry with favicon and meta tags | AI generated |
| `supabase/setup.sql` | SQL for delete_user() RPC function | AI generated |
| `.env.example` | Environment variable template | AI generated |

### 3. Configuration and DevOps (Collaborative)

- **Supabase OAuth setup**: AI provided step-by-step instructions for configuring Google and GitHub providers; I performed the configuration in the Supabase dashboard
- **Google Cloud Console**: AI provided the correct redirect URIs and JavaScript origins; I entered them manually
- **Cloudflare Turnstile**: AI guided the widget setup; I created the widget and provided the site key
- **Gitea push**: AI initialised the git repo, created the .gitignore, and executed the push; I provided credentials interactively
- **Branch management**: AI created the Authentication branch and cleaned up the erroneous master push

### 4. Debugging and Fixes (Collaborative)

| Issue | Who Identified | Who Fixed |
|---|---|---|
| "Welcome back" showing for new users | Me (student) | AI (changed from useEffect to useMemo for synchronous check) |
| Supabase permissions (couldn't edit redirect URLs) | Me (student) | AI (advised asking project admin or creating own Supabase project) |
| Google Cloud Console redirect URIs | Me (student, asked) | AI (provided correct values) |
| GitHub provider addition | Me (student, requested) | AI (added signInWithGitHub to AuthContext and SignIn page) |
| Email/password auth addition | Me (student, requested) | AI (added signInWithEmail and signUpWithEmail forms to SignIn page) |
| Reset password inaccessible from UI | Me (student, identified) | AI (added "Trouble signing in?" link and settings panel option) |

---

## What Was NOT AI-Generated

The following were entirely human-directed and not generated by AI:

- **Project requirements and specification** — provided by the university (COMS3011A Project 7 PDF)
- **Team architecture decisions** — the microservices backend (auth, dashboard, project services) was built by the Codacaine team independently
- **Supabase database schema** — configured by the team
- **Render deployment** — backend services deployed by the team
- **All credentials and API keys** — provided by me
- **UI preferences and design direction** — all aesthetic choices were directed by me
- **Gitea repository setup** — created by the team on the Wits SDP platform
- **Testing and validation** — I tested all features manually in the browser

---

## Human Oversight

At every stage, I maintained oversight of the AI-generated code:

1. **Reviewed all generated code** before accepting it
2. **Tested features manually** in the browser after each change
3. **Made design decisions** — directed the premium UI aesthetic, chose feature scope
4. **Identified bugs** — caught the "Welcome back" greeting issue and the missing reset password access
5. **Configured external services** — manually set up Supabase providers, Google Cloud Console, and Cloudflare Turnstile
6. **Controlled deployment** — decided when and where to push code

---

## Summary

The AI was used as a **code generation and technical guidance tool** under my direct supervision. All architectural decisions, feature requirements, design choices, and deployment decisions were made by me. The AI accelerated the implementation of features I specified but did not independently make product or design decisions.

---

**Signed:** Nasiphi Ntontela  
**Date:** 13 August 2026
