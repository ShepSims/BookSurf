import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SURF_DESTINATIONS } from "@/data/destinations";

type OpportunityFeedRow = {
  id: string;
  destination_id: string;
  departure_date: string;
  return_date: string;
  surf_score: number;
  total_per_person: number | string;
  opportunity_score: number;
  price_source: string;
};

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{watch?:string}> }) {
  const params = await searchParams;
  const client = await createSupabaseServerClient();
  let opportunities: OpportunityFeedRow[] = [];
  let signedIn = false;
  if (client) {
    const { data: auth } = await client.auth.getUser();
    signedIn = Boolean(auth.user);
    if (auth.user) {
      const { data } = await client.from("trip_opportunities").select("*").eq("status","active").order("opportunity_score",{ascending:false}).limit(30);
      opportunities = (data ?? []) as OpportunityFeedRow[];
    }
  }
  return <main className="container" style={{padding:"62px 0 100px"}}><div className="eyebrow">Opportunity feed</div><h1 style={{fontSize:54,letterSpacing:"-.055em",margin:"12px 0 8px"}}>Trips worth taking.</h1><p style={{color:"var(--muted)",marginBottom:28}}>Surf-qualified first, then priced against the complete trip budget.</p>{params.watch && <p className="panel" style={{padding:16}}>Your watch is live. The next discovery run will scan it automatically.</p>}{!signedIn ? <div className="panel" style={{padding:28}}><h2>Sign in to see your opportunities.</h2><p style={{color:"var(--muted)"}}>You can still run <code>npm run discovery:demo</code> locally without credentials.</p><Link className="button" href="/account">Sign in</Link></div> : opportunities.length === 0 ? <div className="panel" style={{padding:28}}><h2>No qualified opportunities yet.</h2><p style={{color:"var(--muted)"}}>That means the current surf + complete trip price hasn’t crossed your watch threshold yet.</p></div> : <div style={{display:"grid",gap:14}}>{opportunities.map((o) => { const d = SURF_DESTINATIONS.find((x)=>x.id===o.destination_id); return <Link key={o.id} href={`/surf/opportunities/${o.id}`} className="panel" style={{padding:24,display:"grid",gridTemplateColumns:"1fr auto",gap:16}}><div><div className="eyebrow">{o.price_source} pricing</div><h2 style={{fontSize:30,margin:"6px 0"}}>{d?.name ?? "Surf trip"}</h2><div>{o.departure_date} → {o.return_date} · Surf {o.surf_score}/100</div></div><div style={{textAlign:"right"}}><strong style={{fontSize:28}}>${Math.round(Number(o.total_per_person))}</strong><div>/ person</div></div></Link>;})}</div>}</main>;
}
