---
name: Agisse
description: A co-pilot for the job search. Apple-neutral grounds, one Agisse blue, shadcn components; light or dark with the system, in the app and on the homepage.
colors:
  paper: "#ffffff"
  paper-2: "#f5f5f7"
  paper-3: "#ebebef"
  ink: "#1d1d1f"
  ink-2: "#515154"
  ink-3: "#6e6e73"
  rule: "#d2d2d7"
  rule-soft: "#e8e8ed"
  blue: "#1f45e0"
  blue-ink: "#1636b8"
  blue-soft: "#eef1fd"
  seg-thumb: "#ffffff"
  contacted-highlight: "#dce4ff"
  green: "#12723f"
  green-ink: "#0d5c32"
  green-tint: "#e7f5ec"
  amber: "#a15c00"
  amber-tint: "#fdf3e1"
  red: "#c4251b"
  red-tint: "#fdeeec"
  gold: "#ffcc00"
  status-saved: "#c7c7cc"
  status-evaluated: "#8e8e93"
  status-applied: "#8aa2f5"
  status-responded: "#5a78ec"
  status-assessment: "#1f45e0"
  status-interview: "#1636b8"
  status-offer: "#12723f"
  status-rejected: "#d2d2d7"
  # Dark set: `.dark` on <html> in agisse/src/styles/tokens.css
  dark-paper: "#1c1c1e"
  dark-paper-2: "#232326"
  dark-paper-3: "#2c2c2f"
  dark-sidebar: "#161618"
  dark-ink: "#f5f5f7"
  dark-ink-2: "#c7c7cc"
  dark-ink-3: "#98989d"
  dark-rule: "#3a3a3d"
  dark-rule-soft: "#2e2e31"
  dark-blue: "#4d7bff"
  dark-blue-ink: "#86a5ff"
  dark-blue-soft: "#1f2846"
  dark-seg-thumb: "#3a3a3d"
  dark-green: "#4cc785"
  dark-amber: "#f0a63c"
  dark-red: "#ff6b5e"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Inter Variable, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Inter Variable, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  page-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Inter Variable, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Display, Inter Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  section:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Inter Variable, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Inter Variable, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-sm:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Inter Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Inter Variable, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "normal"
  tab:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Inter Variable, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  seg-thumb: "7px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "7": "48px"
  "8": "64px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-primary-large:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "32px"
  button-outline-hover:
    backgroundColor: "{colors.paper-2}"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.lg}"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
  button-home:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 28px"
    height: "48px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.blue-soft}"
    textColor: "{colors.blue-ink}"
  segmented:
    backgroundColor: "{colors.paper-3}"
    rounded: "{rounded.lg}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.seg-thumb}"
    textColor: "{colors.ink}"
    rounded: "{rounded.seg-thumb}"
    height: "30px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  grouped-list:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.2xl}"
  list-row:
    padding: "12px 16px"
    height: "56px"
  sidebar:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
  sidebar-item-active:
    backgroundColor: "{colors.paper-3}"
    textColor: "{colors.blue}"
    rounded: "{rounded.md}"
  tab-bar:
    textColor: "{colors.ink-2}"
    height: "56px"
  tab-bar-active:
    textColor: "{colors.blue}"
  notice:
    backgroundColor: "{colors.paper-2}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  notice-error:
    backgroundColor: "{colors.red-tint}"
    textColor: "{colors.red}"
  notice-ok:
    backgroundColor: "{colors.green-tint}"
    textColor: "{colors.green-ink}"
---

# Design System: Agisse

## Overview

**Creative North Star: "The Quiet Desk"**

Agisse looks like a well-made Apple app: white or near-black grounds, system type, hairline separators, grouped lists, one blue that means "this one" or "click here". Everything else steps back so the user's next job-search action is the only loud thing on screen. Density is calm, not sparse: 15px body text, 56px list rows, generous gaps between sections, never more than one primary button in view.

The system is shadcn (style `base-nova`, on Base UI, Lucide icons) themed from one token file. `agisse/src/styles/tokens.css` defines the palette as `--paper`, `--ink`, `--rule`, `--blue` and the status set; `base.css` maps those onto shadcn's variables (`--background`, `--primary`, `--muted`, `--border`, `--ring`, `--sidebar`), so shadcn components and the older hand-written primitives in `components.css` share one source. Light is the default; `.dark` on `<html>` follows `prefers-color-scheme`, set before paint by a script in `index.html` and overridable from the account menu (Appearance: System, Light, Dark; stored as `agisse.theme`).

