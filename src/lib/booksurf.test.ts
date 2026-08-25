import { describe, expect, it } from "vitest";
import { DEMO_WATCH } from "@/data/demo-watch";
import { SURF_DESTINATIONS } from "@/data/destinations";
import { discoverForWatch } from "@/lib/discovery/engine";
import { InMemoryDiscoveryRepository } from "@/lib/discovery/in-memory-repository";
import { shouldAlertOpportunity, opportunityIdentity } from "@/lib/opportunities/dedupe";
import { scoreOpportunity } from "@/lib/opportunities/scoring";
import { StaticBoardProvider } from "@/lib/providers/boards/static-provider";
import { MockSurfForecastProvider } from "@/lib/providers/forecast/mock";
import { MockFlightProvider } from "@/lib/providers/flights/mock";
import { MockLodgingProvider } from "@/lib/providers/lodging/mock";
import { StaticTransportProvider } from "@/lib/providers/transport/static-provider";
import { getEligibleDestinations } from "@/lib/surf/filtering";
import { scoreForecastHour } from "@/lib/surf/scoring";
import { groupSurfWindows } from "@/lib/surf/windows";
import { generateTripDates } from "@/lib/trips/date-generation";
import { calculateTripCost } from "@/lib/trips/pricing";
import type { DestinationForecast, TripOpportunity } from "@/lib/domain/types";

const destination = SURF_DESTINATIONS[0];

function opportunity(overrides: Partial<TripOpportunity> = {}): TripOpportunity {
  return {
    identityKey: "identity", watchId: DEMO_WATCH.id, userId: DEMO_WATCH.userId, destinationId: destination.id,
    departureDate: "2026-10-14", returnDate: "2026-10-18", surfWindowStart: "2026-10-16T06:00", surfWindowEnd: "2026-10-16T10:00", surfTimezone: destination.timezone,
    surfScore: 90, surfConfidence: .9, flightPricePerPerson: 180, lodgingTotal: 280, lodgingPerPerson: 140, boardRentalPerPerson: 80, transportPerPerson: 40, baggagePerPerson: 0,
    totalPerPerson: 440, totalGroupCost: 880,
    flightOption: { origin:"CLT", destination:"BQN", departureAt:"2026-10-14T08:00", returnAt:"2026-10-18T17:00", airline:"Test", stops:0, durationMinutes:180, baseFare:180, carryOnCost:0, totalFare:180, currency:"USD", provider:"test", priceSource:"mocked", fetchedAt:"2026-08-25T00:00:00Z" },
    lodgingOption: { propertyName:"Test", checkIn:"2026-10-14", checkOut:"2026-10-18", totalPrice:280, taxesAndFees:20, sleeps:2, walkableToBeach:true, provider:"test", currency:"USD", priceSource:"mocked", fetchedAt:"2026-08-25T00:00:00Z" },
    surfConditions: { waveHeightFt:4, swellHeightFt:4, swellDirectionDeg:300, swellPeriodSec:12, windSpeedKts:6, windDirectionDeg:100, waterTemperatureF:82 },
    bookingLinks:{}, opportunityScore:88, status:"active", priceSource:"mocked", ...overrides,
  };
}

describe("surf scoring", () => {
  it("scores aligned long-period light-wind surf highly", () => {
    const result = scoreForecastHour(destination, { time:"2026-10-16T08:00", waveHeightM:1.4, swellHeightM:1.3, swellDirectionDeg:300, swellPeriodSec:12.5, windSpeedKph:10, windDirectionDeg:110, seaSurfaceTemperatureC:28 }, DEMO_WATCH);
    expect(result.score).toBeGreaterThanOrEqual(82);
    expect(result.reasons).toContain("Long-period swell");
  });
});

describe("surf window grouping", () => {
  it("prefers a contiguous block over isolated hours", () => {
    const hours = [5,6,7,8,9,13].map((h) => ({ time:`2026-10-16T${String(h).padStart(2,"0")}:00`, waveHeightM:1.4, swellHeightM:1.3, swellDirectionDeg:300, swellPeriodSec:12.5, windSpeedKph:10, windDirectionDeg:110, seaSurfaceTemperatureC:28 }));
    const forecast: DestinationForecast = { destinationId:destination.id, timezone:destination.timezone, fetchedAt:"2026-08-25T00:00:00Z", provider:"test", source:"mocked", hours };
    const windows = groupSurfWindows(destination, forecast, DEMO_WATCH);
    expect(windows).toHaveLength(1);
    expect(windows[0].reasons.some((r) => r.includes("consistent window"))).toBe(true);
  });
});

