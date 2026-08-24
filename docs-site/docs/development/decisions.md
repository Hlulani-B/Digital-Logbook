# Open Questions & Decisions

Tracking decisions we've made, and ones we still need to settle as a team or
with our tutor. Keeping this list current is part of showing evidence of
methodology for the Sprint 1 rubric (Stakeholder Interaction, Project Methodology).

## Settled

| Question | Answer | Source |
|---|---|---|
| Is Supabase Auth allowed? | Yes — the brief expects an established auth library rather than a homemade one, and Supabase Auth satisfies that | Confirmed with lecturer |
| Is Firestore/Supabase allowed as our database? | No auto-generated API endpoints from Firestore/Supabase. Supabase is fine **only** as a hosted PostgreSQL database accessed exclusively through our own hand-written API | Confirmed with lecturer |
| One active entry format per project (Sprint 1 scope) | Yes | Team consensus |
| Duration/time spent as a built-in required field on every entry | Yes | Team consensus |
| Are separate deployed microservices intentional? | Yes — four services (auth, dashboard, project, profile) are deployed independently on Render | Team consensus |
| Where do entries and entry-formats live? | Inside `project-service`, alongside the projects they belong to | Code structure |
| What is `dashboard-service` responsible for? | Cross-project summaries and aggregated data for the dashboard view | Team consensus |
| Which basic field types are supported? | Text, number, date, and boolean for Sprint 1 | Implemented |
| What should the `main` vs `services` branch structure be? | `main` is the default branch. Feature branches are created off `main` and merged back. The older `services` branch is no longer active | Team consensus |

## Open — needs a team decision

| Question | Why it matters |
|---|---|
| Which external API integration counts as "relevant" for a Digital Logbook? | Required by the brief; not yet chosen. The client has asked for a voice feature, which may be the relevant integration, but the technical approach still needs to be decided |
| Which dashboard layout best balances project-first and entry-first views? | The client asked for "a bit of both." We need to decide exactly how the two views are toggled and what each view shows by default |
| Should the entry card always be compact, or should it expand to show more detail on interaction? | The client noted the entry card is taking up half the space; we need a concrete sizing/collapse design |

## Questions for the tutor / client (current)

These are the questions we still want to confirm or discuss:

1. Which external API integration would be considered relevant for a Digital
   Logbook? We are considering the voice feature the client requested, but we
   want to confirm it satisfies this requirement.
2. How should the "bit of both" dashboard direction be implemented — e.g., a
   toggle, tabs, or a default view with a switch?
3. What specific sizing or collapse behaviour should the entry card have to
   address the "half the space" feedback?
4. Should the pin feature pin projects, entries, or both, and where should
   pinned items appear?
