# Stakeholder Interaction

## Sprint 3

### Client Meeting 1 — 25 September 2026

**Venue:** Focus Room 2, Wartenweiler Library (Team gathered in person; client/tutor joined online)
**Attendees:** Hlulani Baloyi, Siphesihle Merile, Lupa Martins, Sicelo Vanyelwa, Zamokuhle Maziya + Jashil (client/tutor)
**Absent:** Nasiphi Ntontela

**Context:** Sprint 3 progress review — the team presented the features implemented since the previous session, demonstrated them live, and received direct feedback from the client/tutor.

---

#### 1. Authentication & Email Management

**What was presented:**

- **Unconfirmed email auto-purge:** A background job running daily at midnight deletes unconfirmed email accounts older than 3 days to prevent database bloat.
- **Password requirements shown upfront:** The sign-up form displays a live password-requirements checklist (green for met, red for unmet).
- **Email typo detection:** A "Did you mean?" suggestion appears when the user types a common email domain misspelling.

**Client feedback (Jashil):**

- Don't show the "Did you mean?" suggestion in both the inline hint and the error message to avoid redundancy and information leakage.
- Move the password-match indicator below the "Confirm password" field so it's more intuitive to check the match after both fields are filled.
- The 3-day purge job is fine as long as it runs once daily.

---

#### 2. Projects, Richer Fields & Entry References

**What was presented:**

- **Cross-project entry references:** Entries can now reference other projects.
- **Customizable entry fields:** Each project can define its own field types (e.g., text, number, dropdown).
- **Entry tags & notes:** Entries can be tagged and described with additional notes.
- **Improved UX:** A new dashboard/project view.

**Client feedback (Jashil):**

- The features add capability, but the UI isn't intuitive enough for new users to understand cross-project references without guidance.
- Strongly recommended adding an onboarding guide or walkthrough in the beginning to introduce new users to the app's concepts.

---

#### 3. Statistics Dashboard

**What was presented:**

- Project-specific statistics panel showing time tracked, entry counts, and averages (e.g., average goals scored in a soccer project).

**Client feedback (Jashil):**

- Liked the per-project breakdown.
- Recommended preparing 2-3 diverse and relatable demo projects (like the soccer training one) before sprint marking so the stats clearly represent contextual data.

---

#### 4. Timer Fixes & UML Diagrams

**What was presented:**

- **Timer Fix:** Addressed a local timer bug where the timer starts counting indefinitely if not stopped manually, causing inaccurate states for statistics.
- **UML Diagrams:** Added architecture UML diagrams to the documentation site to explain the microservices architecture, as requested in Sprint 1.

**Client feedback (Jashil):**

- Confirmed the diagrams and fixes should be ready by the upcoming Tuesday sprint marking.

---

#### 5. Activity Log

**What was presented:**

- Clarified a misinterpreted user story, confirming it was about data persistence and updating field formats instead of visual display. Work is ongoing to meet the correct requirements.

**Client feedback (Jashil):**

- Acknowledged the correction.

---

#### 6. User Feedback Fixes

**What was presented:**

- Implemented fixes based on user feedback, such as allowing users to edit notes on entries after creation.

**Client feedback (Jashil):**

- Acknowledged and accepted the improvements.

---

#### 7. Notification System

**What was presented:**

- **Due-date email notifications:** Users receive an email 24 hours before a task's due date.
- **In-app notification bell:** Shows a red badge for unread notifications.
- **Notification history:** A page to view recent notifications (initially set to 30).

**Client feedback (Jashil):**

- Reduce the notification feed from 30 to 15 most recent to prevent overwhelming the user.
- Use a badge on the bell rather than pop-up notifications, as pop-ups can be disturbing for a logbook app.

---

#### Closing & Action Items

**Decisions made:**

- Incorporate the onboarding flow for new users.
- Use badge-only notifications for in-app alerts and limit the history to 15 items.
- Refine the password validation and error message UI based on Jashil's advice.
- Ensure the timer issue is fully fixed and UML diagrams are ready by the sprint marking.

**Next step decided:**

- Prepare proper demo data for the final sprint marking presentation.
- Finalize the features discussed (timer fix, activity log update, notifications).
- Ensure all members are ready for the presentation on Tuesday.

**Proof of meeting:**

[Download/view meeting transcript](../assets/meetings/meeting-12-2026-09-25-transcript.docx)

![Meeting evidence 1](../assets/meetings/meeting-12-2026-09-25-evidence-01.jpeg)

![Meeting evidence 2](../assets/meetings/meeting-12-2026-09-25-evidence-02.jpeg)
