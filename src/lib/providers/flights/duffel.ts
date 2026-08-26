import type { FlightOption, FlightSearchInput, PriceSource } from "@/lib/domain/types";
import type { FlightProvider } from "./types";

const OFFER_REQUEST_ENDPOINT = "https://api.duffel.com/air/offer_requests";
const SUPPLIER_TIMEOUT_MS = 12_000;
const REQUEST_TIMEOUT_MS = 16_000;

type DuffelBaggage = {
  type?: string;
  quantity?: number;
};

type DuffelSegmentPassenger = {
  baggages?: DuffelBaggage[];
};

type DuffelCarrier = {
  name?: string;
};

type DuffelPlace = {
  iata_code?: string;
};

type DuffelSegment = {
  departing_at?: string;
  arriving_at?: string;
  duration?: string;
  origin?: DuffelPlace;
  destination?: DuffelPlace;
  operating_carrier?: DuffelCarrier;
  marketing_carrier?: DuffelCarrier;
  passengers?: DuffelSegmentPassenger[];
  stops?: unknown[];
};

type DuffelSlice = {
  duration?: string;
  segments?: DuffelSegment[];
};

type DuffelOffer = {
  id?: string;
  expires_at?: string;
  total_amount?: string;
  total_currency?: string;
  owner?: DuffelCarrier;
  slices?: DuffelSlice[];
};

type DuffelOfferRequestResponse = {
  data?: {
    id?: string;
    live_mode?: boolean;
    offers?: DuffelOffer[];
  };
  errors?: Array<{ title?: string; message?: string }>;
};

function durationMinutes(value?: string): number {
  if (!value) return 0;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value);
  if (!match) return 0;
  return (
    Number(match[1] ?? 0) * 24 * 60 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0) +
    Math.round(Number(match[4] ?? 0) / 60)
  );
}

function sliceDurationMinutes(slice: DuffelSlice): number {
  const explicit = durationMinutes(slice.duration);
  if (explicit) return explicit;
  return (slice.segments ?? []).reduce((sum, segment) => sum + durationMinutes(segment.duration), 0);
}

function offerAirline(offer: DuffelOffer): string {
  const carriers = new Set<string>();
  for (const slice of offer.slices ?? []) {
    for (const segment of slice.segments ?? []) {
      const carrier = segment.operating_carrier?.name ?? segment.marketing_carrier?.name;
      if (carrier) carriers.add(carrier);
    }
  }
  return [...carriers].join(" / ") || offer.owner?.name || "Unknown airline";
}

function hasIncludedCarryOn(offer: DuffelOffer): boolean {
  const passengers = (offer.slices ?? []).flatMap((slice) =>
    (slice.segments ?? []).flatMap((segment) => segment.passengers ?? []),
  );
  if (!passengers.length) return false;

  return passengers.every((passenger) =>
    (passenger.baggages ?? []).some((bag) => {
      const type = (bag.type ?? "").toLowerCase().replace(/[-\s]/g, "_");
      return (type === "carry_on" || type === "cabin") && (bag.quantity ?? 0) >= 1;
    }),
  );
}

function sourceForOffer(liveMode: boolean, carryOnRequired: boolean, carryOnIncluded: boolean): PriceSource {
  if (!liveMode) return "mocked";
  if (carryOnRequired && !carryOnIncluded) return "estimated";
  return "live";
}

export class DuffelFlightProvider implements FlightProvider {
  constructor(private readonly accessToken: string) {}

  async search(input: FlightSearchInput): Promise<FlightOption[]> {
    if (!this.accessToken) return [];

    const results = await Promise.allSettled(
      input.destinationAirports.slice(0, 2).map(async (destination) => {
        const endpoint = new URL(OFFER_REQUEST_ENDPOINT);
        endpoint.searchParams.set("return_offers", "true");
        endpoint.searchParams.set("supplier_timeout", String(SUPPLIER_TIMEOUT_MS));
        endpoint.searchParams.set("view", "offers");

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "Content-Type": "application/json",
            "Duffel-Version": "v2",
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: JSON.stringify({
            data: {
              slices: [
                {
                  origin: input.origin,
                  destination,
                  departure_date: input.departureDate,
                },
                {
                  origin: destination,
                  destination: input.origin,
                  departure_date: input.returnDate,
                },
              ],
              passengers: Array.from({ length: input.travelers }, () => ({ type: "adult" })),
              cabin_class: "economy",
              max_connections: input.allowConnections ? 1 : 0,
            },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Duffel ${response.status}: ${body.slice(0, 300)}`);
        }

        return {
          destination,
          payload: (await response.json()) as DuffelOfferRequestResponse,
        };
      }),
    );

    const fetchedAt = new Date().toISOString();
    const options: FlightOption[] = [];

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("booksurf.duffel.search.error", result.reason);
        continue;
      }

      const liveMode = result.value.payload.data?.live_mode === true;
      for (const offer of result.value.payload.data?.offers ?? []) {
        const totalAmount = Number(offer.total_amount);
        const currency = (offer.total_currency ?? "").toUpperCase();
        if (!Number.isFinite(totalAmount) || totalAmount <= 0 || currency !== "USD") continue;

        const slices = offer.slices ?? [];
        const outbound = slices[0];
        const inbound = slices[1];
        const outboundSegments = outbound?.segments ?? [];
        const inboundSegments = inbound?.segments ?? [];
        if (!outboundSegments.length || !inboundSegments.length) continue;

        const sliceDurations = slices.map(sliceDurationMinutes);
        const longestSliceMinutes = Math.max(...sliceDurations, 0);
        if (
          input.maxFlightDurationHours &&
          longestSliceMinutes > input.maxFlightDurationHours * 60
        ) {
          continue;
        }

        const maxConnections = Math.max(
          Math.max(0, outboundSegments.length - 1),
          Math.max(0, inboundSegments.length - 1),
        );
        if (!input.allowConnections && maxConnections > 0) continue;

        const carryOnIncluded = hasIncludedCarryOn(offer);
        const priceSource = sourceForOffer(liveMode, input.carryOnRequired, carryOnIncluded);
        const perPersonFare = totalAmount / Math.max(1, input.travelers);
        const firstOutbound = outboundSegments[0];
        const firstInbound = inboundSegments[0];
        const outboundDestination = outboundSegments[outboundSegments.length - 1]?.destination?.iata_code;

        options.push({
          origin: firstOutbound.origin?.iata_code ?? input.origin,
          destination: outboundDestination ?? result.value.destination,
          departureAt: firstOutbound.departing_at ?? `${input.departureDate}T00:00:00`,
          returnAt: firstInbound.departing_at ?? `${input.returnDate}T00:00:00`,
          airline: offerAirline(offer),
          stops: maxConnections,
          durationMinutes: sliceDurations.reduce((sum, minutes) => sum + minutes, 0),
          baseFare: perPersonFare,
          carryOnCost: 0,
          totalFare: perPersonFare,
          currency: "USD",
          originalCurrency: currency,
          provider: liveMode
            ? input.carryOnRequired && !carryOnIncluded
              ? "duffel-live-offer+carry-on-unverified"
              : "duffel-live-offer"
            : "duffel-test-offer",
          priceSource,
          fetchedAt,
          offerId: offer.id,
          offerExpiresAt: offer.expires_at,
          carryOnIncluded,
        });
      }
    }

    return options.sort((a, b) => a.totalFare - b.totalFare);
  }
}
