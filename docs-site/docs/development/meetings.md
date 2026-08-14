# Meeting Log

Short, factual notes from each team meeting — attendees, what was discussed,
decisions made, and what's still open. This is our evidence for the Sprint 1
rubric's Stakeholder Interaction (10%) and Project Methodology (10%) lines.

---

## Meeting 1 — 27 July 2026

**Venue:** Wartenweiler Library, Discussion Room 2
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo, Zamo, Nasiphi (full team)

**Context:** First meeting as a group. No project had been assigned yet.

**What we did:**

- Introductions — first time meeting as a team
- Read through the COMS3011A project brief together to work out which
  project best suited the group
- Narrowed the eight project options down to our top 5 and submitted them

**Decisions made:** Shortlist of 5 preferred projects submitted.

**Open questions:** None yet raised — pre-assignment stage.

---

## Meeting 2 — 3 August 2026

**Venue:** Commerce Library, Room 3
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo, Zamo, Nasiphi (full team)

**Context:** The Digital Logbook project had now been officially assigned to us.

**What we did:**

- First deep read of the Digital Logbook project-specific brief
- Discussed what "the owner can customise the format of their logbook" 
  actually requires in practice

**Decisions made:** None finalised — surfaced disagreement rather than resolved it.

**Open questions / disagreements:**

- Significant disagreement on how to interpret the custom entry-format
  requirement (how flexible it needs to be, what it means practically for
  the data model)
- Topic was handed to us later than expected, which compressed the time
  available to properly digest it before this meeting

**Next step decided:** Take the format-flexibility question to our tutor/client.

---

## Meeting 3 — 4 August 2026

**Venue:** MSL005
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo + tutor/client

**Context:** First meeting with our assigned tutor/client.

**What we did:**

- Asked our tutor the open questions from Meeting 2, primarily around the
  custom entry-format requirement
- Consolidated the team's understanding of the project based on the tutor's answers

**Decisions made:** *(add specific answers the tutor gave here, if not
already captured elsewhere — e.g. this is likely where the Firebase
Auth/Firestore clarification and other confirmed decisions on the
[Decisions page](decisions.md) originated. Worth cross-referencing.)*

**Open questions:** *(carry forward anything not resolved)*

---

## Meeting 4 — 7 August 2026

**Venue:** Wartenweiler Library, Discussion Room 2
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo, Zamo, Nasiphi (full team)

**Context:** Team now had a clear, shared understanding of project requirements.

**What we did:**

- Wrote Sprint 1 user stories with Given/When/Then acceptance tests
  (see [Sprint 1 User Stories](user-stories.md))
- Assigned tasks to team members via Trello
- Set up the project repository on Gitea

**Decisions made:**

- Sprint 1 user stories and acceptance criteria finalised
- Task ownership assigned via Trello
- Repository created and initialised

**Open questions:** See [Open Questions & Decisions](decisions.md) for what
was still outstanding after this point (e.g. microservices vs. single-backend
approach, which surfaced later during initial implementation).

---

!!! note "Keeping this current"
    Add a new entry after every future meeting — attendees, what was
    discussed, decisions made, and anything left open. Even a few lines per
    meeting is enough to count as evidence.

### Meeting 5 — 13 August 2026

**Venue:** Wartenweiler Library, Discussion Room 2  
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo, Zamo, Nasiphi (full team)

**Context:** Authentication functionality had reached a working structure, including sign-up and login. The team met to discuss how to proceed with Sprint 1 implementation and establish a database design that would support the project requirements efficiently.

**What we did:**
- Reviewed progress on the sign-up and login implementation
- Discussed the next development priorities for Sprint 1
- Analysed the project brief and user stories to determine what data needed to be stored
- Explored different approaches for structuring the database schema
- Discussed how project data, logbook entries, and user information should be related
- Considered how to support customisable logbook formats while keeping the design efficient and maintainable

**Decisions made:**
- Database design would be treated as a priority before implementing additional features
- The schema should be driven by the project brief and user story acceptance criteria rather than by assumptions about future features
- The dashboard and project-management functionality would be built around the core entities required for Sprint 1

**Open questions:**
- Whether project records should be linked to users via Supabase Auth UUIDs rather than email addresses
- How dynamic/custom fields should be represented in the database
- Whether projects should use a dedicated UUID primary key instead of relying on project names
- Final review and approval of the proposed schema before implementation begins

**Next step decided:**
- Refine and finalise the database schema
- Begin implementation of the dashboard and project-creation functionality once the schema has been agreed upon