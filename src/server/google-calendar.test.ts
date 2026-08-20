import { describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  auth: { api: { getAccessToken: vi.fn() } },
}));

vi.mock("./db", () => ({
  prisma: { account: { count: vi.fn() } },
}));

import {
  googleCalendarForUser,
  GoogleCalendarBulkMutationError,
  GoogleCalendarService,
} from "./google-calendar";
import { auth } from "./auth";
import { prisma } from "./db";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const timedEvent = {
  id: "event-1",
  summary: "Planning",
  start: {
    dateTime: "2026-08-24T17:00:00-03:00",
    timeZone: "America/Argentina/Buenos_Aires",
  },
  end: {
    dateTime: "2026-08-24T18:00:00-03:00",
    timeZone: "America/Argentina/Buenos_Aires",
  },
  reminders: {
    useDefault: false,
    overrides: [{ method: "popup", minutes: 15 }],
  },
};

const recurringInstance = {
  ...timedEvent,
  id: "instance-2",
  recurringEventId: "series-1",
  originalStartTime: timedEvent.start,
};

const recurringParent = {
  ...timedEvent,
  id: "series-1",
  start: {
    dateTime: "2026-08-17T17:00:00-03:00",
    timeZone: "America/Argentina/Buenos_Aires",
  },
  end: {
    dateTime: "2026-08-17T18:00:00-03:00",
    timeZone: "America/Argentina/Buenos_Aires",
  },
  recurrence: ["RRULE:FREQ=WEEKLY;COUNT=4"],
  attendees: [{ email: "guest@example.com", responseStatus: "accepted" }],
  attachments: [{ fileUrl: "https://drive.google.com/file/d/notes" }],
  conferenceData: { conferenceId: "meet-id" },
  extendedProperties: { private: { source: "important" } },
  reminders: { useDefault: true },
  visibility: "private",
};

