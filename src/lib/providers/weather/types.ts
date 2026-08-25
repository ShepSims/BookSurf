import type { ForecastHour,SurfDestination } from "@/lib/domain/types";
export interface WeatherForecast { destinationId:string;timezone:string;fetchedAt:string;provider:string;hours:ForecastHour[]; }
export interface WeatherProvider { getForecast(destination:SurfDestination):Promise<WeatherForecast>; }
