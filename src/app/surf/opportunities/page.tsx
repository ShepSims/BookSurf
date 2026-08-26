import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { SupabaseDiscoveryRepository } from "@/lib/supabase/discovery-repository";
import { TransientOpportunityRepository } from "@/lib/discovery/transient-repository";
import { discoverForWatch } from "@/lib/discovery/engine";
import { createDiscoveryServices } from "@/lib/discovery/services";
import { hasVerifiedCoreTravelPricing } from "@/lib/opportunities/pricing-verification";
import { SURF_DESTINATIONS } from "@/data/destinations";
import type {
  FlightOption,
  LodgingOption,
  PriceSource,
  SurfWatch,
  TripOpportunity,
} from "@/lib/domain/types";

type OpportunityFeedRow = {
  id: string;
  watch_id: string;
  destination_id: string;
  departure_date: string;
  return_date: string;
  surf_score: number;
  total_per_person: number | string;
  opportunity_score: number;
  price_source: PriceSource;
  flight_option_json: FlightOption;
  lodging_option_json: LodgingOption;
};

type WatchRow = {
  id: string;
  user_id: string;
  name: string;
  origin_airport: string;
  window_days: number;
  earliest_departure_date: string | null;
  latest_return_date: string | null;
  min_trip_nights: number;
  max_trip_nights: number;
  max_all_in_cost_per_person: number | string;
  travelers: number;
  destination_mode: SurfWatch["destinationMode"];
  allowed_destination_ids: string[] | null;
  allowed_regions: string[] | null;
  skill_level: SurfWatch["skillLevel"];
  min_surf_score: number;
  min_wave_height_ft: number | null;
  max_wave_height_ft: number | null;
  min_period_seconds: number | null;
  warm_water_only: boolean;
  flights_required: boolean;
  accommodation_required: boolean;
  board_rental_required: boolean;
  carry_on_required: boolean;
  walkable_to_beach_required: boolean;
  allow_connections: boolean;
  max_flight_duration_hours: number | null;
  group_discounts_enabled: boolean;
  alert_email: string;
  alerts_enabled: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type DisplayOpportunity = {
  id?: string;
  watchId: string;
  destinationId: string;
  departureDate: string;
  returnDate: string;
  surfScore: number;
  totalPerPerson: number;
  opportunityScore: number;
  priceSource: PriceSource;
  flight: FlightOption;
  lodging: LodgingOption;
  persisted: boolean;
};

const asNumber = (value: number | string) =>
  typeof value === "number" ? value : Number(value);

function mapWatch(row: WatchRow): SurfWatch {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    originAirport: row.origin_airport,
    windowDays: row.window_days,
    earliestDepartureDate: row.earliest_departure_date ?? undefined,
    latestReturnDate: row.latest_return_date ?? undefined,
    minTripNights: row.min_trip_nights,
    maxTripNights: row.max_trip_nights,
    maxAllInCostPerPerson: asNumber(row.max_all_in_cost_per_person),
    travelers: row.travelers,
    destinationMode: row.destination_mode,
    allowedDestinationIds: row.allowed_destination_ids ?? [],
    allowedRegions: row.allowed_regions ?? [],
    skillLevel: row.skill_level,
    minSurfScore: row.min_surf_score,
    minWaveHeightFt: row.min_wave_height_ft ?? undefined,
    maxWaveHeightFt: row.max_wave_height_ft ?? undefined,
    minPeriodSeconds: row.min_period_seconds ?? undefined,
    warmWaterOnly: row.warm_water_only,
    flightsRequired: row.flights_required,
    accommodationRequired: row.accommodation_required,
    boardRentalRequired: row.board_rental_required,
    carryOnRequired: row.carry_on_required,
    walkableToBeachRequired: row.walkable_to_beach_required,
    allowConnections: row.allow_connections,
    maxFlightDurationHours: row.max_flight_duration_hours ?? undefined,
    groupDiscountsEnabled: row.group_discounts_enabled,
    alertEmail: row.alert_email,
    alertsEnabled: row.alerts_enabled,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function liveFlightSearchUrl(opportunity: DisplayOpportunity) {
  if (opportunity.flight.bookingUrl) return opportunity.flight.bookingUrl;
  const query = `flights ${opportunity.flight.origin} to ${opportunity.flight.destination} ${opportunity.departureDate} ${opportunity.returnDate}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function liveStaySearchUrl(opportunity: DisplayOpportunity) {
  if (opportunity.lodging.bookingUrl) return opportunity.lodging.bookingUrl;
  const destination = SURF_DESTINATIONS.find((item) => item.id === opportunity.destinationId);
  const query = `${destination?.name ?? "surf"} hotels ${opportunity.departureDate} ${opportunity.returnDate}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function corePricingVerified(opportunity: DisplayOpportunity, watch?: SurfWatch) {
  return watch
    ? hasVerifiedCoreTravelPricing(watch, opportunity.flight, opportunity.lodging)
    : false;
}

function trimToBudgetOrClosest(
  opportunities: DisplayOpportunity[],
  watchById: Map<string, SurfWatch>,
) {
  const grouped = new Map<string, DisplayOpportunity[]>();
  for (const opportunity of opportunities) {
    const current = grouped.get(opportunity.watchId) ?? [];
    current.push(opportunity);
    grouped.set(opportunity.watchId, current);
  }

  return Array.from(grouped.values())
    .flatMap((group) => {
      const watch = watchById.get(group[0].watchId);
      if (!watch) return group;
      const inBudget = group.filter(
        (opportunity) =>
          opportunity.totalPerPerson <= watch.maxAllInCostPerPerson &&
          corePricingVerified(opportunity, watch),
      );
      if (inBudget.length) return inBudget;
      return [...group].sort((a, b) => a.totalPerPerson - b.totalPerPerson).slice(0, 1);
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

export const maxDuration = 60;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ watch?: string; scan?: string }>;
}) {
  const params = await searchParams;
  const client = await createSupabaseServerClient();
  let signedIn = false;
  let opportunities: DisplayOpportunity[] = [];
  let scanWatch: SurfWatch | null = null;
  let scanFailed = false;
  let usedTransientScan = false;
  const watchById = new Map<string, SurfWatch>();

  if (client) {
    const { data: auth } = await client.auth.getUser();
    signedIn = Boolean(auth.user);

    if (auth.user) {
      const { data: watchRows } = await client
        .from("surf_watches")
        .select("*")
        .eq("active", true);
      const watches = ((watchRows ?? []) as WatchRow[]).map(mapWatch);
      for (const watch of watches) watchById.set(watch.id, watch);

      scanWatch = params.watch ? watches.find((watch) => watch.id === params.watch) ?? null : null;

      if (params.scan === "now" && scanWatch) {
        try {
          const services = createDiscoveryServices();
          let result: Awaited<ReturnType<typeof discoverForWatch>>;

          if (hasSupabaseServiceEnv()) {
            const repository = new SupabaseDiscoveryRepository();
            const destinations = await repository.listActiveDestinations();
            result = await discoverForWatch(scanWatch, destinations, {
              ...services,
              repository,
              alerts: undefined,
            });
          } else {
            usedTransientScan = true;
            const repository = new TransientOpportunityRepository();
            result = await discoverForWatch(
              scanWatch,
              SURF_DESTINATIONS.filter((destination) => destination.active),
              { ...services, repository, alerts: undefined },
            );
          }

          opportunities = result.opportunities.map((opportunity: TripOpportunity) => ({
            id: opportunity.id,
            watchId: opportunity.watchId,
            destinationId: opportunity.destinationId,
            departureDate: opportunity.departureDate,
            returnDate: opportunity.returnDate,
            surfScore: opportunity.surfScore,
            totalPerPerson: opportunity.totalPerPerson,
            opportunityScore: opportunity.opportunityScore,
            priceSource: opportunity.priceSource,
            flight: opportunity.flightOption,
            lodging: opportunity.lodgingOption,
            persisted: !usedTransientScan,
          }));
        } catch (error) {
          scanFailed = true;
          console.error("booksurf.instant-scan.error", error);
        }
      }

      if (!opportunities.length && params.scan !== "now") {
        const { data } = await client
          .from("trip_opportunities")
          .select("*")
          .eq("status", "active")
          .order("opportunity_score", { ascending: false })
          .limit(60);

        opportunities = ((data ?? []) as OpportunityFeedRow[]).map((opportunity) => ({
          id: opportunity.id,
          watchId: opportunity.watch_id,
          destinationId: opportunity.destination_id,
          departureDate: opportunity.departure_date,
          returnDate: opportunity.return_date,
          surfScore: opportunity.surf_score,
          totalPerPerson: asNumber(opportunity.total_per_person),
          opportunityScore: opportunity.opportunity_score,
          priceSource: opportunity.price_source,
          flight: opportunity.flight_option_json,
          lodging: opportunity.lodging_option_json,
          persisted: true,
        }));
      }
    }
  }

  opportunities = trimToBudgetOrClosest(opportunities, watchById);
  const scanHasBudgetMatch = Boolean(
    scanWatch &&
      opportunities.some(
        (opportunity) =>
          opportunity.totalPerPerson <= scanWatch!.maxAllInCostPerPerson &&
          corePricingVerified(opportunity, scanWatch!),
      ),
  );
  const scanHasUnverifiedUnderBudget = Boolean(
    scanWatch &&
      opportunities.some(
        (opportunity) =>
          opportunity.totalPerPerson <= scanWatch!.maxAllInCostPerPerson &&
          !corePricingVerified(opportunity, scanWatch!),
      ),
  );
  const scanHasClosestMatch = Boolean(
    scanWatch && opportunities.length && !scanHasBudgetMatch && !scanHasUnverifiedUnderBudget,
  );

  return (
    <main className="container" style={{ padding: "62px 0 100px" }}>
      <div className="eyebrow">Opportunity feed</div>
      <h1 style={{ fontSize: 54, letterSpacing: "-.055em", margin: "12px 0 8px" }}>
        Trips worth taking.
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: 28 }}>
        Surf-qualified first, then priced against the complete trip budget.
      </p>

      {params.scan === "now" && !scanFailed && scanHasBudgetMatch && (
        <p className="panel" style={{ padding: 16 }}>
          <strong>Found it.</strong> These trips fit your surf rules and your all-in budget with live core travel pricing.
        </p>
      )}
      {params.scan === "now" && !scanFailed && scanHasUnverifiedUnderBudget && scanWatch && (
        <p className="panel" style={{ padding: 16 }}>
          <strong>Promising, but not verified yet.</strong> The current estimate is under ${Math.round(scanWatch.maxAllInCostPerPerson)}, but at least one required flight or stay price is not live, so BookSurf is not calling it a budget match.
        </p>
      )}
      {params.scan === "now" && !scanFailed && scanHasClosestMatch && scanWatch && (
        <p className="panel" style={{ padding: 16 }}>
          <strong>Nothing hit ${Math.round(scanWatch.maxAllInCostPerPerson)} yet.</strong> So we found the
          closest-priced surf trip worth taking instead. Your watch keeps the original budget target.
        </p>
      )}
      {params.scan === "now" && !scanFailed && !opportunities.length && (
        <p className="panel" style={{ padding: 16 }}>
          No destination cleared your surf-quality rules in the current forecast window. Your watch is saved.
        </p>
      )}
      {scanFailed && (
        <p className="panel" style={{ padding: 16, borderColor: "#d79b91" }}>
          The watch saved, but the instant scan failed. Try the scan again from this page shortly.
        </p>
      )}
      {usedTransientScan && (
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
          Instant results are available, but continuous background persistence/alerts still need the server-side
          Supabase discovery credential configured.
        </p>
      )}

      {!signedIn ? (
        <div className="panel" style={{ padding: 28 }}>
          <h2>Sign in to see your opportunities.</h2>
          <Link className="button" href="/account">
            Sign in
          </Link>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="panel" style={{ padding: 28, marginTop: 24 }}>
          <h2>No surf-qualified trip yet.</h2>
          <p style={{ color: "var(--muted)" }}>
            Try a slightly lower surf score or broader trip length if you want more options immediately.
          </p>
          <Link className="button secondary" href="/surf/watch">
            Create another search
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
          {opportunities.map((opportunity) => {
            const destination = SURF_DESTINATIONS.find((item) => item.id === opportunity.destinationId);
            const watch = watchById.get(opportunity.watchId);
            const budget = watch?.maxAllInCostPerPerson;
            const verified = corePricingVerified(opportunity, watch);
            const verifiedInBudget = Boolean(
              watch && verified && opportunity.totalPerPerson <= watch.maxAllInCostPerPerson,
            );
            const overBudget = budget ? Math.max(0, opportunity.totalPerPerson - budget) : 0;
            const flightUrl = liveFlightSearchUrl(opportunity);
            const stayUrl = liveStaySearchUrl(opportunity);
            const pricingLabel = verifiedInBudget
              ? "Live core travel pricing · within budget"
              : overBudget > 0
                ? `Closest match · $${Math.round(overBudget)} over target`
                : "Estimate under target · not fully live";

            return (
              <div key={`${opportunity.watchId}-${opportunity.destinationId}-${opportunity.departureDate}`} className="panel" style={{ padding: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16 }}>
                  <div>
                    <div className="eyebrow">{pricingLabel}</div>
                    <h2 style={{ fontSize: 30, margin: "6px 0" }}>{destination?.name ?? "Surf trip"}</h2>
                    <div>
                      {opportunity.departureDate} → {opportunity.returnDate} · Surf {opportunity.surfScore}/100
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                      Flight: {opportunity.flight.airline} · ${Math.round(opportunity.flight.totalFare)}/person · {opportunity.flight.priceSource}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: 28 }}>${Math.round(opportunity.totalPerPerson)}</strong>
                    <div>/ person</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                  {opportunity.persisted && opportunity.id && (
                    <Link className="button secondary" href={`/surf/opportunities/${opportunity.id}`}>
                      Trip details
                    </Link>
                  )}
                  <a className="button" href={flightUrl} target="_blank" rel="noreferrer">
                    {opportunity.flight.bookingUrl ? "Book flight" : "Check live flight"}
                  </a>
                  <a className="button secondary" href={stayUrl} target="_blank" rel="noreferrer">
                    {opportunity.lodging.bookingUrl ? "Book stay" : "Check live stays"}
                  </a>
                </div>
                {!verified && (
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "14px 0 0" }}>
                    This total is not budget-verified because at least one required flight or lodging component is not live. BookSurf will not send a deal alert for it yet.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
