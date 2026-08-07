import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { localDateTimeToZoned } from "@/calendar/date-time";
import { LocalCalendarService } from "@/calendar/local-calendar-service";

import { createEveTools, type EveTools } from "./tools";

const TIME_ZONE = "UTC";

async function asJson(result: unknown) {
  return JSON.parse((await result) as string);
}

describe("Eve calendar tools", () => {
  let service: LocalCalendarService;
  let tools: EveTools;

  beforeEach(() => {
    window.localStorage.clear();
    service = LocalCalendarService.open(TIME_ZONE).service;
    tools = createEveTools(service, { timeZone: TIME_ZONE });
  });

  afterEach(() => service.dispose());

  function listAugust(query?: string) {
    return asJson(
      tools.listEvents.run({ from: "2026-08-01", to: "2026-08-31", query }),
    );
  }

  it("creates a timed event in the user's timezone by default", async () => {
    const result = await asJson(
      tools.createEvent.run({
        title: "Dentist",
        timing: {
          kind: "timed",
          date: "2026-08-10",
          time: "15:30",
          durationMinutes: 45,
        },
      }),
    );
    expect(result.created.eventId).toBeTruthy();
    expect(result.created.timing.startsAt).toBe(
      localDateTimeToZoned("2026-08-10", "15:30", TIME_ZONE),
    );
    const [record] = service.getDocument().events;
    expect(record.title).toBe("Dentist");
    expect(record.color).toBe("coral");
  });

  it("creates a timed event in an explicit timezone", async () => {
    const result = await asJson(
      tools.createEvent.run({
        title: "Standup",
        timing: {
          kind: "timed",
          date: "2026-08-10",
          time: "09:00",
          durationMinutes: 15,
          timeZone: "America/New_York",
        },
      }),
    );
    expect(result.created.timing.startsAt).toContain("[America/New_York]");
  });

  it("creates all-day events with an inclusive last day", async () => {
    const twoDays = await asJson(
      tools.createEvent.run({
        title: "Offsite",
        timing: { kind: "all-day", startDate: "2026-08-20", endDate: "2026-08-21" },
      }),
    );
    expect(twoDays.created.timing).toEqual({
      kind: "all-day",
      startDate: "2026-08-20",
      lastDay: "2026-08-21",
    });
    expect(service.getDocument().events[0].timing).toMatchObject({
      endDateExclusive: "2026-08-22",
    });

    const singleDay = await asJson(
      tools.createEvent.run({
        title: "Holiday",
        timing: { kind: "all-day", startDate: "2026-08-25" },
      }),
    );
    expect(singleDay.created.timing.lastDay).toBe("2026-08-25");
  });

  it("expands repeating events when listing and reports the rule", async () => {
    await tools.createEvent.run({
      title: "Swim",
      timing: {
        kind: "timed",
        date: "2026-08-03",
        time: "19:00",
        durationMinutes: 60,
      },
      rrule: "FREQ=WEEKLY;COUNT=3",
    });
    const listed = await listAugust();
    expect(listed.count).toBe(3);
    expect(listed.occurrences.map((o: { occurrenceStart: string }) => o.occurrenceStart)).toEqual([
      localDateTimeToZoned("2026-08-03", "19:00", TIME_ZONE),
      localDateTimeToZoned("2026-08-10", "19:00", TIME_ZONE),
      localDateTimeToZoned("2026-08-17", "19:00", TIME_ZONE),
    ]);
    expect(listed.occurrences[0].repeats).toBe("FREQ=WEEKLY;COUNT=3");
  });

  it("filters listed events with a query", async () => {
    await tools.createEvent.run({
      title: "Dentist",
      timing: { kind: "timed", date: "2026-08-10", time: "15:30", durationMinutes: 45 },
    });
    await tools.createEvent.run({
      title: "Coffee",
      location: "Las Violetas",
      timing: { kind: "timed", date: "2026-08-11", time: "09:30", durationMinutes: 45 },
    });
    const byTitle = await listAugust("dentist");
    expect(byTitle.count).toBe(1);
    expect(byTitle.occurrences[0].title).toBe("Dentist");
    const byLocation = await listAugust("violetas");
    expect(byLocation.occurrences[0].title).toBe("Coffee");
  });

  it("round-trips list output into a single-occurrence update", async () => {
    await tools.createEvent.run({
      title: "Swim",
      timing: { kind: "timed", date: "2026-08-03", time: "19:00", durationMinutes: 60 },
      rrule: "FREQ=WEEKLY;COUNT=3",
    });
    const listed = await listAugust();
    const second = listed.occurrences[1];

    await tools.updateEvent.run({
      eventId: second.eventId,
      occurrenceStart: second.occurrenceStart,
      scope: "occurrence",
      changes: {
        timing: { kind: "timed", date: "2026-08-10", time: "20:00", durationMinutes: 90 },
      },
    });

    const after = await listAugust();
    expect(after.count).toBe(3);
    const moved = after.occurrences.find(
      (o: { isSeriesException?: boolean }) => o.isSeriesException,
    );
    expect(moved.timing.startsAt).toBe(
      localDateTimeToZoned("2026-08-10", "20:00", TIME_ZONE),
    );
    expect(moved.timing.durationMinutes).toBe(90);
  });

  it("updates every occurrence with series scope", async () => {
    await tools.createEvent.run({
      title: "Swim",
      timing: { kind: "timed", date: "2026-08-03", time: "19:00", durationMinutes: 60 },
      rrule: "FREQ=WEEKLY;COUNT=2",
    });
    const [first] = (await listAugust()).occurrences;
    await tools.updateEvent.run({
      eventId: first.eventId,
      occurrenceStart: first.occurrenceStart,
      scope: "series",
      changes: { title: "Night swim" },
    });
    const after = await listAugust();
    expect(
      after.occurrences.map((o: { title: string }) => o.title),
    ).toEqual(["Night swim", "Night swim"]);
  });

  it("clears optional fields with null and stops repeating with rrule null", async () => {
    await tools.createEvent.run({
      title: "Swim",
      location: "Club Atlético",
      timing: { kind: "timed", date: "2026-08-03", time: "19:00", durationMinutes: 60 },
      rrule: "FREQ=WEEKLY;COUNT=3",
    });
    const [first] = (await listAugust()).occurrences;
    await tools.updateEvent.run({
      eventId: first.eventId,
      occurrenceStart: first.occurrenceStart,
      scope: "series",
      changes: { location: null, rrule: null },
    });
    const after = await listAugust();
    expect(after.count).toBe(1);
    expect(after.occurrences[0].repeats).toBeNull();
    expect(after.occurrences[0].location).toBeUndefined();
  });

  it("deletes one occurrence or the whole series depending on scope", async () => {
    await tools.createEvent.run({
      title: "Swim",
      timing: { kind: "timed", date: "2026-08-03", time: "19:00", durationMinutes: 60 },
      rrule: "FREQ=WEEKLY;COUNT=3",
    });
    const listed = await listAugust();
    const [first, second] = listed.occurrences;

    await tools.deleteEvent.run({
      eventId: second.eventId,
      occurrenceStart: second.occurrenceStart,
      scope: "occurrence",
    });
    expect((await listAugust()).count).toBe(2);

    await tools.deleteEvent.run({
      eventId: first.eventId,
      occurrenceStart: first.occurrenceStart,
      scope: "series",
    });
    expect((await listAugust()).count).toBe(0);
  });

  it("rejects invalid input with readable errors instead of raw ZodError output", async () => {
    await expect(
      tools.createEvent.run({
        title: "Broken",
        timing: { kind: "timed", date: "2026-08-10", time: "15:30", durationMinutes: 45 },
        rrule: "EVERY-TUESDAY",
      }),
    ).rejects.toThrow(/recurrence\.rrule/);

    await expect(
      tools.listEvents.run({ from: "2026-08-31", to: "2026-08-01" }),
    ).rejects.toThrow(/on or after/);

    await expect(
      tools.updateEvent.run({
        eventId: "missing",
        occurrenceStart: "2026-08-01",
        scope: "occurrence",
        changes: {},
      }),
    ).rejects.toThrow(/no changes provided/i);
  });

  it("validates raw model input through the schemas", () => {
    expect(() =>
      tools.listEvents.parse({ from: "2026-13-01", to: "2026-08-02" }),
    ).toThrow();
    expect(
      tools.deleteEvent.parse({ eventId: "abc", occurrenceStart: "2026-08-01" })
        .scope,
    ).toBe("occurrence");
  });
});
