/**
 * Interactive getting-started tour for new users, built on driver.js.
 *
 * Steps anchor to [data-tour="..."] attributes in the shells (the shared
 * NavBar and the dashboard's inline nav/drawer) and in each view page. View
 * steps open the real page as they are described: the tour dispatches a
 * 'dl-tour-navigate' window event, the TourNavigator in App.tsx calls
 * navigate(), and driver.js waits for the anchor element (waitForElement)
 * before measuring. The tour asks the shell to open the navigation drawer for
 * drawer steps and closes it again for the top-bar steps.
 *
 * The tour also runs itself: a countdown bar under the popover paces each
 * stop (hovering pauses it, pressing Back hands control back to the user for
 * good), and with the voice on, the tour moves on only after the voice has
 * finished the stop — never mid-sentence. The voice reads each stop via the
 * browser's speech synthesis, toggled by the speaker button on the popover.
 * Completion is remembered in localStorage so the one-time offer banner on
 * the dashboard does not nag; the tour can always be replayed from the
 * "Guide" button.
 */
import { driver } from 'driver.js';
import type { DriveStep, Driver } from 'driver.js';
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

// ── Voice guide (browser speech synthesis — no API keys, no cost) ──

const VOICE_PREF_KEY = 'dl_tour_voice';
const VOICE_ON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
const VOICE_OFF_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

