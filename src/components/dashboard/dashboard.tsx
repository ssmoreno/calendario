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
import { GearSix } from "@phosphor-icons/react/dist/ssr/GearSix";
import { Waveform } from "@phosphor-icons/react/dist/ssr/Waveform";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { SignOut } from "@phosphor-icons/react/dist/ssr/SignOut";

import { authClient } from "@/lib/auth-client";
import {
  GOOGLE_CALENDAR_PROVIDER,
  GOOGLE_CALENDAR_SCOPE,
} from "@/lib/google-calendar";
import type { UpcomingEvent } from "@/server/google-calendar";

import { AgentPanel, type AgentMode } from "../agent/agent-panel";
import { clearSavedAgent } from "../agent/agent-storage";
import { EventBoard } from "./event-board";
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

export function Dashboard({ initialConnected, user }: DashboardProps) {
  const router = useRouter();
  const [connection, setConnection] = useState<Connection>(
    initialConnected ? "checking" : "not_connected",
  );
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [agentMode, setAgentMode] = useState<AgentMode>("closed");
  const [agentBusy, setAgentBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const avatarText = useMemo(() => initials(user.name, user.email), [user]);
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const refreshUpcoming = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/calendar/upcoming?timeZone=${encodeURIComponent(
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        )}`,
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

  /*
   * The Agent is summoned rather than sited, so it needs a key of its own.
   * Reopening lands on the conversation already in progress, if there is one.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setAgentMode((mode) =>
          mode === "closed" ? "docked" : "closed",
        );
        return;
      }
      if (event.key === "Escape") setAgentMode("closed");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [user.id]);

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
  const needsGoogle =
    connection === "not_connected" || connection === "authorization";

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">SS</span>
          <h1><span className={styles.visuallyHidden}>SS </span>Calendar</h1>
        </div>
        <div className={styles.topbarEnd}>
          <span className={styles.connectionPill} data-state={connection}>
            <span className={styles.connectionDot} aria-hidden="true" />
            {connectionLabels[connection]}
          </span>
          <button
            className={styles.askButton}
            data-busy={agentBusy || undefined}
            type="button"
            onClick={() =>
              setAgentMode((mode) =>
                mode === "closed" ? "docked" : "closed",
              )
            }
          >
            {agentMode === "closed" ? (
              <Waveform size={16} aria-hidden="true" />
            ) : (
              <X size={16} aria-hidden="true" />
            )}
            {agentMode === "closed" ? "Ask SS" : "Close"}
            <kbd className={styles.shortcut}>⌘K</kbd>
          </button>
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
        {connection === "checking" ? (
          <div className={styles.skeleton} role="status" aria-label="Loading your calendar…">
            <span />
            <span />
            <span />
          </div>
        ) : needsGoogle ? (
          <div className={styles.notice}>
            <h2 className={styles.eyebrow}>Google Calendar</h2>
            <p className={styles.noticeProse}>
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
          </div>
        ) : connection === "error" ? (
          <div className={styles.notice}>
            <h2 className={styles.eyebrow}>Google Calendar</h2>
            <p className={styles.noticeProse} role="alert">
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
          </div>
        ) : events.length ? (
          <EventBoard
            agentOpen={agentMode === "docked"}
            events={events}
            now={now}
            onRefresh={() => void refreshUpcoming()}
            timeZone={timeZone}
          />
        ) : (
          <div className={styles.notice}>
            <CalendarBlank size={28} aria-hidden="true" />
            <p className={styles.noticeProse}>
              Nothing scheduled in the next two weeks. Ask SS to add something.
            </p>
          </div>
        )}
      </div>

      <AgentPanel
        connected={connected}
        mode={agentMode}
        onBusyChange={setAgentBusy}
        onCalendarChanged={() => void refreshUpcoming()}
        onModeChange={setAgentMode}
        userId={user.id}
      />
    </main>
  );
}
