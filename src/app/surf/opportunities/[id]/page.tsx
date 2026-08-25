import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SURF_DESTINATIONS } from "@/data/destinations";
import { setOpportunityStatus } from "./actions";
import type { FlightOption, LodgingOption } from "@/lib/domain/types";

export default async function OpportunityPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  if (!client) notFound();

  const { data:o } = await client.from("trip_opportunities").select("*").eq("id",id).maybeSingle();
  if (!o) notFound();

  const { data:watch } = await client
    .from("surf_watches")
    .select("max_all_in_cost_per_person")
    .eq("id", o.watch_id)
    .maybeSingle();

  const d = SURF_DESTINATIONS.find((x)=>x.id===o.destination_id);
  const surf = o.surf_conditions_json as Record<string, number | undefined>;
  const flight = o.flight_option_json as unknown as FlightOption;
  const lodging = o.lodging_option_json as unknown as LodgingOption;
  const budget = watch ? Number(watch.max_all_in_cost_per_person) : undefined;
  const total = Number(o.total_per_person);
  const overBudget = budget ? Math.max(0, total - budget) : 0;
  const flightUrl = flight.bookingUrl ?? `https://www.google.com/search?q=${encodeURIComponent(`flights ${flight.origin} to ${flight.destination} ${o.departure_date} ${o.return_date}`)}`;
  const stayUrl = lodging.bookingUrl ?? `https://www.google.com/search?q=${encodeURIComponent(`${d?.name ?? "surf"} hotels ${o.departure_date} ${o.return_date}`)}`;
  const setStatus = setOpportunityStatus.bind(null, id);

  return <main className="container" style={{padding:"62px 0 100px",maxWidth:900}}>
    <div className="eyebrow">{o.price_source} pricing · last detected {new Date(o.last_detected_at).toLocaleString()}</div>
    <h1 style={{fontSize:58,letterSpacing:"-.055em",margin:"12px 0 4px"}}>{d?.name ?? "Surf opportunity"}</h1>
    <p>{o.departure_date} → {o.return_date}</p>
    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:28}}>
      <div className="panel" style={{padding:24}}><div className="eyebrow">All-in</div><strong style={{fontSize:38}}>${Math.round(total)}</strong><p>${Math.round(Number(o.total_group_cost))} group total</p>{budget && <p style={{fontSize:13,color:"var(--muted)"}}>{overBudget > 0 ? `Closest match · $${Math.round(overBudget)} over your $${Math.round(budget)} target` : `Within your $${Math.round(budget)} target`}</p>}</div>
      <div className="panel" style={{padding:24}}><div className="eyebrow">Surf score</div><strong style={{fontSize:38}}>{o.surf_score}/100</strong><p>{o.surf_window_start.slice(0,16).replace("T"," ")} → {o.surf_window_end.slice(11,16)} local</p></div>
    </section>
    <section className="panel" style={{padding:26,marginTop:14}}>
      <h2>Conditions</h2>
      <p>{Number(surf.waveHeightFt).toFixed(1)} ft · {Number(surf.swellPeriodSec).toFixed(1)} sec · {Number(surf.windSpeedKts).toFixed(0)} kt wind{surf.waterTemperatureF ? ` · ${Number(surf.waterTemperatureF).toFixed(0)}°F water` : ""}</p>
      <h2>Complete trip</h2>
      <p>Flight ${Math.round(Number(o.flight_price_per_person))}/person<br/>Stay ${Math.round(Number(o.lodging_per_person))}/person<br/>Board ${Math.round(Number(o.board_rental_per_person))}/person<br/>Transport ${Math.round(Number(o.transport_per_person))}/person<br/>Baggage ${Math.round(Number(o.baggage_per_person))}/person</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"20px 0"}}>
        <a className="button" href={flightUrl} target="_blank" rel="noreferrer">{flight.bookingUrl ? "Book flight" : "Check live flight"}</a>
        <a className="button secondary" href={stayUrl} target="_blank" rel="noreferrer">{lodging.bookingUrl ? "Book stay" : "Check live stays"}</a>
      </div>
      <p style={{fontSize:13,color:"var(--muted)"}}>This opportunity is labeled {o.price_source}. Estimated or mocked prices are not claimed to be live or bookable; use the live-search buttons to confirm current inventory before purchasing.</p>
      <h2>Price provenance</h2>
      <p style={{fontSize:13,color:"var(--muted)"}}>Flight: {flight.provider} · {flight.priceSource} · fetched {new Date(flight.fetchedAt).toLocaleString()}<br/>Stay: {lodging.provider} · {lodging.priceSource} · fetched {new Date(lodging.fetchedAt).toLocaleString()}</p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:22}}>{o.status === "active" ? <><form action={setStatus}><input type="hidden" name="status" value="booked"/><button className="button secondary" type="submit">Mark booked</button></form><form action={setStatus}><input type="hidden" name="status" value="dismissed"/><button className="button secondary" type="submit">Dismiss</button></form></> : <form action={setStatus}><input type="hidden" name="status" value="active"/><button className="button secondary" type="submit">Restore opportunity</button></form>}</div>
    </section>
  </main>;
}
