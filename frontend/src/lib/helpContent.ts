export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  keywords: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  icon: string;
  articles: HelpArticle[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    articles: [
      {
        id: 'welcome',
        title: 'Welcome to Digital Logbook',
        content:
          'Digital Logbook is your personal academic planning companion. Track your work entries, manage projects, set due dates, and stay on top of your deadlines — all in one place.\n\n**Key features:**\n- Create and organise work entries under projects\n- Multiple views: Table, Calendar, Kanban, Timeline, Today\n- Focus Mode for distraction-free timed work sessions\n- Notifications for upcoming and overdue tasks\n- Data import/export in JSON, CSV, Markdown, and iCalendar\n- Multiple themes and customisation options',
        keywords: ['welcome', 'introduction', 'overview', 'start'],
      },
      {
        id: 'your-first-entry',
        title: 'Creating Your First Entry',
        content:
          "Entries are the building blocks of your logbook. Each entry represents a task, activity, or work session.\n\n**To create an entry:**\n1. Go to any project page\n2. Click the **New Entry** button\n3. Fill in the entry fields (task description, due date, priority, etc.)\n4. Click **Save**\n\n**Quick Entry:** You can also use natural language on the Dashboard. Type something like 'worked on the login feature for 2 hours, due Friday' and the app will parse it automatically.\n\n**Tip:** Entries can have a timer. Click **Start** to begin tracking time.",
        keywords: ['first entry', 'create', 'new entry', 'add task'],
      },
      {
        id: 'projects-basics',
        title: 'Understanding Projects',
        content:
          'Projects group related entries together. Think of them as courses, modules, or workstreams.\n\n**To create a project:**\n1. Open the drawer menu (hamburger icon)\n2. Scroll to the **Projects** section\n3. Click **+ New Project**\n4. Give it a name and define custom columns (fields)\n\n**Custom columns:** Each project can have its own set of fields (text, number, date, image, etc.) that every entry in that project will have.\n\n**Project views:** Switch between Table, Cards, Checklist, and Board views using the view toggle at the top of any project page.',
        keywords: ['project', 'create project', 'columns', 'fields', 'organise'],
      },
    ],
  },
  {
    id: 'how-to-guides',
    title: 'How-To Guides',
    icon: '📖',
    articles: [
      {
        id: 'using-focus-mode',
        title: 'Using Focus Mode',
        content:
          "Focus Mode gives you a full-screen, distraction-free timer for deep work sessions.\n\n**To start a Focus session:**\n1. On any entry card, check the **Focus** checkbox\n2. Select a duration (15, 25, 30, 45, 60, 90, or 120 minutes)\n3. Click **Start** — you'll be taken to the Focus page\n\n**On the Focus page:**\n- A circular timer shows your remaining time\n- **Pause** to temporarily stop the timer\n- **Resume** to continue after pausing\n- **End Task** to finish early\n- **Exit** (top-right arrow) to return to the dashboard\n- A sound plays when the timer completes\n\n**Tip:** The default 25-minute duration follows the Pomodoro Technique.",
        keywords: ['focus', 'timer', 'pomodoro', 'concentration', 'distraction-free'],
      },
      {
        id: 'calendar-view',
        title: 'Using the Calendar View',
        content:
          "The Calendar view shows all your entries on a monthly grid, colour-coded by project.\n\n**Navigate:**\n- Use the **< >** arrows to move between months\n- Click any day to see entries due on that date\n\n**Drag to reschedule:**\n- Drag an entry from one day to another to change its due date\n- The change saves automatically\n\n**Colour coding:** Each project has a unique colour. Entries inherit their project's colour on the calendar.",
        keywords: ['calendar', 'schedule', 'reschedule', 'drag', 'monthly view'],
      },
      {
        id: 'kanban-board',
        title: 'Using the Kanban Board',
        content:
          'The Kanban board organises entries into columns by status: **Up Next**, **In Motion**, and **Done & Dusted**.\n\n**Drag and drop:**\n- Drag entries between columns to change their status\n- Changes save automatically\n\n**Within a column:**\n- Entries are sorted by priority (urgent at the top)\n- Click any entry to expand and edit it',
        keywords: ['kanban', 'board', 'drag', 'status', 'columns', 'workflow'],
      },
      {
        id: 'timeline-view',
        title: 'Using the Timeline View',
        content:
          "The Timeline view shows your entries as a Gantt-style chart, perfect for seeing how tasks overlap and depend on each other.\n\n**Features:**\n- **Zoom:** Use the zoom controls to see days, weeks, or months\n- **Scroll:** Navigate through time horizontally\n- **Dependencies:** Arrows show which entries depend on others\n- **Colour-coded:** Each bar uses its project's colour",
        keywords: ['timeline', 'gantt', 'dependencies', 'zoom', 'overlap'],
      },
      {
        id: 'today-view',
        title: 'Using the Today View',
        content:
          'The Today view shows what needs your attention right now.\n\n**Organisation:**\n1. **Overdue** entries appear first (in red)\n2. **Due today** entries come next\n3. **In progress** entries follow\n4. Everything else is listed below\n\n**Quick actions:**\n- Start/stop timers directly from the list\n- Change priority and status with the dropdowns\n- Click any entry to expand and edit',
        keywords: ['today', 'daily', 'overdue', 'due today', 'priority'],
      },
      {
        id: 'notifications',
        title: 'Managing Notifications',
        content:
          "Digital Logbook sends email notifications for upcoming and overdue tasks.\n\n**Notification types:**\n- **Due soon:** Alert before a task's due date\n- **Overdue:** Alert when a task passes its due date\n\n**Settings:**\n- Open your profile menu (top-right avatar)\n- Go to **Settings** to configure notification preferences\n- Toggle email notifications on or off\n\n**In-app bell:** The bell icon in the navigation bar shows unread notifications. Click it to view and dismiss alerts.",
        keywords: ['notifications', 'email', 'alerts', 'reminders', 'bell', 'due soon'],
      },
      {
        id: 'import-export',
        title: 'Importing and Exporting Data',
        content:
          'You can export your data for backup or import data from other sources.\n\n**Export formats:**\n- **JSON:** Full data backup with all fields\n- **CSV:** Spreadsheet-compatible format\n- **Markdown:** Human-readable text format\n- **iCalendar (.ics):** Import into Google Calendar, Outlook, etc.\n\n**To export:**\n1. Open the drawer menu\n2. Click **Import & Export**\n3. Choose your format and click **Export**\n\n**To import:**\n1. Go to **Import & Export**\n2. Choose your file format\n3. Select the file and map fields if needed\n4. Click **Import**',
        keywords: ['import', 'export', 'backup', 'csv', 'json', 'markdown', 'ics', 'calendar'],
      },
      {
        id: 'themes',
        title: 'Changing Themes and Appearance',
        content:
          'Customise the look and feel of your logbook.\n\n**To change theme:**\n1. Open your profile menu (top-right avatar)\n2. Go to **Settings** or **Theme**\n3. Choose from available themes\n\n**Available customisations:**\n- Light and dark themes\n- Multiple colour accents\n- Font size and family options\n\n**Theme matching:** Focus Mode and all pages automatically match your selected theme.',
        keywords: ['theme', 'dark mode', 'light mode', 'appearance', 'colours', 'font'],
      },
    ],
  },
  {
    id: 'roles-permissions',
    title: 'Roles & Permissions',
    icon: '🔐',
    articles: [
      {
        id: 'user-roles',
        title: 'Understanding User Roles',
        content:
          'Digital Logbook supports different permission levels for project collaboration.\n\n**Role: Owner**\n- Full control over the project\n- Can create, edit, and delete all entries\n- Can manage project settings and custom fields\n- Can invite and manage other members\n\n**Role: Editor**\n- Can create and edit entries\n- Can change entry status and priority\n- Cannot delete entries or modify project settings\n\n**Role: Viewer**\n- Can view all entries and project data\n- Cannot make any changes\n- Useful for supervisors or stakeholders who need read-only access',
        keywords: ['roles', 'permissions', 'owner', 'editor', 'viewer', 'access'],
      },
      {
        id: 'field-permissions',
        title: 'Field-Level Permissions',
        content:
          'Project owners can control who can see and edit specific fields.\n\n**Permission levels per field:**\n- **Edit:** The role can view and modify the field\n- **View:** The role can see the field but not change it\n- **Hidden:** The field is completely invisible to the role\n\n**To configure:**\n1. Open the project settings\n2. Go to the **Fields** section\n3. Set permissions for each role on each field\n\n**Note:** Owners always have full access to all fields regardless of settings.',
        keywords: ['field permissions', 'field-level', 'visibility', 'edit rights'],
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: '🔧',
    articles: [
      {
        id: 'entries-not-saving',
        title: 'Entries Not Saving',
        content:
          "If your entries aren't saving, try these steps:\n\n1. **Check your connection:** The app works offline and queues changes, but needs internet to sync. Look for the offline indicator in the navigation bar.\n2. **Refresh the page:** Sometimes a stale session can cause issues. Refresh and try again.\n3. **Check field requirements:** Required fields must be filled before saving. Look for red validation messages.\n4. **Clear browser cache:** Go to your browser settings and clear cached data for the site.\n5. **Try a different browser:** Some browser extensions can interfere with the app.\n\nIf the problem persists, use the **Report a Bug** link below.",
        keywords: ['not saving', 'save error', 'sync', 'offline', 'cache'],
      },
      {
        id: 'timer-not-working',
        title: 'Timer Not Starting or Stopping',
        content:
          "If the timer buttons aren't responding:\n\n1. **Check entry status:** Timers only work on entries that are not archived or marked as done.\n2. **Wait for sync:** After clicking Start, wait a moment for the server to confirm. The button shows 'Starting…' during this time.\n3. **Overdue entries:** If an entry is overdue, the timer controls may be disabled. Update the due date first.\n4. **Focus Mode:** If you're in Focus Mode, use the Pause/Resume/End Task buttons on the focus page instead.\n5. **Refresh:** If the timer display is stuck, refresh the page. The timer recalculates from stored timestamps.",
        keywords: ['timer', 'start', 'stop', 'pause', 'not working', 'focus'],
      },
      {
        id: 'notifications-not-received',
        title: 'Not Receiving Email Notifications',
        content:
          "If you're not getting notification emails:\n\n1. **Check notification settings:** Open your profile menu and verify email notifications are enabled.\n2. **Check spam folder:** Notification emails may land in your spam/junk folder.\n3. **Verify email address:** Make sure your account email is correct in your profile settings.\n4. **Due date required:** Notifications only fire for entries with a due date set.\n5. **Browser notifications:** The in-app bell always shows notifications even if emails fail.\n\n**Note:** Email delivery depends on the email service configuration. If issues persist, report a bug.",
        keywords: ['email', 'notifications', 'not received', 'spam', 'settings'],
      },
      {
        id: 'mobile-issues',
        title: 'Mobile Display Issues',
        content:
          "If the app doesn't look right on your phone:\n\n1. **Zoom level:** Make sure your browser isn't zoomed in. Use pinch-to-zoom to reset.\n2. **Rotate screen:** Some views work better in landscape mode.\n3. **Clear cache:** Mobile browsers can hold stale styles. Clear your browser's cache.\n4. **Update browser:** Make sure you're using a recent version of Chrome, Safari, or Firefox.\n5. **Table view on mobile:** The table view automatically switches to a stacked card layout on small screens.\n\n**Best mobile experience:** Use the Cards or Checklist view on mobile devices.",
        keywords: ['mobile', 'phone', 'responsive', 'display', 'layout', 'small screen'],
      },
    ],
  },
  {
    id: 'account-privacy',
    title: 'Account & Privacy',
    icon: '',
    articles: [
      {
        id: 'account-settings',
        title: 'Managing Your Account',
        content:
          'Your account settings control your profile and preferences.\n\n**To access settings:**\n1. Click your avatar/profile icon in the top-right corner\n2. Select **Settings** from the dropdown\n\n**Available settings:**\n- **Profile:** Update your display name and avatar\n- **Theme:** Choose your preferred colour theme\n- **Notifications:** Toggle email and in-app notifications\n- **Password:** Change your account password\n- **Sign out:** End your current session',
        keywords: ['account', 'settings', 'profile', 'password', 'sign out'],
      },
      {
        id: 'data-privacy',
        title: 'Data Privacy and Security',
        content:
          'Your data privacy is important to us.\n\n**Where your data lives:**\n- All entries, projects, and settings are stored securely in the cloud\n- Data is associated with your account email\n- Only you (and project members you invite) can see your data\n\n**Data export:** You can export all your data at any time via Import & Export.\n\n**Data deletion:** Contact us if you need your account and data permanently deleted.\n\n**No third-party sharing:** Your logbook data is never shared with third parties.',
        keywords: ['privacy', 'security', 'data', 'deletion', 'export', 'gdpr'],
      },
    ],
  },
  {
    id: 'faq',
    title: 'FAQ',
    icon: '❓',
    articles: [
      {
        id: 'faq-free',
        title: 'Is Digital Logbook free to use?',
        content:
          'Yes! Digital Logbook is currently free to use during its beta period. It was built as a university project by Team Codacaine at Wits University.',
        keywords: ['free', 'cost', 'price', 'payment', 'beta'],
      },
      {
        id: 'faq-offline',
        title: 'Can I use the app offline?',
        content:
          "Yes, the app supports offline mode. You can create and edit entries while offline, and changes will sync automatically when you reconnect. The navigation bar shows an offline indicator when you're not connected.\n\n**Limitations:**\n- Timer start/stop requires a connection to confirm with the server\n- Email notifications won't be sent until you're back online\n- New project creation requires a connection",
        keywords: ['offline', 'no internet', 'sync', 'connection'],
      },
      {
        id: 'faq-natural-language',
        title: 'How does natural language entry work?',
        content:
          "The Quick Entry bar on the Dashboard accepts natural language input. Type your task as you would describe it to someone, and the app will parse key details.\n\n**Examples:**\n- 'Studied chapter 5 for 2 hours, due Friday' → Creates an entry with a 2-hour timer, due this Friday\n- 'Finish the report by next Monday, high priority' → Creates a high-priority entry due next Monday\n- 'Team meeting tomorrow at 3pm' → Creates an entry due tomorrow at 3 PM\n\n**Tips:**\n- Mention time durations to auto-set the timer\n- Use day names or dates for due dates\n- Include priority keywords: urgent, high, medium, low",
        keywords: ['natural language', 'quick entry', 'parse', 'ai', 'smart entry'],
      },
      {
        id: 'faq-multiple-projects',
        title: 'How many projects can I create?',
        content:
          'There is no hard limit on the number of projects you can create. Organise your work however makes sense — by course, by semester, by type of work, etc.\n\n**Tip:** Use the project search and filters on the Dashboard to quickly find entries across all your projects.',
        keywords: ['projects', 'limit', 'how many', 'organise'],
      },
      {
        id: 'faq-image-fields',
        title: 'Can I attach images to entries?',
        content:
          'Yes! If your project has an image-type field, you can attach images to entries.\n\n**Supported formats:** JPEG, PNG, GIF, WebP\n\n**How it works:**\n1. The project owner adds an image-type column in project settings\n2. When creating/editing an entry, click the image field to upload\n3. Images are displayed as thumbnails in the entry table\n\n**Note:** Very large images may take longer to upload on slow connections.',
        keywords: ['image', 'photo', 'picture', 'attach', 'upload'],
      },
    ],
  },
  {
    id: 'glossary',
    title: 'Glossary',
    icon: '📚',
    articles: [
      {
        id: 'glossary-terms',
        title: 'Key Terms',
        content:
          "**Entry:** A single task, activity, or work session recorded in your logbook.\n\n**Project:** A collection of related entries, like a course or workstream.\n\n**Field / Column:** A data attribute defined by a project (e.g., task description, priority, custom fields).\n\n**Status:** The current state of an entry — Up Next, In Motion, or Done & Dusted.\n\n**Priority:** How urgent an entry is — Urgent & Important, Urgent, Not Urgent, or No Priority.\n\n**Due Date:** When an entry should be completed by.\n\n**Focus Mode:** A full-screen distraction-free timer for deep work sessions.\n\n**Payload:** The structured data stored inside an entry (the field values).\n\n**Kanban:** A board view with columns representing workflow stages.\n\n**Timeline / Gantt:** A horizontal bar chart showing entries over time with dependencies.\n\n**Payload State:** Whether an entry's data is structured (object with fields) or legacy (plain text).",
        keywords: ['glossary', 'terms', 'definitions', 'jargon'],
      },
    ],
  },
  {
    id: 'release-notes',
    title: 'Release Notes',
    icon: '📋',
    articles: [
      {
        id: 'release-latest',
        title: 'Latest Updates',
        content:
          '**Focus Mode** — Full-screen distraction-free timer with circular progress ring, pause/resume controls, completion sound, and configurable duration presets (15–120 min).\n\n**Image Field Thumbnails** — Image-type fields now display as small thumbnails instead of raw text in both entry cards and the project table view.\n\n**Overdue Entry Protection** — Status and priority dropdowns are now disabled on overdue entries to prevent accidental changes.\n\n**Mobile Improvements** — Entry field column names are now visible on mobile, and the New Project modal inputs are properly styled.\n\n**Timer Enhancements** — Presets, auto-stop, analytics, shortcuts, and improved mobile UX for the timer system.',
        keywords: ['release', 'updates', 'changelog', 'new features', 'latest'],
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact & Feedback',
    icon: '💬',
    articles: [
      {
        id: 'report-bug',
        title: 'Report a Bug',
        content:
          'Found a bug? We want to fix it!\n\n**To report a bug:**\n1. Note what you were doing when the bug occurred\n2. Take a screenshot if possible\n3. Note your browser and device type\n4. Use the **Report a Bug** button below to open a bug report\n\n**What to include:**\n- Steps to reproduce the issue\n- Expected behaviour vs. actual behaviour\n- Screenshots or screen recordings\n- Browser name and version\n- Whether you were online or offline',
        keywords: ['bug', 'report', 'error', 'issue', 'problem'],
      },
      {
        id: 'feedback',
        title: 'Send Feedback',
        content:
          "We love hearing from users! Your feedback helps us improve Digital Logbook.\n\n**What to share:**\n- Feature requests — what would you like to see?\n- Usability feedback — what's confusing or hard to use?\n- General comments — anything on your mind\n\n**Contact:** Use the feedback form below or reach out through your course representative.\n\n**Built by:** Team Codacaine — COMS3011A Project 7, Wits University.",
        keywords: ['feedback', 'suggestion', 'feature request', 'contact', 'improvement'],
      },
    ],
  },
];

/** Flatten all articles for search */
export function getAllArticles(): (HelpArticle & { categoryId: string; categoryTitle: string })[] {
  const all: (HelpArticle & { categoryId: string; categoryTitle: string })[] = [];
  for (const cat of HELP_CATEGORIES) {
    for (const article of cat.articles) {
      all.push({ ...article, categoryId: cat.id, categoryTitle: cat.title });
    }
  }
  return all;
}

/** Search articles by query string */
export function searchArticles(
  query: string
): (HelpArticle & { categoryId: string; categoryTitle: string })[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const all = getAllArticles();
  return all.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.keywords.some((k) => k.toLowerCase().includes(q))
  );
}
