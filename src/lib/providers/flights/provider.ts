import type { FlightProvider } from "./types";
import { CompositeFlightProvider } from "./composite";
import { DuffelFlightProvider } from "./duffel";
import { MockFlightProvider } from "./mock";
import { TravelpayoutsFlightProvider } from "./travelpayouts";

export function createFlightProvider(): FlightProvider {
  const providers: FlightProvider[] = [];
  const duffelToken = process.env.DUFFEL_ACCESS_TOKEN;
  if (duffelToken) providers.push(new DuffelFlightProvider(duffelToken));

  const travelpayoutsToken = process.env.TRAVELPAYOUTS_TOKEN;
  const marker = process.env.TRAVELPAYOUTS_MARKER;
  if (travelpayoutsToken && marker) {
    providers.push(new TravelpayoutsFlightProvider(travelpayoutsToken, marker));
  }

  if (!providers.length) providers.push(new MockFlightProvider());
  return providers.length === 1 ? providers[0] : new CompositeFlightProvider(providers);
}
