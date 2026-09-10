import { describe, expect, it } from "vitest";

import { parseAcknowledgement } from "./acknowledgement";

describe("parseAcknowledgement", () => {
  it("reads a bare checkmark as the whole batch", () => {
    expect(parseAcknowledgement("✅")).toEqual({ positions: [], reply: "" });
  });

  it("reads the numbered messages", () => {
    expect(parseAcknowledgement("✅ 1, 3")).toEqual({
      positions: [1, 3],
      reply: "",
    });
  });

  it("keeps the rest of the reply", () => {
    expect(parseAcknowledgement("✅ 2\nNo encontré el disco.\nProbá otro.")).toEqual({
      positions: [2],
      reply: "No encontré el disco.\nProbá otro.",
    });
  });

  it("drops repeated numbers", () => {
    expect(parseAcknowledgement("✅ 1 1 2")?.positions).toEqual([1, 2]);
  });

  it("treats a checkmark used in prose as ordinary text", () => {
    expect(parseAcknowledgement("✅ Guardado.")).toBeNull();
    expect(parseAcknowledgement("Guardado ✅")).toBeNull();
    expect(parseAcknowledgement("Listo.\n✅ 1")).toBeNull();
  });
});
