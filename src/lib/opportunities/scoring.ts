import type { FlightOption,LodgingOption,SurfDestination,SurfWatch,SurfWindow,TripCostBreakdown,TripDateOption } from "@/lib/domain/types";
import { OPPORTUNITY_WEIGHTS } from "@/lib/config";
import { clamp } from "@/lib/utils";

export function scoreOpportunity(input:{watch:SurfWatch;destination:SurfDestination;surf:SurfWindow;dates:TripDateOption;flight:FlightOption;lodging:LodgingOption;cost:TripCostBreakdown}):number {
  const {watch,surf,flight,lodging,cost,dates}=input;
  const budgetAttractiveness=clamp((1.25-cost.allInPerPerson/watch.maxAllInCostPerPerson)*100,0,100);
  const travelFriction=clamp(100-flight.stops*22-Math.max(0,(flight.durationMinutes-180)/8),0,100);
  const walkability=lodging.walkableToBeach?100:20;
  const idealNights=(watch.minTripNights+watch.maxTripNights)/2;
  const tripFit=clamp(100-Math.abs(dates.nights-idealNights)*12,0,100);
  const weighted=surf.score*OPPORTUNITY_WEIGHTS.surfQuality+budgetAttractiveness*OPPORTUNITY_WEIGHTS.budgetAttractiveness+(travelFriction*.8+tripFit*.2)*OPPORTUNITY_WEIGHTS.travelFriction+walkability*OPPORTUNITY_WEIGHTS.walkability+(surf.confidence*100)*OPPORTUNITY_WEIGHTS.confidence;
  return Math.round(clamp(weighted));
}
