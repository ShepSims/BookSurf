import type { FlightOption, FlightSearchInput } from "@/lib/domain/types";
import { stableHash } from "@/lib/utils";
import type { FlightProvider } from "./types";
const dayDiff=(a:string,b:string)=>Math.round((Date.parse(`${a}T12:00:00Z`)-Date.parse(`${b}T12:00:00Z`))/86_400_000);
const BASE:Record<string,number>={BQN:156,SJU:175,MCO:105,MLB:120,ORF:128,RDU:99,MGA:224,LIR:205,SJO:218,PXM:238,PVR:206,TIJ:190,SAN:205,LIS:340,BIQ:385,BOD:365,SNA:198,LAX:185,HNL:410,SAL:235};
export class MockFlightProvider implements FlightProvider {
  async search(input:FlightSearchInput):Promise<FlightOption[]> {
    const now=new Date().toISOString();
    return input.destinationAirports.slice(0,2).flatMap((airport,airportIndex)=>{const seed=stableHash(`${input.origin}-${airport}-${input.departureDate}-${input.returnDate}`),tripDays=dayDiff(input.returnDate,input.departureDate),baseFare=Math.max(79,(BASE[airport]??230)+(seed%55)-30+Math.max(0,tripDays-4)*4),stops=input.allowConnections?seed%2:0,durationMinutes=150+(seed%230)+stops*65+airportIndex*20;if(input.maxFlightDurationHours&&durationMinutes>input.maxFlightDurationHours*60)return[];const carryOnCost=input.carryOnRequired&&seed%3===0?35:0;return[{origin:input.origin,destination:airport,departureAt:`${input.departureDate}T08:10:00`,returnAt:`${input.returnDate}T17:20:00`,airline:["Mock Air","Demo Jet","Surf Shuttle"][seed%3],stops,durationMinutes,baseFare,carryOnCost,totalFare:baseFare+carryOnCost,currency:"USD",provider:"booksurf-mock-flights",priceSource:"mocked" as const,fetchedAt:now}];}).sort((a,b)=>a.totalFare-b.totalFare);
  }
}
