"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import {
  formatDateKey,
  formatTime,
  inclusiveDateRange,
} from "@/calendar/date-time";
import { messages } from "@/calendar/messages";
import type {
  EditorSeed,
  EventSegment,
  OccupiedDateGroup,
} from "@/calendar/types";

import styles from "./calendar.module.css";

interface MonthViewProps {
  from: string;
  to: string;
  monthKey: string;
  groups: OccupiedDateGroup[];
  selectedDate: string;
  today: string;
  locale: string;
  viewerTimeZone: string;
  onSelectDate(dateKey: string): void;
  onAdd(seed: EditorSeed): void;
  onEdit(segment: EventSegment): void;
}

const MOBILE_QUERY = "(max-width: 679px)";

function subscribeToMobile(callback: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getMobileSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getServerMobileSnapshot() {
  return false;
}

function segmentTime(
  segment: EventSegment,
  locale: string,
  viewerTimeZone: string,
) {
  return segment.occurrence.timing.kind === "all-day"
    ? messages.timeline.allDay
    : formatTime(
        segment.occurrence.timing.startsAt,
        locale,
        viewerTimeZone,
      );
}

function MonthEvent({
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
  const event = segment.occurrence.record;
  const time = segmentTime(segment, locale, viewerTimeZone);
  return (
    <button
      className={styles.monthEvent}
      data-color={event.color}
      type="button"
      aria-label={`${event.title}, ${time}`}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onEdit(segment);
      }}
    >
      <span>{time}</span>
      <strong>{event.title}</strong>
    </button>
  );
}

export function MonthView({
  from,
  to,
  monthKey,
  groups,
  selectedDate,
  today,
  locale,
  viewerTimeZone,
  onSelectDate,
  onAdd,
  onEdit,
}: MonthViewProps) {
  const isMobile = useSyncExternalStore(
    subscribeToMobile,
    getMobileSnapshot,
    getServerMobileSnapshot,
  );
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const dates = useMemo(() => inclusiveDateRange(from, to), [from, to]);
  const groupsByDate = useMemo(
    () => new Map(groups.map((group) => [group.dateKey, group])),
    [groups],
  );
  const weeks = useMemo(
    () => Array.from({ length: dates.length / 7 }, (_, index) => dates.slice(index * 7, index * 7 + 7)),
    [dates],
  );
  const weekdayLabels = dates.slice(0, 7).map((dateKey) =>
    formatDateKey(dateKey, locale, { weekday: "short" }),
  );

  function selectDate(dateKey: string, hasEvents: boolean) {
    onSelectDate(dateKey);
    if (isMobile && hasEvents) {
      setExpandedDate((current) => (current === dateKey ? null : dateKey));
      return;
    }
    onAdd({ dateKey, startTime: "09:00" });
  }

  return (
    <section className={styles.monthView} aria-label="Month view">
      <div className={styles.monthWeekdays} aria-hidden="true">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className={styles.monthGrid} role="grid">
        {weeks.map((week) => {
          const expandedSegments = expandedDate && week.includes(expandedDate)
            ? groupsByDate.get(expandedDate)?.segments ?? []
            : [];
          return (
            <div className={styles.monthWeek} role="row" key={week[0]}>
              {week.map((dateKey) => {
                const segments = groupsByDate.get(dateKey)?.segments ?? [];
                const dateLabel = formatDateKey(dateKey, locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
                const outsideMonth = dateKey.slice(0, 7) !== monthKey;
                return (
                  <div
                    className={styles.monthCell}
                    data-outside={outsideMonth || undefined}
                    data-selected={dateKey === selectedDate || undefined}
                    data-today={dateKey === today || undefined}
                    role="gridcell"
                    key={dateKey}
                    onClick={() => selectDate(dateKey, segments.length > 0)}
                  >
                    <button
                      className={styles.monthDateButton}
                      type="button"
                      aria-label={`${dateLabel}${segments.length ? `, ${segments.length} events` : ", no events"}`}
                      aria-expanded={
                        isMobile && segments.length > 0
                          ? expandedDate === dateKey
                          : undefined
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        selectDate(dateKey, segments.length > 0);
                      }}
                    >
                      {Number(dateKey.slice(-2))}
                    </button>
                    <div className={styles.monthCellEvents}>
                      {segments.map((segment) => (
                        <MonthEvent
                          key={`${segment.occurrence.key}:${dateKey}`}
                          segment={segment}
                          locale={locale}
                          viewerTimeZone={viewerTimeZone}
                          onEdit={onEdit}
                        />
                      ))}
                    </div>
                    {segments.length ? (
                      <span className={styles.mobileEventCount}>
                        {segments.length}
                      </span>
                    ) : null}
                  </div>
                );
              })}
              {expandedSegments.length ? (
                <div className={styles.mobileDayDetails}>
                  <div>
                    <strong>
                      {formatDateKey(expandedDate!, locale, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </strong>
                    <button
                      type="button"
                      onClick={() =>
                        onAdd({ dateKey: expandedDate!, startTime: "09:00" })
                      }
                    >
                      {messages.addEvent}
                    </button>
                  </div>
                  {expandedSegments.map((segment) => (
                    <MonthEvent
                      key={`detail:${segment.occurrence.key}:${expandedDate}`}
                      segment={segment}
                      locale={locale}
                      viewerTimeZone={viewerTimeZone}
                      onEdit={onEdit}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
