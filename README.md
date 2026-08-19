# SS Calendar

SS Calendar is a personal assistant built around Eve, a delegating agent. Eve holds the conversation and routes each request to a specialist. Its authenticated home combines a compact agent conversation, the next four events from the user's primary Google Calendar, and account controls.

The current milestone includes:

- Google Calendar sign-in through Better Auth.
- OAuth connection to the user's primary Google Calendar with automatic token refresh.
- A root agent that identifies what a message is about and delegates to a declared subagent.
- Agent-driven listing, creation, editing, deletion, recurring-event scopes, and reminders.
- Saved links — articles, recipes, and videos kept for later, with titles read from the page itself.
- A responsive upcoming-event summary with expandable details and no calendar editor UI.
- Server-backed event defaults, appearance, timezone, and cross-session agent memory.

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

Enable the Google Calendar API for the OAuth project and register `http://localhost:3000/api/auth/callback/google` as a local redirect URI. Calendar events stay in Google; PostgreSQL stores accounts, settings, memories, saved links, Eve session ownership, and provider tokens. `calendario.preferences.v1` remains only the pre-paint theme cache.

For deployment, configure the database variables, Better Auth variables, Google OAuth credentials, and the production `/api/auth/callback/google` redirect URI. A production build applies the checked-in migrations before compiling, so `DIRECT_URL` has to be set wherever production builds run; preview builds and local builds skip that step and expect a database that is already migrated.

## The agent

The project includes an [Eve](https://eve.dev) agent mounted at `/eve/v1`. It uses `zai/glm-5.2` through Vercel AI Gateway and receives the browser's IANA timezone. User memories, event-creation defaults, the resolved timezone, and saved links persist in PostgreSQL.

The root agent is a router: it owns the conversation, the voice, and personalization (`remember`, `forget`, `update_settings`, `set_time_zone`), and delegates domain work to declared subagents under `agent/subagents/`.

- `calendar` manages the connected primary Google Calendar.
- `library` keeps links the user wants to come back to and finds them again.

A declared subagent inherits nothing from the root — its directory is its own agent root, with its own instructions, tools, and disabled built-ins. It also starts with fresh durable state, which is why the timezone lives in `user_settings` rather than in session state: every agent reads the same saved value. A child never sees the parent's conversation, so the root packs everything a specialist needs into the message it sends. Specialists report outcomes as facts; the root writes the single reply the user reads.

Adding a domain is a directory drop under `agent/subagents/`. Note-taking is deliberately absent pending a decision on an Obsidian-backed store.

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
- `src/library/` owns the saved-link contract.
- `src/server/google-calendar.ts` owns Google REST access and implements `CalendarService`.
- `src/server/link-metadata.ts` reads a page's title and description, and is the only place the app fetches a user-supplied URL.
- `src/server/` owns Prisma, Better Auth session resolution, user settings, Eve memories, saved links, and Eve session ownership.
- `agent/` owns Eve's GLM 5.2 configuration, authenticated channel, routing instructions, personalization tools, and the `subagents/` specialists.
- Both the upcoming-events API and Eve resolve Google access on the server; OAuth tokens never cross into browser code.
