# Stakeholder Interaction

## Sprint 2

### Client Meeting 1 — 10 September 2026

**Venue:** Discussion Room 3, Wartenweiler Library (in person)
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo, Zamo, Nasiphi (full team) + client/tutor

**Context:** Sprint 2 progress demonstration and user testing session with the client.

**What we did:**

- Demonstrated our current progress on the Digital Logbook application to the client. The demo followed the full user journey agreed in the 9 September standup: signing in, creating a project, capturing an entry with the live timer running, viewing the dashboard (both project-centric and entry-centric views), and reviewing the statistics panel.
- The client responded positively and liked what was shown. Specific praise went to the toggleable dashboard, the more prominent entry button, and the entry-card sizing fixes carried over from the Sprint 1 feedback.
- Conducted a user testing session where participants tested the app and provided comments and feedback. Participants completed a scripted set of tasks (create a project, log an entry, start and stop the timer, archive a completed item) and narrated any points of confusion.
- Captured the user-testing comments for review — most feedback concerned small UI wording issues and a request for clearer timer labels, which the team agreed were quick wins for the next cycle.

**Decisions made:**

- Client feedback and user testing comments will be reviewed and incorporated into the next development cycle.
- The requested timer-label clarification will be handled together with the ongoing Timer/Stats work rather than as a separate item.

**Next step decided:**

- Transcribe the user-testing comments into the project documentation and convert them into backlog items for Sprint 2.
- Schedule the next client check-in after the Timer/Stats feature is finalised.

**Proof of meeting:**

|                                                                                       |                                                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| ![Proof 1](../assets/meetings/first%20client%20meeting/sprint2-meeting1-proof-1.jpeg) | ![Proof 2](../assets/meetings/first%20client%20meeting/sprint2-meeting1-proof-2.jpeg) |
| ![Proof 3](../assets/meetings/first%20client%20meeting/sprint2-meeting1-proof-3.jpeg) | ![Proof 4](../assets/meetings/first%20client%20meeting/sprint2-meeting1-proof-4.jpeg) |

---

### Client Meeting 2 — 12 September 2026

**Venue:** Online (Microsoft Teams)
**Duration:** 1 hour 45 minutes
**Attendees:** Hlulani Baloyi, Siphesihle Merile, Lupa Martins, Sicelo Vanyelwa, Zamokuhle Maziya, Nasiphi Ntontela (full team) + Jaishil Patel (client/tutor)

**Context:** Sprint 2 progress review — each team member presented the features they implemented since the previous session, demonstrated them live, and received direct feedback from the client. The meeting also covered user-testing feedback collected from the 10 September in-person session.

---

#### 1. Nasiphi — Authentication & Email Management

**What was presented:**

- **Unconfirmed email auto-purge:** Implemented a Supabase `pg_cron` job that runs daily at midnight and deletes unconfirmed email accounts older than 3 days. This prevents database bloat from sign-ups that never complete email verification.
- **Password requirements shown upfront:** The sign-up form now displays a live password-requirements checklist (length, uppercase, lowercase, number, special character) that updates in real time as the user types — green for met, red for unmet. The submit button is disabled until all requirements pass.
- **Email typo detection:** A "Did you mean?" suggestion appears when the user types a common email domain misspelling (e.g. `gmil.com` → `gmail.com`). Clicking the suggestion auto-corrects the field.

**Client feedback (Jaishil):**

| Feedback                                                                                                                                                                              | Resolution                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Don't show the "Did you mean?" suggestion in both the inline hint and the error message — pick one place to avoid redundancy and avoid leaking too much info in error messages        | Keep "Did you mean?" only as the inline hint; error message stays generic ("Invalid email or password") |
| Move the password-match indicator below the "Confirm password" field, not between password and confirm password — it's more intuitive to check the match after both fields are filled | Accepted — will reposition in next iteration                                                            |
| The 3-day purge cron job is fine as long as it runs once daily (not continuously) — confirmed it runs at midnight only                                                                | No change needed                                                                                        |

**Proof:**

![Teams Meeting Screenshot](../assets/meetings/second%20client%20meeting/sprint2-meeting2-screenshot-1.png)

---

#### 2. Lupa — Projects, Richer Fields & Entry References

