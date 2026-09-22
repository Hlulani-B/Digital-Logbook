## Meeting 11 — 21 September 2026

**Venue:** Wartenweiler Library, Focus Room 1 and Focus Room 2
**Attendees:** Hlulani, Siphesihle, Lupa, Sicelo, Zamo, Missy (Nasiphi) (full team)

**Context:** Sprint 3 planning and Sprint 2 retrospective following a disappointing sprint review.

**What we did:**

- Conducted a strict retrospective on our Sprint 2 performance. Acknowledged the low marks received and diagnosed the root cause.
- Identified that a broken automated testing pipeline was the primary reason for our poor Sprint 2 grade, as it allowed failing code to slip through to the client demonstration.
- Confirmed that Missy successfully debugged and fixed the testing pipeline post-review, restoring our CI/CD stability.
- Planned the development scope for Sprint 3 based on direct client criticism (specifically regarding UI confusion) and backlog priorities.
- Grouped the upcoming Sprint 3 work into core themes: UI/UX layout reorganization, legacy data migration, advanced search/stats, timer enhancements, and squashing residual Sprint 2 bugs.

**Decisions made:**

- The team finalized and approved the following 11 features and fixes to be implemented in Sprint 3:
  1. **UI/UX Reorganization (Main Issue):** Restructure the interface to be intuitive and logically grouped to address client criticism.
  2. **Data Migration:** Build logic to migrate existing entries smoothly, filling in reasonably inferred defaults for new formats.
  3. **Advanced Search:** Allow users to pin searches, group entries by specific fields, and compare entries side-by-side.
  4. **Time Plotting:** Allow users to plot statistics and entries on a graph over time.
  5. **Timer Notifications:** Add alerts to remind users if a timer is paused or has been running too long.
  6. **Due Date Fix:** Remove the restriction that prevents users from setting due dates older than a week from the current time.
  7. **Project Card Bug:** Fix the CSS scrolling issue on the "Create Project" modal/card.
  8. **Dashboard Refresh Bug:** Fix the state so that newly created entries appear instantly on the dashboard without requiring a manual browser refresh.
  9. **Granular Timer Inputs:** Refine the timer to let users manually set countdowns using Days, Hours, and Minutes.
  10. **Empty Column Alert:** Add form validation that alerts the user and prevents submission if required columns are left empty.
  11. **Column Visibility Bug:** Fix the issue where newly added custom columns disappear/become absent when attempting to create an entry.
- **Process Decision:** All future commits and branches must pass the newly repaired testing pipeline before being merged to prevent another grading penalty.

**Open questions:** 

- None raised — the team is fully aligned on the mistakes made in Sprint 2 and the exact features required for Sprint 3.

**Next step decided:**

- Add the 11 new User Stories (US49 through US59) to Trello and assign them to individual team members.
- Begin immediate development on the Sprint 3 features, prioritizing the UI reorganization and the pipeline-approved bug fixes.