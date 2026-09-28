# 1.4 Artificial Intelligence

For the duration of this project, you are very encouraged to use AI tooling. To encourage transparency and ethical usage, you must attribute your usage of AI.

## AI Attribution Policy

For complete details of how to attribute AI, please review the dedicated AI policy document, but as a brief summary, you must specify:

- **Tool**: Claude Code, ChatGPT Web, etc.
- **Model**: GPT-5.5, Claude Opus 4.8, etc.
- **Purpose**: Code generation, editing, documentation, etc.

## Our AI Usage

Throughout this project, AI tooling has been used to assist with:

- **Code generation**: Backend routes, frontend components, utility functions
- **Code editing**: Bug fixes, refactoring, TypeScript type corrections
- **Documentation**: Technical writing, architecture documentation, UI design docs
- **Testing**: Test case generation and validation
- **Debugging**: Error diagnosis and resolution

## AI Tools Used

| Tool                        | Model   | Purpose                                            |
| --------------------------- | ------- | -------------------------------------------------- |
| Qoder (AI Coding Assistant) | Claude  | Code generation, editing, debugging, documentation |
| ChatGPT                     | GPT-4/5 | Code review, architecture discussions              |

## AI Usage Log — September 14-28, 2026

### Week 1: September 14-21, 2026

**Timer Enhancements (17 features delivered)**

| Date      | Feature                                | AI Assistance                                                              |
| --------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Sep 14-15 | Manual time entry modal                | Generated modal component with Duration/Time Range modes, validation logic |
| Sep 15    | Auto-stop at target duration           | Implemented countdown monitoring, completion sound triggers                |
| Sep 15-16 | Timer presets (25m, 1h, 2h, 4h)        | Created preset buttons, single API call integration                        |
| Sep 16    | Visual feedback (progress bar, colors) | Implemented progress calculation, color thresholds, CSS animations         |
| Sep 16-17 | Sound notifications (Web Audio API)    | Built sound system with fade-out, distinct cues for events                 |
| Sep 17    | Edit time after stop                   | Created modal with pre-populated values, time recalculation                |
| Sep 17-18 | Running timer persistence              | Implemented server-authoritative timestamps, "Restored" badge              |
| Sep 18    | Timer analytics (StatsView)            | Generated analytics calculations, 4-column responsive grid                 |
| Sep 18-19 | Keyboard shortcuts (Space, P)          | Implemented keydown listener with input guards                             |
| Sep 19    | Mobile timer experience                | Created responsive CSS, 44px touch targets, 2-column layouts               |
| Sep 19-20 | Stop confirmation dialog               | Built modal dialog, "Stop All" batch confirmation                          |
| Sep 20    | Paused duration display                | Implemented live counter, pause time calculation                           |
| Sep 20-21 | Idle detection                         | Added event listeners, 5-minute threshold, badge display                   |
| Sep 21    | Batch timer actions                    | Implemented CustomEvent system, pause-all/stop-all controls                |
| Sep 21    | Export timer data (CSV)                | Created client-side CSV generation, Blob download                          |

**AI Contribution:** ~85% of code generated, 100% reviewed and tested by developer

### Week 2: September 22-28, 2026

**Activity Feed & Bug Fixes**

| Date      | Feature                               | AI Assistance                                                      |
| --------- | ------------------------------------- | ------------------------------------------------------------------ |
| Sep 22    | Fix pause button (optimistic updates) | Diagnosed cache issue, implemented `paused_at` in optimistic patch |
| Sep 22    | Hide internal fields from table       | Added filter for underscore-prefixed fields, base64 image display  |
| Sep 22-23 | Log timer events to activity feed     | Integrated timer actions with activity logging system              |
| Sep 23-24 | Filter activity by action type        | Created filter UI, category definitions, count badges              |
| Sep 24-25 | Activity pagination (infinite scroll) | Implemented scroll detection, batch loading, loading states        |
| Sep 25    | Circular timer UI (SVG)               | Built SVG progress ring, color-coded states, icon controls         |
| Sep 25-26 | Bulk select/delete entries            | Added checkbox UI, select-all, bulk delete with confirmation       |
| Sep 26-27 | Branch corruption investigation       | Diagnosed `git merge -s ours` issue, documented impact             |
| Sep 27-28 | Feature status documentation          | Created comprehensive report, recovery options                     |

**AI Contribution:** ~80% of code generated, 100% reviewed and tested by developer

### Summary Statistics

- **Total PRs merged:** 22 (September 14-28)
- **Features implemented:** 25+ individual features
- **Test files created/updated:** 15+
- **Documentation updates:** 3 major sections
- **Lines of code generated:** ~8,500 (estimated)
- **Bugs fixed:** 12 (including timer pause, cache issues, UI glitches)

### Key AI-Assisted Patterns

1. **Component Generation** — React components with TypeScript types, props interfaces
2. **State Management** — Custom hooks (`useTimerActions`, `useKeyboardShortcuts`)
3. **CSS/Styling** — Responsive layouts, animations, mobile-first design
4. **Testing** — Vitest test cases, mock data, integration tests
5. **Debugging** — Cache invalidation issues, optimistic update patterns
6. **Documentation** — Feature docs, architecture decisions, API documentation

## Responsibility

You are responsible for everything generated and used by AI during this project. Any hallucinations and incorrect artifacts will impact your marks. You should be aware that usage of AI may impact the subjective components of marking as it may insufficiently demonstrate or answer the question with the required depth.

## Transparency

All AI-generated code has been reviewed, tested, and verified by the development team before being committed to the repository. We maintain full transparency about which parts of the codebase were assisted by AI tools.
