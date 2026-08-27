export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type SurfQuality = "poor" | "possible" | "good" | "great" | "firing";
export type PriceSource = "live" | "cached" | "estimated" | "mocked";

export interface SurfDestination {
  id: string; slug: string; name: string; region: string; country: string;
  latitude: number; longitude: number; nearestAirportCodes: string[]; timezone: string;
  minSkillLevel: SkillLevel; maxSkillLevel: SkillLevel; preferredSwellDirections: number[];
  preferredWindDirections: number[]; minUsefulSwellHeight: number; maxUsefulSwellHeight: number;
  minUsefulPeriod: number; preferredTideRange?: [number, number]; typicalBoardRentalDaily: number;
  typicalLocalTransportDaily: number; beachWalkableDefault: boolean; warmWaterMonths: number[]; active: boolean;
}

export interface SurfWatch {
  id:string; userId:string; name:string; originAirport:string; windowDays:number;
  earliestDepartureDate?:string; latestReturnDate?:string; minTripNights:number; maxTripNights:number;
  maxAllInCostPerPerson:number; travelers:number; destinationMode:"anywhere"|"destinations"|"regions";
  allowedDestinationIds:string[]; allowedRegions:string[]; skillLevel:SkillLevel; minSurfScore:number;
  minWaveHeightFt?:number; maxWaveHeightFt?:number; minPeriodSeconds?:number; warmWaterOnly:boolean;
  flightsRequired:boolean; accommodationRequired:boolean; boardRentalRequired:boolean; carryOnRequired:boolean;
  walkableToBeachRequired:boolean; allowConnections:boolean; maxFlightDurationHours?:number;
  groupDiscountsEnabled:boolean; alertEmail:string; alertsEnabled:boolean; active:boolean; createdAt:string; updatedAt:string;
}

export interface ForecastHour { time:string; waveHeightM?:number; waveDirectionDeg?:number; wavePeriodSec?:number; wavePeakPeriodSec?:number; swellHeightM?:number; swellDirectionDeg?:number; swellPeriodSec?:number; swellPeakPeriodSec?:number; secondarySwellHeightM?:number; secondarySwellDirectionDeg?:number; secondarySwellPeriodSec?:number; seaSurfaceTemperatureC?:number; seaLevelHeightMslM?:number; windSpeedKph?:number; windDirectionDeg?:number; windGustsKph?:number; airTemperatureC?:number; weatherCode?:number; }
export interface DestinationForecast { destinationId:string; timezone:string; fetchedAt:string; provider:string; source:PriceSource|"live"; hours:ForecastHour[]; }
export interface SurfConditions { waveHeightFt:number; swellHeightFt:number; swellDirectionDeg:number; swellPeriodSec:number; windSpeedKts:number; windDirectionDeg:number; waterTemperatureF?:number; tideProxyM?:number; }
export interface SurfWindow { destinationId:string; score:number; quality:SurfQuality; reasons:string[]; penalties:string[]; confidence:number; windowStart:string; windowEnd:string; conditions:SurfConditions; }
export interface TripDateOption { departureDate:string; returnDate:string; nights:number; surfLocalDate:string; }
export interface FlightSearchInput { origin:string; destinationAirports:string[]; departureDate:string; returnDate:string; travelers:number; carryOnRequired:boolean; allowConnections:boolean; maxFlightDurationHours?:number; }
export interface FlightOption { origin:string; destination:string; departureAt:string; returnAt:string; airline:string; stops:number; durationMinutes:number; baseFare:number; carryOnCost:number; totalFare:number; currency:string; originalCurrency?:string; bookingUrl?:string; provider:string; priceSource:PriceSource; fetchedAt:string; offerId?:string; offerExpiresAt?:string; carryOnIncluded?:boolean; }
export interface LodgingSearchInput { destination:SurfDestination; checkIn:string; checkOut:string; travelers:number; walkableToBeachRequired:boolean; }
export interface LodgingOption { propertyName:string; checkIn:string; checkOut:string; totalPrice:number; taxesAndFees:number; bedrooms?:number; sleeps:number; latitude?:number; longitude?:number; distanceToBeachMeters?:number; walkableToBeach:boolean; bookingUrl?:string; provider:string; currency:string; originalCurrency?:string; priceSource:PriceSource; fetchedAt:string; searchResultId?:string; offerExpiresAt?:string; publicPrice?:number; }
export interface CostComponent { amount:number; source:PriceSource; provider:string; fetchedAt:string; }
export interface TripCostBreakdown { flightPerPerson:number; lodgingTotal:number; lodgingPerPerson:number; boardPerPerson:number; transportTotal:number; transportPerPerson:number; baggagePerPerson:number; mandatoryFeesPerPerson:number; allInPerPerson:number; totalGroupCost:number; priceSource:PriceSource; }
export interface TripOpportunity { id?:string; identityKey:string; watchId:string; userId:string; destinationId:string; departureDate:string; returnDate:string; surfWindowStart:string; surfWindowEnd:string; surfTimezone:string; surfScore:number; surfConfidence:number; flightPricePerPerson:number; lodgingTotal:number; lodgingPerPerson:number; boardRentalPerPerson:number; transportPerPerson:number; baggagePerPerson:number; totalPerPerson:number; totalGroupCost:number; flightOption:FlightOption; lodgingOption:LodgingOption; surfConditions:SurfConditions; bookingLinks:Record<string,string|undefined>; opportunityScore:number; firstDetectedAt?:string; lastDetectedAt?:string; lowestObservedPrice?:number; status:"active"|"expired"|"booked"|"dismissed"; priceSource:PriceSource; }
export interface DiscoveryRunStats { watchCount:number; destinationsScanned:number; surfCandidates:number; travelSearches:number; opportunitiesFound:number; alertsSent:number; errorCount:number; }
