# Stakeholder Interaction

This page documents stakeholder engagement during the Digital Logbook project.

## Sprint 1

### Stakeholder Interaction 1 — 4 August 2026

**Venue:** MSL005
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo + tutor/client (JP)

**Context:** First meeting with our assigned tutor/client. The team had just received the Digital Logbook project brief and needed clarification on the custom entry-format requirement.

**What we discussed:**

- Asked the tutor our open questions from the previous team meeting, primarily around the custom entry-format requirement ("the owner can customise the format of their logbook")
- Discussed what level of flexibility the format customisation needs to support
- Consolidated the team's understanding of the project based on the tutor's answers

**Decisions made:**

- The team agreed to use **Supabase** as the primary backend platform instead of Firebase
- Supabase would provide authentication and PostgreSQL database hosting
- Application logic would still be implemented through our own backend services rather than relying directly on auto-generated database APIs
- This decision simplified the technology stack by combining authentication and database management within a single platform

**Outcome:** The team left with a clear, shared understanding of the project requirements and technology direction.

---

### Stakeholder Interaction 2 — 20 August 2026

**Venue:** Wartenweiler Library, Focus Room 2 (team in person; client/tutor JP joined online via Microsoft Teams)
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo, Zamo, Nasiphi (full team) + JP (client/tutor)

**Context:** Sprint 1 progress demonstration to the client/tutor. The team showed the current Digital Logbook build and collected feedback before continuing with the remaining Sprint 1 work.

**What we did:**

- Demonstrated the current progress on the Digital Logbook application
- Captured client feedback and requested changes:
  - **Voice feature:** Add voice recording capability for hands-free entry capture
  - **Task-completion visibility:** Show how many tasks are being completed — add stats/progress indicators
  - **Entry button visibility:** Make the entry/add button more prominent and easier to find
  - **Toggleable dashboard:** Allow users to switch between different dashboard views
  - **Pin feature:** Add ability to pin important projects or entries
  - **Entry-card sizing:** Fix the entry card taking up half the screen space
- Discussed two competing ideas for the dashboard layout:
  - One view: show projects/recent projects first, then drill into project entries
  - Alternative view: show entries directly on the dashboard with a clear project label for quick recording
- The client/tutor directed the team to use a **hybrid approach** — "a bit of both"

**Decisions made:**

- Dashboard will support both project-centric and entry-centric views (hybrid approach as suggested by the client)
- All six client feedback items (voice, stats/visibility, entry button, toggle, pin, entry-card sizing) were accepted as the next priorities

**Outcome:** The client was engaged and provided specific, actionable feedback. The team had clear direction for the remainder of Sprint 1 and the start of Sprint 2.

**Proof of meeting:**

![Teams call screenshot showing the client/tutor JP and team members during the demo](../assets/meetings/meeting-07-2026-08-20.jpeg)

---

### Sprint 1 Client Meeting Proof

Below is additional proof of interaction with the client/stakeholder during Sprint 1. This meeting covered project requirements, expectations, and alignment on the Sprint 1 deliverables.

![Sprint 1 Client Meeting](../assets/sprint1-client-meeting.jpg)

#### Key Takeaways from Sprint 1 Stakeholder Engagement

- Confirmed the core user flow: sign in, create project, define entry format, capture entries, view timeline, see statistics
- Agreed on the technology stack (React frontend, Node/Express microservices, Supabase backend)
- Discussed the importance of the natural-language entry feature and voice capture
- Aligned on deployment strategy (Render for backend services)
- Received six specific feedback items that directly shaped Sprint 2 priorities
- Client approved the hybrid dashboard approach (project-centric + entry-centric views)
