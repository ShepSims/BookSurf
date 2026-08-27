import type { PriceSource, SurfDestination } from "@/lib/domain/types";

export interface BoardRentalQuote {
  dailyPerPerson: number;
  totalPerPerson: number;
  provider: string;
  priceSource: PriceSource;
  fetchedAt: string;
  shopName?: string;
  bookingUrl?: string;
  verifiedAt?: string;
}

export interface BoardProvider {
  quote(destination: SurfDestination, days: number, travelers: number): Promise<BoardRentalQuote>;
}
