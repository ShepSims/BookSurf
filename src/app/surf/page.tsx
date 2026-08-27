import Link from "next/link";

export default function SurfPage() {
  const stripe = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;
  return <main className="container" style={{padding:"72px 0 100px"}}>
    <section style={{maxWidth:820}}><div className="eyebrow">Find the wave first. Price the trip second.</div><h1 style={{fontSize:"clamp(46px,8vw,86px)", lineHeight:.92, letterSpacing:"-.065em", margin:"14px 0 22px"}}>Your next surf trip should trigger itself.</h1><p style={{fontSize:20, color:"var(--muted)", maxWidth:700}}>Set your origin, all-in budget, trip length, skill level, and minimum surf quality. BookSurf checks the forecast every day and only prices destinations that are actually worth going to.</p><div style={{display:"flex", gap:12, marginTop:28, flexWrap:"wrap"}}><Link className="button" href="/surf/watch">Start watching</Link><Link className="button secondary" href="/surf/opportunities">View opportunities</Link><Link className="button secondary" href="/surf/sources">Travel sources</Link></div></section>
    <section className="panel" style={{marginTop:68, padding:30, display:"grid", gridTemplateColumns:"1fr auto", gap:24, alignItems:"center"}}><div><div className="eyebrow">Don't want to wait?</div><h2 style={{fontSize:30, margin:"10px 0 6px"}}>Build my surf trip</h2><p style={{color:"var(--muted)", margin:0}}>We’ll manually find your best 3–5 complete surf trips right now.</p></div>{stripe ? <a className="button" href={stripe}>$29 concierge</a> : <span className="button secondary" style={{cursor:"default"}}>Configure Stripe payment link</span>}</section>
  </main>;
}
