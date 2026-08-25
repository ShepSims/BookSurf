import Link from "next/link";

export default function HomePage() {
  return <main className="container" style={{padding:"84px 0 110px"}}>
    <section style={{textAlign:"center", padding:"72px 0"}}>
      <div className="eyebrow">BOOKSURF</div>
      <h1 style={{fontSize:"clamp(52px,9vw,112px)", lineHeight:.86, letterSpacing:"-.075em", margin:"18px 0 24px"}}>Surf books.<br/>Book surf.</h1>
      <p style={{fontSize:19, color:"var(--muted)", maxWidth:650, margin:"0 auto"}}>Tell BookSurf what a trip worth taking looks like once. We scan the surf first, then price only the trips worth chasing.</p>
    </section>
    <section style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:18}}>
      <div className="panel" style={{padding:30, background:"linear-gradient(145deg,#102824,#0b594f)", color:"#f7f2e8", borderColor:"#184b43"}}><div className="eyebrow" style={{color:"rgba(247,242,232,.62)"}}>Play Book Surf</div><h2 style={{fontSize:34, margin:"12px 0"}}>Surf books.</h2><p style={{color:"rgba(247,242,232,.72)", marginBottom:24}}>Ride curling pages, clear the gaps, and keep the story going.</p><Link className="button secondary" href="/book-surf">Play Book Surf</Link></div>
      <div className="panel" style={{padding:30, borderColor:"#97bdb6"}}><div className="eyebrow">Find surf</div><h2 style={{fontSize:34, margin:"12px 0"}}>Book surf.</h2><p style={{color:"var(--muted)", marginBottom:24}}>Wave-first discovery, complete trip economics, and alerts when both surf and budget line up.</p><Link className="button" href="/surf">Find surf</Link></div>
    </section>
  </main>;
}
