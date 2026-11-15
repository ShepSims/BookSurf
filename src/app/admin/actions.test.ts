import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateBooking } from "./actions";

const mocks = vi.hoisted(() => ({
  getBookingAdmin: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/features/bookings/admin", () => ({ getBookingAdmin: mocks.getBookingAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(url); },
  notFound: () => { throw new Error("not found"); },
}));

const id = "c685ecfa-3e73-4e94-8f9d-e92c2888986a";
function change(from: string, to: string, verified = false) {
  const form = new FormData();
  for (const [name, value] of Object.entries({ id, revision: "4", from, to, internalNotes: "Follow up next week" })) {
    form.set(name, value);
  }
  if (verified) form.set("verified", "yes");
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getBookingAdmin.mockResolvedValue({ from: mocks.from });
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.eq, select: () => ({ maybeSingle: mocks.maybeSingle }) });
  mocks.maybeSingle.mockResolvedValue({ data: { id }, error: null });
});

describe("booking admin updates", () => {
  it("redirects signed-out visitors before accessing bookings", async () => {
    mocks.getBookingAdmin.mockResolvedValue("signin");
    await expect(updateBooking(change("pending_operator", "quoted"))).rejects.toThrow("/account?next=admin");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects skipped stages", async () => {
    await expect(updateBooking(change("pending_operator", "confirmed", true))).rejects.toThrow("?error=invalid");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("requires verification before confirmation", async () => {
    await expect(updateBooking(change("awaiting_payment", "confirmed"))).rejects.toThrow("?error=verify");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("saves a verified confirmation and internal notes against the original revision", async () => {
    await expect(updateBooking(change("awaiting_payment", "confirmed", true))).rejects.toThrow("?saved=1");
    expect(mocks.update).toHaveBeenCalledWith({ status: "confirmed", internal_notes: "Follow up next week", admin_revision: 5 });
    expect(mocks.eq.mock.calls).toEqual([["id", id], ["status", "awaiting_payment"], ["admin_revision", 4]]);
  });

  it("reports a conflict when the original revision no longer matches", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateBooking(change("quoted", "quoted"))).rejects.toThrow("?error=conflict");
  });
});
