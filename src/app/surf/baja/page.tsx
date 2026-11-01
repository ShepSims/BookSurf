"use client";
import { useEffect, useState } from "react";
import { parseAttribution, type Attribution } from "@/features/acquisition/attribution";
import Link from "next/link";

const ink="#173a36", sand="#f7f0e3";
export default function BajaPage(){
 const [step,setStep]=useState(0);
 const [attribution,setAttribution]=useState<Attribution|undefined>();
 useEffect(()=>{try{const key="booksurf-first-touch";const stored=sessionStorage.getItem(key);if(stored){setAttribution(JSON.parse(stored) as Attribution);return}const params=new URLSearchParams(window.location.search);params.set("landing_path",window.location.pathname);const value=parseAttribution(params);sessionStorage.setItem(key,JSON.stringify(value));setAttribution(value)}catch{/* booking remains available without tracking */}},[]);
 const [form,setForm]=useState({dates:"",guests:"2",level:"Intermediate",budget:"",name:"",email:"",notes:""});
 const set=(key:keyof typeof form,value:string)=>setForm(s=>({...s,[key]:value}));
 const [copied,setCopied]=useState(false);
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState("");
 const [reference,setReference]=useState("");
 const message=`New Baja trip inquiry\nName: ${form.name}\nEmail: ${form.email}\nDates: ${form.dates}\nGuests: ${form.guests}\nSkill: ${form.level}\nBudget: ${form.budget}\nNotes: ${form.notes}`;
 
 if(reference)return <main style={{minHeight:"75vh",padding:"100px 24px",background:sand,color:ink,textAlign:"center"}}><div style={{font:"700 12px Arial",letterSpacing:".2em"}}>REQUEST RECEIVED</div><h1 style={{fontSize:"clamp(46px,8vw,90px)",margin:"25px auto"}}>The good part starts here.</h1><p style={{maxWidth:570,margin:"0 auto",fontSize:20,lineHeight:1.6}}>Your Baja trip request is saved. We’ll check the details with our local operator and follow up by email. No dates are confirmed and no payment has been taken.</p><p style={{font:"13px Arial",marginTop:30}}>Reference: {reference}</p><Link href="/surf" className="button" style={{marginTop:24}}>Explore more surf trips</Link></main>;
 return <main style={{background:sand,color:ink,minHeight:"100vh",fontFamily:"Georgia,serif"}}>
  <section style={{minHeight:"min(78vh,760px)",padding:"clamp(44px,8vw,110px) max(22px,8vw)",background:"linear-gradient(115deg,rgba(9,39,39,.84),rgba(11,65,68,.35)),url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=85') center/cover",color:"#fff",display:"flex",flexDirection:"column",justifyContent:"center"}}>
   <div style={{font:"700 12px Arial",letterSpacing:".3em",textTransform:"uppercase"}}>BOOKSURF / PRIVATE EXPERIENCES / BAJA CALIFORNIA</div>
   <h1 style={{fontSize:"clamp(64px,11vw,156px)",lineHeight:".86",letterSpacing:"-.07em",margin:"35px 0"}}>Further<br/><i>south.</i></h1>
   <p style={{fontSize:"clamp(19px,2vw,27px)",maxWidth:550,lineHeight:1.45}}>Less planning. More perfect mornings. Your next Baja surf escape, thoughtfully arranged.</p>
   <a href="#plan" style={{background:"#e9cfa5",color:ink,padding:"17px 25px",borderRadius:50,alignSelf:"flex-start",font:"700 14px Arial",marginTop:26}}>Plan my escape ↗</a>
  </section>
  <section style={{padding:"90px max(22px,8vw)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))",gap:50,maxWidth:1500,margin:"auto"}}>
   <div><div style={{font:"700 12px Arial",letterSpacing:".2em"}}>01 / THE EXPERIENCE</div><h2 style={{fontSize:"clamp(42px,5vw,72px)",lineHeight:1.03,letterSpacing:"-.05em"}}>Good waves.<br/>Nothing extra.</h2></div>
   <div style={{fontSize:20,lineHeight:1.7,maxWidth:580}}>Discover Baja through a local surf operator. Tell us when you want to go, who’s coming, and what kind of waves you’re after. We’ll help coordinate a tailored experience, then confirm availability and pricing with the operator before anything is booked.<p style={{font:"13px Arial",color:"#61736c"}}>Trips operated by independent local partners. Accommodation, transportation, meals and surf guiding depend on the confirmed itinerary.</p></div>
  </section>
  <section id="plan" style={{background:ink,color:"#f8f1e5",padding:"90px max(22px,8vw)"}}>
   <div style={{maxWidth:850,margin:"auto"}}>
    <div style={{font:"700 12px Arial",letterSpacing:".22em",color:"#dfc59c"}}>02 / YOUR PERSONAL CONCIERGE</div>
    <h2 style={{fontSize:"clamp(45px,6vw,80px)",lineHeight:1,letterSpacing:"-.05em",margin:"20px 0"}}>Tell us your kind of <i>escape.</i></h2>
    <p style={{font:"17px/1.7 Arial",color:"#c5d3cb",maxWidth:630}}>A few details are all we need to start. No payment today; your dates and final quote are subject to operator confirmation.</p>
    <div style={{background:"#f9f4e9",color:ink,borderRadius:22,padding:"clamp(22px,5vw,48px)",marginTop:35,fontFamily:"Arial"}}>
     <div style={{fontSize:12,letterSpacing:".2em",fontWeight:800,marginBottom:26}}>STEP {step+1} OF 2 — {step===0?"THE TRIP":"YOUR DETAILS"}</div>
     {step===0?<div style={{display:"grid",gap:19}}>
      <label>When would you like to go?<input value={form.dates} onChange={e=>set("dates",e.target.value)} placeholder="e.g. March 12–16, or flexible in spring"/></label>
      <label>How many travelers?<select value={form.guests} onChange={e=>set("guests",e.target.value)}>{Array.from({length:12},(_,i)=><option key={i}>{i+1}</option>)}</select></label>
      <label>Surf experience<select value={form.level} onChange={e=>set("level",e.target.value)}>{["First timer","Beginner","Intermediate","Advanced","Mixed group"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Approximate total budget (optional)<input value={form.budget} onChange={e=>set("budget",e.target.value)} placeholder="e.g. $2,000 per person"/></label>
      <button className="button" onClick={()=>setStep(1)} disabled={!form.dates.trim()} style={{marginTop:10}}>Continue →</button>
     </div>:<form onSubmit={async e=>{e.preventDefault();if(submitting)return;setSubmitting(true);setError("");try{const res=await fetch("/api/surf/booking-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,attribution})});const json=await res.json();if(!res.ok)throw new Error(json.error||"Unable to submit");setReference(json.reference||"submitted")}catch(err){setError(err instanceof Error?err.message:"Please try again.")}finally{setSubmitting(false)}}} style={{display:"grid",gap:19}}>
      <label>Your name<input required value={form.name} onChange={e=>set("name",e.target.value)} autoComplete="name"/></label>
      <label>Email address<input required type="email" value={form.email} onChange={e=>set("email",e.target.value)} autoComplete="email"/></label>
      <label>Anything else we should know?<textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Dream waves, board preferences, accommodations…" style={{minHeight:110,padding:14,borderRadius:12,border:"1px solid #dce5e1",font:"inherit"}}/></label>
      <p style={{fontSize:12,lineHeight:1.6,color:"#60736b"}}>Your request is sent securely to BookSurf. We’ll confirm availability and pricing with the operator before offering payment. No reservation is confirmed yet.</p>
      {error&&<p role="alert" style={{color:"#a53d29",fontWeight:700}}>{error}</p>}<div style={{display:"flex",gap:12,flexWrap:"wrap"}}><button type="button" className="button secondary" onClick={()=>setStep(0)}>← Back</button><button className="button" type="submit" disabled={submitting}>{submitting?"Sending…":"Request availability ↗"}</button><button type="button" className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(message);setCopied(true)}catch{setCopied(false)}}}>{copied?"Copied inquiry":"Copy inquiry"}</button></div>
     </form>}
    </div>
   </div>
  </section>
  <footer style={{padding:"35px max(22px,8vw)",font:"13px Arial"}}><Link href="/surf">← Explore all surf trips</Link><span style={{float:"right"}}>BOOKSURF · BAJA</span></footer>
 </main>;
}