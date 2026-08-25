import { describe, expect, it } from "vitest";
import { DEMO_WATCH } from "@/data/demo-watch";
import { SURF_DESTINATIONS } from "@/data/destinations";
import { discoverForWatch } from "@/lib/discovery/engine";
import { InMemoryDiscoveryRepository } from "@/lib/discovery/in-memory-repository";
import { StaticBoardProvider } from "@/lib/providers/boards/static-provider";
import { MockSurfForecastProvider } from "@/lib/providers/forecast/mock";
import { MockFlightProvider } from "@/lib/providers/flights/mock";
import { MockLodgingProvider } from "@/lib/providers/lodging/mock";
import { StaticTransportProvider } from "@/lib/providers/transport/static-provider";

describe("near-budget fallback", () => {
  it("returns one closest trip and does not alert when nothing can fit the budget", async () => {
    const watch = {
      ...DEMO_WATCH,
      id: "00000000-0000-4000-8000-00000000f001",
      maxAllInCostPerPerson: 1,
      alertsEnabled: true,
    };
    const repository = new InMemoryDiscoveryRepository([watch], SURF_DESTINATIONS);
    let alertsSent = 0;

    const result = await discoverForWatch(watch, SURF_DESTINATIONS, {
      forecast: new MockSurfForecastProvider(),
      flights: new MockFlightProvider(),
      lodging: new MockLodgingProvider(),
      boards: new StaticBoardProvider(),
      transport: new StaticTransportProvider(),
      repository,
      alerts: {
        async sendOpportunity() {
          alertsSent++;
          return { sent: true };
        },
      },
    });

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].totalPerPerson).toBeGreaterThan(watch.maxAllInCostPerPerson);
    expect(result.alertsSent).toBe(0);
    expect(alertsSent).toBe(0);
  });
});
