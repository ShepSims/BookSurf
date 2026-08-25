import type { SurfDestination } from "@/lib/domain/types";
export interface TidePoint { time:string;heightM:number;confidence:number; }
export interface TideProvider { getTides(destination:SurfDestination):Promise<TidePoint[]>; }
