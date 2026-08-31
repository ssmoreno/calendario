"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";

import {
  dateKeyInTimeZone,
  formatDuration,
  todayKey,
} from "@/calendar/date-time";
import type { UpcomingEvent } from "@/server/google-calendar";

import {
  BLOCK_GAP,
  BLOCK_HEIGHT,
  COLUMN_GAP,
  DAY_HEADER_GAP,
  DAY_HEADER_HEIGHT,
  MAX_COLUMN_WIDTH,
  SECTION_GAP,
  groupByDay,
  layoutBoard,
} from "./board-layout";
import styles from "./event-board.module.css";

interface EventBoardProps {
  events: readonly UpcomingEvent[];
  /** Ticks every minute so the next event's lead time stays honest. */
  now: number;
  timeZone: string;
  onRefresh(): void;
}

function dayLabel(dateKey: string, timeZone: string, now: Date) {
  const today = todayKey(timeZone, now);
  if (dateKey === today) return "Today";
  const [year, month, day] = dateKey.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  const dayBefore = new Date(noon);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  if (dayBefore.toISOString().slice(0, 10) === today) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(noon);
}

function shortDayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function blockTime(event: UpcomingEvent, timeZone: string) {
  if (event.timing.kind === "all-day") return "All day";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(event.timing.startsAt));
}

function endLabel(event: UpcomingEvent, timeZone: string) {
  if (event.timing.kind === "all-day") {
    const lastDay = new Date(`${event.timing.endDateExclusive}T12:00:00Z`);
    lastDay.setUTCDate(lastDay.getUTCDate() - 1);
    const lastKey = lastDay.toISOString().slice(0, 10);
    return lastKey === event.timing.startDate
      ? null
      : `Through ${shortDayLabel(lastKey)}`;
  }
  return `Ends ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(event.timing.endsAt))}`;
}

/**
 * How far off the next event is. All-day events have no meaningful countdown,
 * so the block simply goes without one.
 */
function leadLabel(event: UpcomingEvent, now: number) {
  if (event.timing.kind === "all-day") return null;
  const minutes = Math.round(
    (new Date(event.timing.startsAt).getTime() - now) / 60_000,
  );
  if (minutes <= 0) return "Now";
  return `In ${formatDuration(minutes)}`;
}

function EventDetails({
  event,
  timeZone,
}: {
  event: UpcomingEvent;
  timeZone: string;
}) {
  const end = endLabel(event, timeZone);
  return (
    <div className={styles.details}>
      <h3>{event.title}</h3>
      <div className={styles.detailMeta}>
        <span>{`${shortDayLabel(
          event.timing.kind === "all-day"
            ? event.timing.startDate
            : dateKeyInTimeZone(new Date(event.timing.startsAt), timeZone),
        )} · ${blockTime(event, timeZone)}`}</span>
        {end ? <span>{end}</span> : null}
        {event.location ? <span>{event.location}</span> : null}
        {event.recurrence ? <span>{event.recurrence}</span> : null}
        {event.reminderMinutes.length ? (
          <span>
            {event.reminderMinutes
              .map((minutes) => `${formatDuration(minutes)} before`)
              .join(" · ")}
          </span>
        ) : event.usesDefaultReminder ? (
          <span>Uses your Google Calendar default reminder</span>
        ) : null}
      </div>
      {event.notes ? <p>{event.notes}</p> : null}
    </div>
  );
}

function EventBlock({
  event,
  isNext,
  now,
  timeZone,
}: {
  event: UpcomingEvent;
  isNext: boolean;
  now: number;
  timeZone: string;
}) {
  const lead = isNext ? leadLabel(event, now) : null;
  return (
    <DialogTrigger>
      <Button
        className={styles.block}
        data-color={event.color}
        data-next={isNext || undefined}
      >
        <span className={styles.blockWhen}>
          <span>{blockTime(event, timeZone)}</span>
          {lead ? <span className={styles.lead}>{lead}</span> : null}
        </span>
        <span className={styles.blockTitle}>{event.title}</span>
      </Button>
      <Popover className={styles.detailsPopover} placement="bottom start" offset={6}>
        <Dialog className={styles.detailsDialog} aria-label={event.title}>
          <EventDetails event={event} timeZone={timeZone} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export function EventBoard({ events, now, timeZone, onRefresh }: EventBoardProps) {
  // Measured on the wrapper, never on the columns themselves: the columns cap
  // their own width from the column count, which would feed straight back in.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const sections = useMemo(
    () => groupByDay(events, timeZone, new Date(now)),
    [events, timeZone, now],
  );
  const layout = useMemo(() => layoutBoard(sections, size), [sections, size]);

  // The next event is simply the first block drawn, so it needs no lookup.
  const nextId = layout.columns[0]?.[0]?.events[0]?.id;

  return (
    <section className={styles.board} aria-labelledby="board-heading">
      <div className={styles.boardHeading}>
        <h2 className={styles.eyebrow} id="board-heading">
          Upcoming events
        </h2>
        <button className={styles.quietButton} type="button" onClick={onRefresh}>
          <ArrowClockwise size={14} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className={styles.boardBody} ref={bodyRef}>
        <div
          className={styles.columns}
          style={
            {
              "--block-h": `${BLOCK_HEIGHT}px`,
              "--block-gap": `${BLOCK_GAP}px`,
              "--day-header-h": `${DAY_HEADER_HEIGHT}px`,
              "--day-header-gap": `${DAY_HEADER_GAP}px`,
              "--section-gap": `${SECTION_GAP}px`,
              "--column-gap": `${COLUMN_GAP}px`,
              "--column-max": `${MAX_COLUMN_WIDTH}px`,
              // Never 0: `repeat(0, …)` is not a track list the grid would accept.
              "--column-count": Math.max(1, layout.columns.length),
            } as React.CSSProperties
          }
        >
          {layout.columns.map((column) => (
            <div className={styles.column} key={column[0].dateKey}>
              {column.map((day) => (
                <section className={styles.day} key={day.dateKey}>
                  <h3 className={styles.dayHeading}>
                    {dayLabel(day.dateKey, timeZone, new Date(now))}
                  </h3>
                  <div className={styles.blocks}>
                    {day.events.map((event) => (
                      <EventBlock
                        event={event}
                        isNext={event.id === nextId}
                        key={event.id}
                        now={now}
                        timeZone={timeZone}
                      />
                    ))}
                  </div>
                  {day.hiddenCount ? (
                    <p className={styles.dayMore}>{`+${day.hiddenCount} more`}</p>
                  ) : null}
                </section>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/*
        * Always in the layout, empty or not: the board budgets against the
        * height it measures here, and a line that came and went with its own
        * verdict would change that height and re-open the question.
        */}
      <p className={styles.footnote}>
        {layout.hiddenEvents
          ? `Through ${
              layout.lastVisibleDay ? shortDayLabel(layout.lastVisibleDay) : "today"
            } · ${layout.hiddenEvents} more ahead`
          : null}
      </p>
    </section>
  );
}
