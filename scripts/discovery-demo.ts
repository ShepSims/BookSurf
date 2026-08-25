import { DEMO_WATCH } from "../src/data/demo-watch";
import { SURF_DESTINATIONS } from "../src/data/destinations";
import { runDiscovery } from "../src/lib/discovery/engine";
import { InMemoryDiscoveryRepository } from "../src/lib/discovery/in-memory-repository";
import { StaticBoardProvider } from "../src/lib/providers/boards/static-provider";
import { MockSurfForecastProvider } from "../src/lib/providers/forecast/mock";
import { MockFlightProvider } from "../src/lib/providers/flights/mock";
import { MockLodgingProvider } from "../src/lib/providers/lodging/mock";
import { StaticTransportProvider } from "../src/lib/providers/transport/static-provider";

async function main() {
  const repository = new InMemoryDiscoveryRepository([DEMO_WATCH], SURF_DESTINATIONS);
  console.log(`Scanning ${SURF_DESTINATIONS.length} destinations...\n`);
  const result = await runDiscovery(repository, {
    forecast: new MockSurfForecastProvider(),
    flights: new MockFlightProvider(),
    lodging: new MockLodgingProvider(),
    boards: new StaticBoardProvider(),
    transport: new StaticTransportProvider(),
  });
  const opportunities = [...repository.opportunities.values()]
    .filter((opportunity) => opportunity.status === "active")
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 8);

  console.log(`${result.stats.surfCandidates} viable surf windows passed the surf filter.`);
  console.log(`Pricing searches executed: ${result.stats.travelSearches}.`);
  console.log(`\n${opportunities.length} opportunities found:\n`);
  opportunities.forEach((opportunity, index) => {
    const destination = SURF_DESTINATIONS.find((item) => item.id === opportunity.destinationId)!;
    console.log(`${index + 1}. ${destination.name}`);
    console.log(`   ${opportunity.departureDate}–${opportunity.returnDate}`);
    console.log(`   Surf Score ${opportunity.surfScore}`);
    console.log(`   $${Math.round(opportunity.totalPerPerson)}/person (${opportunity.priceSource})\n`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
