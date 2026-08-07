# Calendario design system

## Direction

Calendario is a quiet calendar workspace presented as a restrained card within the page. The calendar card is the only element that floats: page chrome — header above, meta line below — sits directly on the canvas around it. Week is the primary view and Month is the only alternate view. Empty time is represented by empty grid space: there are no mood messages, decorative empty states, oversized date cards, gradients, or shadows.

## Calendar behaviour

- Weeks start on Monday and use 24-hour time in the browser timezone.
- Desktop Week shows seven columns, a dedicated all-day row, and 60px hourly rows. Overlapping events share horizontal space.
- Mobile Week shows one selected day beneath a seven-day strip and supports tap, swipe, and arrow-key day navigation.
- Desktop Month rows grow to show every event. On mobile, a busy date expands an event list directly below its week.
- Week slots snap event creation to 30 minutes with a one-hour default. Empty Month dates seed events at 09:00.
- Empty slots remain blank. Blue is reserved for Today, focus, selection, and current time.

## Typography

- Instrument Sans: navigation, controls, headings, event titles, and body copy.
- IBM Plex Mono: time labels and compact temporal metadata.
- Fonts are delivered through `next/font`.

## Colour

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| Canvas | `#F7F7F5` | `#111315` | Browser background |
| Surface | `#FFFFFF` | `#181B1F` | Calendar workspace and controls |
| Surface 2 | `#F1F3F5` | `#22262B` | Selected and secondary surfaces |
| Ink | `#1F2328` | `#F2F4F7` | Primary text |
| Muted | `#667085` | `#98A2B3` | Secondary text and time labels |
| Line | `#E4E7EC` | `#343A40` | Grid and control borders |
| Accent | `#2563EB` | `#6EA8FE` | Today, selection, focus, and current time |

Saved event hues are mixed into the surface at 12% in light mode and 18% in dark mode, deepening to 20% and 28% on hover. Event text uses a darker or lighter blend of the same hue while retaining at least 4.5:1 contrast. Colour is never the only carrier of meaning.

## Theme

- The header icon button is a one-click toggle: it always flips to the opposite of the theme currently on screen and names the theme it switches to.
- System, Light, and Dark remain selectable under Appearance in the header settings popover; System is the starting preference.
- An inline script paints the stored theme before first paint, so no page load flashes the wrong palette.

## Motion

- Timing tokens: 120ms for hover and press feedback, 200ms for entrances, 320ms for the theme crossfade; entrances ease out and reversible motion eases in and out.
- A theme change runs as a single root view transition, so the page crossfades between palettes rather than snapping to a white or black screen. Browsers without view transitions repaint instantly.
- Views and periods fade in, sliding 12px from the direction of travel. Popovers, the search panel, the toast, and the editor dialog animate in and out; the editor becomes a bottom sheet that slides on mobile.
- Motion never blocks input, and `prefers-reduced-motion` removes all of it.

## Layout and accessibility

- The calendar card is centred at most 1080px wide and 760px tall, with 28px desktop margins and an 8px mobile inset. The header row above it is 56px tall and shares the card's width, as does the meta line below.
- Controls use compact 6px radii and event blocks use 3px radii. Pills are limited to categorical editor choices.
- Keyboard focus uses a visible 2px blue outline.
- Grid slots and events have complete accessible names. Dialog focus and dismissal use React Aria Components.
- `prefers-reduced-motion` removes nonessential motion and smooth scrolling.
