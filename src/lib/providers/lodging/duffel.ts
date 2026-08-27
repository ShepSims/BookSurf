import type { LodgingOption, LodgingSearchInput } from "@/lib/domain/types";
import type { LodgingProvider } from "./types";

const ENDPOINT = "https://api.duffel.com/stays/search";
const REQUEST_TIMEOUT_MS = 16_000;
const WALKABLE_RADIUS_KM = 1.5;
const DEFAULT_RADIUS_KM = 8;

type Coordinates = { latitude?: number; longitude?: number };
type DuffelAccommodation = {
  id?: string;
  name?: string;
  location?: { geographic_coordinates?: Coordinates };
};
type DuffelSearchResult = {
  id?: string;
  expires_at?: string;
  cheapest_rate_total_amount?: string;
  cheapest_rate_currency?: string;
  cheapest_rate_public_amount?: string | null;
  cheapest_rate_public_currency?: string | null;
  accommodation?: DuffelAccommodation;
};
type DuffelStayResponse = { data?: { results?: DuffelSearchResult[] } };

function distanceMeters(a: Coordinates, b: Coordinates) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return undefined;
  const r = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export class DuffelLodgingProvider implements LodgingProvider {
  constructor(private readonly accessToken: string) {}

  async search(input: LodgingSearchInput): Promise<LodgingOption[]> {
    if (!this.accessToken) return [];
    const radius = input.walkableToBeachRequired ? WALKABLE_RADIUS_KM : DEFAULT_RADIUS_KM;
    const response = await fetch(ENDPOINT, {
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
          location: {
            radius,
            geographic_coordinates: {
              latitude: input.destination.latitude,
              longitude: input.destination.longitude,
            },
          },
          check_in_date: input.checkIn,
          check_out_date: input.checkOut,
          guests: Array.from({ length: input.travelers }, () => ({ type: "adult" })),
          rooms: 1,
          mobile: false,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Duffel Stays ${response.status}: ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as DuffelStayResponse;
    const fetchedAt = new Date().toISOString();
    const liveToken = !this.accessToken.startsWith("duffel_test_");
    const origin = { latitude: input.destination.latitude, longitude: input.destination.longitude };

    return (payload.data?.results ?? [])
      .flatMap((result): LodgingOption[] => {
        const total = Number(result.cheapest_rate_total_amount);
        const currency = (result.cheapest_rate_currency ?? "").toUpperCase();
        if (!Number.isFinite(total) || total <= 0 || currency !== "USD") return [];
        const coordinates = result.accommodation?.location?.geographic_coordinates;
        const distanceToBeachMeters = coordinates ? distanceMeters(origin, coordinates) : undefined;
        const walkableToBeach = distanceToBeachMeters != null
          ? distanceToBeachMeters <= WALKABLE_RADIUS_KM * 1000
          : input.walkableToBeachRequired;
        if (input.walkableToBeachRequired && !walkableToBeach) return [];

        const publicPrice = result.cheapest_rate_public_amount == null
          ? undefined
          : Number(result.cheapest_rate_public_amount);

        return [{
          propertyName: result.accommodation?.name ?? "Duffel stay",
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          totalPrice: total,
          taxesAndFees: 0,
          sleeps: input.travelers,
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          distanceToBeachMeters,
          walkableToBeach,
          provider: liveToken ? "duffel-stays-live-search" : "duffel-stays-test-search",
          currency: "USD",
          originalCurrency: currency,
          priceSource: liveToken ? "live" : "mocked",
          fetchedAt,
          searchResultId: result.id,
          offerExpiresAt: result.expires_at,
          publicPrice: Number.isFinite(publicPrice) ? publicPrice : undefined,
        }];
      })
      .sort((a, b) => a.totalPrice - b.totalPrice);
  }
}
