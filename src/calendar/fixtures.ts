import { addDays, localDateTimeToZoned, todayKey } from "./date-time";
import type { EventRecord } from "./types";

function fixture(
  id: string,
  title: string,
  dateKey: string,
  timeZone: string,
  options: Partial<EventRecord> & {
    time?: string;
    durationMinutes?: number;
  } = {},
): EventRecord {
  const now = new Date().toISOString();
  const { time = "09:30", durationMinutes = 60, ...recordOptions } = options;
  return {
    id,
    title,
    timing: {
      kind: "timed",
      startsAt: localDateTimeToZoned(dateKey, time, timeZone),
      durationMinutes,
    },
    recurrence: null,
    color: "coral",
    createdAt: now,
    updatedAt: now,
    ...recordOptions,
  };
}

export function createDevelopmentFixtures(
  timeZone: string,
  now = new Date(),
): EventRecord[] {
  const today = todayKey(timeZone, now);
  const friday = addDays(today, 1);
  const later = addDays(today, 5);

  return [
    fixture("fixture-coffee", "Coffee with Maya", friday, timeZone, {
      time: "09:30",
      durationMinutes: 45,
      location: "Las Violetas · Almagro",
      color: "coral",
    }),
    fixture("fixture-review", "Portfolio review", friday, timeZone, {
      time: "12:00",
      location: "Studio call",
      notes: "Bring the latest cover studies.",
      color: "gold",
    }),
    fixture("fixture-swim", "Swim", friday, timeZone, {
      time: "19:15",
      durationMinutes: 90,
      location: "Club Atlético",
      recurrence: { rrule: "FREQ=WEEKLY;BYDAY=FR", excludedStarts: [] },
      reminderMinutesBefore: 30,
      color: "mint",
    }),
    {
      id: "fixture-launch",
      title: "Launch day",
      timing: {
        kind: "all-day",
        startDate: later,
        endDateExclusive: addDays(later, 2),
      },
      recurrence: null,
      notes: "A two-day milestone.",
      color: "ultramarine",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    fixture("fixture-dinner", "Dinner at Elena’s", later, timeZone, {
      time: "20:30",
      durationMinutes: 120,
      location: "Caballito",
      color: "coral",
    }),
    fixture("fixture-past", "Call Mum", addDays(today, -3), timeZone, {
      time: "18:00",
      durationMinutes: 30,
      color: "gold",
    }),
  ];
}
