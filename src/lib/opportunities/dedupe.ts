import { createHash } from "node:crypto";
import type { TripOpportunity } from "@/lib/domain/types";
import { ALERT_THRESHOLDS } from "@/lib/config";

export function opportunityIdentity(input: { watchId:string; destinationId:string; departureDate:string; returnDate:string; surfWindowStart:string }): string {
  const primarySurfDate = input.surfWindowStart.slice(0, 13);
  return createHash("sha256").update([input.watchId,input.destinationId,input.departureDate,input.returnDate,primarySurfDate].join("|")).digest("hex");
}

export function shouldAlertOpportunity(previous: TripOpportunity | null, current: TripOpportunity): { alert:boolean; reasons:string[] } {
  if (!previous) return { alert:true, reasons:["new opportunity"] };
  const reasons:string[]=[];
  if (previous.totalPerPerson > current.totalPerPerson && previous.totalPerPerson-current.totalPerPerson >= ALERT_THRESHOLDS.meaningfulPriceDropUsd) reasons.push(`price dropped by at least $${ALERT_THRESHOLDS.meaningfulPriceDropUsd}`);
  if (previous.surfScore < ALERT_THRESHOLDS.firingScore && current.surfScore >= ALERT_THRESHOLDS.firingScore) reasons.push("surf entered firing tier");
  if (current.surfScore-previous.surfScore >= ALERT_THRESHOLDS.meaningfulSurfScoreIncrease) reasons.push("surf score materially improved");
  return { alert:reasons.length>0, reasons };
}
