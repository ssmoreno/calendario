"use client";

import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";

import { useShell } from "../shell/shell-context";
import { EventBoard } from "./event-board";
import styles from "../view-state.module.css";

export function CalendarView() {
  const {
    agentOpen,
    connecting,
    connection,
    connectGoogle,
    events,
    now,
    refreshUpcoming,
    timeZone,
  } = useShell();
  const needsGoogle =
    connection === "not_connected" || connection === "authorization";

  if (connection === "checking") {
    return (
      <div className={styles.skeleton} role="status" aria-label="Loading your calendar…">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (needsGoogle) {
    return (
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
          onClick={connectGoogle}
        >
          {connecting
            ? "Connecting…"
            : connection === "authorization"
              ? "Reconnect Google Calendar"
              : "Connect Google Calendar"}
        </button>
      </div>
    );
  }

  if (connection === "error") {
    return (
      <div className={styles.notice}>
        <h2 className={styles.eyebrow}>Google Calendar</h2>
        <p className={styles.noticeProse} role="alert">
          Google Calendar is unavailable right now.
        </p>
        <button className={styles.retryButton} type="button" onClick={refreshUpcoming}>
          <ArrowClockwise size={16} aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className={styles.notice}>
        <CalendarBlank size={28} aria-hidden="true" />
        <p className={styles.noticeProse}>
          Nothing scheduled in the next two weeks. Ask SS to add something.
        </p>
      </div>
    );
  }

  return (
    <EventBoard
      agentOpen={agentOpen}
      events={events}
      now={now}
      onRefresh={refreshUpcoming}
      timeZone={timeZone}
    />
  );
}
