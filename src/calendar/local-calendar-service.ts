import { CalendarDocumentEngine } from "./calendar-document-engine";
import { createDevelopmentFixtures } from "./fixtures";
import {
  EVENTS_STORAGE_KEY,
  loadCalendarDocument,
  parseCalendarImport,
  serializeCalendarExport,
  type StorageLike,
} from "./storage";
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
  recoveredCorruptData: boolean;
  storageAvailable: boolean;
}

export class LocalCalendarService implements CalendarService {
  private readonly engine: CalendarDocumentEngine;
  private readonly listeners = new Set<Listener>();
  private listeningForStorage = false;
  private readonly onStorage = (event: StorageEvent) => {
    if (event.key !== EVENTS_STORAGE_KEY || !event.newValue) return;
    try {
      const incoming = loadCalendarDocument(
        {
          getItem: () => event.newValue,
          setItem: () => undefined,
          removeItem: () => undefined,
        },
        [],
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
    document: CalendarDocument,
    viewerTimeZone: string,
  ) {
    this.engine = new CalendarDocumentEngine(document, viewerTimeZone);
  }

  static open(viewerTimeZone: string): ServiceOpenResult {
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
    const loaded = loadCalendarDocument(storage, seedEvents);
    return {
      service: new LocalCalendarService(
        storage,
        loaded.document,
        viewerTimeZone,
      ),
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
        this.storage?.setItem(EVENTS_STORAGE_KEY, JSON.stringify(next));
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
