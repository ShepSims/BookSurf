import { afterEach, describe, expect, it, vi } from "vitest";
import { DuffelFlightProvider } from "./duffel";

const input = {
  origin: "CLT",
  destinationAirports: ["LIR"],
  departureDate: "2026-09-01",
  returnDate: "2026-09-05",
  travelers: 2,
  carryOnRequired: false,
  allowConnections: true,
};

function response(liveMode: boolean, totalAmount = "1800.00", baggageType?: string) {
  return {
    ok: true,
    json: async () => ({
      data: {
        live_mode: liveMode,
        offers: [
          {
            id: "off_live_123",
            expires_at: "2026-08-26T22:00:00Z",
            total_amount: totalAmount,
            total_currency: "USD",
            slices: [
              {
                duration: "PT06H00M",
                segments: [
                  {
                    departing_at: "2026-09-01T08:00:00",
                    duration: "PT06H00M",
                    origin: { iata_code: "CLT" },
                    destination: { iata_code: "LIR" },
                    operating_carrier: { name: "American Airlines" },
                    passengers: [
                      { baggages: baggageType ? [{ type: baggageType, quantity: 1 }] : [] },
                      { baggages: baggageType ? [{ type: baggageType, quantity: 1 }] : [] },
                    ],
                  },
                ],
              },
              {
                duration: "PT05H30M",
                segments: [
                  {
                    departing_at: "2026-09-05T12:00:00",
                    duration: "PT05H30M",
                    origin: { iata_code: "LIR" },
                    destination: { iata_code: "CLT" },
                    operating_carrier: { name: "American Airlines" },
                    passengers: [
                      { baggages: baggageType ? [{ type: baggageType, quantity: 1 }] : [] },
                      { baggages: baggageType ? [{ type: baggageType, quantity: 1 }] : [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    }),
    text: async () => "",
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DuffelFlightProvider", () => {
  it("uses the live Duffel all-passenger total as a per-person fare", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(true));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new DuffelFlightProvider("duffel_live_key").search(input);

    expect(result).toHaveLength(1);
    expect(result[0].baseFare).toBe(900);
    expect(result[0].totalFare).toBe(900);
    expect(result[0].priceSource).toBe("live");
    expect(result[0].airline).toBe("American Airlines");
    expect(result[0].offerId).toBe("off_live_123");
  });

  it("never labels a Duffel test-mode offer as live", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(false)));

    const result = await new DuffelFlightProvider("duffel_test_key").search(input);

    expect(result[0].priceSource).toBe("mocked");
    expect(result[0].provider).toBe("duffel-test-offer");
  });

  it("marks live airfare estimated when required carry-on inclusion is not verified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(true)));

    const result = await new DuffelFlightProvider("duffel_live_key").search({
      ...input,
      carryOnRequired: true,
    });

    expect(result[0].priceSource).toBe("estimated");
    expect(result[0].carryOnIncluded).toBe(false);
  });

  it("keeps live status when required carry-on is explicitly included", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(true, "1800.00", "carry_on")));

    const result = await new DuffelFlightProvider("duffel_live_key").search({
      ...input,
      carryOnRequired: true,
    });

    expect(result[0].priceSource).toBe("live");
    expect(result[0].carryOnIncluded).toBe(true);
  });
});
