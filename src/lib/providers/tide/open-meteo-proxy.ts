import type { SurfDestination } from "@/lib/domain/types";
import type { TidePoint,TideProvider } from "./types";
import type { MarineProvider } from "../marine/types";
export class OpenMeteoSeaLevelTideProxy implements TideProvider { constructor(private readonly marine:MarineProvider){} async getTides(destination:SurfDestination):Promise<TidePoint[]>{const forecast=await this.marine.getForecast(destination);return forecast.hours.flatMap(hour=>hour.seaLevelHeightMslM==null?[]:[{time:hour.time,heightM:hour.seaLevelHeightMslM,confidence:.35}]);} }
