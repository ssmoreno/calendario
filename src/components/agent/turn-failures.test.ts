import { describe, expect, it } from "vitest";
import type { MessageStreamEvent } from "eve/client";

import { failedTurns } from "./turn-failures";

let sequence = 0;

function meta() {
  sequence += 1;
  return { at: new Date(sequence).toISOString(), id: `evt_${sequence}` };
}

function failed(turnId: string): MessageStreamEvent {
  return {
    data: { code: "model_error", message: "boom", sequence, turnId },
    meta: meta(),
    type: "turn.failed",
  };
}

function completed(turnId: string): MessageStreamEvent {
  return {
    data: { sequence, turnId },
    meta: meta(),
    type: "turn.completed",
  };
}

function stepFailed(turnId: string): MessageStreamEvent {
  return {
    data: {
      code: "model_error",
      message: "boom",
      sequence,
      stepIndex: 0,
      turnId,
    },
    meta: meta(),
    type: "step.failed",
  };
}

describe("failedTurns", () => {
  it("finds the turns that failed and leaves the ones that finished", () => {
    const failures = failedTurns([
      completed("turn_1"),
      stepFailed("turn_2"),
      failed("turn_2"),
      completed("turn_3"),
    ]);
    expect([...failures]).toEqual(["turn_2"]);
  });

  it("counts a retried step as a failure only once the turn gives up", () => {
    expect(failedTurns([stepFailed("turn_1"), completed("turn_1")]).size).toBe(0);
  });

  it("reports nothing for an empty stream", () => {
    expect(failedTurns([]).size).toBe(0);
  });
});
