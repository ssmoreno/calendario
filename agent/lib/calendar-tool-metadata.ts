import { CalendarDocumentEngine } from "../../src/calendar/calendar-document-engine";
import { emptyCalendar } from "../../src/calendar/storage";
import { createEveTools } from "../../src/eve/tools";

export const calendarToolMetadata = createEveTools(
  new CalendarDocumentEngine(emptyCalendar(), "UTC"),
  { timeZone: "UTC" },
);
