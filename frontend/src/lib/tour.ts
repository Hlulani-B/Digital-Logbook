/**
 * Interactive getting-started tour for new users, built on driver.js.
 *
 * Steps anchor to [data-tour="..."] attributes in the shell (NavBar) and the
 * Dashboard so they survive class-name refactors. The tour asks the shell to
 * open the navigation drawer first — most targets live inside it — and closes
 * it again for the top-bar steps. Completion is remembered in localStorage so
 * the one-time offer banner on the dashboard does not nag; the tour can
 * always be replayed from the "Guide" button in the top bar.
 */
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

export const TOUR_COMPLETED_KEY = 'dl_tour_completed';
export const TOUR_OFFERED_KEY = 'dl_tour_offered';

export function hasCompletedTour(): boolean {
  try {
    return !!localStorage.getItem(TOUR_COMPLETED_KEY);
  } catch {
    return false;
  }
}

/** True while the one-time dashboard offer banner should be shown. */
export function shouldOfferTour(): boolean {
  try {
    return !localStorage.getItem(TOUR_COMPLETED_KEY) && !localStorage.getItem(TOUR_OFFERED_KEY);
  } catch {
    return false;
  }
}

/** Records that the offer was shown, so a dismiss is not re-shown next load. */
export function markTourOffered(): void {
  try {
    localStorage.setItem(TOUR_OFFERED_KEY, '1');
  } catch {
    /* localStorage unavailable — the banner simply re-appears */
  }
}

function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_COMPLETED_KEY, '1');
  } catch {
    /* localStorage unavailable — offer may re-appear, tour still works */
  }
}

const openDrawer = () => window.dispatchEvent(new CustomEvent('dl-tour-open-drawer'));
const closeDrawer = () => window.dispatchEvent(new CustomEvent('dl-tour-close-drawer'));

/**
 * Dashed image placeholder rendered inside a step's description. Swap the
 * inner HTML of .tour-img-slot for an <img> (or set a step's description to
 * include one) when real screenshots are ready.
 */
function imgSlot(hint: string): string {
  return [
    '<div class="tour-img-slot">',
    '<span class="tour-img-slot-badge">Image placeholder</span>',
    `<span class="tour-img-slot-hint">${hint}</span>`,
    '</div>',
  ].join('');
}

/** A step anchored inside the navigation drawer. */
function drawerStep(selector: string, title: string, description: string): DriveStep {
  return {
    element: selector,
    popover: { title, description, side: 'right', align: 'start' },
    // Re-open the drawer when arriving here (e.g. stepping Back from a
    // top-bar step that had closed it).
    onHighlighted: openDrawer,
  };
}

