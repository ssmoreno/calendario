# Calendario

Calendario is a personal, offline-first calendar that shows only occupied dates. Empty stretches collapse into explicit quiet-day markers, so the agenda stays compact without losing the shape of time.

The current milestone is a functional local prototype. It includes:

- Bidirectional event-only agenda with Today and quiet-time orientation.
- Timed, all-day, overnight, multi-day, and repeating events.
- Create, edit, delete, recurrence mutation scopes, and deletion undo.
- Locale-aware date navigation, search, system/light/dark themes, and responsive editor states.
- Versioned browser persistence, corrupt-data recovery, tab synchronization, and JSON import/export.

See [DESIGN.md](./DESIGN.md) for the Chromatic Almanac visual system.

## Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Development mode seeds relative-to-Today examples only when there is no saved calendar. Production starts with the designed empty state. Data is stored under `calendario.events.v1` and `calendario.preferences.v1` in browser storage.

## Quality gates

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

The Playwright suite runs both desktop Chromium and a 390px-class mobile viewport. Install its browser once with `pnpm exec playwright install chromium` if needed.

## Architecture

- `src/app/page.tsx` remains a Server Component shell.
- `src/components/agenda/` owns the browser interaction boundary and design composition.
- `src/calendar/` owns event contracts, recurrence, timezone conversion, agenda grouping, validation, and the local `CalendarService` implementation.
- The UI talks to `CalendarService`, leaving cloud persistence and messaging adapters replaceable without rewriting the agenda.

## Roadmap

1. **Interactive local baseline** — current milestone: local CRUD, recurrence, persistence, import/export, responsive UX, and tests.
2. **Cloud foundation** — authenticated PostgreSQL service, local migration, revisions, and conflict handling behind `CalendarService`.
3. **Conversational scheduler** — channel-neutral list/create/update/delete tools with previews, confirmation, and idempotency.
4. **Channel adapter** — connect WhatsApp or Telegram after the product choice is made.
5. **Interoperability and reminders** — ICS, Google Calendar, background delivery, PWA behavior, then Outlook/CalDAV as demand warrants.
6. **Expansion** — shared circles, attendees, and permissions only after validating the personal-first product.
