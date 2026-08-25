import type { SurfDestination } from "@/lib/domain/types";
export interface TransportQuote { total:number;provider:string;priceSource:"estimated";fetchedAt:string; }
export interface TransportProvider { quote(destination:SurfDestination,days:number,travelers:number):Promise<TransportQuote>; }
