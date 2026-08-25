import type {
  DiscoveryRunStats,
  FlightOption,
  LodgingOption,
  PriceSource,
  SurfDestination,
  SurfWatch,
  TripOpportunity,
} from "@/lib/domain/types";
import type { SurfForecastProvider } from "@/lib/providers/forecast/provider";
import type { FlightProvider } from "@/lib/providers/flights/types";
import type { LodgingProvider } from "@/lib/providers/lodging/types";
import type { BoardProvider } from "@/lib/providers/boards/types";
import type { TransportProvider } from "@/lib/providers/transport/types";
import type { AlertSender, DiscoveryRepository, OpportunityRepository } from "./types";
import { DISCOVERY_LIMITS } from "@/lib/config";
import { getEligibleDestinations } from "@/lib/surf/filtering";
import { groupSurfWindows } from "@/lib/surf/windows";
import { generateTripDates } from "@/lib/trips/date-generation";
import { calculateTripCost } from "@/lib/trips/pricing";
import { opportunityIdentity, shouldAlertOpportunity } from "@/lib/opportunities/dedupe";
import { scoreOpportunity } from "@/lib/opportunities/scoring";
import { localCalendarDate, localDateTimeHour } from "@/lib/utils";

function combinePriceSource(sources: PriceSource[]): PriceSource {
  if (sources.includes("mocked")) return "mocked";
  if (sources.includes("estimated")) return "estimated";
  if (sources.includes("cached")) return "cached";
  return "live";
}

async function mapLimited<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  return results;
}

export interface DiscoveryServices {
  forecast: SurfForecastProvider;
  flights: FlightProvider;
  lodging: LodgingProvider;
  boards: BoardProvider;
  transport: TransportProvider;
  repository: OpportunityRepository;
  alerts?: AlertSender;
}

type PricedCandidate = {
  opportunity: TripOpportunity;
  destination: SurfDestination;
  inBudget: boolean;
};

export function selectBudgetMatches(candidates: PricedCandidate[]): PricedCandidate[] {
  const inBudget = candidates.filter((candidate) => candidate.inBudget);
  if (inBudget.length) return inBudget;

  // An empty results page has no purchase value. If surf and trip requirements fit
  // but price misses the target, keep the single closest-priced trip as a fallback.
  return [...candidates]
    .sort(
      (a, b) =>
        a.opportunity.totalPerPerson - b.opportunity.totalPerPerson ||
        b.opportunity.opportunityScore - a.opportunity.opportunityScore,
    )
    .slice(0, 1);
}

