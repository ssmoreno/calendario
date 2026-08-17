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

## Eve agent

The project also includes a durable [Eve](https://eve.dev) calendar agent mounted at `/eve/v1` by the Next.js app. It uses `zai/glm-5.2` through Vercel AI Gateway. The agent asks for and remembers an IANA timezone, then stores its calendar in Eve's per-session durable state.

The agent calendar is intentionally separate from the offline browser calendar: it does not read browser storage, synchronize across Eve sessions, or appear in the Week and Month UI.

Node.js 24 or newer is required. For local development, authenticate AI Gateway by linking the project with Vercel and pulling its environment, or set `AI_GATEWAY_API_KEY` in an ignored local environment file. Then run either the combined app or the standalone agent:

```bash
vercel link
vercel env pull .env.local
pnpm dev

# Agent runtime only
pnpm dev:eve
```

Production Eve routes fail closed until real browser authentication replaces the explicit `placeholderAuth()` guard. Local Eve development and trusted Vercel OIDC callers remain enabled. Those OIDC callers are one trusted operator domain; Eve session IDs do not have per-principal ownership ACLs in this milestone. Add persistent session ownership checks before admitting multiple browser users or tenants.

`/chat` is a plain development harness for talking to that agent: it streams turns, shows each tool call, and answers the approval and question prompts the agent raises for series deletions and ambiguous recurring edits. It keeps its session cursor under `calendario.chat.v1` in browser storage so a reload resumes the same durable calendar, and **New session** starts an empty one. Because the Eve channel fails closed, a deployed `/chat` returns 401 until real browser authentication replaces `placeholderAuth()`.

GLM 5.2 is free for Eve agents through August 27, 2026 under [Vercel's promotion](https://vercel.com/changelog/glm-5-2-free-for-eve-agents-through-august-27-via-blackbox-on-ai-gateway). The offer excludes `zai/glm-5.2-fast`; standard AI Gateway rates apply afterward.

## Quality gates

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build:eve
pnpm build
```

The Playwright suite runs both desktop Chromium and a 390px-class mobile viewport. Install its browser once with `pnpm exec playwright install chromium` if needed.

## Architecture

- `src/app/page.tsx` remains a Server Component shell.
- `src/components/calendar/` owns the browser interaction boundary and Week/Month composition.
- `src/calendar/` owns event contracts, recurrence, timezone conversion, calendar layout data, validation, and the local `CalendarService` implementation.
- `src/calendar/calendar-document-engine.ts` is the storage-independent mutation engine shared by the browser adapter and Eve.
- `agent/` owns Eve's GLM 5.2 configuration, per-session state, route protection, instructions, and tools.
- The UI talks to `CalendarService`, leaving cloud persistence and messaging adapters replaceable without rewriting the calendar.

## Roadmap

1. **Interactive local baseline** — current milestone: local CRUD, recurrence, persistence, import/export, responsive UX, and tests.
2. **Cloud foundation** — authenticated PostgreSQL service, local migration, revisions, and conflict handling behind `CalendarService`.
3. **Conversational scheduler** — current milestone: a channel-neutral durable Eve agent with session-scoped calendar tools.
4. **Calendar synchronization and channel adapters** — connect durable shared storage, then add WhatsApp or Telegram after the product choice is made.
5. **Interoperability and reminders** — ICS, Google Calendar, background delivery, PWA behavior, then Outlook/CalDAV as demand warrants.
6. **Expansion** — shared circles, attendees, and permissions only after validating the personal-first product.
