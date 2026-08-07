"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { I18nProvider } from "react-aria-components";

import {
  buildTimeline,
  filterOccurrences,
  groupOccupiedDates,
  nextOccupiedDate,
} from "@/calendar/agenda";
import { addDays, monthRange, todayKey } from "@/calendar/date-time";
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
  EventInput,
  EventPatch,
  EventRecord,
  EventSegment,
  MutationScope,
  Occurrence,
  PreferencesDocument,
  ThemePreference,
} from "@/calendar/types";

import { AgendaHeader } from "./agenda-header";
import { AgendaTimeline } from "./agenda-timeline";
import { EventEditor } from "./event-editor";
import styles from "./agenda.module.css";

interface BrowserContext {
  locale: string;
  timeZone: string;
  today: string;
}

interface EditorTarget {
  dateKey: string;
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

interface NavigatorCoverage {
  revision: number;
  dates: Set<string>;
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

function scrollToDate(dateKey: string, behavior: ScrollBehavior = "smooth"): boolean {
  const target = document.getElementById(`date-${dateKey}`);
  if (!target) return false;
  target.scrollIntoView({ behavior, block: "start" });
  return true;
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

function AgendaSkeleton() {
  return (
    <main className={styles.pageShell} aria-label={messages.app.loadingLabel}>
      <section className={`${styles.appFrame} ${styles.skeletonFrame}`}>
        <header className={styles.appHeader}>
          <div className={styles.wordmark}>
            {messages.appName}
            <span>.</span>
          </div>
          <div className={styles.skeletonMonth} />
          <div className={styles.skeletonActions}>
            <i />
            <i />
            <i />
          </div>
        </header>
        <div className={styles.agendaHeading}>
          <div>
            <p className={styles.eyebrow}>{messages.app.eventOnlyEyebrow}</p>
            <h1>{messages.agendaHeading}</h1>
          </div>
        </div>
        <div className={styles.skeletonDate}>
          <span />
          <div>
            <i />
            <i />
          </div>
        </div>
      </section>
    </main>
  );
}

export function AgendaApp() {
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  return hydrated ? <HydratedAgenda /> : <AgendaSkeleton />;
}

function createBrowserSession(): BrowserSession {
  const locale = navigator.language || "en";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = todayKey(timeZone);
  const opened = LocalCalendarService.open(timeZone);
  const notice = opened.recoveredCorruptData
    ? { message: messages.corruptRecovery }
    : !opened.storageAvailable
      ? { message: messages.storageUnavailable }
      : null;
  return {
    browser: { locale, timeZone, today },
    service: opened.service,
    preferences: loadPreferences(safeStorage()),
    notice,
  };
}

function HydratedAgenda() {
  const [session] = useState(createBrowserSession);
  const { browser, service } = session;
  const [document, setDocument] = useState<CalendarDocument>(() =>
    service.getDocument(),
  );
  const [range, setRange] = useState<CalendarRange>({
    from: addDays(browser.today, -90),
    to: addDays(browser.today, 180),
  });
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [query, setQuery] = useState("");
  const [visibleDate, setVisibleDate] = useState(browser.today);
  const [selectedDate, setSelectedDate] = useState(browser.today);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [toast, setToast] = useState<ToastState | null>(session.notice);
  const [preferences, setPreferences] = useState<PreferencesDocument>(
    session.preferences,
  );
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);
  const [navigatorCoverage, setNavigatorCoverage] =
    useState<NavigatorCoverage>({
      revision: document.revision,
      dates: new Set(),
    });
  const initialScrollDone = useRef(false);
  const loadedNavigatorMonths = useRef(new Set<string>());

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
        // A malformed preference from another tab must not disrupt this tab.
      }
    }
    window.addEventListener("storage", syncPreferences);
    return () => window.removeEventListener("storage", syncPreferences);
  }, []);

  const shownOccurrences = useMemo(
    () => filterOccurrences(occurrences, query, browser.today),
    [browser.today, occurrences, query],
  );
  const groups = useMemo(
    () => groupOccupiedDates(shownOccurrences),
    [shownOccurrences],
  );
  const timeline = useMemo(
    () => buildTimeline(groups, browser.today),
    [browser.today, groups],
  );
  const occupiedDates = useMemo(
    () => {
      const dates = new Set(
        occurrences.flatMap((occurrence) => occurrence.dateKeys),
      );
      if (navigatorCoverage.revision === document.revision) {
        navigatorCoverage.dates.forEach((dateKey) => dates.add(dateKey));
      }
      return dates;
    }, [document.revision, navigatorCoverage, occurrences],
  );
  const activeDate = nextOccupiedDate(groups, browser.today);

  useEffect(() => {
    if (initialScrollDone.current || occurrences.length === 0) return;
    initialScrollDone.current = true;
    requestAnimationFrame(() => {
      const foundToday = scrollToDate(browser.today, "auto");
      if (!foundToday && activeDate) scrollToDate(activeDate, "auto");
    });
  }, [activeDate, browser.today, occurrences.length]);

  useEffect(() => {
    if (!pendingScroll) return;
    requestAnimationFrame(() => {
      if (scrollToDate(pendingScroll)) setPendingScroll(null);
    });
  }, [occurrences, pendingScroll]);

  const handleVisibleDateChange = useCallback((dateKey: string) => {
    setVisibleDate(dateKey);
  }, []);

  const currentBrowser = browser;
  const calendarService = service;
  const calendarDocument = document;
  const currentRange = range;

  function openCreate(dateKey = currentBrowser.today) {
    setEditor({ dateKey, occurrence: null, seriesEvent: null });
  }

  function openEdit(segment: EventSegment) {
    const occurrence = segment.occurrence;
    const seriesEvent = occurrence.record.seriesId
      ? calendarDocument.events.find(
          (event) => event.id === occurrence.record.seriesId,
        ) ?? null
      : occurrence.record.recurrence
        ? occurrence.record
        : null;
    setEditor({ dateKey: segment.dateKey, occurrence, seriesEvent });
  }

  async function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setVisibleDate(dateKey);
    const outsideRange = dateKey < currentRange.from || dateKey > currentRange.to;
    const matches = await calendarService.listOccurrences({ from: dateKey, to: dateKey });
    if (matches.length) {
      if (outsideRange) {
        setRange({ from: addDays(dateKey, -90), to: addDays(dateKey, 180) });
        setPendingScroll(dateKey);
      } else {
        requestAnimationFrame(() => scrollToDate(dateKey));
      }
      return;
    }
    openCreate(dateKey);
  }

  async function loadNavigatorMonth(dateKey: string) {
    const revision = calendarDocument.revision;
    const monthKey = `${revision}:${dateKey.slice(0, 7)}`;
    if (loadedNavigatorMonths.current.has(monthKey)) return;
    loadedNavigatorMonths.current.add(monthKey);
    const matches = await calendarService.listOccurrences(monthRange(dateKey));
    if (calendarService.getDocument().revision !== revision) return;
    setNavigatorCoverage((current) => {
      const dates =
        current.revision === revision ? new Set(current.dates) : new Set<string>();
      matches.forEach((occurrence) => {
        occurrence.dateKeys.forEach((occupiedDate) => dates.add(occupiedDate));
      });
      return { revision, dates };
    });
  }

  function goToday() {
    setQuery("");
    setSelectedDate(currentBrowser.today);
    setVisibleDate(currentBrowser.today);
    if (
      currentBrowser.today < currentRange.from ||
      currentBrowser.today > currentRange.to
    ) {
      setRange({
        from: addDays(currentBrowser.today, -90),
        to: addDays(currentBrowser.today, 180),
      });
      setPendingScroll(currentBrowser.today);
    } else {
      requestAnimationFrame(() => {
        if (!scrollToDate(currentBrowser.today) && activeDate) {
          scrollToDate(activeDate);
        }
      });
    }
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
        recurrencePatched &&
        base?.recurrence?.rrule !== patch.recurrence?.rrule;
      const hasExceptions = Boolean(
        base &&
          (base.recurrence?.excludedStarts.length ||
            calendarDocument.events.some((event) => event.seriesId === base.id)),
      );
      if (
        recurrenceChanged &&
        hasExceptions &&
        scope !== "occurrence" &&
        !window.confirm(messages.app.recurrenceExceptionConfirm)
      ) {
        throw new Error(messages.app.recurrenceChangeCancelled);
      }
      await calendarService.updateEvent(
        {
          eventId: editor.occurrence.eventId,
          occurrenceStart: editor.occurrence.occurrenceStart,
        },
        scope,
        patch,
      );
    } else {
      await calendarService.createEvent(input);
    }
    setEditor(null);
    setToast({ message: messages.eventSaved });
  }

  async function deleteEvent(scope: MutationScope) {
    if (!editor?.occurrence) return;
    const previous = calendarService.getDocument();
    await calendarService.deleteEvent(
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
        calendarService.restoreDocument(previous);
        setToast({ message: messages.app.deletionUndone });
      },
    });
  }

  async function importFile(file: File) {
    if (
      calendarDocument.events.length > 0 &&
      !window.confirm(messages.app.importReplaceConfirm)
    ) {
      return;
    }
    try {
      calendarService.importJson(await file.text());
      setToast({ message: messages.importSuccess });
    } catch {
      setToast({ message: messages.importFailure });
    }
  }

  return (
    <I18nProvider locale={currentBrowser.locale}>
      <main className={styles.pageShell}>
        <section className={styles.appFrame} aria-label={messages.app.agendaLabel}>
          <AgendaHeader
            visibleDate={visibleDate}
            selectedDate={selectedDate}
            locale={currentBrowser.locale}
            occupiedDates={occupiedDates}
            query={query}
            theme={preferences.theme}
            onQueryChange={setQuery}
            onSelectDate={(dateKey) => void selectDate(dateKey)}
            onCalendarFocusChange={(dateKey) =>
              void loadNavigatorMonth(dateKey)
            }
            onToday={goToday}
            onAdd={() => openCreate()}
            onCycleTheme={cycleTheme}
            onExport={() => downloadJson(calendarService.exportJson())}
            onImport={(file) => void importFile(file)}
          />
          <AgendaTimeline
            groups={groups}
            timeline={timeline}
            activeDate={activeDate}
            today={currentBrowser.today}
            locale={currentBrowser.locale}
            viewerTimeZone={currentBrowser.timeZone}
            query={query}
            onVisibleDateChange={handleVisibleDateChange}
            onEdit={openEdit}
            onAdd={openCreate}
            onEarlier={() =>
              setRange((current) =>
                current
                  ? { ...current, from: addDays(current.from, -180) }
                  : current,
              )
            }
            onLater={() =>
              setRange((current) =>
                current
                  ? { ...current, to: addDays(current.to, 180) }
                  : current,
              )
            }
          />
        </section>
      </main>

      {editor ? (
        <EventEditor
          key={`${editor.occurrence?.key ?? "new"}:${editor.dateKey}`}
          dateKey={editor.dateKey}
          viewerTimeZone={currentBrowser.timeZone}
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
