import { BOARD_RENTALS } from "@/data/board-rentals";

export type ProviderStatus = {
  category: "surf" | "flight" | "lodging" | "board" | "transport";
  name: string;
  configured: boolean;
  mode: "live" | "cached" | "estimated" | "fallback";
  detail: string;
};

export function getProviderStatuses(): ProviderStatus[] {
  const duffelToken = process.env.DUFFEL_ACCESS_TOKEN;
  const duffelLive = Boolean(duffelToken && !duffelToken.startsWith("duffel_test_"));
  const travelpayouts = Boolean(process.env.TRAVELPAYOUTS_TOKEN && process.env.TRAVELPAYOUTS_MARKER);

  return [
    {
      category: "surf",
      name: "Open-Meteo Marine + Weather",
      configured: true,
      mode: "live",
      detail: "Live forecast inputs used to decide whether a destination is worth pricing.",
    },
    {
      category: "flight",
      name: "Duffel Flights",
      configured: Boolean(duffelToken),
      mode: duffelLive ? "live" : duffelToken ? "fallback" : "fallback",
      detail: duffelLive
        ? "Live airline offers are preferred."
        : duffelToken
          ? "Test token configured; Duffel results are never treated as live."
          : "Not configured.",
    },
    {
      category: "flight",
      name: "Travelpayouts / Aviasales",
      configured: travelpayouts,
      mode: travelpayouts ? "cached" : "fallback",
      detail: travelpayouts ? "Secondary cached airfare signal." : "Not configured.",
    },
    {
      category: "lodging",
      name: "Duffel Stays",
      configured: Boolean(duffelToken),
      mode: duffelLive ? "live" : "fallback",
      detail: duffelLive
        ? "Location-based live stay search enabled if the Duffel account has Stays access."
        : "Falls back to labelled estimates until live Stays access is available.",
    },
    {
      category: "board",
      name: "Curated surf shops",
      configured: BOARD_RENTALS.length > 0,
      mode: BOARD_RENTALS.length > 0 ? "live" : "estimated",
      detail: BOARD_RENTALS.length > 0
        ? `${BOARD_RENTALS.length} merchant rate${BOARD_RENTALS.length === 1 ? "" : "s"} verified.`
        : "No merchant rates loaded yet; destination-level estimates are used.",
    },
    {
      category: "transport",
      name: "Destination transport estimate",
      configured: true,
      mode: "estimated",
      detail: "Local ground transport remains an explicit estimate.",
    },
  ];
}
