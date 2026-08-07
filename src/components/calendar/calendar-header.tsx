"use client";

import { useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  FileTrigger,
  Popover,
} from "react-aria-components";

import { formatDateKey, formatTime } from "@/calendar/date-time";
import { messages } from "@/calendar/messages";
import type {
  CalendarView,
  Occurrence,
  ThemePreference,
} from "@/calendar/types";

import {
  ChevronIcon,
  MoonIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
} from "./icons";
import styles from "./calendar.module.css";

interface CalendarHeaderProps {
  view: CalendarView;
  periodLabel: string;
  query: string;
  results: Occurrence[];
  locale: string;
  viewerTimeZone: string;
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  onPrevious(): void;
  onNext(): void;
  onToday(): void;
  onViewChange(view: CalendarView): void;
  onQueryChange(query: string): void;
  onSelectResult(occurrence: Occurrence): void;
  onAdd(): void;
  onToggleTheme(): void;
  onSelectTheme(theme: ThemePreference): void;
  onExport(): void;
  onImport(file: File): void;
}

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: "system", label: messages.header.themeSystem },
  { value: "light", label: messages.header.themeLight },
  { value: "dark", label: messages.header.themeDark },
];

function SearchResult({
  occurrence,
  locale,
  viewerTimeZone,
  onSelect,
}: {
  occurrence: Occurrence;
  locale: string;
  viewerTimeZone: string;
  onSelect(): void;
}) {
  const dateKey = occurrence.dateKeys[0];
  const date = formatDateKey(dateKey, locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time =
    occurrence.timing.kind === "all-day"
      ? messages.timeline.allDay
      : formatTime(occurrence.timing.startsAt, locale, viewerTimeZone);
  return (
    <li>
      <button type="button" onClick={onSelect}>
        <span>{occurrence.record.title}</span>
        <small>
          {date} · {time}
        </small>
      </button>
    </li>
  );
}

export function CalendarHeader({
  view,
  periodLabel,
  query,
  results,
  locale,
  viewerTimeZone,
  theme,
  resolvedTheme,
  onPrevious,
  onNext,
  onToday,
  onViewChange,
  onQueryChange,
  onSelectResult,
  onAdd,
  onToggleTheme,
  onSelectTheme,
  onExport,
  onImport,
}: CalendarHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  function openSearch() {
    setSearchOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function closeSearch() {
    setSearchOpen(false);
    onQueryChange("");
  }

  function selectResult(occurrence: Occurrence) {
    closeSearch();
    onSelectResult(occurrence);
  }

  return (
    <header className={styles.appHeader}>
      <div className={styles.wordmark} aria-label={messages.header.brandLabel}>
        {messages.appName}
      </div>

      <div className={styles.periodNavigation}>
        <button
          className={styles.iconButton}
          type="button"
          aria-label={messages.previousPeriod}
          onClick={onPrevious}
        >
          <ChevronIcon direction="left" />
        </button>
        <button className={styles.todayButton} type="button" onClick={onToday}>
          {messages.today}
        </button>
        <button
          className={styles.iconButton}
          type="button"
          aria-label={messages.nextPeriod}
          onClick={onNext}
        >
          <ChevronIcon />
        </button>
        <h1 className={styles.periodLabel} aria-live="polite">
          {periodLabel}
        </h1>
      </div>

      <div className={styles.headerActions}>
        <div className={styles.viewSwitch} aria-label="Calendar view">
          {(["week", "month"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => onViewChange(option)}
            >
              {option === "week" ? messages.week : messages.month}
            </button>
          ))}
        </div>

        <div className={styles.searchControl}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label={messages.searchEvents}
            aria-expanded={searchOpen}
            onClick={searchOpen ? closeSearch : openSearch}
          >
            <SearchIcon />
          </button>
          {searchOpen ? (
            <div className={styles.searchPanel} aria-label={messages.header.searchResults}>
              <div className={styles.searchInput}>
                <SearchIcon />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  aria-label={messages.searchEvents}
                  placeholder={messages.searchPlaceholder}
                  onChange={(event) => onQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeSearch();
                  }}
                />
                <button
                  type="button"
                  aria-label={messages.header.closeSearch}
                  onClick={closeSearch}
                >
                  ×
                </button>
              </div>
              {query.trim() ? (
                results.length ? (
                  <ul className={styles.searchResults}>
                    {results.map((occurrence) => (
                      <SearchResult
                        key={occurrence.key}
                        occurrence={occurrence}
                        locale={locale}
                        viewerTimeZone={viewerTimeZone}
                        onSelect={() => selectResult(occurrence)}
                      />
                    ))}
                  </ul>
                ) : (
                  <div className={styles.noSearchResults}>
                    <strong>{messages.noSearchHeading}</strong>
                    <span>{messages.noSearchBody}</span>
                  </div>
                )
              ) : null}
            </div>
          ) : null}
        </div>

        <button
          className={`${styles.iconButton} ${styles.themeButton}`}
          type="button"
          aria-label={
            resolvedTheme === "dark"
              ? messages.header.switchToLight
              : messages.header.switchToDark
          }
          title={
            resolvedTheme === "dark"
              ? messages.header.switchToLight
              : messages.header.switchToDark
          }
          onClick={onToggleTheme}
        >
          {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        <DialogTrigger isOpen={settingsOpen} onOpenChange={setSettingsOpen}>
          <Button className={styles.iconButton} aria-label={messages.header.settings}>
            <MoreIcon />
          </Button>
          <Popover className={styles.popover} placement="bottom end" offset={6}>
            <Dialog
              className={styles.settingsDialog}
              aria-label={messages.header.settingsDialog}
            >
              <section className={styles.settingsSection}>
                <h2>{messages.header.appearanceHeading}</h2>
                <div
                  className={styles.segmented}
                  role="group"
                  aria-label={messages.header.themeGroup}
                >
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={theme === option.value}
                      onClick={() => onSelectTheme(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.settingsSection}>
                <h2>{messages.header.dataHeading}</h2>
                <p>{messages.header.dataBody}</p>
                <div className={styles.dataActions}>
                  <Button
                    onPress={() => {
                      setSettingsOpen(false);
                      onExport();
                    }}
                  >
                    {messages.header.exportJson}
                  </Button>
                  <FileTrigger
                    acceptedFileTypes={["application/json", ".json"]}
                    onSelect={(files) => {
                      const file = files?.item(0);
                      if (file) {
                        setSettingsOpen(false);
                        onImport(file);
                      }
                    }}
                  >
                    <Button>{messages.header.importJson}</Button>
                  </FileTrigger>
                </div>
              </section>
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
