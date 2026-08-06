"use client";

import { parseDate } from "@internationalized/date";
import { useRef, useState } from "react";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  Dialog,
  DialogTrigger,
  FileTrigger,
  Heading,
  Popover,
} from "react-aria-components";

import { formatDateKey } from "@/calendar/date-time";
import { messages } from "@/calendar/messages";
import type { ThemePreference } from "@/calendar/types";

import {
  CalendarIcon,
  ChevronIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  ThemeIcon,
} from "./icons";
import styles from "./agenda.module.css";

interface AgendaHeaderProps {
  visibleDate: string;
  selectedDate: string;
  locale: string;
  occupiedDates: Set<string>;
  query: string;
  theme: ThemePreference;
  onQueryChange(query: string): void;
  onSelectDate(dateKey: string): void;
  onCalendarFocusChange(dateKey: string): void;
  onToday(): void;
  onAdd(): void;
  onCycleTheme(): void;
  onExport(): void;
  onImport(file: File): void;
}

const themeLabels: Record<ThemePreference, string> = {
  system: messages.header.themeSystem,
  light: messages.header.themeLight,
  dark: messages.header.themeDark,
};

export function AgendaHeader({
  visibleDate,
  selectedDate,
  locale,
  occupiedDates,
  query,
  theme,
  onQueryChange,
  onSelectDate,
  onCalendarFocusChange,
  onToday,
  onAdd,
  onCycleTheme,
  onExport,
  onImport,
}: AgendaHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const visibleMonth = formatDateKey(visibleDate, locale, {
    month: "long",
    year: "numeric",
  });

  function toggleSearch() {
    setSearchOpen((open) => {
      if (!open) requestAnimationFrame(() => searchRef.current?.focus());
      if (open) onQueryChange("");
      return !open;
    });
  }

  return (
    <header className={styles.appHeader}>
      <div className={styles.wordmark} aria-label={messages.header.brandLabel}>
        {messages.appName}
        <span>.</span>
      </div>

      <div className={styles.monthLabel} aria-live="polite">
        {visibleMonth}
      </div>

      <div className={styles.headerActions}>
        {searchOpen ? (
          <div className={styles.searchBox}>
            <SearchIcon />
            <input
              ref={searchRef}
              type="search"
              value={query}
              aria-label={messages.searchEvents}
              placeholder={messages.searchPlaceholder}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") toggleSearch();
              }}
            />
            <button
              type="button"
              onClick={toggleSearch}
              aria-label={messages.header.closeSearch}
            >
              ×
            </button>
          </div>
        ) : (
          <button
            className={styles.iconButton}
            type="button"
            aria-label={messages.searchEvents}
            title={messages.searchEvents}
            onClick={toggleSearch}
          >
            <SearchIcon />
          </button>
        )}

        <DialogTrigger isOpen={calendarOpen} onOpenChange={setCalendarOpen}>
          <Button
            className={styles.iconButton}
            aria-label={messages.header.openDateNavigator}
          >
            <CalendarIcon />
          </Button>
          <Popover className={styles.popover} placement="bottom end">
            <Dialog
              className={styles.popoverDialog}
              aria-label={messages.header.chooseDate}
            >
              <Calendar
                className={styles.calendar}
                value={parseDate(selectedDate)}
                onFocusChange={(date) =>
                  onCalendarFocusChange(date.toString())
                }
                onChange={(date) => {
                  setCalendarOpen(false);
                  onSelectDate(date.toString());
                }}
              >
                <div className={styles.calendarHeader}>
                  <Button
                    slot="previous"
                    aria-label={messages.header.previousMonth}
                  >
                    <ChevronIcon direction="left" />
                  </Button>
                  <Heading />
                  <Button slot="next" aria-label={messages.header.nextMonth}>
                    <ChevronIcon />
                  </Button>
                </div>
                <CalendarGrid weekdayStyle="short">
                  {(date) => {
                    const dateKey = date.toString();
                    const occupied = occupiedDates.has(dateKey);
                    return (
                      <CalendarCell
                        date={date}
                        className={styles.calendarCell}
                      >
                        {({ formattedDate }) => (
                          <>
                            <span>{formattedDate}</span>
                            {occupied ? <i aria-hidden="true" /> : null}
                          </>
                        )}
                      </CalendarCell>
                    );
                  }}
                </CalendarGrid>
                <p className={styles.calendarHint}>
                  {messages.header.calendarHint}
                </p>
              </Calendar>
            </Dialog>
          </Popover>
        </DialogTrigger>

        <button className={styles.todayButton} type="button" onClick={onToday}>
          {messages.today}
        </button>

        <button
          className={styles.iconButton}
          type="button"
          aria-label={themeLabels[theme]}
          title={messages.header.themeTitle(themeLabels[theme])}
          onClick={onCycleTheme}
        >
          <ThemeIcon />
        </button>

        <DialogTrigger>
          <Button
            className={styles.iconButton}
            aria-label={messages.header.dataOptions}
          >
            <MoreIcon />
          </Button>
          <Popover className={styles.popover} placement="bottom end">
            <Dialog
              className={styles.dataDialog}
              aria-label={messages.header.dataDialog}
            >
              <p className={styles.popoverEyebrow}>
                {messages.header.dataEyebrow}
              </p>
              <h2>{messages.header.dataHeading}</h2>
              <p>{messages.header.dataBody}</p>
              <div className={styles.dataActions}>
                <Button onPress={onExport}>{messages.header.exportJson}</Button>
                <FileTrigger
                  acceptedFileTypes={["application/json", ".json"]}
                  onSelect={(files) => {
                    const file = files?.item(0);
                    if (file) onImport(file);
                  }}
                >
                  <Button>{messages.header.importJson}</Button>
                </FileTrigger>
              </div>
            </Dialog>
          </Popover>
        </DialogTrigger>

        <button
          className={styles.addButton}
          type="button"
          aria-label={messages.addEvent}
          onClick={onAdd}
        >
          <PlusIcon />
          <span>{messages.addEvent}</span>
        </button>
      </div>
    </header>
  );
}
