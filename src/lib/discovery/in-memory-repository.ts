import type {
  DiscoveryRunStats,
  DestinationForecast,
  SurfDestination,
  SurfWatch,
  TripOpportunity,
} from "@/lib/domain/types";
import type { DiscoveryRepository } from "./types";

export class InMemoryDiscoveryRepository implements DiscoveryRepository {
  readonly opportunities = new Map<string, TripOpportunity>();
  readonly snapshots: TripOpportunity[] = [];
  readonly alerts: Array<{ opportunityId?: string; status: "sent" | "failed" | "skipped"; reasons: string[] }> = [];

  constructor(
    private readonly watches: SurfWatch[],
    private readonly destinations: SurfDestination[],
  ) {}

  async saveForecast(_destination: SurfDestination, _forecast: DestinationForecast) {}

  async listActiveWatches() { return this.watches.filter((watch) => watch.active); }
  async listActiveDestinations() { return this.destinations.filter((destination) => destination.active); }
  async startRun() { return crypto.randomUUID(); }

  async expirePastOpportunities(today: string) {
    let expired = 0;
    for (const [key, opportunity] of this.opportunities) {
      if (opportunity.status === "active" && opportunity.returnDate < today) {
        this.opportunities.set(key, { ...opportunity, status: "expired" });
        expired += 1;
      }
    }
    return expired;
  }

  async finishRun(_runId: string, _status: "completed" | "partial" | "failed", _stats: DiscoveryRunStats) {}
  async getPrevious(identityKey: string) { return this.opportunities.get(identityKey) ?? null; }

  async saveOpportunity(opportunity: TripOpportunity) {
    const previous = this.opportunities.get(opportunity.identityKey);
    const now = new Date().toISOString();
    const saved: TripOpportunity = {
      ...opportunity,
      id: previous?.id ?? crypto.randomUUID(),
      firstDetectedAt: previous?.firstDetectedAt ?? now,
      lastDetectedAt: now,
      lowestObservedPrice: Math.min(previous?.lowestObservedPrice ?? Number.POSITIVE_INFINITY, opportunity.totalPerPerson),
      status: previous?.status === "booked" || previous?.status === "dismissed" ? previous.status : opportunity.status,
    };
    this.opportunities.set(saved.identityKey, saved);
    return saved;
  }

  async saveSnapshot(opportunity: TripOpportunity) { this.snapshots.push(structuredClone(opportunity)); }
  async hasSentAlert(opportunityId: string) { return this.alerts.some((alert) => alert.opportunityId === opportunityId && alert.status === "sent"); }

  async saveAlert(input: { watch: SurfWatch; opportunity: TripOpportunity; status: "sent" | "failed" | "skipped"; reasons: string[]; providerMessageId?: string; errorMessage?: string }) {
    this.alerts.push({ opportunityId: input.opportunity.id, status: input.status, reasons: [...input.reasons] });
  }
}
