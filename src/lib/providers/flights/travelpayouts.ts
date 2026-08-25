import type { FlightOption, FlightSearchInput } from "@/lib/domain/types";
import { withRetry } from "@/lib/providers/shared/retry";
import type { FlightProvider } from "./types";

const ENDPOINT="https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
type Row={origin?:string;destination?:string;origin_airport?:string;destination_airport?:string;price?:number;airline?:string;departure_at?:string;return_at?:string;transfers?:number;return_transfers?:number;duration?:number;duration_to?:number;duration_back?:number;link?:string};
type Response={success?:boolean;currency?:string;data?:Row[]};

export class TravelpayoutsFlightProvider implements FlightProvider {
  constructor(private readonly token:string,private readonly marker:string){}
  async search(input:FlightSearchInput):Promise<FlightOption[]> {
    if(!this.token||!this.marker)return[];
    if(input.carryOnRequired){console.info("booksurf.flight.travelpayouts.skipped",{reason:"carry_on_cost_unavailable_in_data_api"});return[];}
    const responses=await Promise.allSettled(input.destinationAirports.slice(0,2).map(async destination=>{const params=new URLSearchParams({origin:input.origin,destination,departure_at:input.departureDate,return_at:input.returnDate,one_way:"false",direct:input.allowConnections?"false":"true",sorting:"price",unique:"false",currency:"usd",market:"us",limit:"10",page:"1",token:this.token});return withRetry(async()=>{const response=await fetch(`${ENDPOINT}?${params}`,{headers:{"User-Agent":"BookSurf/0.1"}});if(!response.ok)throw new Error(`Travelpayouts ${response.status}`);return await response.json() as Response;});}));
    const fetchedAt=new Date().toISOString(),options:FlightOption[]=[];
    for(const response of responses){if(response.status!=="fulfilled"||!response.value.success)continue;const currency=(response.value.currency??"usd").toUpperCase();if(currency!=="USD")continue;for(const row of response.value.data??[]){if(!row.price||!row.departure_at||!row.return_at||!row.destination_airport)continue;const stops=Math.max(row.transfers??0,row.return_transfers??0),durationMinutes=row.duration??((row.duration_to??0)+(row.duration_back??0));if(!input.allowConnections&&stops>0)continue;if(input.maxFlightDurationHours&&durationMinutes>input.maxFlightDurationHours*60)continue;options.push({origin:row.origin_airport??row.origin??input.origin,destination:row.destination_airport,departureAt:row.departure_at,returnAt:row.return_at,airline:row.airline??"Unknown airline",stops,durationMinutes,baseFare:row.price,carryOnCost:0,totalFare:row.price,currency:"USD",originalCurrency:currency,bookingUrl:row.link?`https://www.aviasales.com${row.link}`:undefined,provider:"travelpayouts-aviasales-data-api",priceSource:"cached",fetchedAt});}}
    return options.sort((a,b)=>a.totalFare-b.totalFare);
  }
}
