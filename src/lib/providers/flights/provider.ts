import type { FlightProvider } from "./types";
import { MockFlightProvider } from "./mock";
import { TravelpayoutsFlightProvider } from "./travelpayouts";

export function createFlightProvider(): FlightProvider {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  const marker = process.env.TRAVELPAYOUTS_MARKER;
  const mode = process.env.BOOKSURF_PROVIDER_MODE ?? (token && marker ? "live" : "mock");
  return mode === "live" && token && marker
    ? new TravelpayoutsFlightProvider(token, marker)
    : new MockFlightProvider();
}