The signed-out homepage uses the same tokens and shadcn components as the app, so it switches to dark with the system too. Its only extra register is scale: larger type, a pill-shaped call to action, larger rounded panels.

**Key Characteristics:**
- Apple-neutral greys, light and dark, with one Agisse blue.
- System font stack: SF Pro on Apple devices, self-hosted Inter Variable elsewhere.
- Sentence case everywhere; emphasis comes from weight 600 and size, never from caps or tracking.
- Grouped, inset lists on cards with hairline dividers, iOS Settings style.
- Sidebar on desktop, bottom tab bar on phones.
- Soft, low shadows; most depth is a 1px ring plus a tonal step.

## Colors

Neutral greys tuned to Apple's system palette, with one saturated blue; green, amber and red appear only when they report a state.

### Primary
- **Agisse Blue** (`blue`; `dark-blue` in dark): the primary button, the active sidebar item and tab, links in running text, the focus ring, caret and form `accent-color`, selected chips, the due-count badge, and the wordmark tile.
- **Pressed Blue** (`blue-ink`; `dark-blue-ink`): link text, the text on selected chips, hover on legacy blue controls.
- **Blue Wash** (`blue-soft`; `dark-blue-soft`): selected-chip fill, text selection, the "Contacted" highlight (`contacted-highlight`).

### Tertiary (status only)
- **Green** (`green`, `green-ink`, `green-tint`): success notices, "done" checks, strong-fit pills, offers.
- **Amber** (`amber`, `amber-tint`): deadlines that are close, warnings.
- **Red** (`red`, `red-tint`): errors, destructive actions, invalid fields.
- **Pipeline status ramp** (`status-*`): grey for not yet sent, then lighter to deeper blue as a job moves through applied, responded, assessment and interview, green for offer, and a muted grey for rejected. These colours also feed shadcn's `--chart-1..5`.
- **Gold** (`gold`): only the star in the wordmark's A.

### Neutral
- **Paper** (`paper`; `dark-paper`): page and card ground. Cards sit on the same paper as the page, separated by a ring and not by a fill.
- **Paper 2** (`paper-2`; `dark-paper-2`): hover fills, the sidebar (`dark-sidebar` is darker still in dark mode), notices, muted panels, the auth page backdrop on wider screens.
- **Paper 3** (`paper-3`; `dark-paper-3`): the segmented-control track, the active sidebar item, pressed fills.
- **Ink** (`ink`): primary text. **Ink 2** (`ink-2`): secondary text and `muted-foreground`, at least 7:1 on paper. **Ink 3** (`ink-3`): placeholders and hints, at least 4.8:1.
- **Rule** (`rule`): control borders and the shadcn `--input`. **Rule Soft** (`rule-soft`): hairlines, dividers, and the shadcn `--border`.

### Named Rules
**The One-Blue Rule.** Blue marks the click or the current choice. Anything else that needs to stand out uses weight, size, or a card. Green, amber and red appear only as state.

**The Light-Scope Rule.** The assessment practice games imitate vendor tests, which are light. Their stage carries `.light-scope`, which pins the light palette inside a dark page. Nothing else uses it.

## Typography

**Display Font:** SF Pro Display (`-apple-system`, `BlinkMacSystemFont`) with Inter Variable, then `system-ui`
**Body Font:** SF Pro Text with Inter Variable, then `system-ui`

**Character:** Native and invisible. On a Mac or iPhone the app reads as a system app; elsewhere Inter stands in with the same proportions. Headings use weight 600 with Tailwind's `tracking-tight` (-0.025em) and balanced wrapping.

