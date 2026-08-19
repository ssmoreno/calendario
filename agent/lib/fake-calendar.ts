import { readFile, rm, writeFile } from "node:fs/promises";

import { CalendarDocumentEngine } from "../../src/calendar/calendar-document-engine";
import type {
  CalendarDocument,
  CalendarService,
  EventRecord,
} from "../../src/calendar/types";

/**
 * A calendar in a JSON file instead of Google, so `eve eval` can drive real
 * turns and then read what the run actually saved. `CALENDARIO_FAKE_CALENDAR`
 * names the file; nothing reads it unless that variable is set.
 */
export function fakeCalendarPath(): string | undefined {
  return process.env.CALENDARIO_FAKE_CALENDAR || undefined;
}

function emptyDocument(): CalendarDocument {
  return {
    version: 1,
    revision: 0,
    updatedAt: new Date(0).toISOString(),
    events: [],
  };
}

async function readDocument(path: string): Promise<CalendarDocument> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as CalendarDocument;
  } catch {
    return emptyDocument();
  }
}

export function fakeCalendar(path: string, timeZone: string): CalendarService {
  async function edit<Result>(
    apply: (engine: CalendarDocumentEngine) => Result,
  ): Promise<Result> {
    const engine = new CalendarDocumentEngine(
      await readDocument(path),
      timeZone,
    );
    const result = apply(engine);
    await writeFile(path, JSON.stringify(engine.getDocument(), null, 2));
    return result;
  }

  async function read<Result>(
    query: (engine: CalendarDocumentEngine) => Result,
  ): Promise<Result> {
    return query(
      new CalendarDocumentEngine(await readDocument(path), timeZone),
    );
  }

  return {
    listEventRecords: () => read((engine) => engine.listEventRecords()),
    listOccurrences: (range) => read((engine) => engine.listOccurrences(range)),
    setEventReminders: (eventIds, reminderMinutesBefore) =>
      edit((engine) => engine.setEventReminders(eventIds, reminderMinutesBefore)),
    createEvent: (input) => edit((engine) => engine.createEvent(input)),
    updateEvent: (target, scope, patch) =>
      edit((engine) => engine.updateEvent(target, scope, patch)),
    deleteEvent: (target, scope) =>
      edit((engine) => engine.deleteEvent(target, scope)),
  };
}

function requirePath(): string {
  const path = fakeCalendarPath();
  if (!path) {
    throw new Error("Set CALENDARIO_FAKE_CALENDAR to the fake calendar file.");
  }
  return path;
}

/** Starts an eval from an empty calendar. */
export async function resetFakeCalendar(): Promise<void> {
  await rm(requirePath(), { force: true });
}

/** What the run really saved, read straight from the store. */
export async function savedEvents(): Promise<EventRecord[]> {
  return (await readDocument(requirePath())).events;
}
