"use client";

import {
  useEffect,
  useMemo,
  useRef,
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
import type { UserSettings } from "@/calendar/settings";
import { saveThemePreference } from "@/calendar/storage";
import {
  applyTheme,
  DARK_SCHEME_QUERY,
  resolveTheme,
  type ResolvedTheme,
} from "@/calendar/theme";
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
  ThemePreference,
} from "@/calendar/types";
import { filterOccurrences, groupOccupiedDates } from "@/calendar/view-model";
import { SerialTaskQueue } from "@/lib/serial-task-queue";

import { CalendarBrand, CalendarHeader } from "./calendar-header";
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
  importLegacy?: boolean;
  undo?: () => void;
}

type NavDirection = "next" | "previous" | "none";

interface BrowserSession {
  browser: BrowserContext;
  service: LocalCalendarService;
  notice: ToastState | null;
}

function subscribeToSystemTheme(callback: () => void) {
  const media = window.matchMedia(DARK_SCHEME_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSystemDarkSnapshot() {
  return window.matchMedia(DARK_SCHEME_QUERY).matches;
}

function getServerSystemDarkSnapshot() {
  return false;
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
    <div className={styles.pageShell} aria-label={messages.app.loadingLabel}>
      <header className={styles.appHeader}>
        <CalendarBrand />
        <div className={styles.skeletonPeriod} />
        <div className={styles.skeletonActions} />
      </header>
      <main className={styles.calendarStage}>
        <div className={styles.calendarCard}>
          <div className={styles.skeletonCalendar} />
        </div>
      </main>
    </div>
  );
}

function createBrowserSession(userId: string): BrowserSession {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = todayKey(timeZone);
  const opened = LocalCalendarService.open(timeZone, userId);
  let notice: ToastState | null = null;
  if (opened.recoveredCorruptData) {
    notice = { message: messages.corruptRecovery };
  } else if (!opened.storageAvailable) {
    notice = { message: messages.storageUnavailable };
  } else if (opened.legacyCalendarAvailable) {
    notice = { message: messages.legacyCalendarFound, importLegacy: true };
  }
  return {
    browser: { timeZone, today },
    service: opened.service,
    notice,
  };
}

export function CalendarApp({
  initialSettings,
  userId,
}: {
  initialSettings: UserSettings;
  userId: string;
}) {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  return hydrated ? (
    <HydratedCalendar initialSettings={initialSettings} userId={userId} />
  ) : (
    <CalendarSkeleton />
  );
}

function HydratedCalendar({
  initialSettings,
  userId,
}: {
  initialSettings: UserSettings;
  userId: string;
}) {
  const [session] = useState(() => createBrowserSession(userId));
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
  const [settings, setSettings] = useState(initialSettings);
  const persistedTheme = useRef(initialSettings.theme);
  const themeSaveQueue = useRef(new SerialTaskQueue());
  const themeRequestSequence = useRef(0);
  const [navDirection, setNavDirection] = useState<NavDirection>("none");
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemDarkSnapshot,
    getServerSystemDarkSnapshot,
  );
  const resolvedTheme: ResolvedTheme = resolveTheme(settings.theme, systemDark);

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
    applyTheme(settings.theme, resolvedTheme);
  }, [settings.theme, resolvedTheme]);

  // Settings can change on the settings page, in another tab, or through Eve.
  useEffect(() => {
    async function refresh() {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) return;
        const { settings: next } = (await response.json()) as {
          settings: UserSettings;
        };
        persistedTheme.current = next.theme;
        setSettings(next);
        saveThemePreference(safeStorage(), next.theme);
      } catch {
        // A failed refresh just leaves the settings loaded with the page.
      }
    }
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
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
    setNavDirection("none");
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
    setNavDirection(direction === 1 ? "next" : "previous");
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
    setNavDirection(
      browser.today === anchorDate
        ? "none"
        : browser.today > anchorDate
          ? "next"
          : "previous",
    );
    setAnchorDate(browser.today);
    setSelectedDate(browser.today);
    ensureCoverage(view, browser.today);
  }

  function changeView(nextView: CalendarView) {
    setNavDirection("none");
    setView(nextView);
    setAnchorDate(selectedDate);
    ensureCoverage(nextView, selectedDate);
  }

  async function selectTheme(theme: ThemePreference) {
    const sequence = ++themeRequestSequence.current;
    setSettings((current) => ({ ...current, theme }));
    saveThemePreference(safeStorage(), theme);
    try {
      const saved = await themeSaveQueue.current.run(async () => {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ theme }),
        });
        if (!response.ok) throw new Error(messages.settings.saveFailed);
        const payload = (await response.json()) as { settings: UserSettings };
        return payload.settings;
      });
      persistedTheme.current = saved.theme;
      if (sequence !== themeRequestSequence.current) return;
      setSettings(saved);
      saveThemePreference(safeStorage(), saved.theme);
    } catch {
      if (sequence !== themeRequestSequence.current) return;
      const fallback = persistedTheme.current;
      setSettings((current) => ({ ...current, theme: fallback }));
      saveThemePreference(safeStorage(), fallback);
      setToast({ message: messages.settings.saveFailed });
    }
  }

  function toggleTheme() {
    void selectTheme(resolvedTheme === "dark" ? "light" : "dark");
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

  function importLegacyCalendar() {
    if (
      document.events.length > 0 &&
      !window.confirm(messages.app.importReplaceConfirm)
    ) {
      return;
    }
    const imported = service.importLegacyCalendar();
    setToast({
      message: imported
        ? messages.legacyImportSuccess
        : messages.legacyImportFailure,
    });
  }

  const visibleEventCount = groups.reduce(
    (total, group) => total + group.segments.length,
    0,
  );

  return (
    <I18nProvider locale={CALENDAR_LOCALE}>
      <div className={styles.pageShell}>
        <CalendarHeader
          view={view}
          periodLabel={periodLabel(view, anchorDate)}
          query={query}
          results={searchResults}
          locale={CALENDAR_LOCALE}
          viewerTimeZone={browser.timeZone}
          theme={settings.theme}
          resolvedTheme={resolvedTheme}
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
          onToggleTheme={toggleTheme}
          onSelectTheme={selectTheme}
          onExport={() => downloadJson(service.exportJson())}
          onImport={(file) => void importFile(file)}
        />

        <main className={styles.calendarStage}>
          <section
            className={styles.calendarCard}
            aria-label={messages.app.calendarLabel}
          >
            <div
              key={`${view}:${visibleRange.from}`}
              className={styles.calendarWorkspace}
              data-direction={navDirection}
            >
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
          </section>
        </main>

        <footer className={styles.pageFooter}>
          <span>{messages.footer.eventsInView(visibleEventCount)}</span>
          <span className={styles.footerMeta}>
            {messages.footer.meta(browser.timeZone)}
          </span>
        </footer>
      </div>

      {editor ? (
        <EventEditor
          key={`${editor.occurrence?.key ?? "new"}:${editor.seed.dateKey}:${editor.seed.startTime ?? ""}`}
          seed={editor.seed}
          viewerTimeZone={browser.timeZone}
          defaults={settings}
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
          {toast.importLegacy ? (
            <button type="button" onClick={importLegacyCalendar}>
              {messages.importLegacy}
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