**What was presented:**

- **Cross-project entry references:** Entries can now reference other projects. Clicking a reference navigates directly to the referenced project, creating a linked knowledge graph across the logbook.
- **Customizable entry fields:** Each project can define its own field types (text, number, dropdown, checkbox). Demonstrated with a "Cooking" project that has fields for calories, sauce type, and eaten status.
- **Entry tags:** Entries can be tagged for categorization and filtering.
- **Improved UX:** Tooltips added to ambiguous UI controls; guardrails prevent users from creating tasks before a project exists.

**Client feedback (Jaishil):**

| Feedback                                                                                                                                       | Resolution                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| The features are good and add capability, but the UI isn't intuitive enough — users won't understand cross-project references without guidance | Add an onboarding guide/walkthrough for new users that explains the core concepts                |
| The reference feature is powerful but needs better introduction — users won't discover it on their own                                         | Accepted — Nasiphi confirmed she is already building an onboarding page with step-by-step arrows |
| Demo data should be more relatable — use a soccer training project for the stats demo instead of abstract examples                             | Will prepare better demo data before sprint marking                                              |

---

#### 3. Sicelo — Statistics Dashboard

**What was presented:**

- Project-specific statistics panel showing time tracked, entry counts, and completion rates per project.
- Demonstrated with a "Soccer Training" project to show how stats vary across different project types.

**Client feedback (Jaishil):**

| Feedback                                                                                                                 | Resolution                                             |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| The statistics are cool and useful — likes the per-project breakdown                                                     | No change needed                                       |
| Prepare 2-3 diverse demo projects before sprint marking so the client can understand what the stats represent in context | Will add demo data (soccer training + another project) |

---

#### 4. Siphesihle — Documentation & UML Diagrams

**What was presented:**

- UML architecture diagrams being added to the documentation site to visually explain the system design.
- The client had previously requested these during the Sprint 1 review.

**Client feedback (Jaishil):**

- Confirmed the diagrams will be ready by the Tuesday sprint marking. Approved the approach.

---

#### 5. Zamokuhle — Activity Log

**What was presented:**

- Zamokuhle reported that she had misinterpreted her user story — she thought it was about data persistence rather than activity logging.
- She committed to reworking the activity log feature to match the correct requirements.

**Client feedback (Jaishil):**

- Acknowledged the issue. No specific feedback beyond ensuring the correct story is implemented before sprint marking.

---

#### 6. Hlulani — User Feedback Fixes

**What was presented:**

Hlulani presented the fixes implemented in response to the user feedback collected during the 10 September user-testing session and the quick survey (13 responses). Key changes:

