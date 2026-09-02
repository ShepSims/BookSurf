"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./BookDiscovery.module.css";

type Book = {
  id:string;
  title:string;
  author:string;
  year:number;
  pages:number;
  cover:string;
  hook:string;
  description:string;
  tags:string[];
  energy:"quiet"|"medium"|"high";
  length:"short"|"medium"|"long";
};

const BOOKS:Book[]=[
  {id:"piranesi",title:"Piranesi",author:"Susanna Clarke",year:2020,pages:245,cover:"https://covers.openlibrary.org/b/isbn/9781635575637-L.jpg",hook:"A beautiful impossible house. One man mapping it. Something is very wrong.",description:"Dreamlike, compact and strange without being difficult. It rewards going in with almost no context.",tags:["weird","literary","mystery","atmospheric","fast"],energy:"medium",length:"short"},
  {id:"shantaram",title:"Shantaram",author:"Gregory David Roberts",year:2003,pages:936,cover:"https://covers.openlibrary.org/b/isbn/9780312330538-L.jpg",hook:"An escaped convict disappears into Bombay and builds an entirely new life.",description:"Huge, immersive, messy and addictive. The kind of book you live inside for a while.",tags:["adventure","travel","crime","immersive","epic"],energy:"high",length:"long"},
  {id:"east-of-eden",title:"East of Eden",author:"John Steinbeck",year:1952,pages:601,cover:"https://covers.openlibrary.org/b/isbn/9780142004234-L.jpg",hook:"Two families, one valley, and generations of people trying to choose who they become.",description:"A classic that reads far more immediately than its reputation suggests. Big emotions, sharp characters, enormous payoff.",tags:["classic","literary","family","epic","character"],energy:"medium",length:"long"},
  {id:"into-thin-air",title:"Into Thin Air",author:"Jon Krakauer",year:1997,pages:368,cover:"https://covers.openlibrary.org/b/isbn/9780385494786-L.jpg",hook:"A first-hand account of the 1996 Everest disaster from a writer who was actually on the mountain.",description:"Extremely readable nonfiction with real stakes. It moves like a thriller because the events themselves were one.",tags:["nonfiction","adventure","survival","fast","true"],energy:"high",length:"medium"},
  {id:"three-body",title:"The Three-Body Problem",author:"Cixin Liu",year:2008,pages:400,cover:"https://covers.openlibrary.org/b/isbn/9780765382030-L.jpg",hook:"Humanity discovers it may not be alone, and that someone on Earth has already answered back.",description:"Idea-dense science fiction built around escalating discoveries rather than conventional space-opera action.",tags:["sci-fi","ideas","mystery","big-concept","weird"],energy:"medium",length:"medium"},
  {id:"shoe-dog",title:"Shoe Dog",author:"Phil Knight",year:2016,pages:400,cover:"https://covers.openlibrary.org/b/isbn/9781501135927-L.jpg",hook:"Nike before Nike was Nike: debt, bad decisions, obsession and a tiny group trying to survive.",description:"A founder memoir that feels unusually candid and operational rather than polished into business mythology.",tags:["business","memoir","entrepreneurship","fast","true"],energy:"high",length:"medium"},
  {id:"stasi",title:"Stasiland",author:"Anna Funder",year:2002,pages:304,cover:"https://covers.openlibrary.org/b/isbn/9780062077325-L.jpg",hook:"Ordinary people tell what it was like to live under East Germany's surveillance state.",description:"History through intimate stories rather than a textbook lens. Weird, human and often darkly funny.",tags:["history","nonfiction","politics","true","human"],energy:"medium",length:"medium"},
  {id:"barbarian-days",title:"Barbarian Days",author:"William Finnegan",year:2015,pages:512,cover:"https://covers.openlibrary.org/b/isbn/9780143109396-L.jpg",hook:"A lifetime organized around waves, places, obsession and the question of why anyone keeps surfing.",description:"The definitive literary surf memoir: travel, risk, aging and wave knowledge without romanticizing the culture.",tags:["surf","memoir","travel","literary","true"],energy:"medium",length:"long"},
  {id:"the-road",title:"The Road",author:"Cormac McCarthy",year:2006,pages:287,cover:"https://covers.openlibrary.org/b/isbn/9780307387899-L.jpg",hook:"A father and son walk through the remains of America carrying almost nothing but each other.",description:"Bleak, spare and emotionally direct. Short chapters make it move faster than its subject matter suggests.",tags:["literary","dark","post-apocalyptic","fast","emotional"],energy:"medium",length:"short"},
  {id:"project-hail-mary",title:"Project Hail Mary",author:"Andy Weir",year:2021,pages:496,cover:"https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg",hook:"A man wakes up alone on a spacecraft and gradually realizes why he was sent there.",description:"Problem-solving science fiction with constant forward motion and an unusually likable central relationship.",tags:["sci-fi","adventure","fast","fun","big-concept"],energy:"high",length:"long"},
  {id:"wind-up-bird",title:"The Wind-Up Bird Chronicle",author:"Haruki Murakami",year:1994,pages:607,cover:"https://covers.openlibrary.org/b/isbn/9780679775430-L.jpg",hook:"A missing cat turns into a missing wife, a dry well, strange neighbors and reality quietly coming apart.",description:"Long, surreal and hypnotic. Best when you want atmosphere and discovery more than a tidy plot machine.",tags:["weird","literary","surreal","atmospheric","mystery"],energy:"quiet",length:"long"},
  {id:"anthropocene",title:"The Anthropocene Reviewed",author:"John Green",year:2021,pages:293,cover:"https://covers.openlibrary.org/b/isbn/9780525555216-L.jpg",hook:"Human life reviewed on a five-star scale: Diet Dr Pepper, sunsets, plague, scratch-and-sniff stickers.",description:"Funny, thoughtful essays you can read individually or straight through. Good when a novel feels like too much commitment.",tags:["essays","nonfiction","funny","thoughtful","short"],energy:"quiet",length:"short"},
];

