"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { ZodError } from "zod";

import {
  addDays,
  dateValueFromZoned,
  localDateTimeToZoned,
  timeValueFromZoned,
  timezoneFromZoned,
} from "@/calendar/date-time";
import { messages } from "@/calendar/messages";
import {
  MAX_REMINDER_MINUTES,
  REMINDER_MINUTES_PER_UNIT,
  reminderChoiceFor,
  reminderChoiceMinutes,
  type ReminderPreset,
  type ReminderUnit,
} from "@/calendar/reminders";
import { RRule } from "@/calendar/rrule-package";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/calendar/settings";
import { eventInputSchema } from "@/calendar/schemas";
import {
  EVENT_COLORS,
  type EditorSeed,
  type EventColor,
  type EventInput,
  type EventPatch,
  type EventRecord,
  type MutationScope,
  type Occurrence,
} from "@/calendar/types";

import { CloseIcon } from "./icons";
import styles from "./calendar.module.css";

/** Matches the dialog exit animation in calendar.module.css. */
const EXIT_ANIMATION_MS = 160;

type RepeatPreset =
  | "never"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly-date"
  | "monthly-ordinal"
  | "yearly"
  | "custom";
type RecurrenceEnd = "never" | "date" | "count";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type TimedEndMode = "end-time" | "duration";

interface EditorForm {
  title: string;
  allDay: boolean;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timedEndMode: TimedEndMode;
  durationMinutes: string;
  timeZone: string;
  repeatPreset: RepeatPreset;
  interval: string;
  frequency: Frequency;
  weekdays: string[];
  recurrenceEnd: RecurrenceEnd;
  untilDate: string;
  occurrenceCount: string;
  location: string;
  notes: string;
  color: EventColor;
  reminder: ReminderPreset;
  reminderAmount: string;
  reminderUnit: ReminderUnit;
}

interface EventEditorProps {
  seed: EditorSeed;
  viewerTimeZone: string;
  /** Seeds a new event; an existing event always keeps its own values. */
  defaults?: UserSettings;
  occurrence: Occurrence | null;
  seriesEvent: EventRecord | null;
  onClose(): void;
  onSave(
    input: EventInput,
    scope: MutationScope,
    patch: EventPatch,
  ): Promise<void>;
  onDelete(scope: MutationScope): Promise<void>;
}

interface PendingAction {
  kind: "save" | "delete";
  input?: EventInput;
  patch?: EventPatch;
}

const editorMessages = messages.editor;

