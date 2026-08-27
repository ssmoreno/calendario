import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WhatsAppLinkStatus } from "@/app/api/whatsapp/route";
import { messages } from "@/calendar/messages";
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
  whatsApp: WhatsAppLinkStatus = { waId: null, code: null },
) {
  render(
    <SettingsPage
      email="user@example.com"
      googleConnected={false}
      userId="user-a"
      initialSettings={DEFAULT_USER_SETTINGS}
      initialMemories={memories}
      initialWhatsApp={whatsApp}
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

    fireEvent.click(screen.getByRole("radio", { name: "Mint" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("radio", { name: "Gold" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFirst?.(
      settingsResponse({ ...DEFAULT_USER_SETTINGS, defaultColor: "mint" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Gold" })).toHaveProperty(
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

  it("shows the code to text after asking to connect WhatsApp", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ waId: null, code: "482913" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;
    renderSettings();

    fireEvent.click(
      screen.getByRole("button", { name: messages.settings.whatsappConnect }),
    );

    expect(
      await screen.findByText(messages.settings.whatsappCode("482913")),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/whatsapp", { method: "POST" });
  });

  it("offers to disconnect a number that is already linked", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ waId: null, code: null }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock;
    renderSettings([], { waId: "15551234567", code: null });

    expect(
      screen.getByText(messages.settings.whatsappLinked("15551234567")),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: messages.settings.whatsappDisconnect }),
    );

    expect(
      await screen.findByRole("button", {
        name: messages.settings.whatsappConnect,
      }),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/whatsapp", {
      method: "DELETE",
    });
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
