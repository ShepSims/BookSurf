import type { DiscoveryRunStats, DestinationForecast, SurfDestination, SurfWatch, TripOpportunity } from "@/lib/domain/types";

export interface OpportunityRepository {
  saveForecast(destination: SurfDestination, forecast: DestinationForecast): Promise<void>;
  getPrevious(identityKey: string): Promise<TripOpportunity | null>;
  saveOpportunity(opportunity: TripOpportunity): Promise<TripOpportunity>;
  saveSnapshot(opportunity: TripOpportunity): Promise<void>;
  hasSentAlert(opportunityId: string): Promise<boolean>;
  saveAlert(input: { watch: SurfWatch; opportunity: TripOpportunity; status: "sent" | "failed" | "skipped"; reasons: string[]; providerMessageId?: string; errorMessage?: string }): Promise<void>;
}

export interface DiscoveryRepository extends OpportunityRepository {
  listActiveWatches(): Promise<SurfWatch[]>;
  listActiveDestinations(): Promise<SurfDestination[]>;
  startRun(): Promise<string>;
  expirePastOpportunities(today: string): Promise<number>;
  finishRun(runId: string, status: "completed" | "partial" | "failed", stats: DiscoveryRunStats): Promise<void>;
}

export interface AlertSender {
  sendOpportunity(input: { watch: SurfWatch; opportunity: TripOpportunity; destination: SurfDestination; reasons: string[] }): Promise<{ sent: boolean; providerMessageId?: string }>;
}
