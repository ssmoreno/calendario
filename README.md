# Calendario

Calendario is a personal Week and Month calendar with a minimal, full-viewport workspace, account-scoped preferences, and an Eve calendar assistant.

The current milestone is a functional local prototype. It includes:

- Monday-first Week and Month views with Today navigation and 24-hour time.
- Timed, all-day, overnight, multi-day, and repeating events.
- Create, edit, delete, recurrence mutation scopes, and deletion undo.
- Chronological search, system/light/dark themes, and responsive calendar/editor states.
- Versioned browser event persistence, corrupt-data recovery, tab synchronization, and JSON import/export.
- Email/password accounts, server-backed event defaults and appearance, and cross-session memory for Eve.

See [DESIGN.md](./DESIGN.md) for the visual system and responsive behaviour.

## Development

Node.js 24 or newer is required. Create `.env.local` before installing dependencies because Prisma's postinstall reads the database URLs:

```dotenv
DATABASE_URL="postgresql://calendario:calendario@localhost:54329/calendario"
DIRECT_URL="postgresql://calendario:calendario@localhost:54329/calendario"
BETTER_AUTH_SECRET="<openssl rand -base64 32>"
BETTER_AUTH_URL="http://localhost:3000"
```

Local PostgreSQL runs on port `54329`:

```bash
pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The Docker commands require Docker Desktop, OrbStack, or another compatible Compose runtime. `pnpm db:seed` creates the local Eve principal and the Playwright accounts; it is safe to run again.

Open [http://localhost:3000](http://localhost:3000).

Development mode seeds relative-to-Today examples only when there is no saved calendar. Production starts with the designed empty state. Calendar events remain in account-scoped `calendario.events.v1.user.<user-id>` browser storage for this milestone. The account's settings and Eve memories live in PostgreSQL; `calendario.preferences.v1` is only the pre-paint theme cache.

For deployment, use the Supabase pooled connection URI for `DATABASE_URL` and its direct connection URI for `DIRECT_URL`. Configure those variables plus `BETTER_AUTH_SECRET` and the public `BETTER_AUTH_URL` in Vercel, then apply the checked-in migrations with `pnpm exec prisma migrate deploy` before serving traffic.

## Eve agent

The project also includes a durable [Eve](https://eve.dev) calendar agent mounted at `/eve/v1` by the Next.js app. It uses `zai/glm-5.2` through Vercel AI Gateway. Browser sessions provide their IANA timezone automatically. Eve stores its calendar in per-session durable state, while user memories and event-creation defaults persist across Eve sessions in PostgreSQL.

The agent calendar is intentionally separate from the offline browser calendar: it does not read browser storage, synchronize across Eve sessions, or appear in the Week and Month UI.

For local development, authenticate AI Gateway by linking the project with Vercel and pulling its environment, or set `AI_GATEWAY_API_KEY` in the ignored local environment file. Then run either the combined app or the standalone agent:

```bash
vercel link
vercel env pull .env.local
pnpm dev

# Agent runtime only
pnpm dev:eve
```

The app uses Better Auth with Prisma for email/password accounts. Every page resolves the real server session, and Eve's browser channel accepts the same session cookie. Eve session IDs are recorded against their initiating user and rejected when another account tries to continue, stream, cancel, clear, compact, or reset them. Local Eve development and trusted Vercel OIDC callers remain enabled by Eve's standard auth helpers.

`/chat` is a signed-in development harness for talking to that agent: it streams turns, shows each tool call, and answers the approval and question prompts the agent raises for series deletions and ambiguous recurring edits. It keeps its session cursor under account-scoped `calendario.chat.v1.user.<user-id>` browser storage so a reload resumes the same durable calendar, and **New session** starts an empty one. The visible calendar and Eve's session calendar are intentionally separate until server-side event storage is added.

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
- `src/server/` owns Prisma, Better Auth session resolution, user settings, Eve memories, and Eve session ownership.
- `agent/` owns Eve's GLM 5.2 configuration, per-session calendar state, authenticated channel, dynamic user context, instructions, and tools.
- The UI talks to `CalendarService`, leaving cloud persistence and messaging adapters replaceable without rewriting the calendar.

## Roadmap

1. **Interactive browser calendar** — local CRUD, recurrence, persistence, import/export, responsive UX, and tests.
2. **Identity and personalization** — current milestone: authenticated PostgreSQL foundation, saved defaults, themes, Eve memory, and per-user Eve session ownership.
3. **Shared event storage** — move browser and Eve events behind one user-scoped `CalendarService`, with revisions and conflict handling.
4. **Channel adapters** — add WhatsApp or Telegram after browser and Eve use the same durable calendar.
5. **Interoperability and reminders** — ICS, Google Calendar, background delivery, PWA behavior, then Outlook/CalDAV as demand warrants.
6. **Expansion** — shared circles, attendees, and permissions only after validating the personal-first product.
