"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  formatDateKey,
  formatTime,
  inclusiveDateRange,
  minuteOfDayInTimeZone,
} from "@/calendar/date-time";
import { messages } from "@/calendar/messages";
import { layoutTimedEvents } from "@/calendar/view-model";
import type {
  EditorSeed,
  EventSegment,
  OccupiedDateGroup,
} from "@/calendar/types";

import styles from "./calendar.module.css";

interface WeekViewProps {
  from: string;
  to: string;
  groups: OccupiedDateGroup[];
  selectedDate: string;
  today: string;
  locale: string;
  viewerTimeZone: string;
  onSelectDate(dateKey: string): void;
  onAdd(seed: EditorSeed): void;
  onEdit(segment: EventSegment): void;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const EMPTY_SEGMENTS: EventSegment[] = [];

function CurrentTimeLine({ viewerTimeZone }: { viewerTimeZone: string }) {
  const [minute, setMinute] = useState(() =>
    minuteOfDayInTimeZone(new Date(), viewerTimeZone),
  );

  useEffect(() => {
    const update = () =>
      setMinute(minuteOfDayInTimeZone(new Date(), viewerTimeZone));
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [viewerTimeZone]);

  return (
    <div
      className={styles.currentTimeLine}
      style={{ top: `${minute}px` }}
      role="timer"
      aria-label="Current time"
    />
  );
}

function eventLabel(
  segment: EventSegment,
  locale: string,
  viewerTimeZone: string,
): string {
  const event = segment.occurrence.record;
  if (segment.occurrence.timing.kind === "all-day") {
    return `${event.title}, ${messages.timeline.allDay}`;
  }
  return `${event.title}, ${formatTime(
    segment.occurrence.timing.startsAt,
    locale,
    viewerTimeZone,
  )}`;
}

function TimedEvent({
  layout,
  locale,
  viewerTimeZone,
  onEdit,
}: {
  layout: ReturnType<typeof layoutTimedEvents>[number];
  locale: string;
  viewerTimeZone: string;
  onEdit(segment: EventSegment): void;
}) {
  const { segment } = layout;
  const event = segment.occurrence.record;
  const style = {
    top: `${layout.startMinute}px`,
    height: `${Math.max(24, layout.endMinute - layout.startMinute)}px`,
    left: `calc(${(layout.column / layout.columnCount) * 100}% + 2px)`,
    width: `calc(${100 / layout.columnCount}% - 4px)`,
  } satisfies CSSProperties;
  const time =
    segment.occurrence.timing.kind === "timed"
      ? formatTime(
          segment.occurrence.timing.startsAt,
          locale,
          viewerTimeZone,
        )
      : null;
  return (
    <button
      className={styles.weekEvent}
      data-color={event.color}
      type="button"
      style={style}
      aria-label={eventLabel(segment, locale, viewerTimeZone)}
      onClick={() => onEdit(segment)}
    >
      <strong>{event.title}</strong>
      {time ? <span>{time}</span> : null}
    </button>
  );
}

function DayColumn({
  dateKey,
  segments,
  selected,
  today,
  locale,
  viewerTimeZone,
  onSelectDate,
  onAdd,
  onEdit,
}: {
  dateKey: string;
  segments: EventSegment[];
  selected: boolean;
  today: boolean;
  locale: string;
  viewerTimeZone: string;
  onSelectDate(dateKey: string): void;
  onAdd(seed: EditorSeed): void;
  onEdit(segment: EventSegment): void;
}) {
  const layouts = useMemo(
    () => layoutTimedEvents(segments, viewerTimeZone),
    [segments, viewerTimeZone],
  );
  const fullDate = formatDateKey(dateKey, locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function addAtHour(event: MouseEvent<HTMLButtonElement>, hour: number) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const halfHour = event.detail > 0 && event.clientY - bounds.top >= bounds.height / 2;
    const startTime = `${String(hour).padStart(2, "0")}:${halfHour ? "30" : "00"}`;
    onSelectDate(dateKey);
    onAdd({ dateKey, startTime });
  }

  return (
    <div
      className={styles.weekDayColumn}
      data-selected={selected || undefined}
      data-today={today || undefined}
      data-date-key={dateKey}
      aria-label={fullDate}
    >
      {HOURS.map((hour) => (
        <button
          key={hour}
          className={styles.hourSlot}
          type="button"
          aria-label={`Add event on ${fullDate} at ${String(hour).padStart(2, "0")}:00`}
          onClick={(event) => addAtHour(event, hour)}
        />
      ))}
      {layouts.map((layout) => (
        <TimedEvent
          key={`${layout.segment.occurrence.key}:${dateKey}`}
          layout={layout}
          locale={locale}
          viewerTimeZone={viewerTimeZone}
          onEdit={onEdit}
        />
      ))}
      {today ? (
        <CurrentTimeLine viewerTimeZone={viewerTimeZone} />
      ) : null}
    </div>
  );
}

export function WeekView({
  from,
  to,
  groups,
  selectedDate,
  today,
  locale,
  viewerTimeZone,
  onSelectDate,
  onAdd,
  onEdit,
}: WeekViewProps) {
  const dates = useMemo(() => inclusiveDateRange(from, to), [from, to]);
  const groupsByDate = useMemo(
    () => new Map(groups.map((group) => [group.dateKey, group])),
    [groups],
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const targetMinute =
      today >= from && today <= to
        ? minuteOfDayInTimeZone(new Date(), viewerTimeZone)
        : 8 * 60;
    viewport.scrollTop = Math.max(0, targetMinute - viewport.clientHeight / 3);
  }, [from, to, today, viewerTimeZone]);

  function moveSelectedDay(direction: -1 | 1) {
    const index = dates.indexOf(selectedDate);
    const next = dates[Math.min(dates.length - 1, Math.max(0, index + direction))];
    if (next) onSelectDate(next);
  }

  return (
    <section
      className={styles.weekView}
      aria-label="Week view"
      onPointerDown={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = pointerStart.current;
        pointerStart.current = null;
        if (!start) return;
        const x = event.clientX - start.x;
        const y = event.clientY - start.y;
        if (Math.abs(x) > 60 && Math.abs(x) > Math.abs(y) * 1.5) {
          moveSelectedDay(x < 0 ? 1 : -1);
        }
      }}
    >
      <div className={styles.weekDayHeader}>
        <div className={styles.timeHeader} aria-hidden="true" />
        {dates.map((dateKey) => {
          const dateLabel = formatDateKey(dateKey, locale, {
            weekday: "short",
            day: "numeric",
          });
          return (
            <button
              key={dateKey}
              type="button"
              data-selected={dateKey === selectedDate || undefined}
              data-today={dateKey === today || undefined}
              onClick={() => onSelectDate(dateKey)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  moveSelectedDay(-1);
                }
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  moveSelectedDay(1);
                }
              }}
            >
              {dateLabel}
            </button>
          );
        })}
      </div>

      <div className={styles.allDayRow}>
        <div className={styles.allDayLabel}>{messages.timeline.allDay}</div>
        {dates.map((dateKey) => {
          const allDay = (groupsByDate.get(dateKey)?.segments ?? EMPTY_SEGMENTS).filter(
            (segment) => segment.occurrence.timing.kind === "all-day",
          );
          return (
            <div
              key={dateKey}
              className={styles.allDayCell}
              data-selected={dateKey === selectedDate || undefined}
            >
              {allDay.map((segment) => (
                <button
                  key={`${segment.occurrence.key}:${dateKey}`}
                  type="button"
                  data-color={segment.occurrence.record.color}
                  aria-label={eventLabel(segment, locale, viewerTimeZone)}
                  onClick={() => onEdit(segment)}
                >
                  {segment.occurrence.record.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div ref={viewportRef} className={styles.weekViewport}>
        <div className={styles.timeRail} aria-hidden="true">
          {HOURS.map((hour) => (
            <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
          ))}
        </div>
        <div className={styles.weekGrid}>
          {dates.map((dateKey) => (
            <DayColumn
              key={dateKey}
              dateKey={dateKey}
              segments={groupsByDate.get(dateKey)?.segments ?? EMPTY_SEGMENTS}
              selected={dateKey === selectedDate}
              today={dateKey === today}
              locale={locale}
              viewerTimeZone={viewerTimeZone}
              onSelectDate={onSelectDate}
              onAdd={onAdd}
              onEdit={onEdit}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
