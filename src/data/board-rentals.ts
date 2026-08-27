export interface BoardRentalListing {
  destinationId: string;
  shopName: string;
  dailyPricePerPerson: number;
  bookingUrl: string;
  verifiedAt: string;
}

// Merchant rates live here until we add a supplier/admin ingestion flow.
// Only add rates that were verified against a merchant-owned booking/pricing page.
export const BOARD_RENTALS: BoardRentalListing[] = [];
