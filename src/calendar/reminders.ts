export const MAX_REMINDER_MINUTES = 525_600;
export const REMINDER_UNITS = ["minutes", "hours", "days", "weeks"] as const;

export type ReminderUnit = (typeof REMINDER_UNITS)[number];

export interface ReminderOffset {
  amount: number;
  unit: ReminderUnit;
}

export const REMINDER_MINUTES_PER_UNIT: Record<ReminderUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1_440,
  weeks: 10_080,
};

export function reminderMinutes({ amount, unit }: ReminderOffset): number {
  return amount * REMINDER_MINUTES_PER_UNIT[unit];
}

/** The lead times offered as one-click choices, in minutes before the start. */
export const REMINDER_PRESET_MINUTES = [0, 5, 15, 30, 60, 1_440] as const;

export type ReminderPreset =
  | ""
  | "custom"
  | `${(typeof REMINDER_PRESET_MINUTES)[number]}`;

export interface ReminderChoice {
  preset: ReminderPreset;
  amount: string;
  unit: ReminderUnit;
}

const PRESET_VALUES: ReadonlySet<string> = new Set(
  REMINDER_PRESET_MINUTES.map(String),
);

/** Splits saved minutes into the preset, or the custom amount and unit. */
export function reminderChoiceFor(
  minutes: number | null | undefined,
): ReminderChoice {
  if (minutes === undefined || minutes === null) {
    return { preset: "", amount: "", unit: "minutes" };
  }
  const preset = String(minutes);
  if (PRESET_VALUES.has(preset)) {
    return { preset: preset as ReminderPreset, amount: "", unit: "minutes" };
  }
  const unit =
    (["weeks", "days", "hours"] as const).find(
      (candidate) =>
        minutes > 0 && minutes % REMINDER_MINUTES_PER_UNIT[candidate] === 0,
    ) ?? "minutes";
  return {
    preset: "custom",
    amount: String(minutes / REMINDER_MINUTES_PER_UNIT[unit]),
    unit,
  };
}

/**
 * The minutes a choice resolves to, `undefined` for no reminder, and `NaN` for
 * a custom amount the user has not filled in yet so validation can reject it.
 */
export function reminderChoiceMinutes({
  preset,
  amount,
  unit,
}: ReminderChoice): number | undefined {
  if (preset === "") return undefined;
  if (preset !== "custom") return Number(preset);
  if (amount.trim() === "") return Number.NaN;
  return reminderMinutes({ amount: Number(amount), unit });
}
