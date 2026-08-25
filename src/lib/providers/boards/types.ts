import type { SurfDestination } from "@/lib/domain/types";
export interface BoardRentalQuote { dailyPerPerson:number; totalPerPerson:number; provider:string; priceSource:"estimated"; fetchedAt:string; }
export interface BoardProvider { quote(destination:SurfDestination,days:number,travelers:number):Promise<BoardRentalQuote>; }