describe("GoogleCalendarService", () => {
  it("delegates expired-token refresh to Better Auth", async () => {
    vi.mocked(prisma.account.count).mockResolvedValueOnce(1);
    vi.mocked(auth.api.getAccessToken).mockResolvedValueOnce({
      accessToken: "refreshed-token",
      accessTokenExpiresAt: new Date("2026-08-24T20:00:00Z"),
      scopes: [],
      idToken: undefined,
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ items: [] }));

    const service = await googleCalendarForUser("user-1", "UTC", fetcher);
    await service.listUpcoming();

    expect(auth.api.getAccessToken).toHaveBeenCalledWith({
      body: { providerId: "google", userId: "user-1" },
    });
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      authorization: "Bearer refreshed-token",
    });
  });

  it("normalizes upcoming timed and all-day events", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      json({
        items: [
          timedEvent,
          {
            id: "event-2",
            summary: "Holiday",
            start: { date: "2026-08-25" },
            end: { date: "2026-08-26" },
          },
        ],
      }),
    );
    const service = new GoogleCalendarService(
      "token",
      "America/Argentina/Buenos_Aires",
      fetcher,
    );

    const events = await service.listUpcoming();

    expect(events).toEqual([
      expect.objectContaining({
        id: "event-1",
        title: "Planning",
        reminderMinutes: [15],
        timing: expect.objectContaining({
          kind: "timed",
          timeZone: "America/Argentina/Buenos_Aires",
        }),
      }),
      expect.objectContaining({
        id: "event-2",
        timing: {
          kind: "all-day",
          startDate: "2026-08-25",
          endDateExclusive: "2026-08-26",
        },
      }),
    ]);
  });

  it("keeps the series start when listing a recurring occurrence", async () => {
    const parentWithExclusion = {
      ...recurringParent,
      recurrence: [
        ...recurringParent.recurrence,
        "EXDATE;TZID=America/Argentina/Buenos_Aires:20260831T170000",
      ],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ items: [recurringInstance] }))
      .mockResolvedValueOnce(json(parentWithExclusion));
    const service = new GoogleCalendarService(
      "token",
      "America/Argentina/Buenos_Aires",
      fetcher,
    );

    const [occurrence] = await service.listOccurrences({
      from: "2026-08-24",
      to: "2026-08-24",
    });

    expect(occurrence.timing).toMatchObject({
      startsAt:
        "2026-08-24T17:00:00-03:00[America/Argentina/Buenos_Aires]",
    });
    expect(occurrence.rootTiming).toMatchObject({
      startsAt:
        "2026-08-17T17:00:00-03:00[America/Argentina/Buenos_Aires]",
    });
    expect(occurrence.rootHasRecurrenceExceptions).toBe(true);
  });

  it("paginates event-record reads", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ items: [timedEvent], nextPageToken: "next" }))
      .mockResolvedValueOnce(
        json({
          items: [
            {
              ...timedEvent,
              id: "event-2",
              summary: "Review",
            },
          ],
        }),
      );
    const service = new GoogleCalendarService("token", "UTC", fetcher);

    const records = await service.listEventRecords();

    expect(records.map((record) => record.title)).toEqual(["Planning", "Review"]);
    expect(String(fetcher.mock.calls[1][0])).toContain("pageToken=next");
  });

  it("sends Google event payloads for agent-created events", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(timedEvent));
    const service = new GoogleCalendarService("token", "UTC", fetcher);

    await service.createEvent({
      title: "Planning",
      timing: {
        kind: "timed",
        startsAt: "2026-08-24T17:00:00-03:00[America/Argentina/Buenos_Aires]",
        durationMinutes: 60,
      },
      recurrence: null,
      color: "coral",
      reminderMinutesBefore: 15,
    });

    const init = fetcher.mock.calls[0][1];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      summary: "Planning",
      colorId: "11",
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 15 }],
      },
    });
  });

  it("classifies revoked access separately from provider outages", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({}, 401));
    const service = new GoogleCalendarService("expired", "UTC", fetcher);

    await expect(service.listUpcoming()).rejects.toMatchObject({
      kind: "authorization",
      status: 401,
    });
  });

  it("rebases whole-series time changes onto the recurring master's date", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(recurringInstance))
      .mockResolvedValueOnce(json(recurringParent))
      .mockResolvedValueOnce(json(recurringParent));
    const service = new GoogleCalendarService(
      "token",
      "America/Argentina/Buenos_Aires",
      fetcher,
    );

    await service.updateEvent(
      {
        eventId: "instance-2",
        occurrenceStart:
          "2026-08-24T17:00:00-03:00[America/Argentina/Buenos_Aires]",
      },
      "series",
      {
        timing: {
          kind: "timed",
          startsAt:
            "2026-08-24T10:00:00-03:00[America/Argentina/Buenos_Aires]",
          durationMinutes: 60,
        },
      },
    );

    expect(String(fetcher.mock.calls[2][0])).toContain("/events/series-1");
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toMatchObject({
      start: { dateTime: "2026-08-17T13:00:00.000Z" },
      end: { dateTime: "2026-08-17T14:00:00.000Z" },
    });
  });

  it("uses a real UTC cutoff when trimming a series east of UTC", async () => {
    const tokyoParent = {
      ...timedEvent,
      id: "tokyo-series",
      start: {
        dateTime: "2026-08-17T17:00:00+09:00",
        timeZone: "Asia/Tokyo",
      },
      end: {
        dateTime: "2026-08-17T18:00:00+09:00",
        timeZone: "Asia/Tokyo",
      },
      recurrence: ["RRULE:FREQ=WEEKLY"],
    };
    const tokyoInstance = {
      ...tokyoParent,
      id: "tokyo-instance",
      recurringEventId: "tokyo-series",
      recurrence: undefined,
      start: {
        dateTime: "2026-08-24T17:00:00+09:00",
        timeZone: "Asia/Tokyo",
      },
      end: {
        dateTime: "2026-08-24T18:00:00+09:00",
        timeZone: "Asia/Tokyo",
      },
      originalStartTime: {
        dateTime: "2026-08-24T17:00:00+09:00",
        timeZone: "Asia/Tokyo",
      },
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(tokyoInstance))
      .mockResolvedValueOnce(json(tokyoParent))
      .mockResolvedValueOnce(json(tokyoParent));
    const service = new GoogleCalendarService("token", "Asia/Tokyo", fetcher);

    await service.deleteEvent(
      {
        eventId: "tokyo-instance",
        occurrenceStart: "2026-08-24T17:00:00+09:00[Asia/Tokyo]",
      },
      "following",
    );

    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({
      recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=20260824T075959Z"],
    });
  });

  it("waits for bounded reminder updates and reports the exact partial result", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const id = String(input).split("/").at(-1);
      return id === "event-b"
        ? json({}, 503)
        : json({ ...timedEvent, id });
    });
    const service = new GoogleCalendarService("token", "UTC", fetcher);

    const failure = service.setEventReminders(
      ["event-a", "event-b", "event-c"],
      10,
    );
    await expect(failure).rejects.toBeInstanceOf(
      GoogleCalendarBulkMutationError,
    );
    await expect(failure).rejects.toMatchObject({
      succeededEventIds: ["event-a", "event-c"],
      failedEventIds: ["event-b"],
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("removes a newly split series if trimming the original fails", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(recurringInstance))
      .mockResolvedValueOnce(json(recurringParent))
      .mockResolvedValueOnce(json({ ...recurringInstance, id: "new-series" }))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json(recurringParent))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = new GoogleCalendarService(
      "token",
      "America/Argentina/Buenos_Aires",
      fetcher,
    );

    await expect(
      service.updateEvent(
        {
          eventId: "instance-2",
          occurrenceStart:
            "2026-08-24T17:00:00-03:00[America/Argentina/Buenos_Aires]",
        },
        "following",
        { location: "New room" },
      ),
    ).rejects.toMatchObject({ kind: "unavailable" });

    expect(String(fetcher.mock.calls[2][0])).toContain(
      "supportsAttachments=true&conferenceDataVersion=1",
    );
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toMatchObject({
      attendees: [{ email: "guest@example.com", responseStatus: "accepted" }],
      attachments: [{ fileUrl: "https://drive.google.com/file/d/notes" }],
      conferenceData: { conferenceId: "meet-id" },
      extendedProperties: { private: { source: "important" } },
      location: "New room",
      reminders: { useDefault: true },
      visibility: "private",
    });
    expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe("DELETE");
    expect(String(fetcher.mock.calls.at(-1)?.[0])).toContain("new-series");
  });

  it("reports when a failed split also fails to remove the replacement", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(recurringInstance))
      .mockResolvedValueOnce(json(recurringParent))
      .mockResolvedValueOnce(json({ ...recurringInstance, id: "new-series" }))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json(recurringParent))
      .mockResolvedValueOnce(json({}, 503));
    const service = new GoogleCalendarService(
      "token",
      "America/Argentina/Buenos_Aires",
      fetcher,
    );

    await expect(
      service.updateEvent(
        {
          eventId: "instance-2",
          occurrenceStart:
            "2026-08-24T17:00:00-03:00[America/Argentina/Buenos_Aires]",
        },
        "following",
        { location: "New room" },
      ),
    ).rejects.toMatchObject({
      kind: "unavailable",
      message: expect.stringMatching(/check the calendar before retrying/i),
    });
  });

  it("keeps the replacement when a re-read confirms that trimming succeeded", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(recurringInstance))
      .mockResolvedValueOnce(json(recurringParent))
      .mockResolvedValueOnce(json({ ...recurringInstance, id: "new-series" }))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(
        json({
          ...recurringParent,
          recurrence: ["RRULE:FREQ=WEEKLY;COUNT=1"],
        }),
      );
    const service = new GoogleCalendarService(
      "token",
      "America/Argentina/Buenos_Aires",
      fetcher,
    );

    await service.updateEvent(
      {
        eventId: "instance-2",
        occurrenceStart:
          "2026-08-24T17:00:00-03:00[America/Argentina/Buenos_Aires]",
      },
      "following",
      { location: "New room" },
    );

    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBeUndefined();
  });

  it("retains historical exclusions and resets future exceptions after a split", async () => {
    const excluded =
      "EXDATE;TZID=America/Argentina/Buenos_Aires:20260831T170000";
    const parent = {
      ...recurringParent,
      recurrence: ["RRULE:FREQ=WEEKLY;COUNT=4", excluded],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(recurringInstance))
      .mockResolvedValueOnce(json(parent))
      .mockResolvedValueOnce(json({ ...recurringInstance, id: "new-series" }))
      .mockResolvedValueOnce(json(parent));
    const service = new GoogleCalendarService(
      "token",
      "America/Argentina/Buenos_Aires",
      fetcher,
    );

    await service.updateEvent(
      {
        eventId: "instance-2",
        occurrenceStart:
          "2026-08-24T17:00:00-03:00[America/Argentina/Buenos_Aires]",
      },
      "following",
      { location: "New room" },
    );

    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body)).recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;COUNT=3",
    ]);
    expect(JSON.parse(String(fetcher.mock.calls[3][1]?.body)).recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;COUNT=1",
      excluded,
    ]);
  });

  it("refuses to split recurrence data that cannot be preserved safely", async () => {
    const parent = {
      ...recurringParent,
      recurrence: [
        "RRULE:FREQ=WEEKLY;COUNT=4",
        "RDATE;TZID=America/Argentina/Buenos_Aires:20260930T170000",
      ],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(recurringInstance))
      .mockResolvedValueOnce(json(parent));
    const service = new GoogleCalendarService(
      "token",
      "America/Argentina/Buenos_Aires",
      fetcher,
    );

    await expect(
      service.updateEvent(
        {
          eventId: "instance-2",
          occurrenceStart:
            "2026-08-24T17:00:00-03:00[America/Argentina/Buenos_Aires]",
        },
        "following",
        { location: "New room" },
      ),
    ).rejects.toThrow(/cannot be split safely/i);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("deletes the parent when following deletion starts at the first instance", async () => {
    const firstInstance = {
      ...recurringInstance,
      id: "instance-1",
      start: recurringParent.start,
      end: recurringParent.end,
      originalStartTime: recurringParent.start,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(firstInstance))
      .mockResolvedValueOnce(json(recurringParent))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const service = new GoogleCalendarService(
      "token",
      "America/Argentina/Buenos_Aires",
      fetcher,
    );

    await service.deleteEvent(
      {
        eventId: "instance-1",
        occurrenceStart:
          "2026-08-17T17:00:00-03:00[America/Argentina/Buenos_Aires]",
      },
      "following",
    );

    expect(String(fetcher.mock.calls[2][0])).toContain("/events/series-1");
    expect(fetcher.mock.calls[2][1]?.method).toBe("DELETE");
  });
});
