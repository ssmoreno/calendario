# Calendario

Calendario is a personal, offline-first Week and Month calendar with a minimal, full-viewport workspace.

The current milestone is a functional local prototype. It includes:

- Monday-first Week and Month views with Today navigation and 24-hour time.
- Timed, all-day, overnight, multi-day, and repeating events.
- Create, edit, delete, recurrence mutation scopes, and deletion undo.
- Chronological search, system/light/dark themes, and responsive calendar/editor states.
- Versioned browser persistence, corrupt-data recovery, tab synchronization, and JSON import/export.

See [DESIGN.md](./DESIGN.md) for the visual system and responsive behaviour.

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
- `src/components/calendar/` owns the browser interaction boundary and Week/Month composition.
- `src/calendar/` owns event contracts, recurrence, timezone conversion, calendar layout data, validation, and the local `CalendarService` implementation.
- The UI talks to `CalendarService`, leaving cloud persistence and messaging adapters replaceable without rewriting the calendar.

## Roadmap

1. **Interactive local baseline** — current milestone: local CRUD, recurrence, persistence, import/export, responsive UX, and tests.
2. **Cloud foundation** — authenticated PostgreSQL service, local migration, revisions, and conflict handling behind `CalendarService`.
3. **Conversational scheduler** — channel-neutral list/create/update/delete tools with previews, confirmation, and idempotency.
4. **Channel adapter** — connect WhatsApp or Telegram after the product choice is made.
5. **Interoperability and reminders** — ICS, Google Calendar, background delivery, PWA behavior, then Outlook/CalDAV as demand warrants.
6. **Expansion** — shared circles, attendees, and permissions only after validating the personal-first product.