const WEEKDAYS = [
  ["MO", editorMessages.weekdayMonday],
  ["TU", editorMessages.weekdayTuesday],
  ["WE", editorMessages.weekdayWednesday],
  ["TH", editorMessages.weekdayThursday],
  ["FR", editorMessages.weekdayFriday],
  ["SA", editorMessages.weekdaySaturday],
  ["SU", editorMessages.weekdaySunday],
] as const;

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function addMinutesToTime(value: string, minutes: number): string {
  const total = (minutesFromTime(value) + minutes) % 1_440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

function defaultStartTime(now = new Date()): string {
  const rounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  const safe = rounded >= 1_440 ? 9 * 60 : rounded;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60,
  ).padStart(2, "0")}`;
}

function weekdayCode(dateKey: string): string {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][day];
}

function daysInMonth(dateKey: string): number {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function customReminderValue(minutes: number | undefined): {
  reminder: ReminderPreset;
  reminderAmount: string;
  reminderUnit: ReminderUnit;
} {
  const { preset, amount, unit } = reminderChoiceFor(minutes);
  return { reminder: preset, reminderAmount: amount, reminderUnit: unit };
}

function reminderMinutesFromForm(form: EditorForm): number | undefined {
  return reminderChoiceMinutes({
    preset: form.reminder,
    amount: form.reminderAmount,
    unit: form.reminderUnit,
  });
}

function recurrencePreset(rrule?: string): RepeatPreset {
  if (!rrule) return "never";
  const source = rrule.replace(/^RRULE:/, "");
  if (source.includes("FREQ=DAILY")) return "daily";
  if (
    source.includes("FREQ=WEEKLY") &&
    source.includes("BYDAY=MO,TU,WE,TH,FR")
  ) {
    return "weekdays";
  }
  if (source.includes("FREQ=WEEKLY")) return "weekly";
  if (/BYDAY=-?\d/.test(source)) return "monthly-ordinal";
  if (source.includes("FREQ=MONTHLY")) return "monthly-date";
  if (source.includes("FREQ=YEARLY")) return "yearly";
  return "custom";
}

function ruleValue(rrule: string | undefined, name: string): string | undefined {
  return rrule
    ?.replace(/^RRULE:/, "")
    .split(";")
    .find((part) => part.startsWith(`${name}=`))
    ?.split("=")[1];
}

function initialForm(
  seed: EditorSeed,
  viewerTimeZone: string,
  occurrence: Occurrence | null,
  seriesEvent: EventRecord | null,
  defaults: UserSettings,
): EditorForm {
  const record = occurrence?.record;
  const timing = occurrence?.timing;
  const recurringRecord = seriesEvent ?? record;
  const rrule = recurringRecord?.recurrence?.rrule;
  const startTime =
    timing?.kind === "timed"
      ? timeValueFromZoned(timing.startsAt)
      : (seed.startTime ?? defaultStartTime());
  const startDate =
    timing?.kind === "timed"
      ? dateValueFromZoned(timing.startsAt)
      : timing?.kind === "all-day"
        ? timing.startDate
        : seed.dateKey;
  const until = ruleValue(rrule, "UNTIL");
  const byday = ruleValue(rrule, "BYDAY")?.split(",") ?? [weekdayCode(startDate)];
  const frequency = (ruleValue(rrule, "FREQ") ?? "WEEKLY") as Frequency;
  const reminder = customReminderValue(
    record
      ? record.reminderMinutesBefore
      : (defaults.defaultReminderMinutes ?? undefined),
  );

  return {
    title: record?.title ?? "",
    allDay: timing?.kind === "all-day",
    date: startDate,
    endDate:
      timing?.kind === "all-day" ? addDays(timing.endDateExclusive, -1) : startDate,
    startTime,
    endTime:
      timing?.kind === "timed"
        ? addMinutesToTime(startTime, timing.durationMinutes)
        : addMinutesToTime(startTime, defaults.defaultDurationMinutes),
    timedEndMode:
      timing?.kind === "timed" && timing.durationMinutes > 1_440
        ? "duration"
        : "end-time",
    durationMinutes:
      timing?.kind === "timed"
        ? String(timing.durationMinutes)
        : String(defaults.defaultDurationMinutes),
    timeZone:
      timing?.kind === "timed" ? timezoneFromZoned(timing.startsAt) : viewerTimeZone,
    repeatPreset: recurrencePreset(rrule),
    interval: ruleValue(rrule, "INTERVAL") ?? "1",
    frequency,
    weekdays: byday.filter((day) => WEEKDAYS.some(([code]) => code === day)),
    recurrenceEnd: ruleValue(rrule, "COUNT")
      ? "count"
      : until
        ? "date"
        : "never",
    untilDate: until
      ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`
      : addDays(startDate, 30),
    occurrenceCount: ruleValue(rrule, "COUNT") ?? "10",
    location: record?.location ?? "",
    notes: record?.notes ?? "",
    color: record?.color ?? defaults.defaultColor,
    ...reminder,
  };
}

function monthlyOrdinal(dateKey: string): number {
  const day = Number(dateKey.slice(-2));
  return day + 7 > daysInMonth(dateKey) ? -1 : Math.ceil(day / 7);
}

