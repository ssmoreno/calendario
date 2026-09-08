import { describe, expect, it } from "vitest";

import {
  extractPairingCode,
  generatePairingCode,
  pairingCodeExpiry,
  PAIRING_CODE_TTL_MS,
} from "./pairing";

describe("WhatsApp pairing", () => {
  it("generates six-digit codes", () => {
    expect(generatePairingCode()).toMatch(/^\d{6}$/u);
  });

  it("accepts common ways of texting a pairing code", () => {
    expect(extractPairingCode("123456")).toBe("123456");
    expect(extractPairingCode("my code is 123-456")).toBe("123456");
    expect(extractPairingCode("hello")).toBeNull();
  });

  it("expires codes after ten minutes", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    expect(pairingCodeExpiry(now).getTime() - now.getTime()).toBe(
      PAIRING_CODE_TTL_MS,
    );
  });
});
