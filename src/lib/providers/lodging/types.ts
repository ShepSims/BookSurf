import type { LodgingOption,LodgingSearchInput } from "@/lib/domain/types";
export interface LodgingProvider { search(input:LodgingSearchInput):Promise<LodgingOption[]>; }