function readVoicePref(): boolean {
  try {
    return localStorage.getItem(VOICE_PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

function setVoicePref(on: boolean): void {
  try {
    localStorage.setItem(VOICE_PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* preference simply won't persist */
  }
}

let voiceEnabled = readVoicePref();
let currentSpeech = '';
let preferredVoice: SpeechSynthesisVoice | null = null;

/** Best available English voice — neural/online voices first, then any English. */
function pickVoice(): SpeechSynthesisVoice | null {
  if (preferredVoice) return preferredVoice;
  if (!('speechSynthesis' in window)) return null;
  const english = window.speechSynthesis
    .getVoices()
    .filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  preferredVoice =
    english.find((voice) => /natural|neural|online/i.test(voice.name)) ??
    english.find((voice) => /google/i.test(voice.name)) ??
    english.find((voice) => /zira|aria|samantha|female/i.test(voice.name)) ??
    english[0] ??
    null;
  return preferredVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  // Voices load asynchronously — drop the cache so a later stop can pick better.
  window.speechSynthesis.onvoiceschanged = () => {
    preferredVoice = null;
  };
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

function speak(text: string, onEnd?: () => void): void {
  if (activeUtterance) {
    // Detach first so a cancel-triggered 'end' cannot fire a stale onEnd.
    activeUtterance.onend = null;
    activeUtterance.onerror = null;
  }
  if (!voiceEnabled || !text || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  activeUtterance = utterance;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  window.speechSynthesis.speak(utterance);
}

function stopSpeaking(): void {
  if (activeUtterance) {
    activeUtterance.onend = null;
    activeUtterance.onerror = null;
    activeUtterance = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function pauseSpeaking(): void {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.pause();
  } catch {
    /* some voices cannot pause — the countdown still pauses */
  }
}

function resumeSpeaking(): void {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.resume();
  } catch {
    /* matching pauseSpeaking */
  }
}

/** Decode the few HTML entities used in step copy and drop any tags. */
function speechText(title: string, description: string): string {
  const decode = (value: string) =>
    value
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  const plain = decode(description)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${decode(title)}. ${plain}`;
}

const AUTO_MIN_MS = 8000;
const AUTO_MAX_MS = 24000;

/**
 * Generous speech-time guess (~120 words/min at the tour's 0.95 rate, plus
 * pauses). It only paces the countdown bar — the stop itself ends when the
 * utterance reports it is finished.
 */
function estimateSpeechMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(AUTO_MAX_MS, Math.max(AUTO_MIN_MS, (words / 2.0) * 1000 + 2500));
}

/** Reading pace for the muted tour — quicker than listening. */
function estimateReadMs(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(14000, Math.max(5000, (words / 3.5) * 1000 + 1500));
}

/**
 * Bridge from the steps back to the running tour. driver.js fires either the
 * step-level hook or the config-level one — never both — and every step
 * already owns its step-level hooks, so the guide is wired in explicitly
 * from liveStep instead of through the driver config.
 */
type TourGuide = {
  onStepShown: (index: number, title: string, description: string, driver: Driver) => void;
  stopAutoAdvance: () => void;
};

let activeGuide: TourGuide | null = null;

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
      activeGuide?.onStepShown(
        hookOpts.state.activeIndex ?? 0,
        title,
        description,
        hookOpts.driver
      );
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
        'A focused list of what is due today and what deserves attention first — ' +
        'a good place to start each session.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/kanban',
      element: '[data-tour="page-kanban"]',
      title: 'Kanban',
      description:
        'Drag entries between Up next, In motion, and Done &amp; dusted to track progress at a glance.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/timeline',
      element: '[data-tour="page-timeline"]',
      title: 'Timeline',
      description: 'Your entries laid out over time, including dependencies between them.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/calendar',
      element: '[data-tour="page-calendar"]',
      title: 'Calendar',
      description: 'A month view of all your due dates. Click a day to see what is on it.',
      side: 'top',
      align: 'start',
    }),
    liveStep({
      path: '/stats',
      element: '[data-tour="page-stats"]',
      title: 'My Stats',
      description: 'Progress charts, streaks, and how you spend your time.',
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
    steps.push(
      liveStep({
        element: '[data-tour="quick-entry"]',
        title: 'Quick entry',
        description:
          'The fastest way to log work: type naturally — "Submit chapter 3 by Friday for COMS3011" — ' +
          'and the logbook files it for you. Try it after the tour.',
        side: 'top',
        align: 'start',
      })
    );
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

  // ── Auto-advance + voice-guide state (one tour run) ──
  let autoAdvance = true; // pressing Back hands control back to the user
  let hoverPaused = false;
  let currentIndex = 0;
  let stepDelay = AUTO_MIN_MS;
  let tick: number | undefined;
  let driverRef: Driver | undefined;
  // Identifies the current stop: a late event from a previous stop (like the
  // 'end' a cancelled utterance reports) must not release the countdown.
  let stepToken = 0;
  let speechFinished = true;

  const clearTick = () => {
    if (tick !== undefined) {
      window.clearInterval(tick);
      tick = undefined;
    }
  };

  const setBarPercent = (pct: number) => {
    const fill = document.querySelector<HTMLElement>('.dl-tour-popover .tour-auto-fill');
    if (fill) fill.style.width = `${pct}%`;
  };

  // Countdown shown as a bar draining under the popover. Pauses while the
  // pointer is over the popover or the tab is hidden, and never fires on the
  // final stop — that one waits for the user to press Finish.
  //
  // Voice on: the stop ends when the utterance ends (after a short dwell so
  // the spotlight registers) — never mid-word. The estimate only paces the
  // bar, with a hard cap past it so a stalled engine cannot hang the tour.
  // Voice off: the estimate itself is the stop's length.
  const scheduleAutoAdvance = () => {
    clearTick();
    if (!autoAdvance || currentIndex >= steps.length - 1) {
      document.querySelector('.dl-tour-popover .tour-auto')?.remove();
      return;
    }
    setBarPercent(100);
    let elapsed = 0;
    tick = window.setInterval(() => {
      if (hoverPaused || document.hidden) return;
      elapsed += 100;
      setBarPercent(Math.max(0, 100 - (elapsed / stepDelay) * 100));
      const hardCap = elapsed >= stepDelay + 10000;
      const readyToLeave = speechFinished && (!voiceEnabled || elapsed >= 1500);
      if (hardCap || readyToLeave) {
        clearTick();
        driverRef?.moveNext();
      }
    }, 100);
  };

  const applyVoiceToggle = (on: boolean) => {
    voiceEnabled = on;
    setVoicePref(on);
    if (on) {
      const token = stepToken;
      speechFinished = !('speechSynthesis' in window);
      speak(currentSpeech, () => {
        if (token === stepToken) speechFinished = true;
      });
    } else {
      speechFinished = true;
      stopSpeaking();
    }
  };

  activeGuide = {
    onStepShown: (index, title, description, drv) => {
      driverRef = drv;
      currentIndex = index;
      const token = ++stepToken;
      currentSpeech = speechText(title, description);
      stepDelay = voiceEnabled ? estimateSpeechMs(currentSpeech) : estimateReadMs(currentSpeech);
      // Muted (or unsupported): the countdown alone paces the stop.
      speechFinished = !voiceEnabled || !('speechSynthesis' in window);
      speak(currentSpeech, () => {
        if (token === stepToken) speechFinished = true;
      });
      scheduleAutoAdvance();
    },
    stopAutoAdvance: () => {
      autoAdvance = false;
      clearTick();
      document.querySelector('.dl-tour-popover .tour-auto')?.remove();
    },
  };

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
      // Stepping backwards means the user wants the wheel — stop
      // auto-advancing for the rest of the tour so it never runs away.
      onPrevClick: (_element, _step, opts) => {
        activeGuide?.stopAutoAdvance();
        opts.driver.movePrevious();
      },
      onDeselected: () => clearTick(),
      onPopoverRender: (popover) => {
        if (autoAdvance && !popover.wrapper.querySelector('.tour-auto')) {
          const bar = document.createElement('div');
          bar.className = 'tour-auto';
          bar.innerHTML = '<div class="tour-auto-fill"></div>';
          popover.wrapper.appendChild(bar);
          setBarPercent(100);
        }
        // Hovering the popover pauses the countdown and the voice.
        popover.wrapper.addEventListener('mouseenter', () => {
          hoverPaused = true;
          pauseSpeaking();
        });
        popover.wrapper.addEventListener('mouseleave', () => {
          hoverPaused = false;
          resumeSpeaking();
        });
        if (!popover.footer.querySelector('.tour-voice-btn')) {
          const voiceBtn = document.createElement('button');
          voiceBtn.type = 'button';
          voiceBtn.className = 'tour-voice-btn';
          voiceBtn.title = voiceEnabled ? 'Mute voice guide' : 'Unmute voice guide';
          voiceBtn.setAttribute('aria-label', voiceBtn.title);
          voiceBtn.setAttribute('aria-pressed', String(voiceEnabled));
          voiceBtn.innerHTML = voiceEnabled ? VOICE_ON_SVG : VOICE_OFF_SVG;
          voiceBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            applyVoiceToggle(!voiceEnabled);
            voiceBtn.title = voiceEnabled ? 'Mute voice guide' : 'Unmute voice guide';
            voiceBtn.setAttribute('aria-label', voiceBtn.title);
            voiceBtn.setAttribute('aria-pressed', String(voiceEnabled));
            voiceBtn.innerHTML = voiceEnabled ? VOICE_ON_SVG : VOICE_OFF_SVG;
          });
          popover.footer.appendChild(voiceBtn);
        }
      },
      onDestroyed: (_element, _step, opts) => {
        clearTick();
        stopSpeaking();
        activeGuide = null;
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
