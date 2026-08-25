import type { LodgingProvider } from "./types";
import { MockLodgingProvider } from "./mock";
export function createLodgingProvider():LodgingProvider{return new MockLodgingProvider();}
