# Layout Expectations - Mobile-First Design

## Test Specifications for Visual Regression

### LoginView.vue

**Expected Layout:**
- Title: Centered, large typography with proper letter-spacing
- Description: Max-width of 320px (md:max-w-md on desktop), centered, proper line breaks
- Button: Full-width (w-full) up to max-width container, centered
- Vertical spacing: mb-8 between header and button
- Padding: px-6 for safe horizontal margins

**Test Assertions:**
```javascript
// Description text should not wrap awkwardly
expect(description).toHaveMaxWidth('320px on mobile');
expect(description).toHaveCenteredText();
expect(description).toHaveLineHeight('relaxed or loose');
```

---

### RoomSelectionView.vue

**Expected Layout:**
- Title: Centered, uppercase, mb-8 spacing
- Container: max-w-md (448px), centered
- Buttons: Full-width within container
- Spacing: space-y-5 between sections

**Test Assertions:**
```javascript
expect(createButton).toHaveFullWidth();
expect(joinButton).toHaveFullWidth();
expect(container).toHaveMaxWidth('28rem');
```

---

### RoomLobbyView.vue

**Expected Layout:**
- Top padding: pt-safe (safe-area-inset-top) OR pt-12 minimum
- Header layout:
  - Mobile (<768px): Stack buttons vertically (flex-col, space-y-3)
  - Desktop (≥768px): Side-by-side (flex-row, space-x-3)
- Room code: Large, bold, properly spaced from top
- Cards: Stack vertically on mobile, side-by-side on desktop (md:grid-cols-2)

**Test Assertions:**
```javascript
// Mobile
expect(headerButtons).toStackVertically('on mobile');
expect(headerButtons).toHaveSpacing('space-y-3 on mobile');
expect(header).toHavePaddingTop('pt-12 or pt-safe');

// Desktop
expect(headerButtons).toBeHorizontal('on desktop md:');
expect(headerButtons).toHaveSpacing('md:space-x-3 on desktop');
```

---

### SongPickerView.vue

**Expected Layout:**
- Header: Centered, proper spacing (space-y-2)
- Container: max-w-3xl, centered
- Search input: Full-width, proper padding
- Cards: Stack on mobile, side-by-side on desktop (md:grid-cols-2)

**Test Assertions:**
```javascript
expect(searchInput).toHaveFullWidth();
expect(cards).toStackVertically('on mobile');
expect(cards).toHaveGridColumns('md:grid-cols-2 on desktop');
```

---

### GameView.vue

**Expected Layout:**
- Header: Top padding with safe-area consideration
- Timer: Large, centered, pink accent
- MusicPlayerBar Component (Footer):
  - Uses new Spotify-inspired design
  - See MusicPlayerBar component specs below

**Test Assertions:**
```javascript
expect(timer).toHaveTextSize('text-6xl');
expect(timer).toHaveColor('text-disco-pink');
expect(musicPlayerBar).toBeVisible();
```

---

### MusicPlayerBar.vue (Spotify-Inspired Component)

