import { CalendarDocumentEngine } from "./calendar-document-engine";
import { createDevelopmentFixtures } from "./fixtures";
import {
  EVENTS_STORAGE_KEY,
  loadCalendarDocument,
  parseCalendarImport,
  serializeCalendarExport,
  type StorageLike,
} from "./storage";
import { scopedStorageKey } from "@/lib/scoped-storage";
import type {
  CalendarDocument,
  CalendarRange,
  CalendarService,
  EventInput,
  EventPatch,
  EventRecord,
  MutationScope,
  Occurrence,
  OccurrenceTarget,
} from "./types";

type Listener = (document: CalendarDocument) => void;

export interface ServiceOpenResult {
  service: LocalCalendarService;
  legacyCalendarAvailable: boolean;
  recoveredCorruptData: boolean;
  storageAvailable: boolean;
}

export class LocalCalendarService implements CalendarService {
  private readonly engine: CalendarDocumentEngine;
  private readonly listeners = new Set<Listener>();
  private listeningForStorage = false;
  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== this.storageKey || !event.newValue) return;
    try {
      const incoming = loadCalendarDocument(
        {
          getItem: () => event.newValue,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
        [],
        new Date(),
        this.storageKey,
      ).document;
      const current = this.engine.getDocument();
      const isNewer =
        incoming.revision > current.revision ||
        (incoming.revision === current.revision &&
          incoming.updatedAt > current.updatedAt);
      if (isNewer) {
        this.engine.adoptDocument(incoming);
        this.emit();
      }
    } catch {
      // Ignore malformed writes from another tab; the valid local copy remains.
    }
  };

  private constructor(
    private readonly storage: StorageLike | null,
    private readonly storageKey: string,
    document: CalendarDocument,
    viewerTimeZone: string,
  ) {
    this.engine = new CalendarDocumentEngine(document, viewerTimeZone);
  }

  static open(viewerTimeZone: string, userId: string): ServiceOpenResult {
    let storage: StorageLike | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    const seedEvents =
      process.env.NODE_ENV === "development"
        ? createDevelopmentFixtures(viewerTimeZone)
        : [];
    const storageKey = scopedStorageKey(EVENTS_STORAGE_KEY, userId);
    let legacyCalendarAvailable = false;
    try {
      legacyCalendarAvailable = storage?.getItem(EVENTS_STORAGE_KEY) !== null;
    } catch {
      // The regular load below reports storage availability.
    }
    const loaded = loadCalendarDocument(
      storage,
      seedEvents,
      new Date(),
      storageKey,
    );
    return {
      service: new LocalCalendarService(
        storage,
        storageKey,
        loaded.document,
        viewerTimeZone,
      ),
      legacyCalendarAvailable,
      recoveredCorruptData: loaded.recoveredCorruptData,
      storageAvailable: loaded.storageAvailable,
    };
  }

  getDocument(): CalendarDocument {
    return this.engine.getDocument();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.startStorageListener();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopStorageListener();
    };
  }

  dispose(): void {
    this.stopStorageListener();
    this.listeners.clear();
  }

  async listOccurrences(range: CalendarRange): Promise<Occurrence[]> {
    return this.engine.listOccurrences(range);
  }

  async listEventRecords(): Promise<EventRecord[]> {
    return this.engine.listEventRecords();
  }

  async setEventReminders(
    eventIds: string[],
    reminderMinutesBefore: number | undefined,
  ): Promise<void> {
    this.runMutation(() =>
      this.engine.setEventReminders(eventIds, reminderMinutesBefore),
    );
  }

  async createEvent(input: EventInput): Promise<EventRecord> {
    return this.runMutation(() => this.engine.createEvent(input));
  }

  async updateEvent(
    target: OccurrenceTarget,
    scope: MutationScope,
    patch: EventPatch,
  ): Promise<void> {
    this.runMutation(() => this.engine.updateEvent(target, scope, patch));
  }

  async deleteEvent(
    target: OccurrenceTarget,
    scope: MutationScope,
  ): Promise<void> {
    this.runMutation(() => this.engine.deleteEvent(target, scope));
  }

  replaceDocument(document: CalendarDocument): void {
    this.runMutation(() => this.engine.replaceEvents(document.events));
  }

  restoreDocument(document: CalendarDocument): void {
    this.runMutation(() => this.engine.replaceEvents(document.events));
  }

  importJson(value: string): void {
    this.replaceDocument(parseCalendarImport(value));
  }

  exportJson(): string {
    return serializeCalendarExport(this.engine.getDocument());
  }

  importLegacyCalendar(): boolean {
    if (!this.storage) return false;
    let document: CalendarDocument;
    try {
      const raw = this.storage.getItem(EVENTS_STORAGE_KEY);
      if (!raw) return false;
      document = parseCalendarImport(raw);
    } catch {
      return false;
    }

    const previous = this.engine.getDocument();
    this.engine.replaceEvents(document.events);
    const next = this.engine.getDocument();
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(next));
    } catch {
      this.engine.adoptDocument(previous);
      return false;
    }
    try {
      this.storage.removeItem(EVENTS_STORAGE_KEY);
    } catch {
      // The scoped copy is durable; keep the legacy copy available for recovery.
    }
    this.emit();
    return true;
  }

  private startStorageListener(): void {
    if (this.listeningForStorage || typeof window === "undefined") return;
    window.addEventListener("storage", this.onStorage);
    this.listeningForStorage = true;
  }

  private stopStorageListener(): void {
    if (!this.listeningForStorage || typeof window === "undefined") return;
    window.removeEventListener("storage", this.onStorage);
    this.listeningForStorage = false;
  }

  private runMutation<Result>(mutate: () => Result): Result {
    const previous = this.engine.getDocument();
    const result = mutate();
    const next = this.engine.getDocument();
    if (next !== previous) {
      try {
        this.storage?.setItem(this.storageKey, JSON.stringify(next));
      } catch {
        // The in-memory copy remains usable when storage is blocked or full.
      }
      this.emit();
    }
    return result;
  }

  private emit(): void {
    const document = this.engine.getDocument();
    for (const listener of this.listeners) listener(document);
  }
}