export async function discoverForWatch(
  watch: SurfWatch,
  destinations: SurfDestination[],
  services: DiscoveryServices,
): Promise<{
  opportunities: TripOpportunity[];
  stats: Omit<DiscoveryRunStats, "watchCount" | "alertsSent" | "errorCount">;
  alertsSent: number;
  errors: number;
}> {
  const eligible = getEligibleDestinations(watch, destinations);
  let errors = 0;
  let travelSearches = 0;
  let alertsSent = 0;

  const forecastResults = await mapLimited(
    eligible,
    DISCOVERY_LIMITS.forecastConcurrency,
    async (destination) => {
      const forecast = await services.forecast.getForecast(destination);
      await services.repository.saveForecast(destination, forecast);
      return { destination, forecast };
    },
  );

  const rankedCandidates = forecastResults
    .flatMap((result) => {
      if (result.status === "rejected") {
        errors++;
        console.error("booksurf.forecast.error", result.reason);
        return [];
      }
      const localHour = localDateTimeHour(new Date(), result.value.destination.timezone);
      const forecast = {
        ...result.value.forecast,
        hours: result.value.forecast.hours
          .filter((hour) => hour.time >= localHour)
          .slice(0, Math.max(1, watch.windowDays) * 24),
      };
      const windows = groupSurfWindows(result.value.destination, forecast, watch).slice(
        0,
        DISCOVERY_LIMITS.maxSurfWindowsPerDestination,
      );
      return windows.map((window) => ({ destination: result.value.destination, window }));
    })
    .sort((a, b) => b.window.score - a.window.score);

  const topDestinationIds = new Set<string>();
  const surfCandidates = rankedCandidates.filter((candidate) => {
    if (topDestinationIds.has(candidate.destination.id)) return true;
    if (topDestinationIds.size >= DISCOVERY_LIMITS.maxDestinationsPerWatch) return false;
    topDestinationIds.add(candidate.destination.id);
    return true;
  });

  const now = new Date();
  const tripInputs = surfCandidates.flatMap(({ destination, window }) => {
    const todayLocal = localCalendarDate(now, destination.timezone);
    return generateTripDates(window, watch)
      .filter((dates) => dates.departureDate >= todayLocal)
      .slice(0, DISCOVERY_LIMITS.maxTripDatePermutationsPerWindow)
      .map((dates) => ({ destination, window, dates }));
  });

  const priced = await mapLimited(
    tripInputs,
    DISCOVERY_LIMITS.travelConcurrency,
    async ({ destination, window, dates }): Promise<PricedCandidate | null> => {
      const fetchedAt = new Date().toISOString();
      const noFlight: FlightOption = {
        origin: watch.originAirport,
        destination: destination.nearestAirportCodes[0] ?? destination.slug,
        departureAt: `${dates.departureDate}T00:00:00`,
        returnAt: `${dates.returnDate}T00:00:00`,
        airline: "Not required",
        stops: 0,
        durationMinutes: 0,
        baseFare: 0,
        carryOnCost: 0,
        totalFare: 0,
        currency: "USD",
        provider: "booksurf-not-required",
        priceSource: "estimated",
        fetchedAt,
      };
      const noLodging: LodgingOption = {
        propertyName: "Not required",
        checkIn: dates.departureDate,
        checkOut: dates.returnDate,
        totalPrice: 0,
        taxesAndFees: 0,
        sleeps: watch.travelers,
        walkableToBeach: true,
        provider: "booksurf-not-required",
        currency: "USD",
        priceSource: "estimated",
        fetchedAt,
      };

      const flightPromise = watch.flightsRequired
        ? services.flights.search({
            origin: watch.originAirport,
            destinationAirports: destination.nearestAirportCodes,
            departureDate: dates.departureDate,
            returnDate: dates.returnDate,
            travelers: watch.travelers,
            carryOnRequired: watch.carryOnRequired,
            allowConnections: watch.allowConnections,
            maxFlightDurationHours: watch.maxFlightDurationHours,
          })
        : Promise.resolve([noFlight]);
      const lodgingPromise = watch.accommodationRequired
        ? services.lodging.search({
            destination,
            checkIn: dates.departureDate,
            checkOut: dates.returnDate,
            travelers: watch.travelers,
            walkableToBeachRequired: watch.walkableToBeachRequired,
          })
        : Promise.resolve([noLodging]);

      travelSearches += Number(watch.flightsRequired) + Number(watch.accommodationRequired);
      const [flightOptions, lodgingOptions, board, transport] = await Promise.all([
        flightPromise,
        lodgingPromise,
        services.boards.quote(destination, dates.nights + 1, watch.travelers),
        services.transport.quote(destination, dates.nights + 1, watch.travelers),
      ]);
      const flight = flightOptions[0];
      const lodging = lodgingOptions[0];
      if (!flight || !lodging) return null;
      if (watch.accommodationRequired && watch.walkableToBeachRequired && !lodging.walkableToBeach) {
        return null;
      }

      const priceSources: PriceSource[] = [transport.priceSource];
      if (watch.flightsRequired) priceSources.push(flight.priceSource);
      if (watch.accommodationRequired) priceSources.push(lodging.priceSource);
      if (watch.boardRentalRequired) priceSources.push(board.priceSource);
      const source = combinePriceSource(priceSources);
      const cost = calculateTripCost({
        travelers: watch.travelers,
        flightFarePerPerson: watch.flightsRequired ? flight.baseFare : 0,
        lodgingTotal: watch.accommodationRequired ? lodging.totalPrice : 0,
        boardRentalPerPerson: watch.boardRentalRequired ? board.totalPerPerson : 0,
        transportTotal: transport.total,
        baggagePerPerson:
          watch.flightsRequired && watch.carryOnRequired ? flight.carryOnCost : 0,
        source,
        shareFixedCosts: watch.groupDiscountsEnabled,
      });

      const identityKey = opportunityIdentity({
        watchId: watch.id,
        destinationId: destination.id,
        departureDate: dates.departureDate,
        returnDate: dates.returnDate,
        surfWindowStart: window.windowStart,
      });
      const opportunity: TripOpportunity = {
        identityKey,
        watchId: watch.id,
        userId: watch.userId,
        destinationId: destination.id,
        departureDate: dates.departureDate,
        returnDate: dates.returnDate,
        surfWindowStart: window.windowStart,
        surfWindowEnd: window.windowEnd,
        surfTimezone: destination.timezone,
        surfScore: window.score,
        surfConfidence: window.confidence,
        flightPricePerPerson: cost.flightPerPerson,
        lodgingTotal: cost.lodgingTotal,
        lodgingPerPerson: cost.lodgingPerPerson,
        boardRentalPerPerson: cost.boardPerPerson,
        transportPerPerson: cost.transportPerPerson,
        baggagePerPerson: cost.baggagePerPerson,
        totalPerPerson: cost.allInPerPerson,
        totalGroupCost: cost.totalGroupCost,
        flightOption: flight,
        lodgingOption: lodging,
        surfConditions: window.conditions,
        bookingLinks: { flight: flight.bookingUrl, lodging: lodging.bookingUrl },
        opportunityScore: scoreOpportunity({ watch, destination, surf: window, dates, flight, lodging, cost }),
        status: "active",
        priceSource: source,
      };

      return {
        opportunity,
        destination,
        inBudget: cost.allInPerPerson <= watch.maxAllInCostPerPerson,
      };
    },
  );

  const candidates: PricedCandidate[] = [];
  for (const result of priced) {
    if (result.status === "rejected") {
      errors++;
      console.error("booksurf.travel.error", result.reason);
      continue;
    }
    if (result.value) candidates.push(result.value);
  }

  const selectedCandidates = selectBudgetMatches(candidates);
  const opportunities: TripOpportunity[] = [];

  for (const { opportunity, destination, inBudget } of selectedCandidates) {
    const previous = await services.repository.getPrevious(opportunity.identityKey);
    let alertDecision = shouldAlertOpportunity(previous, opportunity);
    const saved = await services.repository.saveOpportunity(opportunity);

    // Closest-match fallbacks are useful on-screen, but should not trigger a
    // "deal found" email until they actually cross the user's budget.
    if (inBudget && previous && saved.id && !alertDecision.alert && !(await services.repository.hasSentAlert(saved.id))) {
      alertDecision = {
        alert: true,
        reasons: ["opportunity has not been successfully alerted yet"],
      };
    }

    await services.repository.saveSnapshot(saved);
    opportunities.push(saved);

    if (
      inBudget &&
      saved.status === "active" &&
      watch.alertsEnabled &&
      alertDecision.alert &&
      services.alerts
    ) {
      try {
        const delivery = await services.alerts.sendOpportunity({
          watch,
          opportunity: saved,
          destination,
          reasons: alertDecision.reasons,
        });
        await services.repository.saveAlert({
          watch,
          opportunity: saved,
          status: delivery.sent ? "sent" : "skipped",
          reasons: alertDecision.reasons,
          providerMessageId: delivery.providerMessageId,
        });
        if (delivery.sent) alertsSent++;
      } catch (error) {
        errors++;
        await services.repository.saveAlert({
          watch,
          opportunity: saved,
          status: "failed",
          reasons: alertDecision.reasons,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        console.error("booksurf.alert.error", error);
      }
    }
  }

  const bestByIdentity = Array.from(
    new Map(
      opportunities
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .map((opportunity) => [opportunity.identityKey, opportunity]),
    ).values(),
  );

  return {
    opportunities: bestByIdentity,
    stats: {
      destinationsScanned: eligible.length,
      surfCandidates: surfCandidates.length,
      travelSearches,
      opportunitiesFound: bestByIdentity.length,
    },
    alertsSent,
    errors,
  };
}

export async function runDiscovery(
  repository: DiscoveryRepository,
  services: Omit<DiscoveryServices, "repository">,
) {
  const runId = await repository.startRun();
  const stats: DiscoveryRunStats = {
    watchCount: 0,
    destinationsScanned: 0,
    surfCandidates: 0,
    travelSearches: 0,
    opportunitiesFound: 0,
    alertsSent: 0,
    errorCount: 0,
  };

  try {
    await repository.expirePastOpportunities(new Date().toISOString().slice(0, 10));
    const [watches, destinations] = await Promise.all([
      repository.listActiveWatches(),
      repository.listActiveDestinations(),
    ]);
    stats.watchCount = watches.length;

    for (const watch of watches) {
      try {
        const result = await discoverForWatch(watch, destinations, { ...services, repository });
        stats.destinationsScanned += result.stats.destinationsScanned;
        stats.surfCandidates += result.stats.surfCandidates;
        stats.travelSearches += result.stats.travelSearches;
        stats.opportunitiesFound += result.stats.opportunitiesFound;
        stats.alertsSent += result.alertsSent;
        stats.errorCount += result.errors;
      } catch (error) {
        stats.errorCount++;
        console.error("booksurf.watch.error", { watchId: watch.id, error });
      }
    }

    await repository.finishRun(runId, stats.errorCount ? "partial" : "completed", stats);
    return { runId, stats };
  } catch (error) {
    stats.errorCount++;
    await repository.finishRun(runId, "failed", stats);
    throw error;
  }
}
