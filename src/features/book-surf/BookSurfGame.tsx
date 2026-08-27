"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./BookSurfGame.module.css";

type Phase = "ready" | "playing" | "over";
type Book = { x:number; w:number; h:number; phase:number; title:string; hue:number };
type TimingGrade = "EARLY" | "GOOD" | "PERFECT" | "LATE";
type Trick = "none" | "grab" | "reverse" | "spin";

type Runtime = {
  phase: Phase; x:number; speed:number; y:number; vy:number; angle:number; air:boolean;
  left:boolean; right:boolean; jump:boolean; trickQueued:Trick; trick:Trick; trickRotation:number;
  score:number; combo:number; best:number; last:number; books:Book[]; next:number;
  takeoffMultiplier:number; takeoffGrade:TimingGrade; takeoffBook?:Book; takeoffT:number;
};

const TITLES=["MOBY-DICK","THE ODYSSEY","SEA CHANGE","THE TEMPEST","ISLANDS","WATERLOG","ON THE ROAD"];
const TAU=Math.PI*2;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const noise=(n:number)=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x);};

function makeBook(i:number,x:number,vw:number):Book{const r=noise(i*1.31+3.7);return{x,w:Math.max(300,vw*(.29+r*.11)),h:88+r*92,phase:r*TAU,title:TITLES[i%TITLES.length],hue:30+Math.round(r*26)};}
function surface(book:Book,wx:number,base:number){const t=clamp((wx-book.x)/book.w,0,1),envelope=Math.sin(t*Math.PI),swell=Math.sin(t*Math.PI*1.65+book.phase)*.35+.65,curl=Math.pow(t,4)*.72;return base-book.h*envelope*swell-book.h*curl;}
function timingFor(t:number):{grade:TimingGrade;mult:number}{
  const d=Math.abs(t-.79);
  if(d<=.045)return{grade:"PERFECT",mult:2};
  if(d<=.11)return{grade:"GOOD",mult:1.45};
  if(t<.79)return{grade:"EARLY",mult:.85};
  return{grade:"LATE",mult:1.05};
}
function trickLabel(trick:Trick,rotation:number){if(trick==="grab")return"Indy Grab";if(trick==="reverse")return"Air Reverse";if(trick==="spin")return Math.abs(rotation)>Math.PI*1.7?"360 Spin":"180 Spin";return"Straight Air";}
function trickBase(trick:Trick,rotation:number){if(trick==="grab")return180;if(trick==="reverse")return260;if(trick==="spin")return Math.abs(rotation)>Math.PI*1.7?420:240;return90;}