### Hierarchy
- **Display** (600, 2.5rem stepping to 3.75rem at ≥640px and 4.5rem at ≥1024px, line-height 1.05): the homepage hero only.
- **Headline** (600, 1.875rem stepping to 2.25–3rem at ≥640px): homepage section heads and the onboarding question.
- **Page title** (600, 28px, 32px at ≥768px): the greeting on Today and other app page titles.
- **Title** (600, 1.25rem; 1.125rem on the next-step card): card titles and the auth card heading (1.5rem).
- **Section** (600, 15px, tight tracking): section heads above grouped lists ("Coming up", "Pipeline").
- **Body** (400, 15px, line-height 1.55): the base size set on `body`. List row titles use the same size at weight 500.
- **Body small** (400, 13–14px): secondary lines, descriptions, shadcn `text-sm`.
- **Label** (500–600, 13px): chips, legacy `.label`, field hints at 12px.
- **Tab** (500, 11px): tab bar captions and pipeline stage names.

### Named Rules
**The Sentence-Case Rule.** There is no uppercase text and no positive letter-spacing in the app or on the homepage (`--track-caps` is 0). The only exception is the keyboard-shortcut glyphs that come with shadcn's dropdown menu.

**The 16px-On-Phones Rule.** Text inputs are 16px below 768px so iOS does not zoom into the field.

## Layout

- **Shell:** at ≥768px, a collapsible shadcn sidebar (icon rail when collapsed) holds the wordmark, four sections (Today, Jobs, Prepare, People; Lucide icons at 18px, 36px rows, 15px labels) and the account menu in the footer. Below 768px the sidebar is hidden: a 48px sticky top bar holds the wordmark and the account avatar, and a fixed iOS-style tab bar (56px high plus the safe-area inset) holds the same sections. Both bars use `background/85` with a heavy backdrop blur and a hairline border.
- **Content width:** Today is `max-w-[960px]`, 16px side padding on phones and 40px at ≥768px, 24px top padding (40px at ≥768px), with 32px between sections. Legacy pages use `--max-w` (1120px) and `--gutter` (`clamp(16px, 4vw, 40px)`). The homepage wraps at 1080px with 16–32px padding and leaves 112–160px between sections.
- **Auth:** one card, at most 400px wide, centred on a `muted/60` backdrop at ≥640px. On phones it goes full-bleed on paper with no card.
- **Onboarding:** one question per screen, in a `max-w-xl` column. A slim progress bar sits at the top (4px pills, blue up to the current step). Back, Skip and Continue sit in a footer that sticks to the bottom on phones and sits inline at ≥640px.
- **Rhythm:** a 4px base (`--space-1`…`--space-8`: 4, 8, 12, 16, 24, 32, 48, 64). Tap targets grow to 44px on coarse pointers: buttons, inputs, segments, and the hit area around a chip's ×.

## Elevation & Depth

Mostly flat. Depth comes from a 1px ring (`ring-foreground/10`) and the step between paper and paper 2. Where shadows exist they are low, soft, black at low alpha, and roughly doubled in alpha for dark mode.

### Shadow Vocabulary
- **Small** (`--shadow-sm`): the segmented-control thumb and the name badge.
- **Default** (`--shadow`): raised legacy surfaces.
- **Large** (`--shadow-lg`): overlays and popovers in the legacy layer.
- **Card lift** (inline, `0 1px 2px rgb(0 0 0/.04)` plus a long soft blur): the auth card, the next-step card on Today, and homepage product cards. Each surface currently writes its own variant inline; there is no token for it yet.

### Named Rules
**The Ring-Not-Shadow Rule.** A container at rest gets a hairline ring. A shadow is reserved for a surface that is the single focus of a screen (the auth card, the next-step card) or for something floating above the page.

## Shapes

Continuous, friendly corners that scale with size. The base `--radius` is 10px, and shadcn's scale derives from it: 6 / 8 / 10 / 14 / 18 / 22px. Controls (buttons, inputs, notices, the segmented track) use 10px. shadcn cards use 14px (`--radius-card`). Grouped lists, the Today cards, the auth card and onboarding choice cards use 18px. Homepage feature panels use 22px. Pills (999px) are for chips, status pills, badges, the homepage call to action and the progress bar. Icon tiles inside list rows are 32px squares with 10px corners; onboarding icon tiles are 44px squares with 14px corners.

## Components

