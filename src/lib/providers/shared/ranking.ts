import type { PriceSource } from "@/lib/domain/types";

const SOURCE_RANK: Record<PriceSource, number> = {
  live: 0,
  cached: 1,
  estimated: 2,
  mocked: 3,
};

export function sourceRank(source: PriceSource) {
  return SOURCE_RANK[source];
}

export function compareBySourceThenPrice<T>(
  a: T,
  b: T,
  source: (value: T) => PriceSource,
  price: (value: T) => number,
) {
  return sourceRank(source(a)) - sourceRank(source(b)) || price(a) - price(b);
}
