import type { MessageStreamEvent } from "eve/client";

/**
 * The turns that ended in failure. eve keeps the session healthy after one
 * turn fails, so the hook reports neither an error nor a busy status for it —
 * only the event stream says it happened. `step.failed` is not counted: eve
 * retries a step, and the turn boundary is what says the work was lost.
 */
export function failedTurns(
  events: readonly MessageStreamEvent[],
): ReadonlySet<string> {
  const failed = new Set<string>();
  for (const event of events) {
    if (event.type === "turn.failed") failed.add(event.data.turnId);
  }
  return failed;
}
