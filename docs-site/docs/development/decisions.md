# Open Questions & Decisions

Tracking decisions we've made, and ones we still need to settle as a team or
with our tutor. Keeping this list current is part of showing evidence of
methodology for the Sprint 1 rubric (Stakeholder Interaction, Project Methodology).

## Settled

| Question | Answer | Source |
|---|---|---|
| Is Firebase Auth allowed? | Yes — it's an established auth library, exactly what the brief wants instead of a homemade auth system | Confirmed with lecturer |
| Is Firestore allowed as our database? | No auto-generated API endpoints from Firestore/Supabase. Supabase is fine **only** as a hosted database accessed exclusively through our own hand-written API | Confirmed with lecturer |
| One active entry format per project (Sprint 1 scope) | Yes | Team consensus |
| Duration/time spent as a built-in required field on every entry | Yes | Team consensus |

## Open — needs a team decision

| Question | Why it matters |
|---|---|
| Are we intentionally running **separate deployed microservices** (current reality per the deployment log), or should we consolidate to one backend app as originally planned for Sprint 1? | Real microservices means 3x the deployment/debugging surface area — bigger commitment than the team scoped. See [Architecture Overview](../architecture/overview.md#current-status-separate-deployed-microservices) |
| Which basic field types are expected for Sprint 1 — text/number/date/duration only, or should dropdown be included early? | Affects scope of the entry-format builder |
| Which external API integration counts as "relevant" for a Digital Logbook? | Required by the brief; not yet chosen |
| What is `dashboard-service` actually responsible for — pulling data from other services, or its own logic? | Risk of duplicating statistics logic in two places |
| Where do entries and entry-formats live — inside `project-service`, or as separate services? | Core to the app; not yet confirmed in the codebase |
| What should the `main` vs `services` branch structure be going forward? | `origin/HEAD` currently points at `services`, which is unusual; needs a clear team convention |

## Questions for the tutor (from Sprint 1 planning)

1. Is it acceptable that each project has exactly one active entry
   format/template for the basic tier?
2. Is it acceptable that duration/time spent is a built-in required field on
   every entry?
3. Which basic field types are expected for Sprint 1?
4. ~~Is Firebase/Auth0/Clerk acceptable for authentication if our app logic
   still goes through our hand-written API?~~ **Confirmed: yes.**
5. Which external API integration would be considered relevant for a Digital Logbook?
6. How much implementation is expected for Sprint 1 compared with design,
   documentation, and setup evidence?
7. What evidence should we show for quick capture in Sprint 1?
