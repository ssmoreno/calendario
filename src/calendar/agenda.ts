import { addDays, daysBetween } from "./date-time";
import { eventStartSortValue } from "./recurrence";
import type {
  EventSegment,
  OccupiedDateGroup,
  Occurrence,
  QuietGap,
  TimelineItem,
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

function quietGap(from: string, to: string): QuietGap | null {
  if (from > to) return null;
  return {
    kind: "quiet",
    count: daysBetween(from, to) + 1,
    from,
    to,
  };
}

function appendGap(
  items: TimelineItem[],
  from: string,
  to: string,
  today: string,
) {
  if (from > to) return;
  if (today >= from && today <= to) {
    const before = quietGap(from, addDays(today, -1));
    if (before) items.push(before);
    items.push({ kind: "today", dateKey: today });
    const after = quietGap(addDays(today, 1), to);
    if (after) items.push(after);
    return;
  }
  const gap = quietGap(from, to);
  if (gap) items.push(gap);
}

export function buildTimeline(
  groups: OccupiedDateGroup[],
  today: string,
): TimelineItem[] {
  if (groups.length === 0) return [];
  const items: TimelineItem[] = [];
  const first = groups[0].dateKey;
  const last = groups.at(-1)?.dateKey ?? first;

  if (today < first) {
    items.push({ kind: "today", dateKey: today });
    appendGap(items, addDays(today, 1), addDays(first, -1), today);
  }

  groups.forEach((group, index) => {
    if (index > 0) {
      const previous = groups[index - 1].dateKey;
      appendGap(items, addDays(previous, 1), addDays(group.dateKey, -1), today);
    }
    items.push(group);
  });

  if (today > last) {
    appendGap(items, addDays(last, 1), addDays(today, -1), today);
    items.push({ kind: "today", dateKey: today });
  }

  return items;
}

export function nextOccupiedDate(
  groups: OccupiedDateGroup[],
  today: string,
): string | null {
  return groups.find((group) => group.dateKey >= today)?.dateKey ?? null;
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
  return [...nextBySeries.values()];
}
