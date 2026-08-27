import type { SurfDestination } from "@/lib/domain/types";
import { CuratedBoardProvider } from "./curated";
import { StaticBoardProvider } from "./static-provider";
import type { BoardProvider, BoardRentalQuote } from "./types";

class FallbackBoardProvider implements BoardProvider {
  constructor(
    private readonly primary: BoardProvider,
    private readonly fallback: BoardProvider,
  ) {}

  async quote(destination: SurfDestination, days: number, travelers: number): Promise<BoardRentalQuote> {
    try {
      return await this.primary.quote(destination, days, travelers);
    } catch {
      return this.fallback.quote(destination, days, travelers);
    }
  }
}

export function createBoardProvider(): BoardProvider {
  return new FallbackBoardProvider(new CuratedBoardProvider(), new StaticBoardProvider());
}
