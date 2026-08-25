import { createWatch } from "./actions";

export const maxDuration = 60;

export default async function WatchPage({ searchParams }: { searchParams: Promise<{error?: string}> }) {
  const { error } = await searchParams;
  return <main className="container" style={{padding:"64px 0 100px", maxWidth:760}}><div className="eyebrow">Find surf</div><h1 style={{fontSize:52, letterSpacing:"-.055em", margin:"12px 0 8px"}}>What’s a trip worth taking?</h1><p style={{color:"var(--muted)", marginBottom:30}}>Search the current surf window now. If something fits your complete budget, we’ll show it immediately. If nothing does, we’ll show the closest trip worth considering and keep your original target on watch.</p>{error && <p className="panel" style={{padding:14, borderColor:"#d79b91"}}>Could not save the search ({error}). Sign in first and check Supabase configuration.</p>}<form action={createWatch} className="panel" style={{padding:28, display:"grid", gap:20}}>
    <label>Where are you leaving from?<input name="originAirport" defaultValue="CLT" maxLength={3} required/></label>
    <label>What’s your all-in limit per person?<input name="maxAllInCostPerPerson" type="number" defaultValue="500" min="1" required/></label>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><label>Minimum nights<input name="minTripNights" type="number" defaultValue="3" min="1"/></label><label>Maximum nights<input name="maxTripNights" type="number" defaultValue="5" min="1"/></label></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><label>Who’s going?<input name="travelers" type="number" defaultValue="2" min="1"/></label><label>Skill level<select name="skillLevel" defaultValue="intermediate"><option>beginner</option><option>intermediate</option><option>advanced</option><option>expert</option></select></label></div>
    <label>Minimum Surf Score<input name="minSurfScore" type="number" defaultValue="82" min="55" max="100"/></label>
    <label>Alert email<input name="alertEmail" type="email" placeholder="you@example.com" required/></label>
    <div style={{padding:16,borderRadius:14,background:"var(--foam)",fontSize:14,lineHeight:1.7}}><strong>Included:</strong> flights · stay · board · carry-on · walkable to surf · shared lodging/transport economics</div>
    <button className="button" type="submit">Find trips now</button>
  </form></main>;
}
