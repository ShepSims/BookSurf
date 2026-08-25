import { ConsoleAlertSender, ResendAlertSender } from "@/lib/alerts/email";
import { StaticBoardProvider } from "@/lib/providers/boards/static-provider";
import { CombinedSurfForecastProvider } from "@/lib/providers/forecast/provider";
import { MockSurfForecastProvider } from "@/lib/providers/forecast/mock";
import { createFlightProvider } from "@/lib/providers/flights/provider";
import { createLodgingProvider } from "@/lib/providers/lodging/provider";
import { OpenMeteoMarineProvider } from "@/lib/providers/marine/open-meteo";
import { StaticTransportProvider } from "@/lib/providers/transport/static-provider";
import { OpenMeteoWeatherProvider } from "@/lib/providers/weather/open-meteo";

export function createDiscoveryServices(options?: { demo?: boolean }) {
  const demo = options?.demo ?? false;
  const forecast = demo && (process.env.BOOKSURF_DEMO_FORECAST_MODE ?? "mock") === "mock"
    ? new MockSurfForecastProvider()
    : new CombinedSurfForecastProvider(new OpenMeteoMarineProvider(), new OpenMeteoWeatherProvider());
  return {
    forecast,
    flights: createFlightProvider(),
    lodging: createLodgingProvider(),
    boards: new StaticBoardProvider(),
    transport: new StaticTransportProvider(),
    alerts: demo ? new ConsoleAlertSender() : new ResendAlertSender(),
  };
}