function recurrenceRule(form: EditorForm): string | null {
  if (form.repeatPreset === "never") return null;
  const interval = Math.max(1, Number(form.interval) || 1);
  const day = Number(form.date.slice(-2));
  const month = Number(form.date.slice(5, 7));
  const selectedDays = form.weekdays.length
    ? form.weekdays
    : [weekdayCode(form.date)];
  const parts: string[] = [];

  switch (form.repeatPreset) {
    case "daily":
      parts.push("FREQ=DAILY");
      break;
    case "weekdays":
      parts.push("FREQ=WEEKLY", "BYDAY=MO,TU,WE,TH,FR");
      break;
    case "weekly":
      parts.push("FREQ=WEEKLY", `BYDAY=${selectedDays.join(",")}`);
      break;
    case "monthly-date":
      parts.push("FREQ=MONTHLY", `BYMONTHDAY=${day}`);
      break;
    case "monthly-ordinal":
      parts.push(
        "FREQ=MONTHLY",
        `BYDAY=${monthlyOrdinal(form.date)}${weekdayCode(form.date)}`,
      );
      break;
    case "yearly":
      parts.push("FREQ=YEARLY", `BYMONTH=${month}`, `BYMONTHDAY=${day}`);
      break;
    case "custom":
      parts.push(`FREQ=${form.frequency}`);
      if (form.frequency === "WEEKLY") {
        parts.push(`BYDAY=${selectedDays.join(",")}`);
      }
      if (form.frequency === "MONTHLY") parts.push(`BYMONTHDAY=${day}`);
      if (form.frequency === "YEARLY") {
        parts.push(`BYMONTH=${month}`, `BYMONTHDAY=${day}`);
      }
      break;
  }

  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  if (form.recurrenceEnd === "date") {
    if (form.untilDate < form.date) {
      throw new Error(editorMessages.repeatEndError);
    }
    parts.push(`UNTIL=${form.untilDate.replaceAll("-", "")}T235959Z`);
  }
  if (form.recurrenceEnd === "count") {
    parts.push(`COUNT=${Math.max(1, Number(form.occurrenceCount) || 1)}`);
  }

  const rule = parts.join(";");
  RRule.parseString(rule);
  return rule;
}

function buildEventInput(
  form: EditorForm,
  existingRecurrence: EventRecord["recurrence"],
): EventInput {
  const rrule = recurrenceRule(form);
  let timing: EventInput["timing"];
  if (form.allDay) {
    timing = {
      kind: "all-day",
      startDate: form.date,
      endDateExclusive: addDays(form.endDate, 1),
    };
  } else {
    let durationMinutes: number;
    if (form.timedEndMode === "duration") {
      durationMinutes = Number(form.durationMinutes);
    } else {
      const start = minutesFromTime(form.startTime);
      let end = minutesFromTime(form.endTime);
      if (end <= start) end += 1_440;
      durationMinutes = end - start;
    }
    timing = {
      kind: "timed",
      startsAt: localDateTimeToZoned(form.date, form.startTime, form.timeZone),
      durationMinutes,
    };
  }

  return eventInputSchema.parse({
    title: form.title,
    timing,
    recurrence: rrule
      ? {
          rrule,
          excludedStarts:
            existingRecurrence?.rrule === rrule
              ? existingRecurrence.excludedStarts
              : [],
        }
      : null,
    location: form.location.trim() || undefined,
    notes: form.notes.trim() || undefined,
    color: form.color,
    reminderMinutesBefore: reminderMinutesFromForm(form),
  });
}

function buildEventPatch(initial: EventInput, next: EventInput): EventPatch {
  const patch: EventPatch = {};
  if (initial.title !== next.title) patch.title = next.title;
  if (JSON.stringify(initial.timing) !== JSON.stringify(next.timing)) {
    patch.timing = next.timing;
  }
  if (JSON.stringify(initial.recurrence) !== JSON.stringify(next.recurrence)) {
    patch.recurrence = next.recurrence;
  }
  if (initial.location !== next.location) patch.location = next.location;
  if (initial.notes !== next.notes) patch.notes = next.notes;
  if (initial.color !== next.color) patch.color = next.color;
  if (initial.reminderMinutesBefore !== next.reminderMinutesBefore) {
    patch.reminderMinutesBefore = next.reminderMinutesBefore;
  }
  return patch;
}

