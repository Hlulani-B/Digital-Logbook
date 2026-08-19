# UI Design

## Design Philosophy

The Digital Logbook follows a **vintage notebook aesthetic** with modern usability patterns. The design emphasizes:
- Warm, earth-tone color palettes
- Readable typography with accessibility focus
- Intuitive navigation via drawer menu
- Quick entry capture as the primary action

## Color System

### Theme Structure
The app uses CSS custom properties for theming, defined in `index.css`:

```css
:root {
  --bg: #faf6ec;
  --text: #3b2f1e;
  --accent: #8b7355;
  --border: #d4c5a9;
  /* ... */
}
```

### Available Themes
1. **Light (Default)** - Warm ivory background with brown text
2. **Dark** - Pure black/white/grey for low-light environments
3. **Pastel Vintage** - Softer pastel palettes (ivory, blush, powder blue, pale lilac, sage mist, soft tan)
4. **Brown Vintage** - Rich earth tones (espresso, navy ink, deep plum, forest, terracotta, walnut)

### Dark Theme
```css
[data-theme="dark"] {
  --bg: #000000;
  --text: #ffffff;
  --accent: #e0e0e0;
  --border: #333333;
}
```

**Note**: White buttons in dark theme use black text for visibility.

## Typography

### Font Stack
- **Primary**: Lora (serif) - Default font for readability
- **Alternatives**: Playfair Display, Crimson Text, EB Garamond
- **UI**: Plus Jakarta Sans (sans-serif) for interface elements

### Base Sizes
- **Desktop**: 18px base (112.5%)
- **Mobile**: 17px base (106.25%)
- **Line height**: 1.65 for body text

### Accessibility
Font sizes are increased from browser defaults for better readability:
```css
html {
  font-size: 112.5%; /* 18px base */
}

@media (max-width: 768px) {
  html {
    font-size: 106.25%; /* 17px base on mobile */
  }
}
```

## Layout Patterns

### Split-Screen Sign-In
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                 â”‚                 â”‚
â”‚   Video Panel   â”‚   Form Panel    â”‚
â”‚   (22vh height) â”‚   (scrollable)  â”‚
â”‚                 â”‚                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Mobile**: Video panel reduces to 22vh, form panel becomes scrollable.

### Dashboard Layout
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Header (Stats, Search, Settings)   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚          â”‚                          â”‚
â”‚  Drawer  â”‚    Main Content          â”‚
â”‚  Menu    â”‚    - Due Soon            â”‚
â”‚          â”‚    - Up Next             â”‚
â”‚          â”‚    - Activity Feed       â”‚
â”‚          â”‚                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Quick Entry Bar
Fixed at top of dashboard for rapid log entry:
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ âœï¸ Quick add: "Fixed login bug..." âž¤ â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## Component Library

### Buttons

#### Primary Button
```css
.btn-primary {
  background: #3b2f1e;
  color: #faf6ec;
  border-radius: var(--radius-xs);
  padding: 0.55rem 1.35rem;
}
```

#### Save Button
```css
.btn-save {
  background: var(--accent);
  color: white;
}
```

#### Dark Theme Overrides
```css
[data-theme="dark"] .btn-primary {
  background: var(--accent);
  color: #000000; /* Black text on light background */
}
```

### Entry Box
Notion-style card with:
- Bold project title
- Colored priority/status tags
- Table layout for fields
- Three-dots menu for actions

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Project Name              â‹¯    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Description: Fixed login bug   â”‚
â”‚ Status: completed              â”‚
â”‚ Hours: 2                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ Priority: Urgent    Due: Aug 20â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Drawer Menu
Slide-out navigation with:
- View filters (All, Recent, Drafts, Activity)
- Project list with entry counts
- Archive section (placeholder)

### Settings Panel
Slide-out panel with tabs:
- **Profile**: Username, avatar
- **Preferences**: Theme, font, corner style
- **Account**: Password reset, delete account

