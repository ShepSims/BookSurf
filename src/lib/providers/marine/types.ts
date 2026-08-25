import type { ForecastHour,SurfDestination } from "@/lib/domain/types";
export interface MarineForecast { destinationId:string; timezone:string; fetchedAt:string; provider:string; hours:ForecastHour[]; }
export interface MarineProvider { getForecast(destination:SurfDestination):Promise<MarineForecast>; }
