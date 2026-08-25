import type { SurfDestination } from "@/lib/domain/types";
import type { BoardProvider, BoardRentalQuote } from "./types";
export class StaticBoardProvider implements BoardProvider { async quote(destination:SurfDestination,days:number):Promise<BoardRentalQuote>{ return {dailyPerPerson:destination.typicalBoardRentalDaily,totalPerPerson:destination.typicalBoardRentalDaily*days,provider:"booksurf-destination-estimate",priceSource:"estimated",fetchedAt:new Date().toISOString()}; } }
