import { beforeEach, describe, expect, it, vi } from "vitest";

const ZONE = "America/Argentina/Buenos_Aires";
const remindAt = new Date("2026-09-12T11:00:00.000Z");
const row = {
  id: "reminder-1",
  userId: "user-a",
  body: "Escribirle a tu mamá",
  remindAt,
  timeZone: ZONE,
};

const db = vi.hoisted(() => ({
  reminder: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("./db", () => ({ prisma: db }));

const {
  cancelReminder,
  claimDueReminders,
  createReminder,
  listReminders,
  markReminderDelivered,
  releaseReminder,
  ReminderInPastError,
  ReminderNotFoundError,
} = await import("./reminder-store");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createReminder", () => {
  it("stores the resolved instant with the zone it was set in", async () => {
    db.reminder.create.mockResolvedValue(row);

    const reminder = await createReminder(
      "user-a",
      {
        body: "Escribirle a tu mamá",
        remindAt: `2026-09-12T08:00:00-03:00[${ZONE}]`,
      },
      ZONE,
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(db.reminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: "user-a",
          body: "Escribirle a tu mamá",
          remindAt,
          timeZone: ZONE,
        },
      }),
    );
    expect(reminder.remindAt).toBe(remindAt.toISOString());
    expect(reminder.localTime).toContain("08:00");
  });

  it("refuses a moment that has already passed", async () => {
    await expect(
      createReminder(
        "user-a",
        {
          body: "Sacar las milanesas",
          remindAt: `2026-09-09T08:00:00-03:00[${ZONE}]`,
        },
        ZONE,
        new Date("2026-09-09T18:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(ReminderInPastError);
    expect(db.reminder.create).not.toHaveBeenCalled();
  });
});

describe("listReminders", () => {
  it("returns only what is still owed, soonest first", async () => {
    db.reminder.findMany.mockResolvedValue([row]);

    const reminders = await listReminders("user-a");

    expect(db.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-a", deliveredAt: null },
        orderBy: { remindAt: "asc" },
      }),
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).toBe("Escribirle a tu mamá");
  });
});

describe("cancelReminder", () => {
  it("deletes a pending reminder the caller owns", async () => {
    db.reminder.findFirst.mockResolvedValue(row);

    const cancelled = await cancelReminder("user-a", "reminder-1");

    expect(db.reminder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "reminder-1", userId: "user-a", deliveredAt: null },
      }),
    );
    expect(db.reminder.delete).toHaveBeenCalledWith({
      where: { id: "reminder-1" },
    });
    expect(cancelled.id).toBe("reminder-1");
  });

  it("does not delete another account's reminder", async () => {
    db.reminder.findFirst.mockResolvedValue(null);

    await expect(cancelReminder("user-b", "reminder-1")).rejects.toBeInstanceOf(
      ReminderNotFoundError,
    );
    expect(db.reminder.delete).not.toHaveBeenCalled();
  });
});

describe("claimDueReminders", () => {
  const now = new Date("2026-09-12T11:00:30.000Z");

  it("leases due rows and reads back only the ones it won", async () => {
    db.reminder.updateMany.mockResolvedValue({ count: 1 });
    db.reminder.findMany.mockResolvedValue([row]);

    const claimed = await claimDueReminders({ now, leaseForMs: 60_000 });

    const [call] = db.reminder.updateMany.mock.calls;
    expect(call[0].where).toEqual({
      deliveredAt: null,
      remindAt: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    });
    expect(call[0].data.leaseUntil).toEqual(
      new Date("2026-09-12T11:01:30.000Z"),
    );

    const token = call[0].data.leaseToken;
    expect(typeof token).toBe("string");
    expect(db.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { leaseToken: token } }),
    );
    expect(claimed).toEqual([{ ...row, leaseToken: token }]);
  });

  it("uses a fresh token per tick so ticks cannot read each other's rows", async () => {
    db.reminder.updateMany.mockResolvedValue({ count: 1 });
    db.reminder.findMany.mockResolvedValue([row]);

    await claimDueReminders({ now });
    await claimDueReminders({ now });

    const [first, second] = db.reminder.updateMany.mock.calls;
    expect(first[0].data.leaseToken).not.toBe(second[0].data.leaseToken);
  });

  it("skips the read when nothing came due", async () => {
    db.reminder.updateMany.mockResolvedValue({ count: 0 });

    expect(await claimDueReminders({ now })).toEqual([]);
    expect(db.reminder.findMany).not.toHaveBeenCalled();
  });
});

describe("finishing a delivery", () => {
  it("clears the lease when the send lands", async () => {
    await markReminderDelivered("reminder-1", "lease-a");

    const [call] = db.reminder.updateMany.mock.calls;
    expect(call[0].where).toEqual({
      id: "reminder-1",
      leaseToken: "lease-a",
      deliveredAt: null,
    });
    expect(call[0].data.deliveredAt).toBeInstanceOf(Date);
    expect(call[0].data.leaseUntil).toBeNull();
    expect(call[0].data.leaseToken).toBeNull();
  });

  it("holds a failed send back until the retry time", async () => {
    const retryAt = new Date("2026-09-12T11:05:00.000Z");

    await releaseReminder("reminder-1", "lease-a", retryAt);

    expect(db.reminder.updateMany).toHaveBeenCalledWith({
      where: {
        id: "reminder-1",
        leaseToken: "lease-a",
        deliveredAt: null,
      },
      data: { leaseUntil: retryAt, leaseToken: null },
    });
  });
});
