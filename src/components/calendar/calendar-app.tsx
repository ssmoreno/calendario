"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { I18nProvider } from "react-aria-components";

import {
  addDays,
  addMonths,
  CALENDAR_LOCALE,
  formatDateKey,
  minuteOfDayInTimeZone,
  monthGridRange,
  todayKey,
  weekRange,
} from "@/calendar/date-time";
import { LocalCalendarService } from "@/calendar/local-calendar-service";
import { messages } from "@/calendar/messages";
import { preferencesDocumentSchema } from "@/calendar/schemas";
import {
  loadPreferences,
  PREFERENCES_STORAGE_KEY,
  saveThemePreference,
} from "@/calendar/storage";
import type {
  CalendarDocument,
  CalendarRange,
  CalendarView,
  EditorSeed,
  EventInput,
  EventPatch,
  EventRecord,
  EventSegment,
  MutationScope,
  Occurrence,
  PreferencesDocument,
  ThemePreference,
} from "@/calendar/types";
import { filterOccurrences, groupOccupiedDates } from "@/calendar/view-model";

import { CalendarHeader } from "./calendar-header";
import { EventEditor } from "./event-editor";
import styles from "./calendar.module.css";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";

interface BrowserContext {
  timeZone: string;
  today: string;
}

interface EditorTarget {
  seed: EditorSeed;
  occurrence: Occurrence | null;
  seriesEvent: EventRecord | null;
}

interface ToastState {
  message: string;
  undo?: () => void;
}

interface BrowserSession {
  browser: BrowserContext;
  service: LocalCalendarService;
  preferences: PreferencesDocument;
  notice: ToastState | null;
}

const themeOrder: ThemePreference[] = ["system", "light", "dark"];

