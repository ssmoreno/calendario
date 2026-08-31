import { dateKeyInTimeZone, todayKey } from "@/calendar/date-time";
import type { UpcomingEvent } from "@/server/google-calendar";

/*
 * The board is packed rather than scrolled: days flow down a column and then
 * across to the next, so reading left-to-right, top-to-bottom stays
 * chronological. Nothing here touches the DOM — the component measures the
 * board once and hands the numbers in, which keeps the packing testable.
 *
 * Blocks and headings are fixed heights so a column's fill can be computed
 * without measuring every block. These values are the single source of truth:
 * the board publishes them as custom properties and the stylesheet reads them
 * back, so CSS and TypeScript cannot drift apart.
 */
export const BLOCK_HEIGHT = 56;
export const BLOCK_GAP = 8;
export const DAY_HEADER_HEIGHT = 32;
export const DAY_HEADER_GAP = 8;
export const SECTION_GAP = 24;
export const COLUMN_GAP = 24;
export const MIN_COLUMN_WIDTH = 240;
export const MAX_COLUMN_WIDTH = 420;
export const MAX_COLUMNS = 7;
export const PREFERRED_COLUMNS = 3;

export interface DaySection {
  dateKey: string;
  events: UpcomingEvent[];
  /** Events trimmed from this day because the column ran out of room. */
  hiddenCount: number;
}

export interface BoardLayout {
  columns: DaySection[][];
  /** Days dropped whole because the board ran out of columns. */
  hiddenDays: number;
  /** Every event the board is not drawing, whether trimmed or dropped. */
  hiddenEvents: number;
  /** The last day the board actually draws, for the footnote. */
  lastVisibleDay?: string;
}

/**
 * Which day an event belongs to, in the viewer's zone. All-day events that are
 * already underway start before today — Google returns them past `timeMin` —
 * so they clamp forward rather than landing on a day that has gone by.
 */
function dayKeyFor(event: UpcomingEvent, timeZone: string, today: string): string {
  if (event.timing.kind === "all-day") {
    return event.timing.startDate < today ? today : event.timing.startDate;
  }
  // `new Date`, not `zonedTimestampToDate`: the API sends a plain UTC instant,
  // which `parseZonedDateTime` rejects for want of a bracketed IANA name.
  return dateKeyInTimeZone(new Date(event.timing.startsAt), timeZone);
}

export function groupByDay(
  events: readonly UpcomingEvent[],
  timeZone: string,
  now = new Date(),
): DaySection[] {
  const today = todayKey(timeZone, now);
  const byDay = new Map<string, UpcomingEvent[]>();
  for (const event of events) {
    const key = dayKeyFor(event, timeZone, today);
    const day = byDay.get(key);
    if (day) day.push(event);
    else byDay.set(key, [event]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayEvents]) => ({
      dateKey,
      // All-day events head their day; the rest keep the API's start order.
      events: [
        ...dayEvents.filter((event) => event.timing.kind === "all-day"),
        ...dayEvents.filter((event) => event.timing.kind !== "all-day"),
      ],
      hiddenCount: 0,
    }));
}

export function sectionHeight(eventCount: number): number {
  return (
    DAY_HEADER_HEIGHT +
    DAY_HEADER_GAP +
    eventCount * BLOCK_HEIGHT +
    Math.max(0, eventCount - 1) * BLOCK_GAP
  );
}

/** How many blocks fit under a day heading in a column of this height. */
function capacity(columnHeight: number): number {
  const forBlocks = columnHeight - DAY_HEADER_HEIGHT - DAY_HEADER_GAP;
  return Math.max(0, Math.floor((forBlocks + BLOCK_GAP) / (BLOCK_HEIGHT + BLOCK_GAP)));
}

/**
 * Which days the board can draw, in order, trimming a day that is too tall for
 * a column of its own. This settles visibility only; how the survivors are
 * spread over the columns is `balance`'s job. The columns it fills on the way
 * are kept as the safe answer to fall back on.
 */
