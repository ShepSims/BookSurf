import Link from "next/link";

export default function HomePage() {
  return <main className="container" style={{padding:"84px 0 110px"}}>
    <section style={{textAlign:"center", padding:"72px 0 60px"}}>
      <div className="eyebrow">BOOKSURF</div>
      <h1 style={{fontSize:"clamp(52px,9vw,112px)", lineHeight:.86, letterSpacing:"-.075em", margin:"18px 0 24px"}}>Surf books.<br/>Book surf.</h1>
      <p style={{fontSize:19, color:"var(--muted)", maxWidth:690, margin:"0 auto"}}>Two ways to find something worth chasing: surf through books until one grabs you, or let BookSurf find the next surf trip that actually deserves the flight.</p>
    </section>
    <section style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:18}}>
      <div className="panel" style={{padding:30, background:"linear-gradient(145deg,#102824,#0b594f)", color:"#f7f2e8", borderColor:"#184b43"}}>
        <div className="eyebrow" style={{color:"rgba(247,242,232,.62)"}}>Find a book</div>
        <h2 style={{fontSize:34, margin:"12px 0"}}>Surf books.</h2>
        <p style={{color:"rgba(247,242,232,.72)", marginBottom:24}}>One strong recommendation at a time. Pick a vibe, skip fast, save what catches you, and build a shelf that learns your taste.</p>
        <Link className="button secondary" href="/books">Start surfing books</Link>
      </div>
      <div className="panel" style={{padding:30, borderColor:"#97bdb6"}}>
        <div className="eyebrow">Find surf</div>
        <h2 style={{fontSize:34, margin:"12px 0"}}>Book surf.</h2>
        <p style={{color:"var(--muted)", marginBottom:24}}>Wave-first discovery, complete trip economics, and alerts when both surf and budget line up.</p>
        <Link className="button" href="/surf">Find surf</Link>
      </div>
    </section>
    <section style={{marginTop:18, textAlign:"center"}}>
      <Link href="/book-surf" style={{fontSize:13, color:"var(--muted)", fontWeight:700}}>Or play the Book Surf experiment →</Link>
    </section>
  </main>;
}
