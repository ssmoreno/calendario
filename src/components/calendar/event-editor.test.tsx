import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { I18nProvider } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";

import { localDateTimeToZoned } from "@/calendar/date-time";
import type { EventInput, EventRecord, Occurrence } from "@/calendar/types";

import { EventEditor } from "./event-editor";

type EditorProps = ComponentProps<typeof EventEditor>;

function renderEditor(overrides: Partial<EditorProps> = {}) {
  const props: EditorProps = {
    seed: { dateKey: "2026-08-08" },
    viewerTimeZone: "UTC",
    occurrence: null,
    seriesEvent: null,
    onClose: vi.fn(),
    onSave: vi.fn(async () => undefined),
    onDelete: vi.fn(async () => undefined),
    ...overrides,
  };
  render(
    <I18nProvider locale="en-US">
      <EventEditor {...props} />
    </I18nProvider>,
  );
  return {
    props,
    onClose: vi.mocked(props.onClose),
    onSave: vi.mocked(props.onSave),
  };
}

function weeklyOccurrence(): {
  occurrence: Occurrence;
  series: EventRecord;
} {
  const now = "2026-01-01T00:00:00.000Z";
  const series: EventRecord = {
    id: "weekly-swim",
    title: "Swim",
    timing: {
      kind: "timed",
      startsAt: localDateTimeToZoned("2026-08-01", "09:00", "UTC"),
      durationMinutes: 60,
    },
    recurrence: { rrule: "FREQ=WEEKLY;COUNT=4", excludedStarts: [] },
    color: "mint",
    createdAt: now,
    updatedAt: now,
  };
  const startsAt = localDateTimeToZoned("2026-08-15", "09:00", "UTC");
  return {
    series,
    occurrence: {
      key: `${series.id}:${startsAt}`,
      eventId: series.id,
      rootEventId: series.id,
      occurrenceStart: startsAt,
      record: series,
      timing: { kind: "timed", startsAt, durationMinutes: 60 },
      dateKeys: ["2026-08-15"],
      isOverride: false,
    },
  };
}

