# SS Calendar

SS Calendar is a focused Google Calendar agent. Its authenticated home combines a compact agent conversation, the next four events from the user's primary Google Calendar, and account controls.

The current milestone includes:

- Email/password and Google sign-in through Better Auth.
- OAuth connection to the user's primary Google Calendar with automatic token refresh.
- Agent-driven listing, creation, editing, deletion, recurring-event scopes, and reminders.
- A responsive upcoming-event summary with expandable details and no calendar editor UI.
- Server-backed event defaults, appearance, and cross-session agent memory.

See [DESIGN.md](./DESIGN.md) for the visual system and responsive behaviour.

## Development

Node.js 24 or newer is required. Create `.env.local` before installing dependencies because Prisma's postinstall reads the database URLs:

```dotenv
DATABASE_URL="postgresql://calendario:calendario@localhost:54329/calendario"
DIRECT_URL="postgresql://calendario:calendario@localhost:54329/calendario"
BETTER_AUTH_SECRET="<openssl rand -base64 32>"
BETTER_AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="<google-oauth-client-id>"
GOOGLE_CLIENT_SECRET="<google-oauth-client-secret>"
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

Enable the Google Calendar API for the OAuth project and register `http://localhost:3000/api/auth/callback/google` as a local redirect URI. Calendar events stay in Google; PostgreSQL stores accounts, settings, memories, Eve session ownership, and provider tokens. `calendario.preferences.v1` remains only the pre-paint theme cache.

For deployment, configure the database variables, Better Auth variables, Google OAuth credentials, and the production `/api/auth/callback/google` redirect URI. Apply checked-in migrations with `pnpm exec prisma migrate deploy` before serving traffic.

## Calendar agent

The project includes an [Eve](https://eve.dev) agent mounted at `/eve/v1`. It uses `zai/glm-5.2` through Vercel AI Gateway, receives the browser's IANA timezone, and manages the signed-in user's connected primary Google Calendar. User memories and event-creation defaults persist in PostgreSQL.

For local development, authenticate AI Gateway by linking the project with Vercel and pulling its environment, or set `AI_GATEWAY_API_KEY` in the ignored local environment file. Then run either the combined app or the standalone agent:

```bash
vercel link
vercel env pull .env.local
pnpm dev

# Agent runtime only
pnpm dev:eve
```

The app uses Better Auth with Prisma for email/password accounts. Every page resolves the real server session, and Eve's browser channel accepts the same session cookie. Eve session IDs are recorded against their initiating user and rejected when another account tries to continue, stream, cancel, clear, compact, or reset them. Local Eve development and trusted Vercel OIDC callers remain enabled by Eve's standard auth helpers.

The inline Agent area on `/` streams turns and handles approval and clarification prompts without exposing tool diagnostics. Its account-scoped browser cursor preserves the conversation across reloads; calendar data never enters browser storage.

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

- `src/app/page.tsx` is the authenticated Server Component shell.
- `src/components/dashboard/` and `src/components/agent/` own the client interaction boundary.
- `src/calendar/` owns shared event contracts, recurrence, timezone conversion, reminders, and validation.
- `src/server/google-calendar.ts` owns Google REST access and implements `CalendarService`.
- `src/server/` owns Prisma, Better Auth session resolution, user settings, Eve memories, and Eve session ownership.
- `agent/` owns Eve's GLM 5.2 configuration, per-session timezone, authenticated channel, dynamic user context, instructions, and tools.
- Both the upcoming-events API and Eve resolve Google access on the server; OAuth tokens never cross into browser code.
