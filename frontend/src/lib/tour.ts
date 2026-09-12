/**
 * Interactive getting-started tour for new users, built on driver.js.
 *
 * Steps anchor to [data-tour="..."] attributes in the shells (the shared
 * NavBar and the dashboard's inline nav/drawer) and in each view page. View
 * steps open the real page as they are described: the tour dispatches a
 * 'dl-tour-navigate' window event, the TourNavigator in App.tsx calls
 * navigate(), and driver.js waits for the anchor element (waitForElement)
 * before measuring. The tour asks the shell to open the navigation drawer for
 * drawer steps and closes it again for the top-bar steps. Completion is
 * remembered in localStorage so the one-time offer banner on the dashboard
 * does not nag; the tour can always be replayed from the "Guide" button.
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
const navigateTo = (path: string) =>
  window.dispatchEvent(new CustomEvent('dl-tour-navigate', { detail: { path } }));

type LiveStepOptions = {
  /** Route the tour should be on when this step shows (undefined = stay put). */
  path?: string;
  element: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** 'open' keeps the nav drawer open for this step; 'close' puts it away. */
  drawer?: 'open' | 'close';
};

/**
 * A tour step that brings its subject on screen for real: if the app is on
 * another route, it asks the shell to navigate there, then lets driver.js
 * wait for the anchor element and re-measure once the page has rendered.
 */
function liveStep(opts: LiveStepOptions): DriveStep {
  const { path, element, title, description, side = 'bottom', align = 'start', drawer } = opts;
  let navigated = false;

  return {
    element,
    // Give a freshly navigated page time to render its anchor before falling
    // back to a centered popover.
    waitForElement: 2500,
    popover: { title, description, side, align },
    onHighlightStarted: () => {
      navigated = !!path && window.location.pathname !== path;
      if (navigated && path) navigateTo(path);
    },
    onHighlighted: (_element, _step, hookOpts) => {
      if (drawer === 'open') {
        // The target page may still be mounting its tour listeners after a
        // route change — re-request the drawer shortly and repaint.
        window.setTimeout(() => {
          openDrawer();
          hookOpts.driver.refresh();
        }, 350);
      } else {
        if (drawer === 'close') closeDrawer();
        if (navigated) window.setTimeout(() => hookOpts.driver.refresh(), 250);
      }
    },
  };
}

function buildSteps(): DriveStep[] {
  const steps: DriveStep[] = [
    liveStep({
      element: '[data-tour="menu"]',
      title: 'Welcome to your Digital Logbook',
      description:
        'A two-minute tour of the essentials. Each view opens for real as we reach it, so you can see ' +
        'exactly what is being described. Move at your own pace; you can close this anytime and replay ' +
        'it from the Guide button in the top bar.',
      drawer: 'open',
      side: 'bottom',
      align: 'start',
    }),
    liveStep({
      path: '/dashboard',
      element: '[data-tour="drawer-home"]',
      title: 'Home',
      description:
        'Your dashboard: everything you are working on, with due-soon highlights. ' +
        'The number on the right counts your entries.',
      drawer: 'open',
      side: 'right',
      align: 'start',
    }),
    liveStep({
      path: '/today',
      element: '[data-tour="page-today"]',
      title: 'Today',
      description:
        'This is Today — a focused list of what is due today and what deserves attention first. ' +
        'A good place to start each session.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/kanban',
      element: '[data-tour="page-kanban"]',
      title: 'Kanban',
      description:
        'This is Kanban — drag entries between Up next, In motion, and Done &amp; dusted to track ' +
        'progress at a glance.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/timeline',
      element: '[data-tour="page-timeline"]',
      title: 'Timeline',
      description:
        'This is Timeline — your entries laid out over time, including dependencies between them.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/calendar',
      element: '[data-tour="page-calendar"]',
      title: 'Calendar',
      description:
        'This is Calendar — a month view of all your due dates. Click a day to see what is on it.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/stats',
      element: '[data-tour="page-stats"]',
      title: 'My Stats',
      description: 'This is My Stats — progress charts, streaks, and how you spend your time.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/data-portability',
      element: '[data-tour="page-import-export"]',
      title: 'Import &amp; Export',
      description:
        'Download your data as JSON, CSV, Markdown, or iCalendar — and restore from a backup. ' +
        'Your data stays yours.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/dashboard',
      element: '[data-tour="drawer-projects"]',
      title: 'Projects',
      description:
        'Group related entries under a project — like a module or a client. ' +
        'Each project gets its own page and colour.',
      drawer: 'open',
      side: 'right',
      align: 'start',
    }),
    liveStep({
      path: '/dashboard',
      element: '[data-tour="drawer-new-project"]',
      title: 'Create &amp; manage projects',
      description:
        'Create a new project from here, or open Manage Projects to rename, recolour, and archive. ' +
        'Archived projects are never lost — they move to Archives.',
      drawer: 'open',
      side: 'right',
      align: 'start',
    }),
    liveStep({
      path: '/dashboard',
      element: '[data-tour="nav-bell"]',
      title: 'Notifications',
      description:
        'The bell collects due-soon and overdue alerts. Click it for a quick panel, ' +
        'or View all for the full history. Email alerts can be switched on or off in Settings.',
      drawer: 'close',
      side: 'bottom',
      align: 'end',
    }),
    liveStep({
      path: '/dashboard',
      element: '[data-tour="nav-profile"]',
      title: 'Profile &amp; settings',
      description:
        'Your avatar menu: manage your profile, open settings (theme, week start, notifications), ' +
        'reset your password, or sign out.',
      side: 'bottom',
      align: 'end',
    }),
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

  steps.push(
    liveStep({
      element: '[data-tour="nav-guide"]',
      title: 'You are all set',
      description:
        'That is the whole app. If you ever want a refresher, press this Guide button — ' +
        'the tour will walk you through each feature again. Now go log something.',
      side: 'bottom',
      align: 'end',
    })
  );

  return steps;
}

/** Launch the getting-started tour from the Guide button or the offer banner. */
export function startAppTour(): void {
  const steps = buildSteps();
  if (steps.length === 0) return;
  const startPath = window.location.pathname;

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
        const completed = (state?.activeIndex ?? 0) >= steps.length - 1;
        if (completed) {
          markTourCompleted();
        } else if (startPath && window.location.pathname !== startPath) {
          // The tour moved the user between pages — take them back to where
          // they started instead of leaving them stranded mid-app.
          navigateTo(startPath);
        }
      },
    });
    tour.drive();
  }, 300);
}