describe("trip date generation", () => {
  it("keeps the surf local calendar date inside bounded trips", () => {
    const dates = generateTripDates({ destinationId:destination.id, score:90, quality:"great", reasons:[], penalties:[], confidence:.9, windowStart:"2026-10-17T06:00", windowEnd:"2026-10-17T10:00", conditions:opportunity().surfConditions }, DEMO_WATCH);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((d) => d.departureDate <= "2026-10-17" && d.returnDate >= "2026-10-17")).toBe(true);
    expect(dates.every((d) => d.nights >= 3 && d.nights <= 5)).toBe(true);
  });
});

describe("all-in pricing and group economics", () => {
  it("shares fixed lodging and transport without inventing a discount", () => {
    const cost = calculateTripCost({ travelers:2, flightFarePerPerson:190, lodgingTotal:260, boardRentalPerPerson:60, transportTotal:80, baggagePerPerson:35, source:"mocked", shareFixedCosts:true });
    expect(cost.lodgingPerPerson).toBe(130); expect(cost.transportPerPerson).toBe(40); expect(cost.allInPerPerson).toBe(455); expect(cost.totalGroupCost).toBe(910);
  });
});

describe("watch filtering", () => {
  it("honors explicit destination restrictions and skill range", () => {
    const watch = { ...DEMO_WATCH, destinationMode:"destinations" as const, allowedDestinationIds:[destination.id] };
    expect(getEligibleDestinations(watch, SURF_DESTINATIONS)).toEqual([destination]);
  });
});

describe("opportunity scoring", () => {
  it("rewards an under-budget, simple, walkable trip", () => {
    const surf = { destinationId:destination.id, score:94, quality:"firing" as const, reasons:[], penalties:[], confidence:.92, windowStart:"2026-10-16T06:00", windowEnd:"2026-10-16T10:00", conditions:opportunity().surfConditions };
    const flight = opportunity().flightOption, lodging = opportunity().lodgingOption;
    const cost = calculateTripCost({ travelers:2, flightFarePerPerson:160, lodgingTotal:220, boardRentalPerPerson:50, transportTotal:50, baggagePerPerson:0, source:"mocked" });
    const score = scoreOpportunity({ watch:DEMO_WATCH, destination, surf, dates:{departureDate:"2026-10-14",returnDate:"2026-10-18",nights:4,surfLocalDate:"2026-10-16"}, flight, lodging, cost });
    expect(score).toBeGreaterThan(75);
  });
});

describe("deduplication and alert eligibility", () => {
  it("creates deterministic identity and only re-alerts on meaningful changes", () => {
    const args = { watchId:DEMO_WATCH.id, destinationId:destination.id, departureDate:"2026-10-14", returnDate:"2026-10-18", surfWindowStart:"2026-10-16T06:00" };
    expect(opportunityIdentity(args)).toBe(opportunityIdentity(args));
    expect(shouldAlertOpportunity(null, opportunity()).alert).toBe(true);
    expect(shouldAlertOpportunity(opportunity(), opportunity({totalPerPerson:430})).alert).toBe(false);
    expect(shouldAlertOpportunity(opportunity(), opportunity({totalPerPerson:380})).alert).toBe(true);
    expect(shouldAlertOpportunity(opportunity({surfScore:89}), opportunity({surfScore:93})).reasons).toContain("surf entered firing tier");
  });
});

describe("end-to-end-ish discovery", () => {
  it("turns a watch and deterministic forecast into qualifying mocked opportunities", async () => {
    const repo = new InMemoryDiscoveryRepository([DEMO_WATCH], SURF_DESTINATIONS);
    const result = await discoverForWatch(DEMO_WATCH, SURF_DESTINATIONS, { forecast:new MockSurfForecastProvider(), flights:new MockFlightProvider(), lodging:new MockLodgingProvider(), boards:new StaticBoardProvider(), transport:new StaticTransportProvider(), repository:repo });
    expect(result.stats.destinationsScanned).toBeGreaterThan(0); expect(result.stats.surfCandidates).toBeGreaterThan(0); expect(result.opportunities.length).toBeGreaterThan(0);
    expect(result.opportunities.every((o) => o.totalPerPerson <= DEMO_WATCH.maxAllInCostPerPerson)).toBe(true);
    expect(result.opportunities.every((o) => o.priceSource === "mocked")).toBe(true);
  });
});
