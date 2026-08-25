export const DISCOVERY_LIMITS = {
  maxDestinationsPerWatch: 5,
  maxSurfWindowsPerDestination: 2,
  maxTripDatePermutationsPerWindow: 4,
  forecastConcurrency: 4,
  travelConcurrency: 3,
} as const;

export const ALERT_THRESHOLDS = {
  meaningfulPriceDropUsd: 50,
  meaningfulSurfScoreIncrease: 7,
  firingScore: 92,
} as const;

export const OPPORTUNITY_WEIGHTS = {
  surfQuality: 0.4,
  budgetAttractiveness: 0.25,
  travelFriction: 0.15,
  walkability: 0.1,
  confidence: 0.1,
} as const;
