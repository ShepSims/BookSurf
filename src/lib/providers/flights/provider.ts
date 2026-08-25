import type { FlightProvider } from "./types";
import { MockFlightProvider } from "./mock";
import { TravelpayoutsFlightProvider } from "./travelpayouts";
export function createFlightProvider():FlightProvider { const mode=process.env.BOOKSURF_PROVIDER_MODE??"mock",token=process.env.TRAVELPAYOUTS_TOKEN,marker=process.env.TRAVELPAYOUTS_MARKER; return mode==="live"&&token&&marker?new TravelpayoutsFlightProvider(token,marker):new MockFlightProvider(); }
