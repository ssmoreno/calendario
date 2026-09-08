import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { UpcomingEvent } from "@/server/google-calendar";

import { EventBoard } from "./event-board";

const NOW = new Date("2026-09-01T08:00:00Z").getTime();

function timed(id: string, title: string, startsAt: string): UpcomingEvent {
  const endsAt = new Date(new Date(startsAt).getTime() + 60 * 60_000).toISOString();
  return {
    id,
    title,
    timing: { kind: "timed", startsAt, endsAt, timeZone: "UTC" },
    color: "ultramarine",
    reminderMinutes: [],
    usesDefaultReminder: false,
  };
}

const EVENTS = [
  timed("focus", "Focus block", "2026-09-01T10:00:00Z"),
  timed("standup", "Standup", "2026-09-02T09:00:00Z"),
  timed("planning", "Planning", "2026-09-03T11:00:00Z"),
  timed("retro", "Retro", "2026-09-08T11:00:00Z"),
];

function renderBoard(agentOpen = false, events = EVENTS) {
  return render(
    <EventBoard
      agentOpen={agentOpen}
      events={events}
      now={NOW}
      onRefresh={vi.fn()}
      timeZone="UTC"
    />,
  );
}

describe("EventBoard", () => {
  it("makes today primary and opens the first future day", () => {
    renderBoard();

    expect(screen.getByText("02:00")).toBeDefined();
    expect(screen.getByRole("button", { name: /Focus block/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Standup/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Planning/ })).toBeNull();
  });

  it("keeps only one future day expanded", async () => {
    renderBoard();

    await userEvent.click(screen.getByRole("button", { name: /Thursday/ }));

    expect(screen.getByRole("button", { name: /Planning/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Standup/ })).toBeNull();
  });

  it("uses dates instead of weekday names outside the current week", () => {
    renderBoard();

    expect(screen.getByRole("button", { name: /Sep 8/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Tuesday.*1 event/ })).toBeNull();
  });

  it("draws the ends of the day, which the old 07-22 strip dropped", () => {
    const { container } = renderBoard(false, [
      timed("dawn", "Dawn run", "2026-09-01T06:00:00Z"),
      timed("redeye", "Red-eye", "2026-09-01T23:00:00Z"),
    ]);

    expect(container.querySelectorAll('[style*="--event-left"]')).toHaveLength(2);
  });

  it("marks the rail as replaced when the agent is open", () => {
    renderBoard(true);

    const board = screen.getByRole("heading", { name: "Upcoming events" }).parentElement;
    expect(board?.getAttribute("data-agent-open")).toBe("true");
  });
});