### Toast Notifications
Pretty toast for AI comments:
```css
.quick-entry-toast {
  background: linear-gradient(135deg, rgba(139,115,85,0.08), rgba(166,139,107,0.12));
  border: 1px solid rgba(139,115,85,0.18);
  border-radius: var(--radius-sm);
  animation: toast-slide-in 0.35s ease-out;
}
```

## Responsive Design

### Breakpoints
- **Mobile**: â‰¤768px
- **Tablet**: 769px - 1024px
- **Desktop**: >1024px

### Mobile Adaptations
1. **Sign-in**: Video panel shrinks, form scrolls
2. **Dashboard**: Drawer becomes overlay, FAB moves to bottom-right
3. **Entry boxes**: Stack vertically, reduce padding
4. **Fonts**: Slightly smaller base size for space efficiency

### Touch Targets
All interactive elements meet minimum 44x44px touch target size.

## Visual Hierarchy

### Priority Colors
- **Urgent & Important** (0): Red tag
- **Urgent** (1): Orange tag
- **Not Urgent** (2): Yellow tag
- **None**: Grey tag

### Status Indicators
- **Active**: Green dot
- **Archived**: Grey dot, reduced opacity
- **Due Soon**: Orange highlight
- **Overdue**: Red highlight

## Corner Styles

Users can choose corner rounding:
- **Rounded**: `border-radius: 12px`
- **Soft**: `border-radius: 6px`
- **Sharp**: `border-radius: 0`

Applied globally via CSS custom property:
```css
:root {
  --radius-sm: 6px;
  --radius-xs: 4px;
}
```

## Iconography

### Icon Library
- **Feather Icons** via React Icons
- Consistent 16x16px size in UI
- Stroke-based for scalability

### Common Icons
- âœï¸ Edit/Entry
- ðŸ“ Project
- âš™ï¸ Settings
- ðŸ” Search
- âž• Add/Create
- â‹¯ More options

## Animation

### Transitions
- **Panel slides**: 0.3s ease-in-out
- **Button hovers**: 0.2s ease
- **Toast notifications**: 0.35s slide-in

### Loading States
- Spinner for async operations
- Skeleton screens (planned)
- Disabled buttons during submission

## Accessibility

### Color Contrast
All text meets WCAG AA standards:
- Normal text: 4.5:1 contrast ratio
- Large text: 3:1 contrast ratio

### Keyboard Navigation
- All interactive elements focusable
- Visible focus indicators
- Logical tab order

### Screen Readers
- Semantic HTML (nav, main, section, article)
- ARIA labels on icon buttons
- Alt text on images

## Future Enhancements

### Sprint 2 Candidates
- Dark mode auto-detection (prefers-color-scheme)
- High contrast theme option
- Reduced motion preferences
- Custom color picker for themes
- Drag-and-drop entry reordering
- Collapsible drawer sections

---

## UI Walkthrough â€” Screenshots

> Screenshot files should be placed in `../assets/ui-images/` in the repo, keeping their original filenames so the links resolve.

### 1. Authentication â€” Sign In

`../assets/ui-images/Screenshot_19-8-2026_124011_digital-logbook-bxgv.onrender.com.jpeg`

The sign-in screen uses a split layout: a full-bleed lifestyle image (typewriter/journal theme) on the left reinforcing the "logbook" concept, and a clean form on the right with email/password fields, a "Sign In" button, links to create an account or reset password, and OAuth options (Google, GitHub).

**Design decision:** the imagery anchors the product's identity (writing, tracking progress) before the user even logs in.

### 2. Onboarding â€” Profile Setup

`../assets/ui-images/Screenshot_19-8-2026_124024_digital-logbook-bxgv.onrender.com.jpeg`

After first sign-in, the user is asked to confirm their email, enter their full name, and choose a username (lowercase letters, numbers, underscores only, validated inline). A "Continue" button progresses to the next onboarding step.

**Design decision:** minimal required fields to reduce onboarding friction.

### 3. Onboarding â€” Avatar Selection

