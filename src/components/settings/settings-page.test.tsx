import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/calendar/settings";

import { SettingsPage } from "./settings-page";

const moduleMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: moduleMocks.replace,
    refresh: moduleMocks.refresh,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: moduleMocks.signOut },
}));

const originalFetch = globalThis.fetch;

function settingsResponse(settings: UserSettings): Response {
  return new Response(JSON.stringify({ settings }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function renderSettings(
  memories: { id: string; content: string; createdAt: string }[] = [],
) {
  render(
    <SettingsPage
      email="user@example.com"
      userId="user-a"
      initialSettings={DEFAULT_USER_SETTINGS}
      initialMemories={memories}
    />,
  );
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("SettingsPage", () => {
  beforeEach(() => {
    moduleMocks.refresh.mockReset();
    moduleMocks.replace.mockReset();
    moduleMocks.signOut.mockReset();
  });

  it("serializes preference writes so the latest choice wins", async () => {
    let resolveFirst: ((response: Response) => void) | undefined;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce(
        settingsResponse({ ...DEFAULT_USER_SETTINGS, defaultColor: "gold" }),
      );
    globalThis.fetch = fetchMock;
    renderSettings();

    fireEvent.click(screen.getByRole("radio", { name: "mint" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("radio", { name: "gold" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFirst?.(
      settingsResponse({ ...DEFAULT_USER_SETTINGS, defaultColor: "mint" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "gold" })).toHaveProperty(
        "checked",
        true,
      ),
    );
    expect(
      fetchMock.mock.calls.map(([, init]) =>
        JSON.parse(init?.body as string),
      ),
    ).toEqual([{ defaultColor: "mint" }, { defaultColor: "gold" }]);
  });

  it("recovers when forgetting a memory fails before a response", async () => {
    globalThis.fetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("offline"));
    renderSettings([
      {
        id: "memory-a",
        content: "No morning meetings",
        createdAt: "2026-08-17T12:00:00.000Z",
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Forget" }));

    expect(await screen.findByText("That change could not be saved.")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Forget" })).toHaveProperty(
        "disabled",
        false,
      ),
    );
    expect(screen.getByText("No morning meetings")).toBeTruthy();
  });

  it("stays signed in when server-side logout fails", async () => {
    moduleMocks.signOut.mockResolvedValue({
      data: null,
      error: { message: "offline" },
    });
    localStorage.setItem("calendario.chat.v1.user.user-a", "saved chat");
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByText("That account could not be signed out. Try again."),
    ).toBeTruthy();
    expect(moduleMocks.replace).not.toHaveBeenCalled();
    expect(localStorage.getItem("calendario.chat.v1.user.user-a")).toBe(
      "saved chat",
    );
  });
});