function applyTheme(theme: ThemePreference) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
  document.documentElement.style.colorScheme = resolved;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function downloadJson(value: string) {
  const blob = new Blob([value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `calendario-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function minDate(a: string, b: string) {
  return a < b ? a : b;
}

function maxDate(a: string, b: string) {
  return a > b ? a : b;
}

function periodLabel(view: CalendarView, anchorDate: string) {
  if (view === "month") {
    return formatDateKey(anchorDate, CALENDAR_LOCALE, {
      month: "long",
      year: "numeric",
    });
  }
  const { from, to } = weekRange(anchorDate);
  const fromMonth = from.slice(0, 7);
  const toMonth = to.slice(0, 7);
  if (fromMonth === toMonth) {
    return `${Number(from.slice(-2))}–${formatDateKey(to, CALENDAR_LOCALE, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  }
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const start = formatDateKey(from, CALENDAR_LOCALE, {
    day: "numeric",
    month: "long",
    year: sameYear ? undefined : "numeric",
  });
  const end = formatDateKey(to, CALENDAR_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${start}–${end}`;
}

function nextHalfHour(timeZone: string) {
  const minutes = minuteOfDayInTimeZone(new Date(), timeZone);
  const rounded = Math.ceil(minutes / 30) * 30;
  const normalized = rounded % 1_440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function CalendarSkeleton() {
  return (
    <main className={styles.pageShell} aria-label={messages.app.loadingLabel}>
      <header className={styles.appHeader}>
        <div className={styles.wordmark}>{messages.appName}</div>
        <div className={styles.skeletonPeriod} />
        <div className={styles.skeletonActions} />
      </header>
      <div className={styles.skeletonCalendar} />
    </main>
  );
}

function createBrowserSession(): BrowserSession {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = todayKey(timeZone);
  const opened = LocalCalendarService.open(timeZone);
  const notice = opened.recoveredCorruptData
    ? { message: messages.corruptRecovery }
    : !opened.storageAvailable
      ? { message: messages.storageUnavailable }
      : null;
  return {
    browser: { timeZone, today },
    service: opened.service,
    preferences: loadPreferences(safeStorage()),
    notice,
  };
}

export function CalendarApp() {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  return hydrated ? <HydratedCalendar /> : <CalendarSkeleton />;
}

function HydratedCalendar() {
  const [session] = useState(createBrowserSession);
  const { browser, service } = session;
  const [document, setDocument] = useState<CalendarDocument>(() =>
    service.getDocument(),
  );
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(browser.today);
  const [selectedDate, setSelectedDate] = useState(browser.today);
  const [range, setRange] = useState<CalendarRange>({
    from: addDays(browser.today, -90),
    to: addDays(browser.today, 180),
  });
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [toast, setToast] = useState<ToastState | null>(session.notice);
  const [preferences, setPreferences] = useState<PreferencesDocument>(
    session.preferences,
  );

  const visibleRange = useMemo(
    () => (view === "week" ? weekRange(anchorDate) : monthGridRange(anchorDate)),
    [anchorDate, view],
  );

  useEffect(() => {
    const unsubscribe = service.subscribe(setDocument);
    return () => {
      unsubscribe();
      service.dispose();
    };
  }, [service]);

  useEffect(() => {
    let active = true;
    void service.listOccurrences(range).then((next) => {
      if (active) setOccurrences(next);
    });
    return () => {
      active = false;
    };
  }, [document, range, service]);

  useEffect(() => {
    applyTheme(preferences.theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (preferences.theme === "system") applyTheme("system");
    };
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [preferences.theme]);

  useEffect(() => {
    function syncPreferences(event: StorageEvent) {
      if (event.key !== PREFERENCES_STORAGE_KEY || !event.newValue) return;
      try {
        const incoming = preferencesDocumentSchema.parse(JSON.parse(event.newValue));
        setPreferences((current) =>
          incoming.revision > current.revision ? incoming : current,
        );
      } catch {
        // Malformed preferences from another tab cannot replace a valid copy.
      }
    }
    window.addEventListener("storage", syncPreferences);
    return () => window.removeEventListener("storage", syncPreferences);
  }, []);

  const groups = useMemo(
    () =>
      groupOccupiedDates(occurrences).filter(
        (group) =>
          group.dateKey >= visibleRange.from && group.dateKey <= visibleRange.to,
      ),
    [occurrences, visibleRange],
  );
  const searchResults = useMemo(
    () => filterOccurrences(occurrences, query, browser.today),
    [browser.today, occurrences, query],
  );

  function openCreate(seed: EditorSeed) {
    setSelectedDate(seed.dateKey);
    setEditor({ seed, occurrence: null, seriesEvent: null });
  }

  function openEdit(segment: EventSegment) {
    openOccurrence(segment.occurrence, segment.dateKey);
  }

  function openOccurrence(occurrence: Occurrence, dateKey: string) {
    const seriesEvent = occurrence.record.seriesId
      ? document.events.find((event) => event.id === occurrence.record.seriesId) ?? null
      : occurrence.record.recurrence
        ? occurrence.record
        : null;
    setSelectedDate(dateKey);
    setAnchorDate(dateKey);
    ensureCoverage(view, dateKey);
    setEditor({
      seed: { dateKey },
      occurrence,
      seriesEvent,
    });
  }

  function ensureCoverage(nextView: CalendarView, nextAnchor: string) {
    const nextVisible =
      nextView === "week" ? weekRange(nextAnchor) : monthGridRange(nextAnchor);
    setRange((current) => {
      if (nextVisible.from >= current.from && nextVisible.to <= current.to) {
        return current;
      }
      return {
        from: minDate(current.from, addDays(nextVisible.from, -90)),
        to: maxDate(current.to, addDays(nextVisible.to, 180)),
      };
    });
  }

  function navigate(direction: -1 | 1) {
    const shift = view === "week" ? 7 * direction : direction;
    const nextAnchor =
      view === "week"
        ? addDays(anchorDate, shift)
        : addMonths(anchorDate, shift);
    const nextSelected =
      view === "week"
        ? addDays(selectedDate, shift)
        : addMonths(selectedDate, shift);
    setAnchorDate(nextAnchor);
    setSelectedDate(nextSelected);
    ensureCoverage(view, nextAnchor);
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
  }

  function goToday() {
    setAnchorDate(browser.today);
    setSelectedDate(browser.today);
    ensureCoverage(view, browser.today);
  }

  function changeView(nextView: CalendarView) {
    setView(nextView);
    setAnchorDate(selectedDate);
    ensureCoverage(nextView, selectedDate);
  }

  function cycleTheme() {
    const index = themeOrder.indexOf(preferences.theme);
    const theme = themeOrder[(index + 1) % themeOrder.length];
    const next = saveThemePreference(safeStorage(), theme);
    setPreferences(next);
  }

  async function saveEvent(
    input: EventInput,
    scope: MutationScope,
    patch: EventPatch,
  ) {
    if (!editor) return;
    if (editor.occurrence) {
      const base = editor.seriesEvent;
      const recurrencePatched = Object.prototype.hasOwnProperty.call(
        patch,
        "recurrence",
      );
      const recurrenceChanged =
        recurrencePatched && base?.recurrence?.rrule !== patch.recurrence?.rrule;
      const hasExceptions = Boolean(
        base &&
          (base.recurrence?.excludedStarts.length ||
            document.events.some((event) => event.seriesId === base.id)),
      );
      if (
        recurrenceChanged &&
        hasExceptions &&
        scope !== "occurrence" &&
        !window.confirm(messages.app.recurrenceExceptionConfirm)
      ) {
        throw new Error(messages.app.recurrenceChangeCancelled);
      }
      await service.updateEvent(
        {
          eventId: editor.occurrence.eventId,
          occurrenceStart: editor.occurrence.occurrenceStart,
        },
        scope,
        patch,
      );
    } else {
      await service.createEvent(input);
    }
    setEditor(null);
    setToast({ message: messages.eventSaved });
  }

  async function deleteEvent(scope: MutationScope) {
    if (!editor?.occurrence) return;
    const previous = service.getDocument();
    await service.deleteEvent(
      {
        eventId: editor.occurrence.eventId,
        occurrenceStart: editor.occurrence.occurrenceStart,
      },
      scope,
    );
    setEditor(null);
    setToast({
      message: messages.eventDeleted,
      undo: () => {
        service.restoreDocument(previous);
        setToast({ message: messages.app.deletionUndone });
      },
    });
  }

  async function importFile(file: File) {
    if (
      document.events.length > 0 &&
      !window.confirm(messages.app.importReplaceConfirm)
    ) {
      return;
    }
    try {
      service.importJson(await file.text());
      setToast({ message: messages.importSuccess });
    } catch {
      setToast({ message: messages.importFailure });
    }
  }

  return (
    <I18nProvider locale={CALENDAR_LOCALE}>
      <main className={styles.pageShell}>
        <CalendarHeader
          view={view}
          periodLabel={periodLabel(view, anchorDate)}
          query={query}
          results={searchResults}
          locale={CALENDAR_LOCALE}
          viewerTimeZone={browser.timeZone}
          theme={preferences.theme}
          onPrevious={() => navigate(-1)}
          onNext={() => navigate(1)}
          onToday={goToday}
          onViewChange={changeView}
          onQueryChange={setQuery}
          onSelectResult={(occurrence) =>
            openOccurrence(occurrence, occurrence.dateKeys[0])
          }
          onAdd={() =>
            openCreate({
              dateKey: selectedDate,
              startTime: nextHalfHour(browser.timeZone),
            })
          }
          onCycleTheme={cycleTheme}
          onExport={() => downloadJson(service.exportJson())}
          onImport={(file) => void importFile(file)}
        />

        <div className={styles.calendarWorkspace} aria-label={messages.app.calendarLabel}>
          {view === "week" ? (
            <WeekView
              from={visibleRange.from}
              to={visibleRange.to}
              groups={groups}
              selectedDate={selectedDate}
              today={browser.today}
              locale={CALENDAR_LOCALE}
              viewerTimeZone={browser.timeZone}
              onSelectDate={selectDate}
              onAdd={openCreate}
              onEdit={openEdit}
            />
          ) : (
            <MonthView
              from={visibleRange.from}
              to={visibleRange.to}
              monthKey={anchorDate.slice(0, 7)}
              groups={groups}
              selectedDate={selectedDate}
              today={browser.today}
              locale={CALENDAR_LOCALE}
              viewerTimeZone={browser.timeZone}
              onSelectDate={selectDate}
              onAdd={openCreate}
              onEdit={openEdit}
            />
          )}
        </div>
      </main>

      {editor ? (
        <EventEditor
          key={`${editor.occurrence?.key ?? "new"}:${editor.seed.dateKey}:${editor.seed.startTime ?? ""}`}
          seed={editor.seed}
          viewerTimeZone={browser.timeZone}
          occurrence={editor.occurrence}
          seriesEvent={editor.seriesEvent}
          onClose={() => setEditor(null)}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      ) : null}

      {toast ? (
        <div className={styles.toast} role="status">
          <span>{toast.message}</span>
          {toast.undo ? (
            <button type="button" onClick={toast.undo}>
              {messages.undo}
            </button>
          ) : null}
          <button
            type="button"
            aria-label={messages.app.dismissMessage}
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      ) : null}
    </I18nProvider>
  );
}