`../assets/ui-images/Screenshot_19-8-2026_124058_digital-logbook-bxgv.onrender.com.jpeg`

A grid of pre-made avatar icons lets the user pick a profile picture without needing to upload an image. Covers a range of styles/skin tones.

**Design decision:** avoids the complexity (and moderation risk) of custom image uploads while still letting users personalize their identity.

### 4. Main Dashboard â€” All Entries (Empty State)

`../assets/ui-images/Screenshot_19-8-2026_124214_digital-logbook-bxgv.onrender.com.jpeg`

The core screen of the app. Top navigation bar has a menu toggle, app logo/name, search, and user account dropdown. Below that:
- **Filter entries** search bar
- **Due Soon / All Entries** toggle tabs
- **Sort** controls (Date / Priority)
- **Quick add** bar with natural-language placeholder text (e.g. *"Fixed login bug for ProjectX, urgent, due tomorrow"*)
- Empty state illustration with a clock icon and "Nothing due soon" messaging when there's nothing due in the next 3 days
- Floating **+** action button (bottom left) for creating new entries/projects

**Design decision:** the "Due Soon" default view keeps the user focused on what's urgent rather than a flooded list.

### 5. Navigation Sidebar

`../assets/ui-images/Screenshot_19-8-2026_124325_digital-logbook-bxgv.onrender.com.jpeg`

Slide-out panel triggered by the menu icon. Organized into:
- **Views:** All Entries, Recent, Drafts, My Stats (each with entry counts)
- **Archive:** Archived Projects
- **Projects:** user-created projects (e.g. Software Design Project, Meal Plan, Workout), each with entry counts
- **New Project** button pinned at the bottom

**Design decision:** projects act as customizable categories/templates, separating structural navigation (Views/Archive) from user content (Projects).

### 6. Floating Action Menu

`../assets/ui-images/Screenshot_19-8-2026_124439_digital-logbook-bxgv.onrender.com.jpeg`

Tapping the **+** button expands into two options: **New Entry** and **New Project**, keeping primary creation actions one tap away from anywhere in the app.

### 7. New Project â€” Empty Form

`../assets/ui-images/Screenshot_19-8-2026_124531_digital-logbook-bxgv.onrender.com.jpeg`

Form for creating a project with:
- Project name field
- Optional description textarea
- **Project Fields** section â€” starts empty with a message ("No fields defined...") and an **Add Another Project Field** button

**Design decision:** projects are schema-driven â€” the user defines what data each entry under that project will capture (a "Meal Plan" project has different fields than a "Workout" project).

### 8. New Project â€” Defining Fields

`../assets/ui-images/Screenshot_19-8-2026_124612_digital-logbook-bxgv.onrender.com.jpeg`

Each field row lets the user set: field name, field type (dropdown, e.g. "Text"), whether it's **Required** (checkbox), and a remove (Ã—) button. Example shown: a "Software Design Project" with a custom field.

### 9. New Project â€” Workout Example

`../assets/ui-images/Screenshot_19-8-2026_124637_digital-logbook-bxgv.onrender.com.jpeg`

Shows a populated example: project name "Workout", description "I want to write what I want to focus on at the gym," and a single required "Target" text field.

### 10. New Project â€” Meal Plan Example (Multiple Fields)

`../assets/ui-images/Screenshot_19-8-2026_124655_digital-logbook-bxgv.onrender.com.jpeg`

Shows a project with four fields already defined: Lunch, Breakfast, Supper, Snack â€” all Text type, demonstrating the dynamic multi-field capability.

### 11. New Entry â€” Project Picker

`../assets/ui-images/Screenshot_19-8-2026_12522_digital-logbook-bxgv.onrender.com.jpeg`

When creating a new entry, the user first selects which project it belongs to from a list (Software Design Project, Meal Plan, Workout), each shown with a folder icon.

### 12. New Entry â€” Empty Form (Dynamic Fields)

