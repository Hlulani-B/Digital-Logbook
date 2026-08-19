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
┌─────────────────┬─────────────────┐
│                 │                 │
│   Video Panel   │   Form Panel    │
│   (22vh height) │   (scrollable)  │
│                 │                 │
└─────────────────┴─────────────────┘
```

**Mobile**: Video panel reduces to 22vh, form panel becomes scrollable.

### Dashboard Layout
```
┌─────────────────────────────────────┐
│  Header (Stats, Search, Settings)   │
├──────────┬──────────────────────────┤
│          │                          │
│  Drawer  │    Main Content          │
│  Menu    │    - Due Soon            │
│          │    - Up Next             │
│          │    - Activity Feed       │
│          │                          │
└──────────┴──────────────────────────┘
```

### Quick Entry Bar
Fixed at top of dashboard for rapid log entry:
```
┌─────────────────────────────────────┐
│ ✏️ Quick add: "Fixed login bug..." ➤ │
└─────────────────────────────────────┘
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
┌─────────────────────────────────┐
│ Project Name              ⋯    │
├─────────────────────────────────┤
│ Description: Fixed login bug   │
│ Status: completed              │
│ Hours: 2                       │
├─────────────────────────────────┤
│ Priority: Urgent    Due: Aug 20│
└─────────────────────────────────┘
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
- **Mobile**: ≤768px
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
- ✏️ Edit/Entry
- 📁 Project
- ⚙️ Settings
- 🔍 Search
- ➕ Add/Create
- ⋯ More options

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