describe("EventEditor", () => {
  it("seeds a new event from the account defaults", () => {
    renderEditor({
      seed: { dateKey: "2026-08-08", startTime: "14:30" },
      defaults: {
        defaultDurationMinutes: 30,
        defaultReminderMinutes: 8,
        defaultColor: "mint",
        theme: "system",
      },
    });

    expect(screen.getByLabelText("Ends")).toHaveProperty("value", "15:00");
    expect(screen.getByLabelText("Reminder amount")).toHaveProperty(
      "value",
      "8",
    );
    expect(
      screen.getByRole("radio", { name: "mint" }),
    ).toHaveProperty("checked", true);
  });

  it("uses an explicit calendar-slot start time", () => {
    renderEditor({ seed: { dateKey: "2026-08-08", startTime: "14:30" } });

    expect(screen.getByLabelText("Starts")).toHaveProperty("value", "14:30");
    expect(screen.getByLabelText("Ends")).toHaveProperty("value", "15:30");
  });

  it("validates required data and submits a complete event", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();

    await user.click(screen.getByRole("button", { name: "Save event" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Add a title.");

    await user.type(
      screen.getByRole("textbox", { name: "Event title" }),
      "Bookshop",
    );
    await user.selectOptions(screen.getByLabelText("Reminder"), "15");
    expect(
      screen.getByText(
        "Saved here only — reminder delivery is not active yet.",
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save event" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Bookshop",
        color: "coral",
        reminderMinutesBefore: 15,
        timing: expect.objectContaining({ kind: "timed" }),
      }),
      "series",
      {},
    );
  });

  it("supports a custom reminder amount and unit", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    await user.type(screen.getByLabelText("Event title"), "Visa appointment");
    await user.click(screen.getByRole("button", { name: "Customize reminder" }));
    await user.clear(screen.getByLabelText("Reminder amount"));
    await user.type(screen.getByLabelText("Reminder amount"), "5");
    await user.selectOptions(screen.getByLabelText("Reminder unit"), "days");

    await user.click(screen.getByRole("button", { name: "Save event" }));

    expect(onSave.mock.calls[0][0]).toMatchObject({
      reminderMinutesBefore: 7_200,
    });
  });

  it("keeps a custom reminder when switching between custom and presets", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    await user.type(screen.getByLabelText("Event title"), "Visa appointment");
    await user.click(screen.getByRole("button", { name: "Customize reminder" }));
    await user.clear(screen.getByLabelText("Reminder amount"));
    await user.type(screen.getByLabelText("Reminder amount"), "5");
    await user.selectOptions(screen.getByLabelText("Reminder unit"), "days");

    await user.click(screen.getByRole("button", { name: "Use reminder presets" }));
    await user.click(screen.getByRole("button", { name: "Customize reminder" }));
    expect((screen.getByLabelText("Reminder amount") as HTMLInputElement).value).toBe(
      "5",
    );
    expect((screen.getByLabelText("Reminder unit") as HTMLSelectElement).value).toBe(
      "days",
    );

    await user.click(screen.getByRole("button", { name: "Save event" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      reminderMinutesBefore: 7_200,
    });
  });

  it("builds inclusive all-day ranges", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    await user.type(screen.getByLabelText("Event title"), "Retreat");
    await user.click(screen.getByLabelText("All-day event"));
    fireEvent.change(screen.getByLabelText("Last day"), {
      target: { value: "2026-08-10" },
    });

    await user.click(screen.getByRole("button", { name: "Save event" }));

    const input = onSave.mock.calls[0][0] as EventInput;
    expect(input.timing).toEqual({
      kind: "all-day",
      startDate: "2026-08-08",
      endDateExclusive: "2026-08-11",
    });
  });

  it("makes overnight timing explicit and calculates its duration", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    await user.type(screen.getByLabelText("Event title"), "Night train");
    fireEvent.change(screen.getByLabelText("Starts"), {
      target: { value: "23:00" },
    });
    fireEvent.change(screen.getByLabelText("Ends"), {
      target: { value: "01:00" },
    });

    expect(screen.getByText("Ends the next day")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save event" }));

    expect((onSave.mock.calls[0][0] as EventInput).timing).toMatchObject({
      kind: "timed",
      durationMinutes: 120,
    });
  });

  it("preserves multi-day timed events through duration editing", async () => {
    const user = userEvent.setup();
    const now = "2026-01-01T00:00:00.000Z";
    const startsAt = localDateTimeToZoned("2026-08-08", "09:00", "UTC");
    const record: EventRecord = {
      id: "long-train",
      title: "Long train",
      timing: { kind: "timed", startsAt, durationMinutes: 2_880 },
      recurrence: null,
      color: "gold",
      createdAt: now,
      updatedAt: now,
    };
    const occurrence: Occurrence = {
      key: `${record.id}:${startsAt}`,
      eventId: record.id,
      rootEventId: record.id,
      occurrenceStart: startsAt,
      record,
      timing: record.timing,
      dateKeys: ["2026-08-08", "2026-08-09", "2026-08-10"],
      isOverride: false,
    };
    const { onSave } = renderEditor({ occurrence });

    expect(screen.getByLabelText("Duration (minutes)")).toHaveProperty(
      "value",
      "2880",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect((onSave.mock.calls[0][0] as EventInput).timing).toMatchObject({
      kind: "timed",
      durationMinutes: 2_880,
    });
    expect(onSave.mock.calls[0][2]).toEqual({});
  });

  it("builds selected weekday and count recurrence rules", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor({ seed: { dateKey: "2026-08-10" } });
    await user.type(screen.getByLabelText("Event title"), "Training");
    await user.click(screen.getByRole("button", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: "Wed" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Ends" }),
      "count",
    );
    fireEvent.change(screen.getByLabelText("Occurrences"), {
      target: { value: "3" },
    });

    await user.click(screen.getByRole("button", { name: "Save event" }));

    const input = onSave.mock.calls[0][0] as EventInput;
    expect(input.recurrence?.rrule).toBe(
      "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=3",
    );
  });

  it("confirms before discarding dirty edits", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderEditor();
    await user.type(screen.getByLabelText("Event title"), "Unfinished");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledWith("Discard your unsaved changes?");
    expect(onClose).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    // Closing waits for the dialog exit animation before unmounting.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("submits only changed fields when editing an entire series", async () => {
    const user = userEvent.setup();
    const { occurrence, series } = weeklyOccurrence();
    const { onSave } = renderEditor({
      seed: { dateKey: occurrence.dateKeys[0] },
      occurrence,
      seriesEvent: series,
    });
    const title = screen.getByLabelText("Event title");
    await user.clear(title);
    await user.type(title, "Morning swim");

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: "Entire series" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][1]).toBe("series");
    expect(onSave.mock.calls[0][2]).toEqual({ title: "Morning swim" });
  });
});