`../assets/ui-images/Screenshot_19-8-2026_125226_digital-logbook-bxgv.onrender.com.jpeg`

Once a project is selected, the entry form dynamically renders the fields defined for that project (Lunch, Breakfast, Supper, Snack for "Meal Plan"), plus common fields:
- **Due Date** (date/time picker)
- **Priority** dropdown (e.g. "No priority")
- **Status** dropdown (e.g. "Up Next")

**Design decision:** the entry form is generated entirely from the project's field schema â€” no hardcoded entry types.

### 13. New Entry â€” Filled Form

`../assets/ui-images/Screenshot_19-8-2026_125329_digital-logbook-bxgv.onrender.com.jpeg`

Same form populated with real values (Lunch: "Dunked Wings", Breakfast: "Dunked Wings", Supper: "Zinger Wings", Snack: "Strawberry and Banana"), due date set, priority set to "Not urgent, not important," status "Up Next," with **Cancel** / **Add Entry** actions.

### 14. Entry Card â€” Detail View

`../assets/ui-images/Screenshot_19-8-2026_125412_digital-logbook-bxgv.onrender.com.jpeg`

Once created, an entry renders as a card showing: priority dropdown, status badge ("Up Next"), title, all field values in a label/value list, a **Created** date, **Due** date, and a **Start Task** button (with a play icon) to begin time tracking. A "..." menu offers further actions.

### 15. Quick Add â€” Natural Language Entry

`../assets/ui-images/Screenshot_19-8-2026_125651_digital-logbook-bxgv.onrender.com.jpeg`

Typing directly into the quick-add bar (e.g. "I need to work on my abs day tomorrow morning") and submitting creates an entry without opening the full form â€” parsed into the relevant project/fields.

### 16. Dashboard with Populated Entries

`../assets/ui-images/Screenshot_19-8-2026_124011_digital-logbook-bxgv.onrender.com.jpeg`

Shows the "Due Soon" view with an actual entry card ("Workout" with Target: "abs day tomorrow morning", created/due dates, Start Task button) â€” demonstrating the empty-state-to-populated transition.

### 17. Account Menu

`../assets/ui-images/Screenshot_19-8-2026_12353_digital-logbook-bxgv.onrender.com.jpeg`

Dropdown from the top-right user badge showing: display name, email, **Manage Profile**, **Settings**, and **Sign Out** (styled distinctly in a warning tone).

### 18. Settings â€” Preferences (Theme: Soft Tan, Font: Crimson Text)

`../assets/ui-images/Screenshot_19-8-2026_123958_digital-logbook-bxgv.onrender.com.jpeg`

Settings modal with **Profile / Preferences / Account** tabs. Preferences tab covers:
- **Time Format** (e.g. 24-hour)
- **Theme** dropdown (e.g. Soft Tan)
- **Font** dropdown (e.g. Crimson Text)
- **Corner Style** dropdown (e.g. Rounded (Default))
- A **Behavior** section below (collapsed/scrolled past in this view)
- **Cancel** / **Save Changes** actions

### 19. Settings â€” Font Variation (Plus Jakarta Sans)

`../assets/ui-images/Screenshot_19-8-2026_123315_digital-logbook-bxgv.onrender.com.jpeg`

Same Preferences panel with Font changed to "Plus Jakarta Sans," demonstrating live typography switching across the whole app.

### 20. Settings â€” Font Variation (Playfair Display)

`../assets/ui-images/Screenshot_19-8-2026_123344_digital-logbook-bxgv.onrender.com.jpeg`

Same panel with Font set to "Playfair Display," on a tan-background dashboard behind it, showing the theme + font combination together.

### 21. Dashboard â€” Empty State (Tan Theme Variant)

`../assets/ui-images/Screenshot_19-8-2026_123423_digital-logbook-bxgv.onrender.com.jpeg`

The "All Entries / Nothing due soon" screen shown in a warm tan background theme, confirming the theming system covers the entire app shell consistently.

