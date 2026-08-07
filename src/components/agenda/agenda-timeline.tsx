"use client";

import { useEffect, useRef } from "react";

import {
  formatDateKey,
  formatDuration,
  formatTime,
  timezoneFromZoned,
} from "@/calendar/date-time";
import { messages } from "@/calendar/messages";
import { recurrenceDescription } from "@/calendar/recurrence";
import type {
  EventSegment,
  OccupiedDateGroup,
  TimelineItem,
} from "@/calendar/types";

import { PlusIcon } from "./icons";
import styles from "./agenda.module.css";

interface AgendaTimelineProps {
  groups: OccupiedDateGroup[];
  timeline: TimelineItem[];
  activeDate: string | null;
  today: string;
  locale: string;
  viewerTimeZone: string;
  query: string;
  onVisibleDateChange(dateKey: string): void;
  onEdit(segment: EventSegment): void;
  onAdd(dateKey?: string): void;
  onEarlier(): void;
  onLater(): void;
}

function continuationLabel(segment: EventSegment): string | null {
  if (segment.dayPosition === "start") {
    return messages.timeline.continuationStart;
  }
  if (segment.dayPosition === "middle") {
    return messages.timeline.continuationMiddle;
  }
  if (segment.dayPosition === "end") return messages.timeline.continuationEnd;
  return null;
}

function timeLabel(
  segment: EventSegment,
  locale: string,
  viewerTimeZone: string,
): { primary: string; secondary?: string } {
  if (segment.occurrence.timing.kind === "all-day") {
    return {
      primary:
        segment.dayPosition === "middle"
          ? messages.timeline.continuing
          : messages.timeline.allDay,
      secondary: continuationLabel(segment) ?? undefined,
    };
  }
  if (segment.dayPosition === "middle" || segment.dayPosition === "end") {
    return {
      primary: messages.timeline.continuing,
      secondary: continuationLabel(segment) ?? undefined,
    };
  }
  return {
    primary: formatTime(
      segment.occurrence.timing.startsAt,
      locale,
      viewerTimeZone,
    ),
    secondary: formatDuration(segment.occurrence.timing.durationMinutes),
  };
}

function eventMeta(segment: EventSegment, viewerTimeZone: string): string[] {
  const values: string[] = [];
  const continuation = continuationLabel(segment);
  if (continuation) values.push(continuation);
  if (segment.occurrence.record.location) {
    values.push(segment.occurrence.record.location);
  }
  if (segment.occurrence.record.recurrence) {
    values.push(
      messages.timeline.recurrence(
        recurrenceDescription(segment.occurrence.record.recurrence.rrule),
      ),
    );
  } else if (segment.occurrence.record.seriesId) {
    values.push(messages.timeline.seriesException);
  }
  if (segment.occurrence.record.reminderMinutesBefore !== undefined) {
    const reminder = segment.occurrence.record.reminderMinutesBefore;
    values.push(
      reminder === 0
        ? messages.timeline.reminderAtStart
        : messages.timeline.reminderBefore(formatDuration(reminder)),
    );
  }
  if (segment.occurrence.timing.kind === "timed") {
    const eventTimeZone = timezoneFromZoned(
      segment.occurrence.timing.startsAt,
    );
    if (eventTimeZone !== viewerTimeZone) {
      values.push(messages.timeline.eventTimezone(eventTimeZone));
    }
  }
  return values;
}

