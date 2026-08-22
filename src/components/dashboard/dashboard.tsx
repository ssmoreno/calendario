"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Popover,
} from "react-aria-components";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { GearSix } from "@phosphor-icons/react/dist/ssr/GearSix";
import { SignOut } from "@phosphor-icons/react/dist/ssr/SignOut";

import { formatDuration } from "@/calendar/date-time";
import { authClient } from "@/lib/auth-client";
import {
  GOOGLE_CALENDAR_PROVIDER,
  GOOGLE_CALENDAR_SCOPE,
} from "@/lib/google-calendar";
import type { UpcomingEvent } from "@/server/google-calendar";

import { AgentPanel } from "../agent/agent-panel";
import { clearSavedAgent } from "../agent/agent-storage";
import styles from "./dashboard.module.css";

type Connection =
  | "checking"
  | "connected"
  | "not_connected"
  | "authorization"
  | "error";

interface DashboardProps {
  initialConnected: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface UpcomingResponse {
  status: "connected" | "not_connected";
  reason?: "authorization";
  events: UpcomingEvent[];
}

const connectionLabels: Record<Connection, string> = {
  checking: "Checking…",
  connected: "Connected",
  not_connected: "Not connected",
  authorization: "Reconnect needed",
  error: "Unavailable",
};

function initials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length) return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return email.slice(0, 1).toUpperCase();
}

function dateLabel(dateKey: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function eventSummary(event: UpcomingEvent) {
  if (event.timing.kind === "all-day") {
    return `${dateLabel(event.timing.startDate)} · All day`;
  }
  const start = new Date(event.timing.startsAt);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timing.timeZone,
  }).format(start);
}

function eventEndLabel(event: UpcomingEvent) {
  if (event.timing.kind === "all-day") {
    const lastDay = new Date(`${event.timing.endDateExclusive}T12:00:00Z`);
    lastDay.setUTCDate(lastDay.getUTCDate() - 1);
    const lastKey = lastDay.toISOString().slice(0, 10);
    return lastKey === event.timing.startDate ? null : `Through ${dateLabel(lastKey)}`;
  }
  return `Ends ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timing.timeZone,
  }).format(new Date(event.timing.endsAt))}`;
}

/**
 * How far off the next event is. All-day events have no meaningful countdown,
 * so they fall back to their date.
 */
function leadLabel(event: UpcomingEvent, now: number) {
  if (event.timing.kind === "all-day") return dateLabel(event.timing.startDate);
  const minutes = Math.round(
    (new Date(event.timing.startsAt).getTime() - now) / 60_000,
  );
  if (minutes <= 0) return "Now";
  return `In ${formatDuration(minutes)}`;
}