export default function BookSurfGame(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),raf=useRef<number|undefined>(undefined);
  const game=useRef<Runtime>({phase:"ready",x:0,speed:185,y:0,vy:0,angle:0,air:false,left:false,right:false,jump:false,trickQueued:"none",trick:"none",trickRotation:0,score:0,combo:1,best:0,last:0,books:[],next:0,takeoffMultiplier:1,takeoffGrade:"GOOD",takeoffT:0});
  const [phase,setPhase]=useState<Phase>("ready"),[score,setScore]=useState(0),[combo,setCombo]=useState(1),[best,setBest]=useState(0),[callout,setCallout]=useState("READ THE LIP"),[timing,setTiming]=useState("WAIT FOR IT");

  const reset=useCallback(()=>{const g=game.current;Object.assign(g,{phase:"playing",x:0,speed:185,y:0,vy:0,angle:0,air:false,left:false,right:false,jump:false,trickQueued:"none",trick:"none",trickRotation:0,score:0,combo:1,last:0,books:[],next:0,takeoffMultiplier:1,takeoffGrade:"GOOD",takeoffT:0});setPhase("playing");setScore(0);setCombo(1);setCallout("READ THE LIP");setTiming("WAIT FOR IT");},[]);
  const queueJump=useCallback(()=>{if(game.current.phase==="playing")game.current.jump=true;},[]);
  const queueTrick=useCallback((trick:Trick)=>{const g=game.current;if(g.phase!=="playing")return;if(g.air)g.trick=trick;else g.trickQueued=trick;},[]);

  useEffect(()=>{const saved=Number(localStorage.getItem("booksurf-book-surf-best")||0);game.current.best=Number.isFinite(saved)?saved:0;setBest(game.current.best);},[]);
  useEffect(()=>{const down=(e:KeyboardEvent)=>{if(["ArrowLeft","ArrowRight","ArrowUp","Space","KeyA","KeyD","KeyQ","KeyE","KeyS"].includes(e.code))e.preventDefault();if(e.code==="ArrowLeft"||e.code==="KeyA")game.current.left=true;if(e.code==="ArrowRight"||e.code==="KeyD")game.current.right=true;if(e.code==="Space"||e.code==="ArrowUp")queueJump();if(e.code==="KeyQ")queueTrick("reverse");if(e.code==="KeyE")queueTrick("spin");if(e.code==="KeyS")queueTrick("grab");if(e.code==="Enter"&&game.current.phase!=="playing")reset();};const up=(e:KeyboardEvent)=>{if(e.code==="ArrowLeft"||e.code==="KeyA")game.current.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")game.current.right=false;};addEventListener("keydown",down,{passive:false});addEventListener("keyup",up);return()=>{removeEventListener("keydown",down);removeEventListener("keyup",up);};},[queueJump,queueTrick,reset]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const resize=()=>{const d=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);};resize();addEventListener("resize",resize);
    const ensure=(vw:number)=>{const g=game.current;if(!g.books.length){let x=-80;for(let i=0;i<8;i++){const b=makeBook(i,x,vw);g.books.push(b);x+=b.w*.82;}g.next=8;}while(g.books.at(-1)!.x+g.books.at(-1)!.w<g.x+vw*2.3){const p=g.books.at(-1)!,gap=1.03+noise(g.next*4.1)*.08,b=makeBook(g.next,p.x+p.w*gap,vw);g.books.push(b);g.next++;}while(g.books.length>10&&g.books[1].x+g.books[1].w<g.x-vw)g.books.shift();};
    const drawBook=(b:Book,vw:number,base:number)=>{const g=game.current,sx=b.x-g.x+vw*.28,slices=48;ctx.beginPath();for(let i=0;i<=slices;i++){const t=i/slices,wx=b.x+t*b.w,x=wx-g.x+vw*.28,y=surface(b,wx,base);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.lineTo(sx+b.w,base+28);ctx.lineTo(sx,base+28);ctx.closePath();const grad=ctx.createLinearGradient(sx,base-b.h,sx+b.w,base);grad.addColorStop(0,"#fffaf0");grad.addColorStop(.55,"#f5ead2");grad.addColorStop(1,"#dfcba5");ctx.fillStyle=grad;ctx.fill();ctx.globalAlpha=.28;ctx.strokeStyle="#806b4f";for(let i=4;i<slices;i+=4){const t=i/slices,wx=b.x+t*b.w,x=wx-g.x+vw*.28,y=surface(b,wx,base);ctx.beginPath();ctx.moveTo(x,y+3);ctx.lineTo(sx+b.w*t,base+3);ctx.stroke();}ctx.globalAlpha=1;ctx.fillStyle=`hsl(${b.hue} 35% 24%)`;ctx.fillRect(sx-4,base+5,b.w+8,25);ctx.fillStyle="rgba(255,255,255,.78)";ctx.font="800 9px Arial";ctx.fillText(b.title,sx+12,base+21);const lipx=b.x+b.w*.79-g.x+vw*.28,lipy=surface(b,b.x+b.w*.79,base);ctx.strokeStyle="rgba(255,235,154,.9)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(lipx,lipy,12,0,TAU);ctx.stroke();};
    const drawSurfer=(x:number,y:number,a:number,g:Runtime)=>{ctx.save();ctx.translate(x,y-3);ctx.rotate(a);const board=ctx.createLinearGradient(-24,0,24,0);board.addColorStop(0,"#efb765");board.addColorStop(.5,"#fff0c9");board.addColorStop(1,"#c65b40");ctx.fillStyle=board;ctx.beginPath();ctx.ellipse(0,0,28,6,0,0,TAU);ctx.fill();ctx.strokeStyle="#081c19";ctx.lineWidth=5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-4,-5);ctx.lineTo(-9,-21);ctx.lineTo(-2,-36);ctx.lineTo(8,-22);ctx.lineTo(12,-7);ctx.stroke();ctx.strokeStyle="#efc49d";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-2,-30);ctx.lineTo(g.trick==="grab"?-21:-17,g.trick==="grab"?-4:-20);ctx.moveTo(4,-29);ctx.lineTo(17,-23);ctx.stroke();ctx.fillStyle="#e4b98e";ctx.beginPath();ctx.arc(-1,-42,7,0,TAU);ctx.fill();ctx.restore();};
    const finish=()=>{const g=game.current;if(g.phase!=="playing")return;g.phase="over";const final=Math.floor(g.score);if(final>g.best){g.best=final;localStorage.setItem("booksurf-book-surf-best",String(final));setBest(final);}setScore(final);setPhase("over");};

    const tick=(ts:number)=>{const r=canvas.getBoundingClientRect(),vw=r.width,vh=r.height,base=vh*.73,g=game.current,dt=g.last?Math.min(.033,(ts-g.last)/1000):0;g.last=ts;ensure(vw);const bg=ctx.createLinearGradient(0,0,0,vh);bg.addColorStop(0,"#071513");bg.addColorStop(.52,"#0d322d");bg.addColorStop(1,"#0a5b50");ctx.fillStyle=bg;ctx.fillRect(0,0,vw,vh);ctx.globalAlpha=.12;ctx.strokeStyle="#dce9dc";for(let i=0;i<17;i++){const y=vh*.2+i*18;ctx.beginPath();for(let x=0;x<=vw;x+=22){const yy=y+Math.sin(x*.013+ts*.00025+i)*4;x?ctx.lineTo(x,yy):ctx.moveTo(x,yy);}ctx.stroke();}ctx.globalAlpha=1;
      if(g.phase==="playing"){
        const steer=Number(g.right)-Number(g.left);g.speed=clamp(g.speed+steer*125*dt,145,340);g.speed+=2.5*dt;g.x+=g.speed*dt;const wx=g.x,b=g.books.find(v=>wx>=v.x&&wx<=v.x+v.w),sy=b?surface(b,wx,base):base+120,ay=b?surface(b,wx+7,base):sy,slope=Math.atan2(ay-sy,7),t=b?clamp((wx-b.x)/b.w,0,1):1;
        if(!g.air){g.y=sy-7;g.angle+=(slope-g.angle)*Math.min(1,dt*9);if(b){const tm=timingFor(t);setTiming(`${tm.grade} · x${tm.mult.toFixed(2)}`);}if(g.jump){if(b){const tm=timingFor(t);g.takeoffMultiplier=tm.mult;g.takeoffGrade=tm.grade;g.takeoffBook=b;g.takeoffT=t;setCallout(`${tm.grade} TAKEOFF`);}g.air=true;g.vy=-285-g.speed*.18;g.y-=5;g.jump=false;g.trick=g.trickQueued;g.trickQueued="none";g.trickRotation=0;}}
        else{g.vy+=690*dt;g.y+=g.vy*dt;if(g.trick==="reverse"){const dir=steer||1;g.angle+=dir*4.2*dt;g.trickRotation+=dir*4.2*dt;}else if(g.trick==="spin"){const dir=steer||1;g.angle+=dir*6.3*dt;g.trickRotation+=dir*6.3*dt;}else g.angle+=steer*2.4*dt;g.angle*=.998;if(b&&g.vy>0&&g.y>=sy-11){const rawDiff=Math.abs(Math.atan2(Math.sin(g.angle-slope),Math.cos(g.angle-slope))),landingMult=rawDiff<.18?1.7:rawDiff<.42?1.35:rawDiff<.75?1:0;if(!landingMult){setCallout("BOUNCED THE LANDING");g.combo=1;setCombo(1);finish();}else{const name=trickLabel(g.trick,g.trickRotation),basePts=trickBase(g.trick,g.trickRotation),points=Math.round(basePts*g.takeoffMultiplier*landingMult*g.combo);g.score+=points;g.combo=clamp(g.combo+(g.takeoffGrade==="PERFECT"&&rawDiff<.25?1:.5),1,10);setCombo(Math.floor(g.combo));setCallout(`${name} +${points} · ${rawDiff<.18?"STOMPED":"LANDED"}`);g.air=false;g.y=sy-7;g.trick="none";g.trickRotation=0;}}}
        if(!b&&!g.air){g.air=true;g.vy=110;}if(g.y>vh+90)finish();g.score+=dt*g.speed*.035*g.combo;setScore(Math.floor(g.score));
      }
      for(const b of g.books)drawBook(b,vw,base);const px=vw*.28;if(g.phase==="ready"){const b=g.books[0];drawSurfer(px,surface(b,b.x+b.w*.44,base)-7,-.12,g);}else drawSurfer(px,g.y||base-120,g.angle,g);raf.current=requestAnimationFrame(tick);};
    raf.current=requestAnimationFrame(tick);return()=>{removeEventListener("resize",resize);if(raf.current)cancelAnimationFrame(raf.current);};
  },[]);

  const hold=(key:"left"|"right",on:boolean)=>{game.current[key]=on;};
  return <main className={styles.shell}>
    <canvas ref={canvasRef} className={styles.canvas} aria-label="Book Surf game canvas" />
    <header className={styles.topbar}><Link href="/" className={styles.brand}><strong>BOOKSURF</strong><span>Surf books. Book surf.</span></Link><div className={styles.actions}><Link href="/surf" className={styles.ghost}>Find surf</Link>{phase==="playing"?<button className={styles.solid} onClick={reset}>Restart</button>:null}</div></header>
    {phase!=="ready"?<><div className={styles.hud}><div className={styles.pill}><small>Score</small><strong>{score.toLocaleString()}</strong></div><div className={styles.pill}><small>Multiplier</small><strong>x{combo}</strong></div><div className={styles.pill}><small>Best</small><strong>{best.toLocaleString()}</strong></div></div><div className={styles.timingHud}><strong>{timing}</strong><span>{callout}</span></div></>:null}
    {phase==="ready"?<section className={styles.intro}><div className={styles.introCard}><p className={styles.kicker}>A BookSurf game</p><h1 className={styles.title}>BOOK<br/>SURF</h1><p className={styles.tagline}>Hit the lip at the right moment. Throw tricks. Stomp the landing. Build the multiplier.</p><button className={styles.start} onClick={reset}>Start surfing</button><p className={styles.instructions}>A / D trim · SPACE launch · Q air reverse · E spin · S grab · the gold ring is the critical section</p></div></section>:null}
    {phase==="over"?<section className={styles.gameOver}><p className={styles.kicker}>You lost the plot</p><h2>{score.toLocaleString()} points</h2><p>Perfect takeoffs and clean landings build the line multiplier. Mistime the section and the score collapses.</p><button className={styles.start} onClick={reset}>Surf again</button></section>:null}
    {phase==="playing"?<div className={styles.touchControls}><button className={styles.touchButton} onPointerDown={()=>hold("left",true)} onPointerUp={()=>hold("left",false)} onPointerCancel={()=>hold("left",false)}>←</button><button className={styles.touchButton} onPointerDown={()=>queueTrick("reverse")}>REV</button><button className={`${styles.touchButton} ${styles.touchJump}`} onPointerDown={queueJump}>AIR</button><button className={styles.touchButton} onPointerDown={()=>queueTrick("spin")}>SPIN</button><button className={styles.touchButton} onPointerDown={()=>hold("right",true)} onPointerUp={()=>hold("right",false)} onPointerCancel={()=>hold("right",false)}>→</button></div>:null}
  </main>;
}