- **Notes editing:** Users can now edit notes on entries after creation.
- **Terminology rename:** "Field" → "Column" (users didn't understand "field"); "Entry" → "Item" (to avoid collision with Kanban "task board" vocabulary).
- **Recently Created / Recently Viewed:** Added to the Dashboard so users can immediately find what they just created — addressing the #1 user complaint that "projects/calendar/tasks feel disconnected."
- **Auto-redirect after creation:** Creating a project or task now navigates directly to that project's page.
- **Project colours:** Each project can have a custom colour, surfaced across the UI.
- **Cache subscriptions:** All pages now subscribe to cache changes, so a write on one page live-updates others without a reload.

**Client feedback (Jaishil):**

| Feedback                                                                                       | Resolution         |
| ---------------------------------------------------------------------------------------------- | ------------------ |
| "As long as you're listening to what the feedback says, it's very, very good"                  | All fixes approved |
| The documentation of feedback (spreadsheet + issue tracker + fix trail) is sufficient evidence | No change needed   |

---

#### 7. Nasiphi — Notification System (New Feature)

**What was presented:**

- **Due-date email notifications:** Users receive an email 24 hours before a task's due date as a reminder.
- **In-app notification bell:** A bell icon in the header shows a red badge with the count of unread notifications.
- **Notification history page:** Users can view their 30 most recent notifications.

**Client feedback (Jaishil):**

| Feedback                                                                                            | Resolution                   |
| --------------------------------------------------------------------------------------------------- | ---------------------------- |
| Reduce the notification feed from 30 to 15 most recent — 30 is too many                             | Will change to 15            |
| Use a badge on the bell rather than pop-up notifications — pop-ups are disturbing for a logbook app | Will use badge-only approach |
| The notification idea is good overall                                                               | Approved                     |

---

#### 8. Data Disclaimer Discussion

**What was discussed:**

Nasiphi raised a concern about the Data Disclaimer page (shown to new users after sign-up). Specifically:

- The "Where your data lives" section names "Supabase Cloud Database" explicitly. Nasiphi argued this could create vulnerability concerns for end users who don't know what Supabase is.
- The "Open source" badge on the disclaimer could trigger privacy concerns — users might think "everyone has access to my data."

**Client feedback (Jaishil):**

| Feedback                                                                                                         | Resolution                  |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Don't name specific services (Supabase) in the user-facing disclaimer — say "our database" instead               | Will update disclaimer copy |
| The open-source concern is valid — clarify that open source means the code is auditable, not that data is public | Will revise wording         |
| "It's very nice to see that you guys are thinking about these things — this is the important stuff nowadays"     | Positive reinforcement      |

---

#### 9. Closing & Action Items

**Decisions made:**

- All quick-win stakeholder feedback from the user-testing session will be completed within the current sprint; larger items go to the Sprint 3 backlog.
- The team will show confidence in the sprint marking presentation on Tuesday.
- Nasiphi scheduled a follow-up review with the client for Monday before 12:00 to verify the disclaimer changes before sprint marking.
- The client agreed to fill out the user feedback form (Google Form) and to share it with his network.

**Next step decided:**

- Finalise and merge the Timer/Stats changes via merge request.
- Publish the updated documentation, including the expanded meeting logs and stakeholder-interaction evidence.
- Prepare demo data (soccer training project + second project) for the statistics presentation.
- Update the Data Disclaimer copy to remove specific service names and clarify the open-source statement.

**Proof of meeting:**

|                                                                                                     |                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| ![Teams Screenshot](../assets/meetings/second%20client%20meeting/sprint2-meeting2-screenshot-1.png) | ![Meeting Proof](../assets/meetings/second%20client%20meeting/sprint2-meeting2-proof.jpeg) |

**Full transcript:** The complete meeting transcript is available in the repository at [`docs-site/docs/assets/meetings/second client meeting/Meeting in 'Codecaine'.docx`](../assets/meetings/second%20client%20meeting/Meeting%20in%20'Codecaine'.docx).

---

### Stakeholder Feedback Review — 12 September 2026 (Evening)

**Venue:** Online (Microsoft Teams)
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo, Zamo, Nasiphi (full team)

**Context:** Internal review of the stakeholder feedback collected during the 12 September client meeting, with the project demonstration revisited to confirm every feedback point against the live build.

**What we did:**

- **Stakeholder feedback review:** Grouped the client comments from the 12 September session into quick wins (password match indicator reposition, notification count reduction, disclaimer copy changes) versus items needing design discussion (onboarding guide, better demo data).
- **Project demonstration:** Re-ran the demonstration scenarios from the client meeting against the current build to confirm the feedback items reproduce and are properly scoped.
- Each team member confirmed the part of the demonstration they own:
  - **Hlulani:** Timer label and entry-card copy changes requested during user testing — the UI now clearly distinguishes the deadline countdown from the work-session timer.
  - **Siphesihle:** Updated timer behaviour with pause/resume, with the Stats module totals staying in sync.
  - **Lupa:** Archive-flow feedback incorporated, with tightened confirmation prompts.
  - **Sicelo:** Statistics panel verified against the user-testing scenarios.
  - **Zamo:** Activity-log entries linked to the user actions observed during the testing session for traceability.
  - **Nasiphi:** Next client check-in scheduled and the stakeholder feedback summary prepared for this log.

**Decisions made:**

- All quick-win stakeholder feedback from the 12 September client meeting will be completed before the Tuesday sprint marking.
- The next stakeholder check-in will focus on a demonstration of the corrected timer and stats behaviour.

**Next step decided:**

- Finalise and merge the Timer/Stats changes via merge request.
- Publish the updated documentation, including the expanded meeting logs and stakeholder-interaction evidence.