function EventRow({
  segment,
  locale,
  viewerTimeZone,
  onEdit,
}: {
  segment: EventSegment;
  locale: string;
  viewerTimeZone: string;
  onEdit(segment: EventSegment): void;
}) {
  const time = timeLabel(segment, locale, viewerTimeZone);
  const meta = eventMeta(segment, viewerTimeZone);
  const event = segment.occurrence.record;
  const accessibleLabel = [
    event.title,
    time.primary,
    time.secondary,
    ...meta,
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
  return (
    <button
      className={styles.eventRow}
      data-color={event.color}
      type="button"
      aria-label={accessibleLabel}
      onClick={() => onEdit(segment)}
    >
      <span className={styles.eventTime}>
        <strong>{time.primary}</strong>
        {time.secondary ? <small>{time.secondary}</small> : null}
      </span>
      <span className={styles.eventBody}>
        <span className={styles.eventTitle}>{event.title}</span>
        {meta.length ? (
          <span className={styles.eventMeta}>{meta.join(" · ")}</span>
        ) : (
          <span className={styles.eventMeta}>
            {messages.timeline.personalEvent}
          </span>
        )}
      </span>
      <span className={styles.eventBadge}>
        {event.recurrence || event.seriesId
          ? messages.domain.repeats
          : event.color}
      </span>
    </button>
  );
}

function DateGroup({
  group,
  active,
  past,
  today,
  locale,
  viewerTimeZone,
  onEdit,
}: {
  group: OccupiedDateGroup;
  active: boolean;
  past: boolean;
  today: boolean;
  locale: string;
  viewerTimeZone: string;
  onEdit(segment: EventSegment): void;
}) {
  const weekday = formatDateKey(group.dateKey, locale, { weekday: "long" });
  const month = formatDateKey(group.dateKey, locale, { month: "long" });
  const dayNumber = formatDateKey(group.dateKey, locale, { day: "2-digit" });
  const fullDate = formatDateKey(group.dateKey, locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const headingId = `date-heading-${group.dateKey}`;
  return (
    <section
      id={`date-${group.dateKey}`}
      data-date-key={group.dateKey}
      aria-labelledby={headingId}
      className={[
        styles.dateGroup,
        active ? styles.activeDate : "",
        past ? styles.pastDate : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.dateStamp}>
        <h2 id={headingId} className={styles.visuallyHidden}>
          {fullDate}
        </h2>
        <div className={styles.dateMeta} aria-hidden="true">
          <span>{today ? messages.today : weekday}</span>
          <span>{month}</span>
        </div>
        <div className={styles.dateNumber} aria-hidden="true">
          {dayNumber}
        </div>
      </div>
      <div className={styles.eventList}>
        {group.segments.map((segment) => (
          <EventRow
            key={`${segment.occurrence.key}:${segment.dateKey}`}
            segment={segment}
            locale={locale}
            viewerTimeZone={viewerTimeZone}
            onEdit={onEdit}
          />
        ))}
      </div>
    </section>
  );
}

function QuietDivider({ item, locale }: { item: Extract<TimelineItem, { kind: "quiet" }>; locale: string }) {
  const large = item.count >= 7;
  const range = `${formatDateKey(item.from, locale, {
    month: "short",
    day: "numeric",
  })} — ${formatDateKey(item.to, locale, {
    month: "short",
    day: "numeric",
  })}`;
  return (
    <div
      role="separator"
      className={[styles.quietGap, large ? styles.largeQuietGap : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label={messages.timeline.quietLabel(item.count, range)}
    >
      <div className={styles.quietCount}>
        <strong>{String(item.count).padStart(2, "0")}</strong>
        {messages.timeline.quietCount(item.count)}
      </div>
      <div className={styles.quietMap}>
        <span>{large ? range : messages.timeline.quietHint}</span>
        <span className={styles.quietDots} aria-hidden="true">
          {Array.from({ length: Math.min(item.count, 7) }, (_, index) => (
            <i key={index} />
          ))}
        </span>
      </div>
    </div>
  );
}

export function AgendaTimeline({
  groups,
  timeline,
  activeDate,
  today,
  locale,
  viewerTimeZone,
  query,
  onVisibleDateChange,
  onEdit,
  onAdd,
  onEarlier,
  onLater,
}: AgendaTimelineProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodes = rootRef.current?.querySelectorAll<HTMLElement>("[data-date-key]");
    if (!nodes?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const dateKey = (visible?.target as HTMLElement | undefined)?.dataset
          .dateKey;
        if (dateKey) onVisibleDateChange(dateKey);
      },
      { rootMargin: "-80px 0px -68% 0px", threshold: [0, 0.1] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [groups, onVisibleDateChange]);

  return (
    <div ref={rootRef}>
      <div className={styles.agendaHeading}>
        <div>
          <p className={styles.eyebrow}>{messages.app.eventOnlyEyebrow}</p>
          <h1>{messages.agendaHeading}</h1>
        </div>
        <p>{messages.agendaDescription}</p>
      </div>

      {groups.length === 0 ? (
        <section className={styles.emptyState} aria-live="polite">
          <p className={styles.eyebrow}>
            {query
              ? messages.timeline.searchEyebrow
              : messages.timeline.clearEyebrow}
          </p>
          <h2>
            {query ? messages.noSearchHeading : messages.emptyHeading}
          </h2>
          <p>{query ? messages.noSearchBody : messages.emptyBody}</p>
          {!query ? (
            <button type="button" onClick={() => onAdd(today)}>
              <PlusIcon />
              {messages.addEvent}
            </button>
          ) : null}
        </section>
      ) : (
        <>
          <div className={styles.rangeControl}>
            <button type="button" onClick={onEarlier}>
              ← {messages.earlier}
            </button>
            <span>{messages.timeline.historyHint}</span>
          </div>

          {timeline.map((item) => {
            if (item.kind === "quiet") {
              return <QuietDivider key={`quiet-${item.from}`} item={item} locale={locale} />;
            }
            if (item.kind === "today") {
              return (
                <div
                  id={`date-${item.dateKey}`}
                  key={`today-${item.dateKey}`}
                  role="separator"
                  className={styles.todayMarker}
                  aria-label={`${messages.today}. ${messages.todayClear}.`}
                >
                  <span>
                    {messages.today} /{" "}
                    {formatDateKey(item.dateKey, locale, {
                      weekday: "long",
                      day: "2-digit",
                    })}
                  </span>
                  <span>{messages.todayClear}</span>
                </div>
              );
            }
            return (
              <DateGroup
                key={item.dateKey}
                group={item}
                active={item.dateKey === activeDate}
                past={item.dateKey < today}
                today={item.dateKey === today}
                locale={locale}
                viewerTimeZone={viewerTimeZone}
                onEdit={onEdit}
              />
            );
          })}

          <div className={`${styles.rangeControl} ${styles.laterControl}`}>
            <span>{messages.timeline.rangeEndHint}</span>
            <button type="button" onClick={onLater}>
              {messages.later} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
