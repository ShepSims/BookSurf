import type { LodgingOption, LodgingSearchInput } from "@/lib/domain/types";
import { compareBySourceThenPrice } from "@/lib/providers/shared/ranking";
import type { LodgingProvider } from "./types";

export class CompositeLodgingProvider implements LodgingProvider {
  constructor(private readonly providers: LodgingProvider[]) {}

  async search(input: LodgingSearchInput): Promise<LodgingOption[]> {
    const results = await Promise.allSettled(this.providers.map((provider) => provider.search(input)));
    const options = results.flatMap((result) => {
      if (result.status === "fulfilled") return result.value;
      console.error("booksurf.lodging-provider.error", result.reason);
      return [];
    });

    const deduped = new Map<string, LodgingOption>();
    for (const option of options) {
      const key = option.searchResultId ?? [option.propertyName, option.checkIn, option.checkOut].join("|");
      const current = deduped.get(key);
      if (!current || compareBySourceThenPrice(option, current, (x) => x.priceSource, (x) => x.totalPrice) < 0) {
        deduped.set(key, option);
      }
    }

    return [...deduped.values()].sort((a, b) =>
      compareBySourceThenPrice(a, b, (x) => x.priceSource, (x) => x.totalPrice),
    );
  }
}
