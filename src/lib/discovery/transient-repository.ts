import type {
  DestinationForecast,
  SurfDestination,
  SurfWatch,
  TripOpportunity,
} from "@/lib/domain/types";
import type { OpportunityRepository } from "./types";

/**
 * Used for a just-created watch when the app can run discovery but the
 * service-role persistence credential is not available. Results are still
 * returned immediately to the user; the normal cron/admin repository remains
 * the source of truth for persisted opportunities and alerts.
 */
export class TransientOpportunityRepository implements OpportunityRepository {
  private readonly opportunities = new Map<string, TripOpportunity>();

  async saveForecast(_destination: SurfDestination, _forecast: DestinationForecast) {}

  async getPrevious(identityKey: string) {
    return this.opportunities.get(identityKey) ?? null;
  }

  async saveOpportunity(opportunity: TripOpportunity) {
    const previous = this.opportunities.get(opportunity.identityKey);
    const now = new Date().toISOString();
    const saved: TripOpportunity = {
      ...opportunity,
      id: opportunity.identityKey,
      firstDetectedAt: previous?.firstDetectedAt ?? now,
      lastDetectedAt: now,
      lowestObservedPrice: Math.min(
        previous?.lowestObservedPrice ?? Number.POSITIVE_INFINITY,
        opportunity.totalPerPerson,
      ),
    };
    this.opportunities.set(opportunity.identityKey, saved);
    return saved;
  }

  async saveSnapshot(_opportunity: TripOpportunity) {}

  async hasSentAlert(_opportunityId: string) {
    return false;
  }

  async saveAlert(_input: {
    watch: SurfWatch;
    opportunity: TripOpportunity;
    status: "sent" | "failed" | "skipped";
    reasons: string[];
    providerMessageId?: string;
    errorMessage?: string;
  }) {}
}
