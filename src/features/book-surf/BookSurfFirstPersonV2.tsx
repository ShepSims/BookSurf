"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./BookSurfGame.module.css";

type Phase="ready"|"playing"|"over";
type Droplet={x:number;y:number;vx:number;vy:number;life:number;r:number};
type Runtime={phase:Phase;last:number;t:number;speed:number;face:number;faceVel:number;bank:number;heading:number;left:boolean;right:boolean;pump:boolean;pumpCd:number;pocket:number;score:number;best:number;spray:Droplet[]};

const TAU=Math.PI*2;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smooth=(t:number)=>t*t*(3-2*t);
const hash=(n:number)=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x);};

function spray(g:Runtime,side:-1|1,power:number){for(let i=0;i<8+Math.round(power*16);i++){g.spray.push({x:side*(42+Math.random()*28),y:0,vx:side*(80+Math.random()*150)*power,vy:-55-Math.random()*120*power,life:.3+Math.random()*.45,r:1+Math.random()*2.5});}}

export default function BookSurfFirstPersonV2(){
 const canvasRef=useRef<HTMLCanvasElement|null>(null),raf=useRef<number>();
 const game=useRef<Runtime>({phase:"ready",last:0,t:0,speed:22,face:.58,faceVel:-.04,bank:0,heading:0,left:false,right:false,pump:false,pumpCd:0,pocket:.34,score:0,best:0,spray:[]});
 const [phase,setPhase]=useState<Phase>("ready"),[score,setScore]=useState(0),[best,setBest]=useState(0),[status,setStatus]=useState("TRIM"),[hint,setHint]=useState("The shoulder is ahead-left. The breaking pocket is on your right.");
 useEffect(()=>{const b=Number(localStorage.getItem("booksurf-book-surf-best")||0);game.current.best=Number.isFinite(b)?b:0;setBest(game.current.best)},[]);
 const reset=useCallback(()=>{Object.assign(game.current,{phase:"playing",last:0,t:0,speed:22,face:.58,faceVel:-.04,bank:0,heading:0,left:false,right:false,pump:false,pumpCd:0,pocket:.34,score:0,spray:[]});setPhase("playing");setScore(0);setStatus("TRIM");setHint("← LEFT RAIL · → RIGHT RAIL · SPACE PUMP")},[]);
 const finish=useCallback((m:string)=>{const g=game.current;if(g.phase!=="playing")return;g.phase="over";const s=Math.floor(g.score);if(s>g.best){g.best=s;localStorage.setItem("booksurf-book-surf-best",String(s));setBest(s)}setScore(s);setHint(m);setPhase("over")},[]);
 useEffect(()=>{const kd=(e:KeyboardEvent)=>{if(["ArrowLeft","ArrowRight","Space","KeyA","KeyD"].includes(e.code))e.preventDefault();const g=game.current;if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=true;if(e.code==="ArrowRight"||e.code==="KeyD")g.right=true;if(e.code==="Space"&&!e.repeat)g.pump=true;if(e.code==="Enter"&&g.phase!=="playing")reset()};const ku=(e:KeyboardEvent)=>{const g=game.current;if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")g.right=false};addEventListener("keydown",kd,{passive:false});addEventListener("keyup",ku);return()=>{removeEventListener("keydown",kd);removeEventListener("keyup",ku)}},[reset]);
 useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;const resize=()=>{const d=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0)};resize();addEventListener("resize",resize);

 const draw=(vw:number,vh:number,g:Runtime)=>{
   // Camera roll is opposite the board bank so LEFT input visibly tips the POV left.
   const roll=-g.bank*.30;
   ctx.save();ctx.translate(vw/2,vh*.53);ctx.rotate(roll);ctx.translate(-vw/2,-vh*.53);
   const horizon=vh*.30;
   const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#7eacba");sky.addColorStop(1,"#d3e4e2");ctx.fillStyle=sky;ctx.fillRect(-vw,-vh,vw*3,vh*2);
   const sea=ctx.createLinearGradient(0,horizon,0,vh);sea.addColorStop(0,"#2a7883");sea.addColorStop(.35,"#106777");sea.addColorStop(.7,"#07505f");sea.addColorStop(1,"#033845");ctx.fillStyle=sea;ctx.fillRect(-vw,horizon,vw*3,vh*2);
   // distant horizon chop gives a stable visual reference for camera bank
   ctx.globalAlpha=.20;ctx.strokeStyle="#d9eeee";for(let j=0;j<6;j++){ctx.beginPath();for(let x=-vw;x<vw*2;x+=28){const y=horizon+18+j*14+Math.sin(x*.012+j+g.t*.5)*2.5;x===-vw?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}ctx.globalAlpha=1;

   // LEFT-HANDER POV: open shoulder / escape line is ahead-left. Pocket and breaking lip are to the right.
   const troughY=vh*.88;
   const crestX=vw*(.74-g.pocket*.08);
   const crestY=vh*(.27+(1-g.face)*.06);
   const shoulderY=vh*(.48+(1-g.face)*.12);
   ctx.beginPath();ctx.moveTo(-vw*.2,troughY);
   ctx.bezierCurveTo(vw*.05,troughY-90,vw*.25,shoulderY+35,vw*.48,shoulderY);
   ctx.bezierCurveTo(vw*.62,shoulderY-40,crestX-55,crestY+30,crestX,crestY);
   ctx.bezierCurveTo(crestX+55,crestY-18,vw*1.02,crestY+110,vw*1.18,troughY-30);
   ctx.lineTo(vw*1.2,vh*1.2);ctx.lineTo(-vw*.2,vh*1.2);ctx.closePath();
   const fg=ctx.createLinearGradient(vw*.18,troughY,crestX,crestY);fg.addColorStop(0,"#07515e");fg.addColorStop(.28,"#096b79");fg.addColorStop(.58,"#0b8190");fg.addColorStop(.82,"#087181");fg.addColorStop(1,"#07505e");ctx.fillStyle=fg;ctx.fill();

   // face light / concavity: bright clean wall left of the pocket, darker under the lip
   const glow=ctx.createRadialGradient(vw*.43,vh*.58,20,vw*.43,vh*.58,vw*.44);glow.addColorStop(0,"rgba(76,190,198,.30)");glow.addColorStop(.65,"rgba(39,143,156,.10)");glow.addColorStop(1,"rgba(0,50,65,0)");ctx.fillStyle=glow;ctx.fillRect(-vw*.1,horizon,vw*1.3,vh*.7);
   ctx.fillStyle="rgba(1,35,47,.24)";ctx.beginPath();ctx.moveTo(crestX-25,crestY+8);ctx.bezierCurveTo(crestX-90,crestY+72,crestX-115,crestY+165,crestX-150,troughY-30);ctx.bezierCurveTo(crestX-70,troughY-110,crestX+15,crestY+140,crestX+36,crestY+62);ctx.closePath();ctx.fill();

   // pitching lip on RIGHT; it peels toward the rider's LEFT down the line
   const pitch=clamp((.53-g.pocket)*2.1,0,1),reach=105+pitch*145;
   const lg=ctx.createLinearGradient(crestX,crestY,crestX-reach,crestY+130);lg.addColorStop(0,"rgba(239,255,252,.98)");lg.addColorStop(.28,"rgba(168,230,229,.90)");lg.addColorStop(.7,"rgba(51,150,164,.55)");lg.addColorStop(1,"rgba(10,78,94,.06)");
   ctx.beginPath();ctx.moveTo(crestX+18,crestY+8);ctx.bezierCurveTo(crestX+5,crestY-43,crestX-reach*.62,crestY-32,crestX-reach,crestY+115);ctx.bezierCurveTo(crestX-reach*.72,crestY+75,crestX-reach*.32,crestY+48,crestX+18,crestY+8);ctx.fillStyle=lg;ctx.fill();
   ctx.strokeStyle="rgba(239,255,252,.92)";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(crestX+28,crestY+4);ctx.bezierCurveTo(crestX-25,crestY-28,crestX-reach*.72,crestY-18,crestX-reach,crestY+108);ctx.stroke();

   // whitewater mass is on the RIGHT / behind you, not in the open shoulder
   ctx.fillStyle="rgba(224,246,244,.92)";ctx.beginPath();ctx.moveTo(crestX+10,crestY+35);for(let x=crestX+10;x<vw*1.15;x+=14){const y=crestY+62+Math.sin(x*.034+g.t*3.6)*16+hash(x*.09+Math.floor(g.t*4))*27;ctx.lineTo(x,y)}ctx.lineTo(vw*1.15,troughY);ctx.lineTo(crestX+55,troughY);ctx.closePath();ctx.fill();
   // feather blowing off the crest
   ctx.fillStyle="rgba(244,255,253,.72)";for(let i=0;i<18;i++){const s=i*13.7,x=crestX+hash(s)*70-10,y=crestY-10-hash(s+3)*45,r=1+hash(s+7)*3;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}

   // flow streaks on the usable face converge toward the trough, reinforcing the 3D slope
   ctx.globalAlpha=.18;ctx.strokeStyle="#d6f3f1";ctx.lineWidth=1;
   for(let i=0;i<12;i++){ctx.beginPath();const y0=shoulderY+20+i*11;ctx.moveTo(vw*.04,y0);ctx.bezierCurveTo(vw*.28,y0+12,crestX-180,crestY+85+i*12,crestX-55,troughY-28+i*3);ctx.stroke()}ctx.globalAlpha=1;
   ctx.restore();

   // First-person board is the stable body reference. Nose leans the SAME direction as the input.
   const boardY=vh*.96;ctx.save();ctx.translate(vw/2,boardY);ctx.rotate(g.bank*.22);
   const bg=ctx.createLinearGradient(-62,0,62,0);bg.addColorStop(0,"#d4a335");bg.addColorStop(.5,"#f5d66d");bg.addColorStop(1,"#d4a335");ctx.fillStyle=bg;ctx.beginPath();ctx.moveTo(0,-130);ctx.bezierCurveTo(-35,-101,-57,-50,-64,12);ctx.quadraticCurveTo(0,28,64,12);ctx.bezierCurveTo(57,-50,35,-101,0,-130);ctx.fill();ctx.strokeStyle="rgba(255,255,255,.58)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-118);ctx.lineTo(0,17);ctx.stroke();ctx.restore();
   for(const p of g.spray){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle="#f1fffd";ctx.beginPath();ctx.arc(vw/2+p.x,boardY+p.y,p.r,0,TAU);ctx.fill()}ctx.globalAlpha=1;
 };

 const tick=(ts:number)=>{const r=canvas.getBoundingClientRect(),vw=r.width,vh=r.height,g=game.current,dt=g.last?Math.min(.032,(ts-g.last)/1000):0;g.last=ts;g.t+=dt;
  if(g.phase==="playing"){
   const rail=Number(g.right)-Number(g.left); // LEFT=-1, RIGHT=+1
   const target=rail*.88;g.bank+=(target-g.bank)*Math.min(1,dt*(rail?7.2:4.6));
   const hold=clamp(g.speed/27,.5,1.25),turn=Math.sin(g.bank)*(.65+hold*.68);g.heading+=turn*dt;
   const drag=Math.abs(g.bank)*(.28+.28*hold)+g.bank*g.bank*.26;
   // left rail bends line toward the left / up-face; right rail bends right / down-face.
   g.faceVel+=(-Math.sin(g.bank)*g.speed*.013-.17)*dt;g.faceVel*=Math.pow(.992,dt*60);g.face+=g.faceVel*dt;
   const down=Math.max(0,-g.faceVel),up=Math.max(0,g.faceVel),steep=.62+smooth(clamp(g.face,0,1))*.78;g.speed+=(down*12.8*steep-up*7.2-drag-.36)*dt;
   if(g.face<=.04){g.face=.04;if(g.bank<-.16){g.faceVel=Math.abs(g.faceVel)*.62+.2;g.speed+=.9;setStatus("LEFT RAIL · BOTTOM TURN")}else{g.faceVel=.06;g.speed-=.9;setStatus("FLAT / RIGHT AT TROUGH")}}
   if(g.face>=.96){g.face=.96;g.faceVel=-Math.abs(g.faceVel)*.5-.08;setStatus(g.bank>.18?"RIGHT RAIL · REDIRECT":"HIGH LINE")}
   g.pumpCd=Math.max(0,g.pumpCd-dt);if(g.pump){g.pump=false;if(g.pumpCd<=0){const transition=clamp(Math.abs(g.faceVel)*3,0,1),loaded=clamp(Math.abs(g.bank)*1.3,0,1),zone=1-smooth(clamp((g.face-.25)/.5,0,1)),eff=clamp(.14+transition*.34+loaded*.25+zone*.31,0,1);g.speed+=eff*2.6;g.score+=Math.round(eff*55);g.pumpCd=.34;setStatus(eff>.75?"PUMP · PERFECT":eff>.5?"PUMP · DRIVE":"PUMP · MISTIMED");if(eff>.55)spray(g,g.bank<0?-1:1,eff)}}
   const downLine=g.speed*Math.cos(g.heading);g.pocket+=((downLine-21.5)/175)*dt;g.pocket=clamp(g.pocket,-.08,1.05);if(g.pocket<.025)finish("THE BREAKING SECTION CAUGHT YOU");if(g.pocket>.92){g.speed-=1.5*dt;setStatus("TOO FAR ON THE SHOULDER")};if(g.speed<10.5)finish("YOU LOST TOO MUCH SPEED");g.score+=dt*(g.speed*.65+Math.abs(g.bank)*12);setScore(Math.floor(g.score));setHint(`Speed ${g.speed.toFixed(1)} · Face ${Math.round(g.face*100)}% · ${g.bank<-.12?"LEFT RAIL":g.bank>.12?"RIGHT RAIL":"FLAT"}`)
  }
  for(const p of g.spray){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=175*dt}g.spray=g.spray.filter(p=>p.life>0);draw(vw,vh,g);raf.current=requestAnimationFrame(tick)};
 raf.current=requestAnimationFrame(tick);return()=>{removeEventListener("resize",resize);if(raf.current)cancelAnimationFrame(raf.current)}},[finish]);
 const hold=(k:"left"|"right",v:boolean)=>{game.current[k]=v};
 return <main className={styles.shell}><canvas ref={canvasRef} className={styles.canvas} aria-label="First-person left-hander surfing game"/><header className={styles.topbar}><Link href="/" className={styles.brand}><strong>BOOKSURF</strong><span>First-person carving prototype</span></Link><div className={styles.actions}><Link href="/surf" className={styles.ghost}>Find surf</Link>{phase==="playing"?<button className={styles.solid} onClick={reset}>Restart</button>:null}</div></header>{phase!=="ready"?<><div className={styles.hud}><div className={styles.pill}><small>Score</small><strong>{score.toLocaleString()}</strong></div><div className={styles.pill}><small>Status</small><strong>{status}</strong></div><div className={styles.pill}><small>Best</small><strong>{best.toLocaleString()}</strong></div></div><div className={styles.timingHud}><strong>LEFT-HANDER</strong><span>{hint}</span></div></>:null}{phase==="ready"?<section className={styles.intro}><div className={styles.introCard}><p className={styles.kicker}>Carving prototype</p><h1 className={styles.title}>FIRST<br/>PERSON</h1><p className={styles.tagline}>The clean shoulder opens ahead-left. Keep the breaking pocket on your right, set a rail, and use the face for speed.</p><button className={styles.start} onClick={reset}>Take off</button><p className={styles.instructions}>← left rail · → right rail · SPACE pump</p></div></section>:null}{phase==="over"?<section className={styles.gameOver}><p className={styles.kicker}>Wipeout</p><h2>{score.toLocaleString()} points</h2><p>{hint}</p><button className={styles.start} onClick={reset}>Take another wave</button></section>:null}{phase==="playing"?<div className={styles.touchControls}><button className={styles.touchButton} onPointerDown={()=>hold("left",true)} onPointerUp={()=>hold("left",false)} onPointerCancel={()=>hold("left",false)}>LEFT</button><button className={`${styles.touchButton} ${styles.touchJump}`} onPointerDown={()=>{game.current.pump=true}}>PUMP</button><button className={styles.touchButton} onPointerDown={()=>hold("right",true)} onPointerUp={()=>hold("right",false)} onPointerCancel={()=>hold("right",false)}>RIGHT</button></div>:null}</main>
}
