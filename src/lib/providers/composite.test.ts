import { describe, expect, it } from "vitest";
import type {
  FlightOption,
  FlightSearchInput,
  LodgingOption,
  LodgingSearchInput,
  SurfDestination,
} from "@/lib/domain/types";
import { CompositeFlightProvider } from "@/lib/providers/flights/composite";
import { CompositeLodgingProvider } from "@/lib/providers/lodging/composite";
import type { FlightProvider } from "@/lib/providers/flights/types";
import type { LodgingProvider } from "@/lib/providers/lodging/types";

const destination: SurfDestination = {
  id: "test",
  slug: "test",
  name: "Test Break",
  region: "Test",
  country: "US",
  latitude: 34,
  longitude: -118,
  nearestAirportCodes: ["LAX"],
  timezone: "America/Los_Angeles",
  minSkillLevel: "beginner",
  maxSkillLevel: "expert",
  preferredSwellDirections: [],
  preferredWindDirections: [],
  minUsefulSwellHeight: 0,
  maxUsefulSwellHeight: 10,
  minUsefulPeriod: 0,
  typicalBoardRentalDaily: 30,
  typicalLocalTransportDaily: 10,
  beachWalkableDefault: true,
  warmWaterMonths: [],
  active: true,
};

const flightInput: FlightSearchInput = {
  origin: "CLT",
  destinationAirports: ["LAX"],
  departureDate: "2026-09-01",
  returnDate: "2026-09-05",
  travelers: 1,
  carryOnRequired: false,
  allowConnections: true,
};

function flight(totalFare: number, priceSource: FlightOption["priceSource"], provider: string): FlightOption {
  return {
    origin: "CLT",
    destination: "LAX",
    departureAt: "2026-09-01T08:00:00",
    returnAt: "2026-09-05T08:00:00",
    airline: provider,
    stops: 0,
    durationMinutes: 300,
    baseFare: totalFare,
    carryOnCost: 0,
    totalFare,
    currency: "USD",
    provider,
    priceSource,
    fetchedAt: new Date().toISOString(),
  };
}

const lodgingInput: LodgingSearchInput = {
  destination,
  checkIn: "2026-09-01",
  checkOut: "2026-09-05",
  travelers: 2,
  walkableToBeachRequired: true,
};

function lodging(totalPrice: number, priceSource: LodgingOption["priceSource"], provider: string): LodgingOption {
  return {
    propertyName: provider,
    checkIn: lodgingInput.checkIn,
    checkOut: lodgingInput.checkOut,
    totalPrice,
    taxesAndFees: 0,
    sleeps: 2,
    walkableToBeach: true,
    provider,
    currency: "USD",
    priceSource,
    fetchedAt: new Date().toISOString(),
  };
}

describe("provider aggregation", () => {
  it("prefers verified live flights over cheaper mock fares", async () => {
    const live: FlightProvider = { search: async () => [flight(480, "live", "live-source")] };
    const mock: FlightProvider = { search: async () => [flight(120, "mocked", "mock-source")] };
    const options = await new CompositeFlightProvider([mock, live]).search(flightInput);
    expect(options[0].provider).toBe("live-source");
    expect(options[0].totalFare).toBe(480);
  });

  it("keeps a flight fallback when an external supplier fails", async () => {
    const broken: FlightProvider = { search: async () => { throw new Error("supplier down"); } };
    const mock: FlightProvider = { search: async () => [flight(120, "mocked", "mock-source")] };
    const options = await new CompositeFlightProvider([broken, mock]).search(flightInput);
    expect(options).toHaveLength(1);
    expect(options[0].priceSource).toBe("mocked");
  });

  it("prefers live lodging over cheaper estimates", async () => {
    const live: LodgingProvider = { search: async () => [lodging(600, "live", "live-stay")] };
    const mock: LodgingProvider = { search: async () => [lodging(250, "mocked", "mock-stay")] };
    const options = await new CompositeLodgingProvider([mock, live]).search(lodgingInput);
    expect(options[0].provider).toBe("live-stay");
    expect(options[0].totalPrice).toBe(600);
  });
});