const VIBES=["surprise me","fast","weird","adventure","literary","nonfiction","sci-fi","business","surf","dark"];

export default function BookDiscovery(){
  const [vibe,setVibe]=useState("surprise me");
  const [index,setIndex]=useState(0);
  const [saved,setSaved]=useState<string[]>([]);
  const [rejected,setRejected]=useState<string[]>([]);
  const [showShelf,setShowShelf]=useState(false);

  useEffect(()=>{
    try{setSaved(JSON.parse(localStorage.getItem("booksurf-shelf")||"[]"))}catch{}
  },[]);

  const pool=useMemo(()=>{
    const available=BOOKS.filter(b=>!rejected.includes(b.id));
    if(vibe==="surprise me") return available;
    const matched=available.filter(b=>b.tags.includes(vibe));
    return matched.length?matched:available;
  },[vibe,rejected]);

  const book=pool[index%Math.max(pool.length,1)] ?? BOOKS[0];
  const shelf=BOOKS.filter(b=>saved.includes(b.id));

  const next=()=>setIndex(i=>i+1);
  const changeVibe=(nextVibe:string)=>{setVibe(nextVibe);setIndex(0)};
  const save=()=>{
    const nextSaved=saved.includes(book.id)?saved:saved.concat(book.id);
    setSaved(nextSaved);localStorage.setItem("booksurf-shelf",JSON.stringify(nextSaved));next();
  };
  const skip=()=>{setRejected(r=>r.includes(book.id)?r:r.concat(book.id));setIndex(0)};
  const remove=(id:string)=>{const n=saved.filter(x=>x!==id);setSaved(n);localStorage.setItem("booksurf-shelf",JSON.stringify(n))};

  return <main className={styles.shell}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><strong>BOOKSURF</strong><span>Surf books</span></Link>
      <button className={styles.shelfButton} onClick={()=>setShowShelf(v=>!v)}>Shelf <span>{saved.length}</span></button>
    </header>

    <section className={styles.hero}>
      <div className={styles.kicker}>Don’t search. Surf.</div>
      <h1>Find the book<br/>you actually want<br/>to start tonight.</h1>
      <p>Pick a direction, then keep moving until something catches. No 40-card recommendation grid. One book at a time.</p>
    </section>

    <nav className={styles.vibes} aria-label="Book vibes">
      {VIBES.map(v=><button key={v} className={v===vibe?styles.activeVibe:""} onClick={()=>changeVibe(v)}>{v}</button>)}
    </nav>

    <section className={styles.stage}>
      <div className={styles.coverWrap}>
        <div className={styles.coverShadow}/>
        <img className={styles.cover} src={book.cover} alt={`${book.title} cover`}/>
        <div className={styles.counter}>#{String((index%Math.max(pool.length,1))+1).padStart(2,"0")}</div>
      </div>

      <article className={styles.bookInfo}>
        <div className={styles.meta}>{book.year} · {book.pages} pages · {book.length}</div>
        <h2>{book.title}</h2>
        <div className={styles.author}>by {book.author}</div>
        <p className={styles.hook}>{book.hook}</p>
        <p className={styles.description}>{book.description}</p>
        <div className={styles.tags}>{book.tags.slice(0,5).map(tag=><button key={tag} onClick={()=>changeVibe(tag)}>#{tag}</button>)}</div>
        <div className={styles.actions}>
          <button className={styles.keep} onClick={save}>Keep this</button>
          <button className={styles.next} onClick={next}>Next →</button>
          <button className={styles.nope} onClick={skip}>Not for me</button>
        </div>
        <div className={styles.buyRow}>
          <a href={`https://www.google.com/search?q=${encodeURIComponent(`${book.title} ${book.author} book`)}`} target="_blank" rel="noreferrer">Look it up ↗</a>
          <span>Energy: {book.energy}</span>
        </div>
      </article>
    </section>

    <section className={styles.promise}>
      <div><span>01</span><strong>Signal, not catalog</strong><p>Every interaction should narrow taste, not add more choices.</p></div>
      <div><span>02</span><strong>Startability matters</strong><p>We care whether you’ll actually open it tonight, not whether it belongs on a canonical list.</p></div>
      <div><span>03</span><strong>Your shelf becomes taste</strong><p>Saved and rejected books become the input for the next recommendation layer.</p></div>
    </section>

    {showShelf&&<aside className={styles.shelf}>
      <div className={styles.shelfHeader}><div><div className={styles.kicker}>Your shelf</div><h3>Books worth coming back to</h3></div><button onClick={()=>setShowShelf(false)}>×</button></div>
      {shelf.length===0?<p className={styles.empty}>Nothing saved yet. Keep a book when one catches you.</p>:<div className={styles.shelfGrid}>{shelf.map(b=><div className={styles.shelfItem} key={b.id}><img src={b.cover} alt=""/><div><strong>{b.title}</strong><span>{b.author}</span><button onClick={()=>remove(b.id)}>Remove</button></div></div>)}</div>}
    </aside>}
  </main>;
}
