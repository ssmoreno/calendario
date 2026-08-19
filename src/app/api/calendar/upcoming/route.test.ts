import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth", () => ({
  auth: { api: { getSession: vi.fn(), getAccessToken: vi.fn() } },
}));

vi.mock("@/server/db", () => ({
  prisma: { account: { count: vi.fn() } },
}));

import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

import { GET } from "./route";

function request() {
  return new Request("https://calendario.test/api/calendar/upcoming?timeZone=UTC");
}

describe("GET /api/calendar/upcoming", () => {
  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    vi.mocked(prisma.account.count).mockResolvedValue(1);
  });

  it("asks an unconnected user to connect rather than to reconnect", async () => {
    // The connection disappears between the route's check and the token lookup.
    vi.mocked(prisma.account.count)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "not_connected",
      events: [],
    });
  });

  it("flags an authorization failure so the dashboard offers a reconnect", async () => {
    vi.mocked(auth.api.getAccessToken).mockRejectedValueOnce(
      new Error("Failed to get a valid access token"),
    );

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "not_connected",
      reason: "authorization",
      events: [],
    });
  });

  it("reports an outage as a service error", async () => {
    vi.mocked(auth.api.getAccessToken).mockResolvedValueOnce({
      accessToken: "token",
      accessTokenExpiresAt: new Date("2026-08-24T20:00:00Z"),
      scopes: [],
      idToken: undefined,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("", { status: 500 })),
    );

    const response = await GET(request());

    expect(response.status).toBe(503);
  });
});
