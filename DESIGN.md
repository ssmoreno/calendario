# Calendario design system

## Direction

Calendario is a chromatic almanac: an event-only agenda that compresses empty time without making the user lose their place. The interface uses bold editorial dates, precise time labels, and one expressive ultramarine date group at a time. Empty days never become calendar cards; they appear only as quiet-time dividers.

The approved prototype at `/tmp/calendario-design-preview.html` is the visual source of truth for this baseline.

## Typography

- Fraunces, weight 600–900: date numerals, display headings, and the wordmark.
- Instrument Sans, weight 400–600: navigation, controls, event titles, and body copy.
- IBM Plex Mono, weight 400–500: times, durations, weekdays, compact labels, and metadata.
- Fonts are self-hosted by `next/font`; no browser request is made to Google Fonts.

## Color

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| Canvas | `#F4F0E6` | `#141411` | Application background |
| Surface | `#FFFCF5` | `#1F1E1A` | Raised controls and editor |
| Surface 2 | `#EBE5D8` | `#2B2923` | Quiet intervals |
| Ink | `#181713` | `#F4F0E6` | Primary text |
| Muted | `#6B685F` | `#AAA498` | Secondary text |
| Line | `#D7D0C2` | `#38362F` | Dividers and borders |
| Ultramarine | `#203FBD` | `#5374F2` | Next occupied day and focus context |
| Ultramarine text | `#203FBD` | `#6685FF` | Accessible accent text on surfaces |
| Ultramarine ink | `#FAF4E7` | `#000000` | Text on the active date field |
| Coral | `#E95738` | `#FF7257` | Signals and focus |
| Coral text | `#B43120` | `#FF8B76` | Accessible coral-toned labels on surfaces |
| Mint | `#77C6AD` | `#88D4BB` | Event color |
| Gold | `#E8B44D` | `#F4C15A` | Event color |

Color is never the only carrier of meaning. Event cards always include a textual time, recurrence, or continuation label.

## Layout and shape

- Maximum application canvas: 1320px.
- Desktop occupied-date layout: approximately 31% date stamp and 69% events.
- Mobile layout: oversized date stamp above the event list.
- Base spacing unit: 4px.
- Control radius: 5px. Card radius: 12px. Outer frame/editor radius: 20px.
- Avoid pill shapes except for compact categorical controls and status tags.
- Interactive targets are at least 44px wherever layout permits.

## Motion and accessibility

- Functional transitions run between 160ms and 240ms.
- `prefers-reduced-motion` removes nonessential movement and smooth scrolling.
- Keyboard focus uses a visible 3px coral ring with a 3px offset.
- Date groups are labelled sections; event rows are buttons with complete accessible names.
- The date navigator, popovers, and editor use React Aria Components for keyboard and focus behavior.
- The editor becomes a right drawer on desktop and a full-height sheet on narrow screens.
