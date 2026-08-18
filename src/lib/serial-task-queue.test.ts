import { describe, expect, it } from "vitest";

import { SerialTaskQueue } from "./serial-task-queue";

describe("SerialTaskQueue", () => {
  it("starts each task only after the previous task settles", async () => {
    const queue = new SerialTaskQueue();
    const events: string[] = [];
    let finishFirst: (() => void) | undefined;
    const first = queue.run(
      () =>
        new Promise<void>((resolve) => {
          events.push("first started");
          finishFirst = resolve;
        }),
    );
    const second = queue.run(async () => {
      events.push("second started");
    });

    await Promise.resolve();
    expect(events).toEqual(["first started"]);
    finishFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual(["first started", "second started"]);
  });
});