function rowDay(event: UpcomingEvent) {
  if (event.timing.kind === "all-day") {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${event.timing.startDate}T12:00:00Z`));
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    timeZone: event.timing.timeZone,
  }).format(new Date(event.timing.startsAt));
}

function rowTime(event: UpcomingEvent) {
  if (event.timing.kind === "all-day") return "All day";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timing.timeZone,
  }).format(new Date(event.timing.startsAt));
}

function EventDetails({ event }: { event: UpcomingEvent }) {
  const end = eventEndLabel(event);
  return (
    <div className={styles.eventDetails}>
      {end ? <span>{end}</span> : null}
      {event.location ? <span>{event.location}</span> : null}
      {event.recurrence ? <span>{event.recurrence}</span> : null}
      {event.reminderMinutes.length ? (
        <span>
          {event.reminderMinutes
            .map((minutes) => `${formatDuration(minutes)} before`)
            .join(" · ")}
        </span>
      ) : event.usesDefaultReminder ? (
        <span>Uses your Google Calendar default reminder</span>
      ) : null}
      {event.notes ? <p>{event.notes}</p> : null}
    </div>
  );
}

function LedgerRow({ event }: { event: UpcomingEvent }) {
  return (
    <li>
      <details className={styles.eventRow} data-color={event.color}>
        <summary>
          <span className={styles.swatch} aria-hidden="true" />
          <span className={styles.rowWhen}>
            <span>{rowDay(event)}</span>
            <span>{rowTime(event)}</span>
          </span>
          <strong>{event.title}</strong>
          <CaretDown className={styles.expandMark} size={16} aria-hidden="true" />
        </summary>
        <EventDetails event={event} />
      </details>
    </li>
  );
}

export function Dashboard({ initialConnected, user }: DashboardProps) {
  const router = useRouter();
  const [connection, setConnection] = useState<Connection>(
    initialConnected ? "checking" : "not_connected",
  );
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const avatarText = useMemo(() => initials(user.name, user.email), [user]);

  const refreshUpcoming = useCallback(async () => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(
        `/api/calendar/upcoming?timeZone=${encodeURIComponent(timeZone)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Upcoming events could not be loaded.");
      const result = (await response.json()) as UpcomingResponse;
      setEvents(result.events);
      setConnection(
        result.reason === "authorization" ? "authorization" : result.status,
      );
    } catch {
      setConnection("error");
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshUpcoming(), 0);
    window.addEventListener("focus", refreshUpcoming);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", refreshUpcoming);
    };
  }, [refreshUpcoming]);

  /* The lead time would otherwise sit stale between calendar refreshes. */
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(tick);
  }, []);

  async function connectGoogle() {
    setConnecting(true);
    const result = await authClient.linkSocial({
      provider: GOOGLE_CALENDAR_PROVIDER,
      callbackURL: "/",
      errorCallbackURL: "/?google=error",
      scopes: [GOOGLE_CALENDAR_SCOPE],
    });
    if (result?.error) {
      setConnection("error");
      setConnecting(false);
    }
  }

  async function signOut() {
    const result = await authClient.signOut();
    if (!result.error) {
      clearSavedAgent(user.id);
      router.replace("/login");
      router.refresh();
    }
  }

  const connected = connection === "connected" || (connection === "checking" && initialConnected);
  const [next, ...later] = events;
  const needsGoogle =
    connection === "not_connected" || connection === "authorization";

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <h1>SS Calendar</h1>
        </div>
        <div className={styles.topbarEnd}>
          <span className={styles.connectionPill} data-state={connection}>
            <span className={styles.connectionDot} aria-hidden="true" />
            {connectionLabels[connection]}
          </span>
          <DialogTrigger isOpen={profileOpen} onOpenChange={setProfileOpen}>
            <Button className={styles.avatarButton} aria-label="Open profile menu">
              {avatarText}
            </Button>
            <Popover className={styles.profilePopover} placement="bottom end" offset={10}>
              <Dialog className={styles.profileDialog} aria-label="Profile">
                <div className={styles.profileIdentity}>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <Link
                  className={styles.profileItem}
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                >
                  <GearSix size={16} aria-hidden="true" />
                  Settings
                </Link>
                <button
                  className={styles.profileItem}
                  type="button"
                  onClick={() => void signOut()}
                >
                  <SignOut size={16} aria-hidden="true" />
                  Log out
                </button>
              </Dialog>
            </Popover>
          </DialogTrigger>
        </div>
      </header>

      <div className={styles.sheet}>
        <div className={styles.mainColumn}>
          <section className={styles.now} aria-labelledby="now-heading">
            <h2 className={styles.eyebrow} id="now-heading">
              {needsGoogle || connection === "error" ? "Google Calendar" : "Next"}
            </h2>

            {connection === "checking" ? (
              <div className={styles.nowSkeleton} role="status" aria-label="Loading your calendar…">
                <span />
                <span />
              </div>
            ) : needsGoogle ? (
              <>
                <p className={styles.nowProse}>
                  {connection === "authorization"
                    ? "SS needs you to reconnect Google Calendar to restore access."
                    : "Connect Google Calendar to see upcoming events and let SS manage them."}
                </p>
                <button
                  className={styles.primaryButton}
                  disabled={connecting}
                  type="button"
                  onClick={() => void connectGoogle()}
                >
                  {connecting
                    ? "Connecting…"
                    : connection === "authorization"
                      ? "Reconnect Google Calendar"
                      : "Connect Google Calendar"}
                </button>
              </>
            ) : connection === "error" ? (
              <>
                <p className={styles.nowProse} role="alert">
                  Google Calendar is unavailable right now.
                </p>
                <button
                  className={styles.retryButton}
                  type="button"
                  onClick={() => void refreshUpcoming()}
                >
                  <ArrowClockwise size={16} aria-hidden="true" />
                  Try again
                </button>
              </>
            ) : next ? (
              <>
                <p className={styles.lead}>
                  <span
                    className={styles.swatch}
                    data-color={next.color}
                    aria-hidden="true"
                  />
                  {leadLabel(next, now)}
                </p>
                <p className={styles.nowTitle}>{next.title}</p>
                <p className={styles.nowMeta}>
                  {[eventSummary(next), eventEndLabel(next), next.location]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            ) : (
              <p className={styles.nowTitle} data-quiet="true">Nothing scheduled</p>
            )}
          </section>

          <AgentPanel
            connected={connected}
            onCalendarChanged={() => void refreshUpcoming()}
            userId={user.id}
          />
        </div>

        <section className={styles.upcoming} aria-labelledby="upcoming-heading">
          <div className={styles.sectionHeading}>
            <h2 className={styles.eyebrow} id="upcoming-heading">Upcoming events</h2>
            {connection === "connected" ? (
              <button
                className={styles.quietButton}
                type="button"
                onClick={() => void refreshUpcoming()}
              >
                <ArrowClockwise size={14} aria-hidden="true" />
                Refresh
              </button>
            ) : null}
          </div>

          {connection === "checking" ? (
            <div className={styles.ledgerSkeleton} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : later.length ? (
            <ul className={styles.ledger}>
              {later.map((event) => <LedgerRow event={event} key={event.id} />)}
            </ul>
          ) : (
            <div className={styles.ledgerEmpty}>
              <CalendarBlank size={28} aria-hidden="true" />
              <p>
                {connection === "connected"
                  ? "Nothing else scheduled. Ask SS to add something."
                  : "Once Google Calendar is connected, your schedule reads here."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
