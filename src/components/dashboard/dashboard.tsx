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

function UpcomingCard({ event }: { event: UpcomingEvent }) {
  const end = eventEndLabel(event);
  return (
    <li>
      <details className={styles.eventCard}>
        <summary>
          <span className={styles.eventWhen}>{eventSummary(event)}</span>
          <strong>{event.title}</strong>
          <span className={styles.expandMark} aria-hidden="true">+</span>
        </summary>
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

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div aria-hidden="true" />
        <h1>SS Calendar</h1>
        <DialogTrigger isOpen={profileOpen} onOpenChange={setProfileOpen}>
          <Button className={styles.avatarButton} aria-label="Open profile menu">
            {avatarText}
          </Button>
          <Popover className={styles.profilePopover} placement="bottom end" offset={8}>
            <Dialog className={styles.profileDialog} aria-label="Profile">
              <div className={styles.profileIdentity}>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <Link href="/settings" onClick={() => setProfileOpen(false)}>
                Settings
              </Link>
              <button type="button" onClick={() => void signOut()}>
                Log out
              </button>
            </Dialog>
          </Popover>
        </DialogTrigger>
      </header>

      <div className={styles.workspace}>
        <AgentPanel
          connected={connected}
          onCalendarChanged={() => void refreshUpcoming()}
          userId={user.id}
        />

        <section className={styles.upcoming} aria-labelledby="upcoming-heading">
          <div className={styles.sectionHeading}>
            <h2 id="upcoming-heading">Upcoming events</h2>
            {connection === "connected" ? (
              <button type="button" onClick={() => void refreshUpcoming()}>
                Refresh
              </button>
            ) : null}
          </div>

          {connection === "checking" ? (
            <div className={styles.stateCard} role="status">Loading your calendar…</div>
          ) : connection === "not_connected" || connection === "authorization" ? (
            <div className={styles.stateCard}>
              <p>
                {connection === "authorization"
                  ? "SS needs you to reconnect Google Calendar to restore access."
                  : "Connect Google Calendar to see upcoming events and let SS manage them."}
              </p>
              <button disabled={connecting} type="button" onClick={() => void connectGoogle()}>
                {connecting
                  ? "Connecting…"
                  : connection === "authorization"
                    ? "Reconnect Google Calendar"
                    : "Connect Google Calendar"}
              </button>
            </div>
          ) : connection === "error" ? (
            <div className={styles.stateCard} role="alert">
              <p>Google Calendar is unavailable right now.</p>
              <button type="button" onClick={() => void refreshUpcoming()}>Try again</button>
            </div>
          ) : events.length ? (
            <ul className={styles.eventList}>
              {events.map((event) => <UpcomingCard event={event} key={event.id} />)}
            </ul>
          ) : (
            <div className={styles.stateCard}>No upcoming events.</div>
          )}
        </section>
      </div>
    </main>
  );
}
