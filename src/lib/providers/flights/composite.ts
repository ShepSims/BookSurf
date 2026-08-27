import type { FlightOption, FlightSearchInput } from "@/lib/domain/types";
import { compareBySourceThenPrice } from "@/lib/providers/shared/ranking";
import type { FlightProvider } from "./types";

export class CompositeFlightProvider implements FlightProvider {
  constructor(private readonly providers: FlightProvider[]) {}

  async search(input: FlightSearchInput): Promise<FlightOption[]> {
    const results = await Promise.allSettled(this.providers.map((provider) => provider.search(input)));
    const options = results.flatMap((result) => {
      if (result.status === "fulfilled") return result.value;
      console.error("booksurf.flight-provider.error", result.reason);
      return [];
    });

    const deduped = new Map<string, FlightOption>();
    for (const option of options) {
      const key = option.offerId ?? [
        option.origin,
        option.destination,
        option.departureAt,
        option.returnAt,
        option.airline,
        Math.round(option.totalFare),
      ].join("|");
      const current = deduped.get(key);
      if (!current || compareBySourceThenPrice(option, current, (x) => x.priceSource, (x) => x.totalFare) < 0) {
        deduped.set(key, option);
      }
    }

    return [...deduped.values()].sort((a, b) =>
      compareBySourceThenPrice(a, b, (x) => x.priceSource, (x) => x.totalFare),
    );
  }
}