**Design Philosophy:**
- Clean, minimal Spotify-like aesthetic
- Pink accent color (#FF1493) instead of Spotify green
- Album art on left, controls in center, device selector on right
- Responsive flex layout optimized for mobile
- Touch-friendly circular play/pause button

**Expected Layout:**
- **Container**:
  - Background: `bg-zinc-900/95` with `backdrop-blur-sm`
  - Border: `border-t border-zinc-800` for subtle separation
  - Padding: `px-4 py-3` for compact mobile layout
  - Max-width: `max-w-5xl mx-auto` for desktop centering

- **Album Art (Left)**:
  - Size: `w-14 h-14` (56px square)
  - Gradient placeholder: `from-disco-pink/20 to-purple-900/20`
  - Rounded: `rounded-lg`
  - Music icon as placeholder

- **Track Info & Controls (Center/Flex)**:
  - Flex container: `flex-1 min-w-0` to handle overflow
  - Track title: `text-sm font-medium text-white truncate`
  - Artist name: `text-xs text-zinc-400 truncate`
  - Play/Pause button:
    - Size: `w-10 h-10` circular button
    - Playing state: `bg-disco-pink` with white icons
    - Paused state: `bg-white` with black icons
    - Hover effects: `hover:scale-105` for feedback
    - Smooth transitions: `transition-all duration-200`

- **Device Selector (Right)**:
  - Pill-shaped button: `rounded-full`
  - Connected state: `bg-disco-pink/10 text-disco-pink`
  - Disconnected state: `bg-zinc-800 text-zinc-400`
  - Icon + text on desktop: `hidden sm:inline` for text label
  - Hover: `hover:bg-disco-pink/20` or `hover:bg-zinc-700`

**Mobile Optimizations:**
- Album art maintains fixed size to prevent layout shift
- Track info truncates with ellipsis to prevent overflow
- Device text hidden on small screens (icon only)
- Minimum touch targets: 40px+ for all interactive elements
- Compact vertical padding (12px) to maximize content area

**Test Assertions:**
```javascript
// Layout structure
expect(playerBar).toHaveFlexLayout();
expect(albumArt).toHaveSize('56px x 56px');
expect(trackInfo).toTruncateOverflow();

// Interactive elements
expect(playPauseButton).toHaveSize('40px x 40px');
expect(playPauseButton).toBeCircular();
expect(playPauseButton).toHaveMinTouchTarget('40px');

// Responsive behavior
expect(deviceText).toBeHidden('on mobile');
expect(deviceText).toBeVisible('on desktop sm:');

// Color theme
expect(playButton).toHaveBackgroundColor('disco-pink when playing');
expect(playButton).toHaveBackgroundColor('white when paused');
expect(deviceButton).toHaveBackgroundColor('disco-pink/10 when connected');
```

---

### GuessingView.vue

**Expected Layout:**
- Header: Centered, proper spacing
- Player cards: Stack on mobile, 2 columns on desktop
- Buttons: Full-width within cards, proper touch targets

**Test Assertions:**
```javascript
expect(playerCards).toStackVertically('on mobile');
expect(playerCards).toHaveGridColumns('md:grid-cols-2 on desktop');
expect(guessButtons).toHaveFullWidth();
expect(guessButtons).toHaveMinHeight('48px');
```

---

### RevealView.vue

**Expected Layout:**
- Header: Centered with proper spacing
- Content card: max-w-4xl, centered
- Lists: Adequate spacing (space-y-2 or space-y-3)
- Button: Full-width within container

**Test Assertions:**
```javascript
expect(contentCard).toHaveMaxWidth('56rem');
expect(votesList).toHaveSpacing('space-y-2');
expect(nextButton).toHaveFullWidth();
```

---

## Spacing System Standards

### Vertical Rhythm
- Page top padding: `pt-12` (48px) or `pt-safe` for notch devices
- Page bottom padding: `pb-10` (40px)
- Section spacing: `space-y-6` or `space-y-8`
- Card internal padding: `p-5` or `p-6`
- List item spacing: `space-y-2` or `space-y-3`

### Horizontal Spacing
- Page margins: `px-6` (24px) on mobile
- Button spacing: `space-x-3` (horizontal) or `space-y-3` (vertical)
- Card gap: `gap-4` or `gap-6`

### Touch Targets
- Minimum height: `py-3` (48px total with padding)
- Full-width on mobile: `w-full`
- Rounded corners: `rounded-full` for buttons, `rounded-2xl` or `rounded-3xl` for cards

### Typography
- Headers: `text-3xl` or `text-4xl` with `font-semibold` or `font-bold`
- Body: `text-base` (16px) with `text-zinc-400` for secondary
- Small text: `text-sm` or `text-xs` with `uppercase` for labels

---

## Responsive Breakpoints

- **Mobile**: Default (0-767px)
- **Desktop**: `md:` prefix (768px+)

Pattern: Design for mobile first, enhance for desktop.
