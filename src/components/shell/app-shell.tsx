"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Popover,
} from "react-aria-components";
import { GearSix } from "@phosphor-icons/react/dist/ssr/GearSix";
import { Waveform } from "@phosphor-icons/react/dist/ssr/Waveform";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { SignOut } from "@phosphor-icons/react/dist/ssr/SignOut";

import { messages } from "@/calendar/messages";
import { authClient } from "@/lib/auth-client";
import {
  GOOGLE_CALENDAR_PROVIDER,
  GOOGLE_CALENDAR_SCOPE,
} from "@/lib/google-calendar";
import type { UpcomingEvent } from "@/server/google-calendar";

import { AgentPanel, type AgentMode } from "../agent/agent-panel";
import { clearSavedAgent } from "../agent/agent-storage";
import { ShellProvider, type Connection } from "./shell-context";
import styles from "./app-shell.module.css";

interface AppShellProps {
  children: ReactNode;
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

const views = [
  { href: "/", label: messages.views.calendar },
  { href: "/library", label: messages.views.library },
] as const;

function initials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length) return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return email.slice(0, 1).toUpperCase();
}

export function AppShell({ children, initialConnected, user }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
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

  const connectGoogle = useCallback(async () => {
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
  }, []);

  async function signOut() {
    const result = await authClient.signOut();
    if (!result.error) {
      clearSavedAgent(user.id);
      router.replace("/login");
      router.refresh();
    }
  }

  const connected = connection === "connected" || (connection === "checking" && initialConnected);
  const agentOpen = agentMode === "docked";

  const shell = useMemo(
    () => ({
      connection,
      connecting,
      events,
      now,
      timeZone,
      agentOpen,
      connectGoogle: () => void connectGoogle(),
      refreshUpcoming: () => void refreshUpcoming(),
    }),
    [
      connection,
      connecting,
      events,
      now,
      timeZone,
      agentOpen,
      connectGoogle,
      refreshUpcoming,
    ],
  );

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <h1 className={styles.mark}>{messages.appName}</h1>
          <nav className={styles.viewNav} aria-label="Views">
            {views.map((view) => {
              const current =
                view.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(view.href);
              return (
                <Link
                  className={styles.viewLink}
                  aria-current={current ? "page" : undefined}
                  href={view.href}
                  key={view.href}
                >
                  {view.label}
                </Link>
              );
            })}
          </nav>
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
        <ShellProvider value={shell}>{children}</ShellProvider>
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
