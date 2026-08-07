export const EVENT_COLORS = [
  "ultramarine",
  "coral",
  "mint",
  "gold",
] as const;

export type EventColor = (typeof EVENT_COLORS)[number];
export type ThemePreference = "system" | "light" | "dark";
export type MutationScope = "occurrence" | "following" | "series";
export type CalendarView = "week" | "month";

export interface EditorSeed {
  dateKey: string;
  startTime?: string;
}

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

export interface EventRecord {
  id: string;
  title: string;
  timing: EventTiming;
  recurrence: Recurrence | null;
  location?: string;
  notes?: string;
  color: EventColor;
  reminderMinutesBefore?: number;
  seriesId?: string;
  originalStart?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventInput = Omit<
  EventRecord,
  "id" | "seriesId" | "originalStart" | "createdAt" | "updatedAt"
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

export interface EventSegment {
  occurrence: Occurrence;
  dateKey: string;
  dayPosition: "single" | "start" | "middle" | "end";
}

export interface OccupiedDateGroup {
  kind: "date";
  dateKey: string;
  segments: EventSegment[];
}

export interface TimedEventLayout {
  segment: EventSegment;
  startMinute: number;
  endMinute: number;
  column: number;
  columnCount: number;
}
