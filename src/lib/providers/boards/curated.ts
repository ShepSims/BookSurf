import { BOARD_RENTALS } from "@/data/board-rentals";
import type { SurfDestination } from "@/lib/domain/types";
import type { BoardProvider, BoardRentalQuote } from "./types";

export class CuratedBoardProvider implements BoardProvider {
  async quote(destination: SurfDestination, days: number): Promise<BoardRentalQuote> {
    const listing = BOARD_RENTALS
      .filter((item) => item.destinationId === destination.id)
      .sort((a, b) => a.dailyPricePerPerson - b.dailyPricePerPerson)[0];

    if (!listing) throw new Error(`No verified board rental for ${destination.id}`);
    return {
      dailyPerPerson: listing.dailyPricePerPerson,
      totalPerPerson: listing.dailyPricePerPerson * days,
      provider: "booksurf-curated-rental",
      priceSource: "live",
      fetchedAt: new Date().toISOString(),
      shopName: listing.shopName,
      bookingUrl: listing.bookingUrl,
      verifiedAt: listing.verifiedAt,
    };
  }
}
