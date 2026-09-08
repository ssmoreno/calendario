"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr/ArrowClockwise";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";

import {
  dateKeyInTimeZone,
  formatDuration,
  todayKey,
} from "@/calendar/date-time";
import type { UpcomingEvent } from "@/server/google-calendar";

import { groupByDay, type DaySection } from "./board-layout";
import styles from "./event-board.module.css";

interface EventBoardProps {
  agentOpen: boolean;
  events: readonly UpcomingEvent[];
  now: number;
  timeZone: string;
  onRefresh(): void;
}

const TIMELINE_START = 7 * 60;
const TIMELINE_END = 22 * 60;
const MAX_TODAY_EVENTS = 5;

function dateAtNoon(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dayLabel(dateKey: string, timeZone: string, now: Date) {
  const today = todayKey(timeZone, now);
  if (dateKey === today) return "Today";
  const date = dateAtNoon(dateKey);
  const dayBefore = new Date(date);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  if (dayBefore.toISOString().slice(0, 10) === today) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
}

function fullDayLabel(dateKey: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateAtNoon(dateKey));
}

function shortDayLabel(dateKey: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateAtNoon(dateKey));
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

function durationLabel(event: UpcomingEvent) {
  if (event.timing.kind === "all-day") return "All day";
  const minutes = Math.max(
    1,
    Math.round(
      (new Date(event.timing.endsAt).getTime() -
        new Date(event.timing.startsAt).getTime()) /
        60_000,
    ),
  );
  return formatDuration(minutes);
}

function leadMinutes(event: UpcomingEvent, now: number) {
  if (event.timing.kind === "all-day") return null;
  return Math.round((new Date(event.timing.startsAt).getTime() - now) / 60_000);
}