function buildSteps(): DriveStep[] {
  const steps: DriveStep[] = [
    {
      // Centered intro step — no element.
      popover: {
        title: 'Welcome to your Digital Logbook',
        description:
          'A two-minute tour of the essentials — where everything lives and what each part does. ' +
          'Move at your own pace; you can close this anytime and replay it from the Guide button in the top bar.' +
          imgSlot('A wide screenshot of the dashboard (light theme)'),
      },
    },
    drawerStep(
      '[data-tour="menu"]',
      'Your way around',
      'Everything in the app lives behind this menu — your views, projects, and data tools. ' +
        'It is already open, so let us look at each stop.'
    ),
    drawerStep(
      '[data-tour="drawer-home"]',
      'Home',
      'Your dashboard: everything you are working on, with due-soon highlights. ' +
        'The number on the right counts your entries.'
    ),
    drawerStep(
      '[data-tour="drawer-today"]',
      'Today',
      'A focused list of what is due today and what deserves attention first — ' +
        'a good place to start each session.'
    ),
    drawerStep(
      '[data-tour="drawer-kanban"]',
      'Kanban',
      'Drag entries between Up next, In motion, and Done &amp; dusted to track progress at a glance.'
    ),
    drawerStep(
      '[data-tour="drawer-timeline"]',
      'Timeline',
      'See your entries laid out over time, including dependencies between them.'
    ),
    drawerStep(
      '[data-tour="drawer-calendar"]',
      'Calendar',
      'A month view of all your due dates. Click a day to see what is on it.'
    ),
    drawerStep(
      '[data-tour="drawer-stats"]',
      'My Stats',
      'Progress charts, streaks, and how you spend your time.'
    ),
    drawerStep(
      '[data-tour="drawer-import-export"]',
      'Import &amp; Export',
      'Download your data as JSON, CSV, Markdown, or iCalendar — and restore from a backup. ' +
        'Your data stays yours.'
    ),
    drawerStep(
      '[data-tour="drawer-projects"]',
      'Projects',
      'Group related entries under a project — like a module or a client. ' +
        'Each project gets its own page and colour.'
    ),
    drawerStep(
      '[data-tour="drawer-new-project"]',
      'Create &amp; manage projects',
      'Create a new project from here, or open Manage Projects to rename, recolour, and archive. ' +
        'Archived projects are never lost — they move to Archives.'
    ),
    {
      element: '[data-tour="nav-bell"]',
      popover: {
        title: 'Notifications',
        description:
          'The bell collects due-soon and overdue alerts. Click it for a quick panel, ' +
          'or View all for the full history. Email alerts can be switched on or off in Settings.',
        side: 'bottom',
        align: 'end',
      },
      // Drawer steps are done — put it away so the top bar is visible.
      onHighlighted: closeDrawer,
    },
    {
      element: '[data-tour="nav-profile"]',
      popover: {
        title: 'Profile &amp; settings',
        description:
          'Your avatar menu: manage your profile, open settings (theme, week start, notifications), ' +
          'reset your password, or sign out.',
        side: 'bottom',
        align: 'end',
      },
    },
  ];

  // Dashboard-only stop — QuickEntryBar does not exist on other pages.
  if (document.querySelector('[data-tour="quick-entry"]')) {
    steps.push({
      element: '[data-tour="quick-entry"]',
      popover: {
        title: 'Quick entry',
        description:
          'The fastest way to log work: type naturally — "Submit chapter 3 by Friday for COMS3011" — ' +
          'and the logbook files it for you. Try it after the tour.',
        side: 'top',
        align: 'start',
      },
    });
  }

  steps.push({
    popover: {
      title: 'You are all set',
      description:
        'That is the whole app. If you ever want a refresher, press the Guide button in the top bar. ' +
        'Now go log something.' +
        imgSlot('Optional: a highlighted entry card'),
    },
  });

  return steps;
}

/** Launch the getting-started tour from the Guide button or the offer banner. */
export function startAppTour(): void {
  const steps = buildSteps();
  if (steps.length === 0) return;

  // Most targets live in the drawer — open it and give the slide-in
  // animation a moment before measuring element positions.
  openDrawer();
  window.setTimeout(() => {
    const tour = driver({
      showProgress: true,
      animate: true,
      stagePadding: 6,
      stageRadius: 8,
      popoverOffset: 12,
      overlayOpacity: 0.65,
      smoothScroll: true,
      // Block clicks on the highlighted element so a stray tap cannot close
      // the drawer or navigate away mid-tour.
      disableActiveInteraction: true,
      popoverClass: 'dl-tour-popover',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Finish',
      progressText: 'Step {{current}} of {{total}}',
      steps,
      onDestroyed: (_element, _step, opts) => {
        closeDrawer();
        // Only count it as completed when the user reached the final step —
        // closing early (X, Escape, overlay click) leaves it re-runnable.
        const state = opts?.state as { activeIndex?: number } | undefined;
        if ((state?.activeIndex ?? 0) >= steps.length - 1) {
          markTourCompleted();
        }
      },
    });
    tour.drive();
  }, 300);
}
