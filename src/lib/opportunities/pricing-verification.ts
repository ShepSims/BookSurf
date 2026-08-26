import type { FlightOption, LodgingOption, SurfWatch, TripOpportunity } from "@/lib/domain/types";

function sourceIsLiveOrNotRequired(source: string, provider: string) {
  return source === "live" || provider === "booksurf-not-required";
}

export function hasVerifiedCoreTravelPricing(
  watch: Pick<SurfWatch, "flightsRequired" | "accommodationRequired">,
  flight: FlightOption,
  lodging: LodgingOption,
) {
  const flightVerified =
    !watch.flightsRequired || sourceIsLiveOrNotRequired(flight.priceSource, flight.provider);
  const lodgingVerified =
    !watch.accommodationRequired || sourceIsLiveOrNotRequired(lodging.priceSource, lodging.provider);
  return flightVerified && lodgingVerified;
}

export function isVerifiedBudgetMatch(
  watch: Pick<SurfWatch, "flightsRequired" | "accommodationRequired" | "maxAllInCostPerPerson">,
  opportunity: Pick<TripOpportunity, "totalPerPerson" | "flightOption" | "lodgingOption">,
) {
  return (
    opportunity.totalPerPerson <= watch.maxAllInCostPerPerson &&
    hasVerifiedCoreTravelPricing(watch, opportunity.flightOption, opportunity.lodgingOption)
  );
}
