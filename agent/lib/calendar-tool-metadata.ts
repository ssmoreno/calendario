import type { CalendarService } from "../../src/calendar/types";
import { createEveTools } from "../../src/eve/tools";

const metadataService: CalendarService = {
  listEventRecords: async () => [],
  setEventReminders: async () => undefined,
  listOccurrences: async () => [],
  createEvent: async () => {
    throw new Error("Metadata-only calendar service.");
  },
  updateEvent: async () => undefined,
  deleteEvent: async () => undefined,
};

export const calendarToolMetadata = createEveTools(
  metadataService,
  { timeZone: "UTC" },
);