function countdownLabel(event: UpcomingEvent | undefined, now: number) {
  if (!event) return "CLEAR";
  const minutes = leadMinutes(event, now);
  if (minutes === null) return "ALL DAY";
  if (minutes <= 0) return "NOW";
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function eventNote(event: UpcomingEvent) {
  if (event.location) return event.location;
  if (event.recurrence) return event.recurrence;
  if (event.reminderMinutes.length) {
    return `Reminder ${formatDuration(event.reminderMinutes[0])} before`;
  }
  if (event.usesDefaultReminder) return "Default reminder";
  return "No location";
}

function timeOfDay(instant: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date(instant));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function timelineStyle(
  event: UpcomingEvent,
  timeZone: string,
): CSSProperties | null {
  if (event.timing.kind === "all-day") return null;
  const start = timeOfDay(event.timing.startsAt, timeZone);
  const end = timeOfDay(event.timing.endsAt, timeZone);
  const visibleStart = Math.max(TIMELINE_START, start);
  const visibleEnd = Math.min(TIMELINE_END, end);
  if (visibleEnd <= visibleStart) return null;
  const range = TIMELINE_END - TIMELINE_START;
  return {
    "--event-left": `${((visibleStart - TIMELINE_START) / range) * 100}%`,
    "--event-width": `${((visibleEnd - visibleStart) / range) * 100}%`,
  } as CSSProperties;
}

function nowStyle(now: number, timeZone: string): CSSProperties {
  const minutes = timeOfDay(new Date(now).toISOString(), timeZone);
  const position = Math.min(
    100,
    Math.max(
      0,
      ((minutes - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100,
    ),
  );
  return { "--now-left": `${position}%` } as CSSProperties;
}

function EventDetails({ event, timeZone }: { event: UpcomingEvent; timeZone: string }) {
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

function EventRow({
  event,
  isNext,
  timeZone,
}: {
  event: UpcomingEvent;
  isNext: boolean;
  timeZone: string;
}) {
  return (
    <DialogTrigger>
      <Button className={styles.eventRow} data-next={isNext || undefined}>
        <span className={styles.eventWhen}>
          {blockTime(event, timeZone)}
          <small>{durationLabel(event)}</small>
        </span>
        <span className={styles.eventCopy}>
          <strong>{event.title}</strong>
          <small>{eventNote(event)}</small>
        </span>
        {isNext ? <span className={styles.nextBadge}>Next</span> : null}
      </Button>
      <Popover className={styles.detailsPopover} placement="bottom start" offset={6}>
        <Dialog className={styles.detailsDialog} aria-label={event.title}>
          <EventDetails event={event} timeZone={timeZone} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function FutureDay({
  day,
  expanded,
  now,
  onToggle,
  timeZone,
}: {
  day: DaySection;
  expanded: boolean;
  now: Date;
  onToggle(): void;
  timeZone: string;
}) {
  return (
    <section className={styles.futureDay} data-expanded={expanded || undefined}>
      <button
        className={styles.futureDayButton}
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <CaretDown size={14} aria-hidden="true" />
        <span>{dayLabel(day.dateKey, timeZone, now)}</span>
        <small>{`${day.events.length} ${day.events.length === 1 ? "event" : "events"}`}</small>
      </button>
      {expanded ? (
        <div className={styles.futureEvents}>
          {day.events.slice(0, 5).map((event) => (
            <DialogTrigger key={event.id}>
              <Button className={styles.futureEvent}>
                <span>{blockTime(event, timeZone)}</span>
                <strong>{event.title}</strong>
              </Button>
              <Popover className={styles.detailsPopover} placement="left top" offset={8}>
                <Dialog className={styles.detailsDialog} aria-label={event.title}>
                  <EventDetails event={event} timeZone={timeZone} />
                </Dialog>
              </Popover>
            </DialogTrigger>
          ))}
          {day.events.length > 5 ? (
            <p className={styles.futureMore}>{`+${day.events.length - 5} more`}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function EventBoard({
  agentOpen,
  events,
  now,
  timeZone,
  onRefresh,
}: EventBoardProps) {
  const nowDate = useMemo(() => new Date(now), [now]);
  const today = todayKey(timeZone, nowDate);
  const sections = useMemo(
    () => groupByDay(events, timeZone, nowDate),
    [events, timeZone, nowDate],
  );
  const todayEvents = sections.find((section) => section.dateKey === today)?.events ?? [];
  const futureDays = sections.filter((section) => section.dateKey !== today);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const defaultDay = futureDays[0]?.dateKey;
  const expandedDay = futureDays.some((day) => day.dateKey === selectedDay)
    ? selectedDay
    : selectedDay === null
      ? defaultDay
      : undefined;
  const nextEvent = events[0];
  const shownToday = todayEvents.slice(0, MAX_TODAY_EVENTS);
  const nowTime = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(nowDate);

  return (
    <section
      className={styles.board}
      data-agent-open={agentOpen || undefined}
      aria-labelledby="board-heading"
    >
      <h2 className={styles.visuallyHidden} id="board-heading">Upcoming events</h2>

      <section className={styles.today} aria-labelledby="today-heading">
        <div className={styles.hero}>
          <div className={styles.countdown}>
            <strong>{countdownLabel(nextEvent, now)}</strong>
            <span>{nextEvent ? "Until your next event" : "Your schedule is open"}</span>
          </div>
          <div className={styles.nextEvent}>
            <span>{`${fullDayLabel(today)} · ${nowTime}`}</span>
            <h3 id="today-heading">{nextEvent?.title ?? "Nothing else scheduled"}</h3>
            <p>
              {nextEvent
                ? `${blockTime(nextEvent, timeZone)} · ${durationLabel(nextEvent)} · ${eventNote(nextEvent)}`
                : "The rest of today is yours."}
            </p>
          </div>
        </div>

        <div className={styles.timeline} aria-hidden="true">
          {[7, 10, 13, 16, 19, 22].map((hour) => (
            <span
              className={styles.tick}
              key={hour}
              style={{
                "--tick-left": `${((hour * 60 - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100}%`,
              } as CSSProperties}
            >
              {String(hour).padStart(2, "0")}
            </span>
          ))}
          {todayEvents.map((event) => {
            const style = timelineStyle(event, timeZone);
            return style ? (
              <span
                className={styles.timelineEvent}
                data-next={event.id === nextEvent?.id || undefined}
                key={event.id}
                style={style}
              />
            ) : null;
          })}
          <span className={styles.now} style={nowStyle(now, timeZone)}>
            <b>{nowTime}</b>
          </span>
        </div>

        <div className={styles.eventList}>
          {shownToday.length ? (
            shownToday.map((event) => (
              <EventRow
                event={event}
                isNext={event.id === nextEvent?.id}
                key={event.id}
                timeZone={timeZone}
              />
            ))
          ) : (
            <p className={styles.emptyToday}>No events remaining today.</p>
          )}
          {todayEvents.length > shownToday.length ? (
            <p className={styles.moreToday}>{`+${todayEvents.length - shownToday.length} more today`}</p>
          ) : null}
        </div>
      </section>

      <aside className={styles.rail} aria-labelledby="future-heading">
        <div className={styles.railHeading}>
          <div>
            <h3 id="future-heading">Days ahead</h3>
            <span>{`${futureDays.reduce((total, day) => total + day.events.length, 0)} events`}</span>
          </div>
          <button className={styles.refreshButton} type="button" onClick={onRefresh}>
            <ArrowClockwise size={14} aria-hidden="true" />
            Refresh
          </button>
        </div>
        <div className={styles.futureList}>
          {futureDays.map((day) => (
            <FutureDay
              day={day}
              expanded={day.dateKey === expandedDay}
              key={day.dateKey}
              now={nowDate}
              onToggle={() =>
                setSelectedDay((current) =>
                  (current ?? defaultDay) === day.dateKey ? "" : day.dateKey,
                )
              }
              timeZone={timeZone}
            />
          ))}
          {futureDays.length === 0 ? (
            <p className={styles.emptyFuture}>No later events in the next two weeks.</p>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