function timeZoneOptions(current: string): string[] {
  const common = [
    current,
    "UTC",
    "America/Argentina/Buenos_Aires",
    "America/Los_Angeles",
    "America/New_York",
    "Europe/London",
    "Europe/Madrid",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];
  return [...new Set(common)];
}

function submissionMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
  return error instanceof Error ? error.message : fallback;
}

export function EventEditor({
  seed,
  viewerTimeZone,
  defaults = DEFAULT_USER_SETTINGS,
  occurrence,
  seriesEvent,
  onClose,
  onSave,
  onDelete,
}: EventEditorProps) {
  const initial = useMemo(
    () => initialForm(seed, viewerTimeZone, occurrence, seriesEvent, defaults),
    [defaults, occurrence, seed, seriesEvent, viewerTimeZone],
  );
  const [form, setForm] = useState(initial);
  const [shouldAutoFocus] = useState(() =>
    window.matchMedia("(min-width: 681px)").matches,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(true);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const repeating = Boolean(seriesEvent?.recurrence ?? occurrence?.record.recurrence);
  const isEditing = Boolean(occurrence);
  const overnight =
    !form.allDay &&
    form.timedEndMode === "end-time" &&
    minutesFromTime(form.endTime) <= minutesFromTime(form.startTime);

  function update<K extends keyof EditorForm>(key: K, value: EditorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function toggleTimedEndMode() {
    setForm((current) => {
      if (current.timedEndMode === "end-time") {
        const start = minutesFromTime(current.startTime);
        let end = minutesFromTime(current.endTime);
        if (end <= start) end += 1_440;
        return {
          ...current,
          timedEndMode: "duration",
          durationMinutes: String(end - start),
        };
      }
      const duration = Math.max(1, Number(current.durationMinutes) || 1);
      return {
        ...current,
        timedEndMode: "end-time",
        endTime: addMinutesToTime(current.startTime, duration),
      };
    });
    setError(null);
  }

  function toggleReminderMode() {
    setForm((current) => {
      if (current.reminder === "custom") {
        return { ...current, reminder: "" };
      }
      return {
        ...current,
        reminder: "custom",
        reminderAmount:
          current.reminder || current.reminderAmount || "15",
        reminderUnit: current.reminder ? "minutes" : current.reminderUnit,
      };
    });
    setError(null);
  }

  /**
   * Closing runs through local state so the dialog can play its exit
   * animation before the parent drops it from the tree.
   */
  function close() {
    setOpen(false);
    window.setTimeout(onClose, EXIT_ANIMATION_MS);
  }

  function requestClose() {
    if (dirty && !window.confirm(editorMessages.discardConfirm)) return;
    close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const existingRecurrence =
        seriesEvent?.recurrence ?? occurrence?.record.recurrence ?? null;
      const input = buildEventInput(form, existingRecurrence);
      const patch = isEditing
        ? buildEventPatch(
            buildEventInput(initial, existingRecurrence),
            input,
          )
        : {};
      if (isEditing && repeating) {
        setPending({ kind: "save", input, patch });
        return;
      }
      setSubmitting(true);
      await onSave(input, "series", patch);
      close();
    } catch (submissionError) {
      setError(
        submissionMessage(submissionError, editorMessages.genericSaveError),
      );
      setSubmitting(false);
    }
  }

  async function completePending(scope: MutationScope) {
    if (!pending) return;
    setSubmitting(true);
    try {
      if (pending.kind === "save" && pending.input) {
        await onSave(pending.input, scope, pending.patch ?? {});
      } else {
        await onDelete(scope);
      }
      close();
    } catch (actionError) {
      setError(
        submissionMessage(actionError, editorMessages.genericChangeError),
      );
      setPending(null);
      setSubmitting(false);
    }
  }

  function requestDelete() {
    if (repeating) {
      setPending({ kind: "delete" });
    } else if (window.confirm(editorMessages.deleteConfirm)) {
      setSubmitting(true);
      void onDelete("series")
        .then(close)
        .catch((actionError: unknown) => {
          setError(
            submissionMessage(actionError, editorMessages.genericChangeError),
          );
          setSubmitting(false);
        });
    }
  }

  const showWeekdays =
    form.repeatPreset === "weekly" ||
    (form.repeatPreset === "custom" && form.frequency === "WEEKLY");

  return (
    <ModalOverlay
      isOpen={open}
      isDismissable
      className={styles.modalOverlay}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) requestClose();
      }}
    >
      <Modal className={styles.editorModal}>
        <Dialog
          className={styles.editorDialog}
          aria-label={
            isEditing ? editorMessages.editDialog : editorMessages.addDialog
          }
        >
          <div className={styles.editorHeader}>
            <Heading>
              {isEditing
                ? editorMessages.editHeading
                : editorMessages.newHeading}
            </Heading>
            <Button
              className={styles.closeButton}
              onPress={requestClose}
              aria-label={editorMessages.close}
            >
              <CloseIcon />
            </Button>
          </div>

          <form className={styles.editorForm} onSubmit={submit} noValidate>
            <label className={styles.titleField}>
              <span className={styles.visuallyHidden}>
                {editorMessages.eventTitle}
              </span>
              <input
                autoFocus={shouldAutoFocus}
                required
                maxLength={160}
                value={form.title}
                placeholder={editorMessages.eventTitle}
                onChange={(event) => update("title", event.target.value)}
              />
            </label>

            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(event) => update("allDay", event.target.checked)}
              />
              <span>{editorMessages.allDay}</span>
            </label>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>{editorMessages.date}</span>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(event) => {
                    update("date", event.target.value);
                    if (form.endDate < event.target.value) {
                      update("endDate", event.target.value);
                    }
                  }}
                />
              </label>
              {form.allDay ? (
                <label className={styles.field}>
                  <span>{editorMessages.lastDay}</span>
                  <input
                    type="date"
                    required
                    min={form.date}
                    value={form.endDate}
                    onChange={(event) => update("endDate", event.target.value)}
                  />
                </label>
              ) : (
                <div className={styles.compoundField}>
                  <label className={styles.field}>
                    <span>{editorMessages.starts}</span>
                    <input
                      type="time"
                      required
                      value={form.startTime}
                      onChange={(event) => update("startTime", event.target.value)}
                    />
                  </label>
                  {form.timedEndMode === "end-time" ? (
                    <label className={styles.field}>
                      <span>{editorMessages.ends}</span>
                      <input
                        type="time"
                        required
                        value={form.endTime}
                        onChange={(event) =>
                          update("endTime", event.target.value)
                        }
                      />
                    </label>
                  ) : (
                    <label className={styles.field}>
                      <span>{editorMessages.durationMinutes}</span>
                      <input
                        type="number"
                        required
                        min="1"
                        max="525600"
                        value={form.durationMinutes}
                        onChange={(event) =>
                          update("durationMinutes", event.target.value)
                        }
                      />
                    </label>
                  )}
                  {overnight ? (
                    <small className={styles.overnightNote}>
                      {editorMessages.overnight}
                    </small>
                  ) : null}
                  <button
                    type="button"
                    className={styles.timingModeButton}
                    onClick={toggleTimedEndMode}
                  >
                    {form.timedEndMode === "end-time"
                      ? editorMessages.useDuration
                      : editorMessages.useEndTime}
                  </button>
                </div>
              )}
            </div>

            <fieldset className={styles.repeatFieldset}>
              <legend>{editorMessages.repeat}</legend>
              <div className={styles.repeatOptions}>
                {[
                  ["never", editorMessages.repeatNever],
                  ["daily", editorMessages.repeatDaily],
                  ["weekdays", editorMessages.repeatWeekdays],
                  ["weekly", editorMessages.repeatWeekly],
                  ["monthly-date", editorMessages.repeatMonthlyDate],
                  ["monthly-ordinal", editorMessages.repeatMonthlyWeekday],
                  ["yearly", editorMessages.repeatYearly],
                  ["custom", editorMessages.repeatCustom],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={form.repeatPreset === value ? styles.selectedChip : ""}
                    aria-pressed={form.repeatPreset === value}
                    onClick={() => update("repeatPreset", value as RepeatPreset)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {form.repeatPreset !== "never" ? (
                <div className={styles.recurrenceDetails}>
                  {form.repeatPreset === "custom" ? (
                    <label className={styles.field}>
                      <span>{editorMessages.frequency}</span>
                      <select
                        value={form.frequency}
                        onChange={(event) =>
                          update("frequency", event.target.value as Frequency)
                        }
                      >
                        <option value="DAILY">
                          {editorMessages.frequencyDays}
                        </option>
                        <option value="WEEKLY">
                          {editorMessages.frequencyWeeks}
                        </option>
                        <option value="MONTHLY">
                          {editorMessages.frequencyMonths}
                        </option>
                        <option value="YEARLY">
                          {editorMessages.frequencyYears}
                        </option>
                      </select>
                    </label>
                  ) : null}
                  <label className={styles.field}>
                    <span>{editorMessages.every}</span>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={form.interval}
                      onChange={(event) => update("interval", event.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>{editorMessages.ends}</span>
                    <select
                      value={form.recurrenceEnd}
                      onChange={(event) =>
                        update("recurrenceEnd", event.target.value as RecurrenceEnd)
                      }
                    >
                      <option value="never">
                        {editorMessages.repeatEndNever}
                      </option>
                      <option value="date">
                        {editorMessages.repeatEndDate}
                      </option>
                      <option value="count">
                        {editorMessages.repeatEndCount}
                      </option>
                    </select>
                  </label>
                  {form.recurrenceEnd === "date" ? (
                    <label className={styles.field}>
                      <span>{editorMessages.until}</span>
                      <input
                        type="date"
                        min={form.date}
                        value={form.untilDate}
                        onChange={(event) => update("untilDate", event.target.value)}
                      />
                    </label>
                  ) : null}
                  {form.recurrenceEnd === "count" ? (
                    <label className={styles.field}>
                      <span>{editorMessages.occurrences}</span>
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        value={form.occurrenceCount}
                        onChange={(event) =>
                          update("occurrenceCount", event.target.value)
                        }
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {showWeekdays ? (
                <div
                  className={styles.weekdayPicker}
                  aria-label={editorMessages.repeatOnWeekdays}
                >
                  {WEEKDAYS.map(([code, label]) => {
                    const selected = form.weekdays.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={selected}
                        className={selected ? styles.selectedDay : ""}
                        onClick={() =>
                          update(
                            "weekdays",
                            selected
                              ? form.weekdays.filter((day) => day !== code)
                              : [...form.weekdays, code],
                          )
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </fieldset>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>{editorMessages.location}</span>
                <input
                  value={form.location}
                  maxLength={240}
                  placeholder={editorMessages.optional}
                  onChange={(event) => update("location", event.target.value)}
                />
              </label>
              <div className={styles.field}>
                <span>{editorMessages.reminder}</span>
                {form.reminder === "custom" ? (
                  <div className={styles.reminderCustomFields}>
                    <label>
                      <span className={styles.visuallyHidden}>
                        {editorMessages.reminderAmount}
                      </span>
                      <input
                        aria-label={editorMessages.reminderAmount}
                        type="number"
                        required
                        min="0"
                        max={
                          MAX_REMINDER_MINUTES /
                          REMINDER_MINUTES_PER_UNIT[form.reminderUnit]
                        }
                        step="any"
                        value={form.reminderAmount}
                        onChange={(event) =>
                          update("reminderAmount", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span className={styles.visuallyHidden}>
                        {editorMessages.reminderUnit}
                      </span>
                      <select
                        value={form.reminderUnit}
                        onChange={(event) =>
                          update("reminderUnit", event.target.value as ReminderUnit)
                        }
                      >
                        <option value="minutes">
                          {editorMessages.reminderMinutesUnit}
                        </option>
                        <option value="hours">
                          {editorMessages.reminderHoursUnit}
                        </option>
                        <option value="days">
                          {editorMessages.reminderDaysUnit}
                        </option>
                        <option value="weeks">
                          {editorMessages.reminderWeeksUnit}
                        </option>
                      </select>
                    </label>
                  </div>
                ) : (
                  <select
                    aria-label={editorMessages.reminder}
                    value={form.reminder}
                    onChange={(event) =>
                      update("reminder", event.target.value as ReminderPreset)
                    }
                  >
                    <option value="">{editorMessages.reminderNone}</option>
                    <option value="0">{editorMessages.reminderAtStart}</option>
                    <option value="5">{editorMessages.reminderFive}</option>
                    <option value="15">{editorMessages.reminderFifteen}</option>
                    <option value="30">{editorMessages.reminderThirty}</option>
                    <option value="60">{editorMessages.reminderHour}</option>
                    <option value="1440">{editorMessages.reminderDay}</option>
                  </select>
                )}
                <button
                  type="button"
                  className={styles.timingModeButton}
                  onClick={toggleReminderMode}
                >
                  {form.reminder === "custom"
                    ? editorMessages.reminderUsePresets
                    : editorMessages.reminderCustom}
                </button>
                {form.reminder ? <small>{messages.reminderUnavailable}</small> : null}
              </div>
            </div>

            <fieldset className={styles.colorFieldset}>
              <legend>{editorMessages.color}</legend>
              <div>
                {EVENT_COLORS.map((color) => (
                  <label key={color} data-color={color}>
                    <input
                      type="radio"
                      name="color"
                      value={color}
                      checked={form.color === color}
                      onChange={() => update("color", color)}
                    />
                    <span>{color}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <details className={styles.moreDetails}>
              <summary>{editorMessages.moreDetails}</summary>
              <div className={styles.moreDetailsBody}>
                {!form.allDay ? (
                  <label className={styles.field}>
                    <span>{editorMessages.timezone}</span>
                    <input
                      list="calendario-timezones"
                      value={form.timeZone}
                      onChange={(event) => update("timeZone", event.target.value)}
                    />
                    <datalist id="calendario-timezones">
                      {timeZoneOptions(form.timeZone).map((timeZone) => (
                        <option key={timeZone} value={timeZone} />
                      ))}
                    </datalist>
                  </label>
                ) : null}
                <label className={styles.field}>
                  <span>{editorMessages.notes}</span>
                  <textarea
                    value={form.notes}
                    maxLength={10_000}
                    rows={5}
                    placeholder={editorMessages.notesPlaceholder}
                    onChange={(event) => update("notes", event.target.value)}
                  />
                </label>
              </div>
            </details>

            {error ? (
              <p className={styles.formError} role="alert">
                {error}
              </p>
            ) : null}

            {pending ? (
              <fieldset className={styles.scopeChooser}>
                <legend>
                  {pending.kind === "delete"
                    ? editorMessages.deleteScope
                    : editorMessages.changeScope}
                </legend>
                <p>{editorMessages.scopeHelp}</p>
                <div>
                  <button type="button" disabled={submitting} onClick={() => void completePending("occurrence")}>
                    {editorMessages.occurrenceScope}
                  </button>
                  <button type="button" disabled={submitting} onClick={() => void completePending("following")}>
                    {editorMessages.followingScope}
                  </button>
                  <button type="button" disabled={submitting} onClick={() => void completePending("series")}>
                    {editorMessages.seriesScope}
                  </button>
                  <button type="button" disabled={submitting} onClick={() => setPending(null)}>
                    {editorMessages.cancel}
                  </button>
                </div>
              </fieldset>
            ) : (
              <div className={styles.formActions}>
                {isEditing ? (
                  <button className={styles.deleteButton} type="button" disabled={submitting} onClick={requestDelete}>
                    {editorMessages.delete}
                  </button>
                ) : (
                  <span />
                )}
                <div>
                  <button type="button" disabled={submitting} onClick={requestClose}>
                    {editorMessages.cancel}
                  </button>
                  <button className={styles.primaryButton} type="submit" disabled={submitting}>
                    {submitting
                      ? editorMessages.saving
                      : isEditing
                        ? editorMessages.saveChanges
                        : editorMessages.saveEvent}
                  </button>
                </div>
              </div>
            )}
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
