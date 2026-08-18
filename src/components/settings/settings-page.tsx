"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { messages } from "@/calendar/messages";
import {
  MAX_REMINDER_MINUTES,
  REMINDER_MINUTES_PER_UNIT,
  reminderChoiceFor,
  reminderChoiceMinutes,
  type ReminderPreset,
  type ReminderUnit,
} from "@/calendar/reminders";
import {
  MAX_DEFAULT_DURATION_MINUTES,
  THEME_PREFERENCES,
  type UserMemoryRecord,
  type UserSettings,
  type UserSettingsPatch,
} from "@/calendar/settings";
import { saveThemePreference } from "@/calendar/storage";
import { applyThemePreference } from "@/calendar/theme";
import { EVENT_COLORS, type ThemePreference } from "@/calendar/types";
import { authClient } from "@/lib/auth-client";
import { SerialTaskQueue } from "@/lib/serial-task-queue";

import calendarStyles from "../calendar/calendar.module.css";
import { clearSavedChat } from "../chat/chat-storage";
import styles from "./settings.module.css";

const settingsMessages = messages.settings;
const editorMessages = messages.editor;

const themeLabels: Record<ThemePreference, string> = {
  system: messages.header.themeSystem,
  light: messages.header.themeLight,
  dark: messages.header.themeDark,
};

const reminderOptions: { value: ReminderPreset; label: string }[] = [
  { value: "", label: editorMessages.reminderNone },
  { value: "0", label: editorMessages.reminderAtStart },
  { value: "5", label: editorMessages.reminderFive },
  { value: "15", label: editorMessages.reminderFifteen },
  { value: "30", label: editorMessages.reminderThirty },
  { value: "60", label: editorMessages.reminderHour },
  { value: "1440", label: editorMessages.reminderDay },
];

const reminderUnitLabels: Record<ReminderUnit, string> = {
  minutes: editorMessages.reminderMinutesUnit,
  hours: editorMessages.reminderHoursUnit,
  days: editorMessages.reminderDaysUnit,
  weeks: editorMessages.reminderWeeksUnit,
};

interface SettingsPageProps {
  email: string;
  userId: string;
  initialSettings: UserSettings;
  initialMemories: UserMemoryRecord[];
}

