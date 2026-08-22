export const EVENT_COLORS = [
  "ultramarine",
  "coral",
  "mint",
  "gold",
] as const;

export type EventColor = (typeof EVENT_COLORS)[number];

/** Display names for the event hues, so no surface prints the raw enum. */
export const EVENT_COLOR_LABELS: Record<EventColor, string> = {
  ultramarine: "Ultramarine",
  coral: "Coral",
  mint: "Mint",
  gold: "Gold",
};

export type ThemePreference = "system" | "light" | "dark";
export type MutationScope = "occurrence" | "following" | "series";

export type EventTiming =
  | {
      kind: "timed";
      startsAt: string;
      durationMinutes: number;
    }
  | {
      kind: "all-day";
      startDate: string;
      endDateExclusive: string;
    };

export interface Recurrence {
  rrule: string;
  excludedStarts: string[];
}

export interface EventReminderOverride {
  method: string;
  minutes: number;
}

export interface EventRecord {
  id: string;
  title: string;
  timing: EventTiming;
  recurrence: Recurrence | null;
  location?: string;
  notes?: string;
  color: EventColor;
  reminderMinutesBefore?: number;
  reminderOverrides?: EventReminderOverride[];
  usesDefaultReminder?: boolean;
  seriesId?: string;
  originalStart?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventInput = Omit<
  EventRecord,
  | "id"
  | "seriesId"
  | "originalStart"
  | "reminderOverrides"
  | "createdAt"
  | "updatedAt"
>;

export type EventPatch = Partial<EventInput>;

export interface OccurrenceTarget {
  eventId: string;
  occurrenceStart: string;
}

export interface Occurrence {
  key: string;
  eventId: string;
  rootEventId: string;
  occurrenceStart: string;
  record: EventRecord;
  timing: EventTiming;
  dateKeys: string[];
  isOverride: boolean;
}

export interface CalendarRange {
  from: string;
  to: string;
}

export interface CalendarService {
  listEventRecords(): Promise<EventRecord[]>;
  setEventReminders(
    eventIds: string[],
    reminderMinutesBefore: number | undefined,
  ): Promise<void>;
  listOccurrences(range: CalendarRange): Promise<Occurrence[]>;
  createEvent(input: EventInput): Promise<EventRecord>;
  updateEvent(
    target: OccurrenceTarget,
    scope: MutationScope,
    patch: EventPatch,
  ): Promise<void>;
  deleteEvent(
    target: OccurrenceTarget,
    scope: MutationScope,
  ): Promise<void>;
}

export interface CalendarDocument {
  version: 1;
  revision: number;
  updatedAt: string;
  events: EventRecord[];
}

export interface PreferencesDocument {
  version: 1;
  revision: number;
  theme: ThemePreference;
}
