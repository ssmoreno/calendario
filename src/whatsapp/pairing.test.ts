import { describe, expect, it } from "vitest";

import {
  extractPairingCode,
  generatePairingCode,
  PAIRING_CODE_LENGTH,
  pairingCodeExpiry,
  PAIRING_CODE_TTL_MS,
} from "./pairing";

describe("generatePairingCode", () => {
  it("always produces six digits, including for small draws", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePairingCode()).toMatch(/^\d{6}$/u);
    }
  });
});

describe("extractPairingCode", () => {
  it("reads the code out of how people actually text it", () => {
    expect(extractPairingCode("123456")).toBe("123456");
    expect(extractPairingCode("123 456")).toBe("123456");
    expect(extractPairingCode("my code is 123-456")).toBe("123456");
    expect(extractPairingCode("  042135\n")).toBe("042135");
  });

  it("treats anything that is not exactly six digits as a normal message", () => {
    expect(extractPairingCode("hello")).toBeNull();
    expect(extractPairingCode("12345")).toBeNull();
    expect(extractPairingCode("1234567")).toBeNull();
    expect(extractPairingCode("call me at 555 1234")).toBeNull();
    expect(extractPairingCode("")).toBeNull();
  });
});

describe("pairingCodeExpiry", () => {
  it("expires the code a fixed window after it was minted", () => {
    const now = new Date("2026-08-27T12:00:00.000Z");

    expect(pairingCodeExpiry(now).getTime() - now.getTime()).toBe(
      PAIRING_CODE_TTL_MS,
    );
  });
});

it("keeps the code short enough to text without thinking", () => {
  expect(PAIRING_CODE_LENGTH).toBe(6);
});
