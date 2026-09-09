import { describe, expect, it } from "vitest";

import { isPublicIpAddress } from "./public-url";

describe("isPublicIpAddress", () => {
  it("accepts routable addresses", () => {
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
    expect(isPublicIpAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
  });

  it("rejects loopback, private, and reserved addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.5",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "fe80::1%eth0",
      "::ffff:127.0.0.1",
      "not-an-address",
    ]) {
      expect(isPublicIpAddress(address), address).toBe(false);
    }
  });
});
