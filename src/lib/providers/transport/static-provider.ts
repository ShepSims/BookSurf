import type { SurfDestination } from "@/lib/domain/types";
import type { TransportProvider,TransportQuote } from "./types";
export class StaticTransportProvider implements TransportProvider { async quote(destination:SurfDestination,days:number):Promise<TransportQuote>{return{total:destination.typicalLocalTransportDaily*days,provider:"booksurf-destination-estimate",priceSource:"estimated",fetchedAt:new Date().toISOString()};} }
