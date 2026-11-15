import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBookingAdmin } from "./admin";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

const ownerId = "810cb213-a095-418a-a9e3-8ab60e62d4ca";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BOOKSURF_ADMIN_USER_IDS", ownerId);
  mocks.createAdminClient.mockReturnValue({ owner: true });
});

afterEach(() => vi.unstubAllEnvs());

describe("booking admin access", () => {
  it("fails closed when no admin is configured", async () => {
    vi.stubEnv("BOOKSURF_ADMIN_USER_IDS", " , ");
    expect(await getBookingAdmin()).toBe("unavailable");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a regular signed-in user before opening the service client", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "regular-user" } }, error: null });
    await expect(getBookingAdmin()).rejects.toThrow("not found");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("opens the service client for the allowlisted verified user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null });
    expect(await getBookingAdmin()).toEqual({ owner: true });
  });
});
