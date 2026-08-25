import type { FlightOption,FlightSearchInput } from "@/lib/domain/types";
export interface FlightProvider { search(input:FlightSearchInput):Promise<FlightOption[]>; }
