import {
  dateKeyInTimeZone,
  minuteOfDayInTimeZone,
  zonedTimestampToDate,
} from "./date-time";
import { eventStartSortValue } from "./recurrence";
import type {
  EventSegment,
  OccupiedDateGroup,
  Occurrence,
  TimedEventLayout,
} from "./types";

function segmentPosition(
  occurrence: Occurrence,
  dateKey: string,
): EventSegment["dayPosition"] {
  if (occurrence.dateKeys.length === 1) return "single";
  if (dateKey === occurrence.dateKeys[0]) return "start";
  if (dateKey === occurrence.dateKeys.at(-1)) return "end";
  return "middle";
}

function compareSegments(a: EventSegment, b: EventSegment): number {
  const aAllDay = a.occurrence.timing.kind === "all-day";
  const bAllDay = b.occurrence.timing.kind === "all-day";
  if (aAllDay !== bAllDay) return aAllDay ? -1 : 1;

  const timeDifference =
    eventStartSortValue(a.occurrence) - eventStartSortValue(b.occurrence);
  if (timeDifference !== 0) return timeDifference;

  if (
    a.occurrence.timing.kind === "timed" &&
    b.occurrence.timing.kind === "timed"
  ) {
    const endDifference =
      a.occurrence.timing.durationMinutes -
      b.occurrence.timing.durationMinutes;
    if (endDifference !== 0) return endDifference;
  }

  const titleDifference = a.occurrence.record.title.localeCompare(
    b.occurrence.record.title,
  );
  if (titleDifference !== 0) return titleDifference;
  return a.occurrence.key.localeCompare(b.occurrence.key);
}

export function groupOccupiedDates(
  occurrences: Occurrence[],
): OccupiedDateGroup[] {
  const groups = new Map<string, EventSegment[]>();

  for (const occurrence of occurrences) {
    for (const dateKey of occurrence.dateKeys) {
      const segment: EventSegment = {
        occurrence,
        dateKey,
        dayPosition: segmentPosition(occurrence, dateKey),
      };
      groups.set(dateKey, [...(groups.get(dateKey) ?? []), segment]);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, segments]) => ({
      kind: "date" as const,
      dateKey,
      segments: segments.sort(compareSegments),
    }));
}

function timedBounds(
  segment: EventSegment,
  viewerTimeZone: string,
): Pick<TimedEventLayout, "startMinute" | "endMinute"> {
  const timing = segment.occurrence.timing;
  if (timing.kind !== "timed") {
    return { startMinute: 0, endMinute: 1_440 };
  }

  const start = zonedTimestampToDate(timing.startsAt);
  const end = new Date(start.getTime() + timing.durationMinutes * 60_000);
  const startDate = dateKeyInTimeZone(start, viewerTimeZone);
  const endDate = dateKeyInTimeZone(end, viewerTimeZone);
  const startMinute =
    segment.dateKey === startDate
      ? minuteOfDayInTimeZone(start, viewerTimeZone)
      : 0;
  const endMinute =
    segment.dateKey === endDate
      ? minuteOfDayInTimeZone(end, viewerTimeZone)
      : 1_440;

  return {
    startMinute,
    endMinute: Math.max(startMinute + 1, endMinute),
  };
}

function finalizeCluster(
  cluster: Omit<TimedEventLayout, "column" | "columnCount">[],
): TimedEventLayout[] {
  if (cluster.length === 0) return [];
  const laneEnds: number[] = [];
  const placed = cluster.map((item) => {
    const available = laneEnds.findIndex((end) => end <= item.startMinute);
    const column = available === -1 ? laneEnds.length : available;
    laneEnds[column] = item.endMinute;
    return { ...item, column };
  });
  const columnCount = Math.max(1, laneEnds.length);
  return placed.map((item) => ({ ...item, columnCount }));
}

export function layoutTimedEvents(
  segments: EventSegment[],
  viewerTimeZone: string,
): TimedEventLayout[] {
  const timed = segments
    .filter((segment) => segment.occurrence.timing.kind === "timed")
    .map((segment) => ({ segment, ...timedBounds(segment, viewerTimeZone) }))
    .sort(
      (a, b) =>
        a.startMinute - b.startMinute ||
        a.endMinute - b.endMinute ||
        a.segment.occurrence.key.localeCompare(b.segment.occurrence.key),
    );

  const layouts: TimedEventLayout[] = [];
  let cluster: typeof timed = [];
  let clusterEnd = -1;

  for (const item of timed) {
    if (cluster.length > 0 && item.startMinute >= clusterEnd) {
      layouts.push(...finalizeCluster(cluster));
      cluster = [];
      clusterEnd = -1;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinute);
  }
  layouts.push(...finalizeCluster(cluster));
  return layouts;
}

export function filterOccurrences(
  occurrences: Occurrence[],
  query: string,
  today?: string,
): Occurrence[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return occurrences;

  const nextBySeries = new Map<string, Occurrence>();
  for (const occurrence of occurrences) {
    const haystack = [
      occurrence.record.title,
      occurrence.record.location,
      occurrence.record.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    if (!haystack.includes(normalized)) continue;

    if (!occurrence.record.recurrence && !occurrence.record.seriesId) {
      nextBySeries.set(occurrence.key, occurrence);
      continue;
    }
    const previous = nextBySeries.get(occurrence.rootEventId);
    const occurrenceDate = occurrence.dateKeys[0];
    const previousDate = previous?.dateKeys[0];
    const occurrenceIsFuture = !today || occurrenceDate >= today;
    const previousIsFuture = !today || (previousDate ?? "") >= today;
    const isBetterMatch =
      !previous ||
      (occurrenceIsFuture && !previousIsFuture) ||
      (occurrenceIsFuture === previousIsFuture &&
        (occurrenceIsFuture
          ? occurrence.occurrenceStart < previous.occurrenceStart
          : occurrence.occurrenceStart > previous.occurrenceStart));
    if (isBetterMatch) {
      nextBySeries.set(occurrence.rootEventId, occurrence);
    }
  }
  return [...nextBySeries.values()].sort((a, b) =>
    a.occurrenceStart.localeCompare(b.occurrenceStart),
  );
}