### Buttons
- **Shape:** gently rounded (10px). shadcn default height 32px, large 36px; auth, onboarding and primary page actions use 44px (`h-11`).
- **Primary:** blue fill, white 500-weight text; hover drops to 80% opacity (legacy `.btn--primary` mixes in 14% black).
- **Outline / Secondary / Ghost:** an outline on paper, or a paper-2 fill, or transparent with ink-2 text. All hover to a paper-2 fill. **Destructive** is a red text on a 10% red wash.
- **Focus / Active:** a 3px blue ring at 50% (25–30% in the legacy layer); a 1px press-down on `:active`.
- **Homepage:** pill-shaped, 48px high, 28px side padding, 16px text.

### Chips
- **Style:** 32px pills on paper with a soft hairline, 13px text at weight 500, tabular counts in ink-3.
- **State:** selected (`aria-pressed`) chips take the blue wash, blue-ink text and a 40% blue border. A removable chip has an 18px × that turns red on hover, with a 44px hit area.

### Segmented Control
iOS style. A paper-3 track with 3px padding and 10px corners; 30px segments (38px on touch) in ink-2. The selected segment is a raised thumb (`seg-thumb`, 7px corners, small shadow plus a 0.5px hairline). It stretches to full width on phones. Tabs on postings and admin filters reuse it.

### Cards / Containers
- **Corner Style:** 14px for shadcn `Card`; 18px for grouped lists and the Today cards.
- **Background:** paper on paper, separated by `ring-1 ring-foreground/10`.
- **Grouped list:** rows of at least 56px with 12px × 16px padding, a 32px icon tile, a title at 15px/500 over a 13px muted line, and a muted chevron. Hairline dividers run between rows. Hover tints the row with `muted/60`; keyboard focus shows an inset ring.
- **Internal Padding:** 16px (`Card`), 20px on Today's cards.

### Inputs / Fields
- **Style:** 32px shadcn inputs and 36px legacy `.field__input` (44px on auth and on touch), with a 1px `rule` border and 10px corners on paper.
- **Focus:** the border turns blue, with a 3px blue ring at 25–50%.
- **Error / Disabled:** a red border with a 20% red ring; disabled fields go to 50% opacity on paper-2. Error text is 13px red with an icon.

### Navigation
- **Sidebar:** a paper-2 ground. The active item gets a paper-3 fill, blue text and icon, and weight 500. The due count is a blue pill with white text.
- **Tab bar:** 22px icons over 11px captions. The active tab is blue with a 2.2 stroke; inactive tabs are muted with a 1.8 stroke.
- **Account menu:** an avatar (initial on a 10% blue wash) opens a shadcn dropdown with profile, extension, docs, Connect an AI agent, Admin (admins only), an Appearance submenu (System / Light / Dark radio items), and Sign out.

### Notices / Alerts
Notices use 10px corners and 12px × 14px padding with a 16px leading icon. The neutral notice is paper-2 with a hairline; error notices are red tint with red text; success notices are green tint with green-ink text. New code uses shadcn `Alert`.

### Name Badge (signature)
A person card that flips in 3D: 14px corners, a small shadow, a hairline, and a 320ms flip on `--ease-out`.

## Do's and Don'ts

### Do:
- **Do** take every colour from the tokens (or their shadcn aliases) so dark mode follows for free.
- **Do** build new UI from `components/ui/*` (shadcn base-nova on Base UI) with Lucide icons.
- **Do** show one primary blue action per view; everything else is outline, ghost or a link.
- **Do** keep tap targets at 44px on touch and inputs at 16px on phones.
- **Do** wrap vendor-imitating light surfaces in `.light-scope`.
- **Do** give every top-level section (Today, Jobs, Prepare, People) a large title above its segmented tabs; a form under it takes a 20px section title, never a second large one.
- **Do** mark a disclosure row with a chevron that turns when open (`.index-card__options`, `.posting__fold`), not a plus.
- **Do** name the destination on a back link ("Jobs", "My jobs", "Today"), as an iOS back button does.
- **Do** respect `prefers-reduced-motion`: base.css collapses all animation and transition; onboarding uses `motion-safe:` for its 200ms fade-in.

### Don't:
- **Don't** add a second accent colour, or use green, amber or red for emphasis rather than state.
- **Don't** use uppercase labels or positive letter-spacing.
- **Don't** hard-code hex values in components (the wordmark SVG is the one exception).
- **Don't** put a shadow on a resting container that a ring already separates.