function fitSections(
  sections: readonly DaySection[],
  { columnCount, columnHeight }: { columnCount: number; columnHeight: number },
) {
  const perColumn = capacity(columnHeight);
  const columns: DaySection[][] = [];
  let current: DaySection[] = [];
  let used = 0;
  let trimmed = 0;
  let index = 0;

  for (; index < sections.length; index += 1) {
    const section = sections[index];
    const height = sectionHeight(section.events.length);

    if (current.length && used + SECTION_GAP + height > columnHeight) {
      columns.push(current);
      current = [];
      used = 0;
    }
    if (columns.length >= columnCount) break;
    if (current.length === 0 && perColumn === 0) break;

    // A day too tall for an empty column keeps that column to itself and shows
    // what it can, rather than being skipped over for the days behind it. It
    // gives up one more block so the "+N more" line it grows has a place to sit.
    const room = current.length === 0 ? perColumn : section.events.length;
    const shown = section.events.length > room ? room - 1 : section.events.length;

    trimmed += section.events.length - shown;
    used += (current.length === 0 ? 0 : SECTION_GAP) + sectionHeight(shown);
    current.push(
      shown === section.events.length
        ? section
        : {
            ...section,
            events: section.events.slice(0, shown),
            hiddenCount: section.events.length - shown,
          },
    );
  }

  if (current.length) columns.push(current);
  const dropped = sections.slice(index);
  return {
    columns,
    visible: columns.flat(),
    hiddenDays: dropped.length,
    hiddenEvents:
      trimmed + dropped.reduce((total, day) => total + day.events.length, 0),
  };
}

function columnHeightOf(column: readonly DaySection[]): number {
  return column.reduce(
    (total, day, index) =>
      total + (index ? SECTION_GAP : 0) + sectionHeight(day.events.length),
    0,
  );
}

/**
 * Spread the visible days over the columns rather than filling each to the brim
 * and leaving the last one half empty. Order is untouched, so reading down a
 * column and on to the next is still reading forward in time — the columns just
 * aim for a common depth, taking whichever side of the target lands closer.
 */
function balance(
  sections: readonly DaySection[],
  columnCount: number,
  columnHeight: number,
): DaySection[][] {
  if (!sections.length) return [];
  const heights = sections.map((section) => sectionHeight(section.events.length));
  const total =
    heights.reduce((sum, height) => sum + height, 0) +
    (sections.length - 1) * SECTION_GAP;
  const target = Math.min(columnHeight, total / columnCount);

  const columns: DaySection[][] = [];
  let current: DaySection[] = [];
  let used = 0;

  sections.forEach((section, index) => {
    const height = heights[index];
    if (current.length) {
      const next = used + SECTION_GAP + height;
      const closerToStop = target - used < next - target;
      const lastColumn = columns.length + 1 >= columnCount;
      if (next > columnHeight || (closerToStop && !lastColumn)) {
        columns.push(current);
        current = [];
        used = 0;
      }
    }
    used = current.length ? used + SECTION_GAP + height : height;
    current.push(section);
  });

  if (current.length) columns.push(current);
  return columns;
}

export function packColumns(
  sections: readonly DaySection[],
  { columnCount, columnHeight }: { columnCount: number; columnHeight: number },
): BoardLayout {
  const fitted = fitSections(sections, { columnCount, columnHeight });
  const balanced = balance(fitted.visible, columnCount, columnHeight);
  // Balancing is a preference, not a guarantee: if aiming for a common depth
  // ever costs a column or overruns one, the filled columns still stand.
  const safe =
    balanced.length <= columnCount &&
    balanced.every((column) => columnHeightOf(column) <= columnHeight);

  return {
    columns: safe ? balanced : fitted.columns,
    hiddenDays: fitted.hiddenDays,
    hiddenEvents: fitted.hiddenEvents,
    lastVisibleDay: fitted.visible.at(-1)?.dateKey,
  };
}

/**
 * Three columns is the resting shape. The board widens past it only when the
 * extra column buys another day, and never past what the width can carry — a
 * day trimmed because it is taller than any column is not worth widening for.
 */
export function chooseColumnCount(
  sections: readonly DaySection[],
  { width, height }: { width: number; height: number },
): number {
  const fitsWidth = Math.min(
    MAX_COLUMNS,
    Math.max(1, Math.floor((width + COLUMN_GAP) / (MIN_COLUMN_WIDTH + COLUMN_GAP))),
  );
  let best = Math.min(PREFERRED_COLUMNS, fitsWidth);
  let fewestHidden = packColumns(sections, {
    columnCount: best,
    columnHeight: height,
  }).hiddenEvents;

  for (let count = best + 1; count <= fitsWidth && fewestHidden > 0; count += 1) {
    const { hiddenEvents } = packColumns(sections, {
      columnCount: count,
      columnHeight: height,
    });
    if (hiddenEvents < fewestHidden) {
      best = count;
      fewestHidden = hiddenEvents;
    }
  }
  return best;
}

export function layoutBoard(
  sections: readonly DaySection[],
  size: { width: number; height: number },
): BoardLayout & { columnCount: number } {
  const columnCount = chooseColumnCount(sections, size);
  return {
    columnCount,
    ...packColumns(sections, { columnCount, columnHeight: size.height }),
  };
}