### 22. Dashboard â€” Empty State (Lavender Theme Variant)

`../assets/ui-images/Screenshot_19-8-2026_123443_digital-logbook-bxgv.onrender.com.jpeg`

Same empty-state screen in a light lavender background theme.

### 23. Dashboard â€” Dark Theme

`../assets/ui-images/Screenshot_19-8-2026_123527_digital-logbook-bxgv.onrender.com.jpeg`

The "All Entries" dashboard rendered in a dark theme â€” dark background, light text â€” confirming full dark-mode support across the interface, not just isolated components.

### 24. Settings â€” Theme Variation (Pale Lilac, full-width layout)

`../assets/ui-images/Screenshot_19-8-2026_123545_digital-logbook-bxgv.onrender.com.jpeg`

Preferences panel (full-width layout) with additional **Week Starts On** field (e.g. Monday), Theme set to "Pale Lilac," Font "Lora (Default)."

### 25. Dashboard â€” Empty State (Blush Theme Variant)

`../assets/ui-images/Screenshot_19-8-2026_12366_digital-logbook-bxgv.onrender.com.jpeg`

Empty-state dashboard shown in a blush/pink background theme.

### 26. Dashboard â€” Empty State (Cream Theme Variant)

`../assets/ui-images/Screenshot_19-8-2026_12377_digital-logbook-bxgv.onrender.com.jpeg`

Empty-state dashboard shown in a cream background theme.

### 27. Dashboard â€” Empty State (Peach Theme Variant)

`../assets/ui-images/Screenshot_19-8-2026_12395_digital-logbook-bxgv.onrender.com.jpeg`

Empty-state dashboard shown in a soft peach background theme.

### 28. Dashboard â€” Empty State (Pink Variant)

`../assets/ui-images/Screenshot_19-8-2026_12366_digital-logbook-bxgv.onrender.com.jpeg`

Empty-state dashboard in a pink-toned background â€” a distinct shade from the blush variant above, suggesting the theme picker offers several pink/warm tones rather than just one.

### 29. Dashboard â€” Empty State (Light Blue / Cool Variant)

`../assets/ui-images/Screenshot_19-8-2026_12377_digital-logbook-bxgv.onrender.com.jpeg`

Empty-state dashboard in a cool light-blue background tone, distinct from the lavender/purple variants â€” rounds out the cool end of the theme palette alongside the warm tan/peach/blush tones.

### 30. Dashboard â€” Empty State (Purple / Mauve Variant)

`../assets/ui-images/Screenshot_19-8-2026_123443_digital-logbook-bxgv.onrender.com.jpeg`

Empty-state dashboard in a deeper purple/mauve tone, distinct from the lighter Pale Lilac setting shown in item 24 â€” indicates the theme system has multiple purple-family options, not just one.

### 31. Settings â€” Corner Style Variation (Sharp/Vintage)

`../assets/ui-images/Screenshot_19-8-2026_125412_digital-logbook-bxgv.onrender.com.jpeg`

Preferences panel with **Corner Style** changed to "Sharp (Vintage)," showing input fields and buttons render with squared corners instead of rounded â€” confirming the Corner Style setting applies globally to UI elements.

### Summary of Design System Capabilities

- **Layout:** consistent top nav (menu, logo, search, account) + content area + floating action button across all screens
- **Theming:** multiple background themes (Soft Tan, Pale Lilac, Dark, Blush, Cream, Peach, Lavender, etc.), all applied consistently across dashboard, cards, and modals
- **Typography:** multiple font choices (Crimson Text, Plus Jakarta Sans, Playfair Display, Lora), user-selectable
- **Shape system:** Rounded (default) vs Sharp (Vintage) corner styles, applied app-wide
- **Dynamic forms:** both Projects and Entries are schema-driven â€” fields are user-defined per project and rendered dynamically on entry creation
- **Time tracking:** entries support a "Start Task" action tied to time-tracking functionality
- **Natural language input:** quick-add bar for fast entry creation without the full form



