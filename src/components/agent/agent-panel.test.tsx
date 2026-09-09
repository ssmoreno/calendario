import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import type { EveMessage } from "eve/react";

import { SAVED_ITEM_REACTION } from "@/library/constants";
import { writeSavedAgent } from "./agent-storage";
import { AgentPanel } from "./agent-panel";

const moduleMocks = vi.hoisted(() => ({ useEveAgent: vi.fn() }));

vi.mock("eve/react", () => ({ useEveAgent: moduleMocks.useEveAgent }));

const USER_ID = "user-a";
const SESSION: ClientSessionState = { sessionId: "sess_1", streamIndex: 0 };

let sequence = 0;

function meta() {
  sequence += 1;
  return { at: new Date(sequence).toISOString(), id: `evt_${sequence}` };
}

function turnFailed(turnId: string): MessageStreamEvent {
  return {
    data: { code: "customer_verification_required", message: "no card", sequence, turnId },
    meta: meta(),
    type: "turn.failed",
  };
}

function userMessage(turnId: string, text: string): EveMessage {
  return {
    id: `${turnId}:user`,
    metadata: { status: "submitted", turnId },
    parts: [{ state: "done", text, type: "text" }],
    role: "user",
  };
}

/** What the reducer projects for a turn that died after `step.started`. */
function emptyAssistantMessage(turnId: string): EveMessage {
  return {
    id: `${turnId}:assistant`,
    metadata: { status: "streaming", turnId },
    parts: [{ type: "step-start" }],
    role: "assistant",
  };
}

function renderPanel(
  messages: EveMessage[],
  events: MessageStreamEvent[] = [],
) {
  // Docked is the shape the panel takes once a conversation exists.
  writeSavedAgent(USER_ID, { events: [turnFailed("turn_0")], session: SESSION });
  moduleMocks.useEveAgent.mockReturnValue({
    data: { messages },
    error: undefined,
    events,
    respond: vi.fn(),
    reset: vi.fn(),
    send: vi.fn(),
    session: SESSION,
    status: "ready",
    stop: vi.fn(),
  });
  render(
    <AgentPanel
      mode="docked"
      onBusyChange={vi.fn()}
      onDataChanged={vi.fn()}
      onModeChange={vi.fn()}
      userId={USER_ID}
    />,
  );
}

const NOTICE = /Something went wrong on my end/;

function assistantMessage(turnId: string, text: string): EveMessage {
  return {
    id: `${turnId}:assistant`,
    metadata: { status: "complete", turnId },
    parts: [{ state: "done", text, type: "text" }],
    role: "assistant",
  };
}

describe("AgentPanel", () => {
  it("says a settled turn failed instead of showing the user nothing", () => {
    renderPanel(
      [userMessage("turn_1", "do you know my name?"), emptyAssistantMessage("turn_1")],
      [turnFailed("turn_1")],
    );

    expect(screen.getByText("do you know my name?")).toBeDefined();
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it("says so too when the turn failed before it produced any message", () => {
    renderPanel([userMessage("turn_1", "do you know my name?")], [turnFailed("turn_1")]);

    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it("stays quiet when the turn replied", () => {
    renderPanel([
      userMessage("turn_1", "do you know my name?"),
      assistantMessage("turn_1", "You're Santi."),
    ]);

    expect(screen.getByText("You're Santi.")).toBeDefined();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("shows a save confirmation as a reaction on the user's message", () => {
    renderPanel([
      userMessage("turn_1", "Save Kind of Blue."),
      assistantMessage("turn_1", SAVED_ITEM_REACTION),
    ]);

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Save Kind of Blue.")).toBeDefined();
    expect(
      screen.getByRole("img", { name: "SS reacted with a check mark" }),
    ).toBeDefined();
  });
});
