import type { LodgingProvider } from "./types";
import { CompositeLodgingProvider } from "./composite";
import { DuffelLodgingProvider } from "./duffel";
import { MockLodgingProvider } from "./mock";

export function createLodgingProvider(): LodgingProvider {
  const providers: LodgingProvider[] = [];
  const duffelToken = process.env.DUFFEL_ACCESS_TOKEN;
  if (duffelToken) providers.push(new DuffelLodgingProvider(duffelToken));

  // Additional suppliers (Booking.com Demand, Expedia Rapid, direct hotel feeds)
  // plug into this list without changing discovery or pricing code.
  providers.push(new MockLodgingProvider());
  return providers.length === 1 ? providers[0] : new CompositeLodgingProvider(providers);
}
