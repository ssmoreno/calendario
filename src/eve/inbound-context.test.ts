import { describe, expect, it } from "vitest";

import { buildInboundContext } from "./inbound-context";

describe("buildInboundContext", () => {
  it("numbers the batch in arrival order", () => {
    const content = buildInboundContext([
      { messageId: "wamid.1", preview: "Artaud" },
      { messageId: "wamid.2", preview: "el disco, no el pintor" },
    ]);

    expect(content).toContain("1. Artaud");
    expect(content).toContain("2. el disco, no el pintor");
    expect(content).not.toContain("wamid");
  });
});