export function SettingsPage({
  email,
  userId,
  initialSettings,
  initialMemories,
}: SettingsPageProps) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [memories, setMemories] = useState(initialMemories);
  const [duration, setDuration] = useState(
    String(initialSettings.defaultDurationMinutes),
  );
  const [reminder, setReminder] = useState(() =>
    reminderChoiceFor(initialSettings.defaultReminderMinutes),
  );
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const saveQueue = useRef(new SerialTaskQueue());
  const pendingOperations = useRef(0);

  function beginOperation() {
    pendingOperations.current += 1;
    setBusy(true);
  }

  function endOperation() {
    pendingOperations.current -= 1;
    if (pendingOperations.current === 0) setBusy(false);
  }

  function save(patch: UserSettingsPatch): Promise<UserSettings | null> {
    beginOperation();
    const request = saveQueue.current.run(async () => {
      try {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!response.ok) throw new Error(settingsMessages.saveFailed);
        const { settings: next } = (await response.json()) as {
          settings: UserSettings;
        };
        setSettings(next);
        setStatus({ text: settingsMessages.saved, failed: false });
        return next;
      } catch {
        setStatus({ text: settingsMessages.saveFailed, failed: true });
        return null;
      }
    });
    return request.finally(endOperation);
  }

  async function commitDuration() {
    const minutes = Number(duration);
    if (
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > MAX_DEFAULT_DURATION_MINUTES ||
      minutes === settings.defaultDurationMinutes
    ) {
      setDuration(String(settings.defaultDurationMinutes));
      return;
    }
    const next = await save({ defaultDurationMinutes: minutes });
    if (next) setDuration(String(next.defaultDurationMinutes));
  }

  async function commitReminder(choice: {
    preset: ReminderPreset;
    amount: string;
    unit: ReminderUnit;
  }) {
    setReminder(choice);
    const minutes = reminderChoiceMinutes(choice);
    if (minutes !== undefined && !Number.isSafeInteger(minutes)) return;
    if (minutes !== undefined && minutes > MAX_REMINDER_MINUTES) return;
    const value = minutes ?? null;
    if (value === settings.defaultReminderMinutes) return;
    await save({ defaultReminderMinutes: value });
  }

  async function selectTheme(theme: ThemePreference) {
    if (theme === settings.theme) return;
    const previousTheme = settings.theme;
    applyThemePreference(theme);
    saveThemePreference(safeStorage(), theme);
    const next = await save({ theme });
    const savedTheme = next?.theme ?? previousTheme;
    applyThemePreference(savedTheme);
    saveThemePreference(safeStorage(), savedTheme);
  }

  async function forget(memoryId: string) {
    beginOperation();
    try {
      const response = await fetch(`/api/memories/${memoryId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(settingsMessages.saveFailed);
      setMemories((current) =>
        current.filter((memory) => memory.id !== memoryId),
      );
    } catch {
      setStatus({ text: settingsMessages.saveFailed, failed: true });
    } finally {
      endOperation();
    }
  }

  async function signOut() {
    beginOperation();
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(messages.auth.signOutFailed);
      clearSavedChat(userId);
      router.replace("/login");
      router.refresh();
    } catch {
      setStatus({ text: messages.auth.signOutFailed, failed: true });
    } finally {
      endOperation();
    }
  }

  return (
    <div className={styles.settingsShell}>
      <header className={styles.settingsHeader}>
        <h1>{settingsMessages.title}</h1>
        <Link className={styles.backLink} href="/">
          {settingsMessages.backToCalendar}
        </Link>
      </header>

      <main className={styles.settingsCard}>
        <section className={styles.settingsGroup}>
          <div className={styles.groupIntro}>
            <h2>{settingsMessages.defaultsHeading}</h2>
            <p>{settingsMessages.defaultsBody}</p>
          </div>

          <div className={styles.controlRow}>
            <label className={calendarStyles.field}>
              <span>{settingsMessages.duration}</span>
              <input
                type="number"
                min="1"
                max={MAX_DEFAULT_DURATION_MINUTES}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                onBlur={() => void commitDuration()}
              />
            </label>

            <div className={calendarStyles.field}>
              <span>{settingsMessages.reminder}</span>
              <select
                aria-label={settingsMessages.reminder}
                value={reminder.preset}
                onChange={(event) =>
                  void commitReminder({
                    ...reminder,
                    preset: event.target.value as ReminderPreset,
                  })
                }
              >
                {reminderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">{settingsMessages.reminderCustom}</option>
              </select>
              {reminder.preset === "custom" ? (
                <div className={calendarStyles.reminderCustomFields}>
                  <input
                    aria-label={editorMessages.reminderAmount}
                    type="number"
                    min="0"
                    max={
                      MAX_REMINDER_MINUTES /
                      REMINDER_MINUTES_PER_UNIT[reminder.unit]
                    }
                    value={reminder.amount}
                    onChange={(event) =>
                      setReminder({ ...reminder, amount: event.target.value })
                    }
                    onBlur={() => void commitReminder(reminder)}
                  />
                  <select
                    aria-label={editorMessages.reminderUnit}
                    value={reminder.unit}
                    onChange={(event) =>
                      void commitReminder({
                        ...reminder,
                        unit: event.target.value as ReminderUnit,
                      })
                    }
                  >
                    {(
                      Object.keys(reminderUnitLabels) as ReminderUnit[]
                    ).map((unit) => (
                      <option key={unit} value={unit}>
                        {reminderUnitLabels[unit]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>

          <fieldset className={calendarStyles.colorFieldset}>
            <legend>{settingsMessages.color}</legend>
            <div className={styles.colorChoices}>
              {EVENT_COLORS.map((color) => (
                <label key={color} data-color={color}>
                  <input
                    type="radio"
                    name="defaultColor"
                    value={color}
                    checked={settings.defaultColor === color}
                    onChange={() => void save({ defaultColor: color })}
                  />
                  <span>{color}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className={styles.settingsGroup}>
          <div className={styles.groupIntro}>
            <h2>{settingsMessages.appearanceHeading}</h2>
            <p>{settingsMessages.appearanceBody}</p>
          </div>
          <div
            className={calendarStyles.segmented}
            role="group"
            aria-label={messages.header.themeGroup}
          >
            {THEME_PREFERENCES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={settings.theme === option}
                onClick={() => void selectTheme(option)}
              >
                {themeLabels[option]}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.settingsGroup}>
          <div className={styles.groupIntro}>
            <h2>{settingsMessages.memoriesHeading}</h2>
            <p>{settingsMessages.memoriesBody}</p>
          </div>
          {memories.length ? (
            <ul className={styles.memoryList}>
              {memories.map((memory) => (
                <li key={memory.id}>
                  <p>
                    {memory.content}
                    <time dateTime={memory.createdAt}>
                      {memory.createdAt.slice(0, 10)}
                    </time>
                  </p>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={busy}
                    onClick={() => void forget(memory.id)}
                  >
                    {settingsMessages.forget}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyNote}>{settingsMessages.memoriesEmpty}</p>
          )}
        </section>

        <section className={styles.settingsGroup}>
          <div className={styles.groupIntro}>
            <h2>{settingsMessages.accountHeading}</h2>
          </div>
          <div className={styles.accountRow}>
            <span className={styles.accountEmail}>
              {settingsMessages.signedInAs(email)}
            </span>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={busy}
              onClick={() => void signOut()}
            >
              {messages.auth.signOut}
            </button>
          </div>
        </section>
      </main>

      <p
        className={styles.statusLine}
        role="status"
        data-tone={status?.failed ? "error" : undefined}
      >
        {status?.text ?? ""}
      </p>
    </div>
  );
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
