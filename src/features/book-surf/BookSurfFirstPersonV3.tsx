"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./BookSurfGame.module.css";

type Phase = "ready" | "playing" | "over";
type Drop = { x:number; y:number; vx:number; vy:number; life:number; r:number };
type Runtime = {
  phase:Phase; last:number; t:number; speed:number; face:number; faceVel:number; bank:number; heading:number;
  left:boolean; right:boolean; pump:boolean; pumpCd:number; pocket:number; score:number; best:number; spray:Drop[];
};

const TAU=Math.PI*2;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smooth=(t:number)=>t*t*(3-2*t);
const hash=(n:number)=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x)};

function spray(g:Runtime,side:-1|1,power:number){
  for(let i=0;i<8+Math.round(power*14);i++)g.spray.push({x:side*(38+Math.random()*24),y:0,vx:side*(70+Math.random()*130)*power,vy:-45-Math.random()*105*power,life:.28+Math.random()*.4,r:1+Math.random()*2.2});
}

export default function BookSurfFirstPersonV3(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),raf=useRef<number|undefined>(undefined);
  const game=useRef<Runtime>({phase:"ready",last:0,t:0,speed:22,face:.56,faceVel:-.04,bank:0,heading:0,left:false,right:false,pump:false,pumpCd:0,pocket:.34,score:0,best:0,spray:[]});
  const [phase,setPhase]=useState<Phase>("ready"),[score,setScore]=useState(0),[best,setBest]=useState(0),[status,setStatus]=useState("TRIM"),[hint,setHint]=useState("Wall left · shoulder right · ride down the line");

  useEffect(()=>{const b=Number(localStorage.getItem("booksurf-book-surf-best")||0);game.current.best=Number.isFinite(b)?b:0;setBest(game.current.best)},[]);
  const reset=useCallback(()=>{Object.assign(game.current,{phase:"playing",last:0,t:0,speed:22,face:.56,faceVel:-.04,bank:0,heading:0,left:false,right:false,pump:false,pumpCd:0,pocket:.34,score:0,spray:[]});setPhase("playing");setScore(0);setStatus("TRIM");setHint("← LEFT RAIL · → RIGHT RAIL · SPACE PUMP")},[]);
  const finish=useCallback((m:string)=>{const g=game.current;if(g.phase!=="playing")return;g.phase="over";const s=Math.floor(g.score);if(s>g.best){g.best=s;localStorage.setItem("booksurf-book-surf-best",String(s));setBest(s)}setScore(s);setHint(m);setPhase("over")},[]);

  useEffect(()=>{
    const kd=(e:KeyboardEvent)=>{if(["ArrowLeft","ArrowRight","Space","KeyA","KeyD"].includes(e.code))e.preventDefault();const g=game.current;if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=true;if(e.code==="ArrowRight"||e.code==="KeyD")g.right=true;if(e.code==="Space"&&!e.repeat)g.pump=true;if(e.code==="Enter"&&g.phase!=="playing")reset()};
    const ku=(e:KeyboardEvent)=>{const g=game.current;if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")g.right=false};
    addEventListener("keydown",kd,{passive:false});addEventListener("keyup",ku);return()=>{removeEventListener("keydown",kd);removeEventListener("keyup",ku)};
  },[reset]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const resize=()=>{const d=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0)};resize();addEventListener("resize",resize);

    const draw=(vw:number,vh:number,g:Runtime)=>{
      const roll=g.bank*.24;
      ctx.save();ctx.translate(vw/2,vh*.54);ctx.rotate(roll);ctx.translate(-vw/2,-vh*.54);
      const horizon=vh*.30;
      const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#84b3c0");sky.addColorStop(1,"#d7e7e5");ctx.fillStyle=sky;ctx.fillRect(-vw,-vh,vw*3,vh*2);
      const sea=ctx.createLinearGradient(0,horizon,0,vh);sea.addColorStop(0,"#287480");sea.addColorStop(.38,"#0b6372");sea.addColorStop(.72,"#07505e");sea.addColorStop(1,"#033844");ctx.fillStyle=sea;ctx.fillRect(-vw,horizon,vw*3,vh*2);

      // LEFT-HANDER POV: wall and crest rise on the LEFT; shoulder opens down-the-line to the RIGHT.
      const troughY=vh*.91;
      const crestX=vw*(.12+g.pocket*.04);
      const crestY=vh*(.29+(1-g.face)*.055);
      const shoulderY=vh*(.49+(1-g.face)*.13);
      ctx.beginPath();ctx.moveTo(-vw*.2,troughY);
      ctx.bezierCurveTo(-vw*.04,crestY+120,crestX-35,crestY+24,crestX,crestY);
      ctx.bezierCurveTo(crestX+95,crestY-10,vw*.42,shoulderY-34,vw*.68,shoulderY);
      ctx.bezierCurveTo(vw*.84,shoulderY+35,vw*1.03,troughY-120,vw*1.2,troughY-40);
      ctx.lineTo(vw*1.2,vh*1.2);ctx.lineTo(-vw*.2,vh*1.2);ctx.closePath();
      const fg=ctx.createLinearGradient(crestX,crestY,vw*.78,troughY);fg.addColorStop(0,"#07515f");fg.addColorStop(.18,"#087284");fg.addColorStop(.47,"#0a8795");fg.addColorStop(.78,"#0a6674");fg.addColorStop(1,"#064450");ctx.fillStyle=fg;ctx.fill();

      // Deep concave pocket immediately under the left-side lip.
      ctx.fillStyle="rgba(1,35,47,.28)";ctx.beginPath();ctx.moveTo(crestX+10,crestY+10);ctx.bezierCurveTo(crestX+70,crestY+82,crestX+130,crestY+190,vw*.34,troughY-32);ctx.bezierCurveTo(crestX+125,troughY-90,crestX+45,crestY+150,crestX-8,crestY+42);ctx.closePath();ctx.fill();

      // Pitching lip and whitewater remain LEFT/rear; the clean shoulder remains visibly open on the right.
      const pitch=clamp((.53-g.pocket)*2.1,0,1),reach=100+pitch*150;
      const lg=ctx.createLinearGradient(crestX,crestY,crestX+reach,crestY+130);lg.addColorStop(0,"rgba(239,255,252,.98)");lg.addColorStop(.28,"rgba(164,230,229,.9)");lg.addColorStop(.72,"rgba(44,146,160,.48)");lg.addColorStop(1,"rgba(8,76,91,.05)");
      ctx.beginPath();ctx.moveTo(crestX-14,crestY+9);ctx.bezierCurveTo(crestX+12,crestY-46,crestX+reach*.65,crestY-34,crestX+reach,crestY+118);ctx.bezierCurveTo(crestX+reach*.7,crestY+78,crestX+reach*.32,crestY+45,crestX-14,crestY+9);ctx.fillStyle=lg;ctx.fill();
      ctx.strokeStyle="rgba(239,255,252,.94)";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(crestX-18,crestY+4);ctx.bezierCurveTo(crestX+35,crestY-30,crestX+reach*.72,crestY-18,crestX+reach,crestY+110);ctx.stroke();

      ctx.fillStyle="rgba(225,247,244,.92)";ctx.beginPath();ctx.moveTo(-vw*.15,troughY);ctx.lineTo(-vw*.15,crestY+70);for(let x=-vw*.1;x<crestX+34;x+=14){const y=crestY+65+Math.sin(x*.034+g.t*3.6)*15+hash(x*.09+Math.floor(g.t*4))*28;ctx.lineTo(x,y)}ctx.lineTo(crestX+60,troughY);ctx.closePath();ctx.fill();

      // Perspective streaks point toward the open shoulder on the RIGHT.
      ctx.globalAlpha=.18;ctx.strokeStyle="#d7f3f0";ctx.lineWidth=1;
      for(let i=0;i<12;i++){ctx.beginPath();const y0=crestY+70+i*18;ctx.moveTo(crestX+22,y0);ctx.bezierCurveTo(vw*.34,y0+16,vw*.62,shoulderY+40+i*9,vw*1.04,troughY-42+i*2);ctx.stroke()}ctx.globalAlpha=1;
      ctx.restore();

      // First-person board points slightly RIGHT down the line; rail bank rotates around that neutral heading.
      const boardY=vh*.965;ctx.save();ctx.translate(vw*.51,boardY);ctx.rotate(.10+g.bank*.20);
      const bg=ctx.createLinearGradient(-62,0,62,0);bg.addColorStop(0,"#d3a234");bg.addColorStop(.5,"#f5d66d");bg.addColorStop(1,"#d3a234");ctx.fillStyle=bg;ctx.beginPath();ctx.moveTo(0,-132);ctx.bezierCurveTo(-35,-100,-58,-48,-64,12);ctx.quadraticCurveTo(0,28,64,12);ctx.bezierCurveTo(58,-48,35,-100,0,-132);ctx.fill();ctx.strokeStyle="rgba(255,255,255,.6)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-118);ctx.lineTo(0,17);ctx.stroke();ctx.restore();
      for(const p of g.spray){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle="#f3fffd";ctx.beginPath();ctx.arc(vw*.51+p.x,boardY+p.y,p.r,0,TAU);ctx.fill()}ctx.globalAlpha=1;
    };

    const tick=(ts:number)=>{const r=canvas.getBoundingClientRect(),vw=r.width,vh=r.height,g=game.current,dt=g.last?Math.min(.032,(ts-g.last)/1000):0;g.last=ts;g.t+=dt;
      if(g.phase==="playing"){
        const rail=Number(g.right)-Number(g.left),target=rail*.88;g.bank+=(target-g.bank)*Math.min(1,dt*(rail?7.2:4.6));
        const hold=clamp(g.speed/27,.5,1.25),turn=Math.sin(g.bank)*(.65+hold*.68);g.heading+=turn*dt;const drag=Math.abs(g.bank)*(.28+.28*hold)+g.bank*g.bank*.26;
        // LEFT rail drives up toward the wall on screen-left; RIGHT rail redirects down/open toward screen-right.
        g.faceVel+=(-Math.sin(g.bank)*g.speed*.013-.17)*dt;g.faceVel*=Math.pow(.992,dt*60);g.face+=g.faceVel*dt;
        const down=Math.max(0,-g.faceVel),up=Math.max(0,g.faceVel),steep=.62+smooth(clamp(g.face,0,1))*.78;g.speed+=(down*12.8*steep-up*7.2-drag-.36)*dt;
        if(g.face<=.04){g.face=.04;if(g.bank<-.16){g.faceVel=Math.abs(g.faceVel)*.62+.2;g.speed+=.9;setStatus("LEFT RAIL · BOTTOM TURN")}else{g.faceVel=.06;g.speed-=.9;setStatus("TROUGH")}}
        if(g.face>=.96){g.face=.96;g.faceVel=-Math.abs(g.faceVel)*.5-.08;setStatus(g.bank>.18?"RIGHT RAIL · REDIRECT":"HIGH LINE")}
        g.pumpCd=Math.max(0,g.pumpCd-dt);if(g.pump){g.pump=false;if(g.pumpCd<=0){const transition=clamp(Math.abs(g.faceVel)*3,0,1),loaded=clamp(Math.abs(g.bank)*1.3,0,1),zone=1-smooth(clamp((g.face-.25)/.5,0,1)),eff=clamp(.14+transition*.34+loaded*.25+zone*.31,0,1);g.speed+=eff*2.6;g.score+=Math.round(eff*55);g.pumpCd=.34;setStatus(eff>.75?"PUMP · PERFECT":eff>.5?"PUMP · DRIVE":"PUMP · MISTIMED");if(eff>.55)spray(g,g.bank<0?-1:1,eff)}}
        const downLine=g.speed*Math.cos(g.heading);g.pocket+=((downLine-21.5)/175)*dt;g.pocket=clamp(g.pocket,-.08,1.05);if(g.pocket<.025)finish("THE BREAKING SECTION CAUGHT YOU");if(g.pocket>.92){g.speed-=1.5*dt;setStatus("TOO FAR ON THE SHOULDER")};if(g.speed<10.5)finish("YOU LOST TOO MUCH SPEED");g.score+=dt*(g.speed*.65+Math.abs(g.bank)*12);setScore(Math.floor(g.score));setHint(`Speed ${g.speed.toFixed(1)} · Face ${Math.round(g.face*100)}% · ${g.bank<-.12?"LEFT RAIL":g.bank>.12?"RIGHT RAIL":"FLAT"}`)
      }
      for(const p of g.spray){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=175*dt}g.spray=g.spray.filter(p=>p.life>0);draw(vw,vh,g);raf.current=requestAnimationFrame(tick)};
    raf.current=requestAnimationFrame(tick);return()=>{removeEventListener("resize",resize);if(raf.current)cancelAnimationFrame(raf.current)};
  },[finish]);

  const hold=(k:"left"|"right",v:boolean)=>{game.current[k]=v};
  return <main className={styles.shell}><canvas ref={canvasRef} className={styles.canvas} aria-label="First-person left-hander surfing game"/><header className={styles.topbar}><Link href="/" className={styles.brand}><strong>BOOKSURF</strong><span>First-person carving prototype</span></Link><div className={styles.actions}><Link href="/surf" className={styles.ghost}>Find surf</Link>{phase==="playing"?<button className={styles.solid} onClick={reset}>Restart</button>:null}</div></header>{phase!=="ready"?<><div className={styles.hud}><div className={styles.pill}><small>Score</small><strong>{score.toLocaleString()}</strong></div><div className={styles.pill}><small>Status</small><strong>{status}</strong></div><div className={styles.pill}><small>Best</small><strong>{best.toLocaleString()}</strong></div></div><div className={styles.timingHud}><strong>LEFT-HANDER</strong><span>{hint}</span></div></>:null}{phase==="ready"?<section className={styles.intro}><div className={styles.introCard}><p className={styles.kicker}>Carving prototype</p><h1 className={styles.title}>FIRST<br/>PERSON</h1><p className={styles.tagline}>Wave wall on your left. Open shoulder down the line to your right. Set a rail and use the face for speed.</p><button className={styles.start} onClick={reset}>Take off</button><p className={styles.instructions}>← left rail · → right rail · SPACE pump</p></div></section>:null}{phase==="over"?<section className={styles.gameOver}><p className={styles.kicker}>Wipeout</p><h2>{score.toLocaleString()} points</h2><p>{hint}</p><button className={styles.start} onClick={reset}>Take another wave</button></section>:null}{phase==="playing"?<div className={styles.touchControls}><button className={styles.touchButton} onPointerDown={()=>hold("left",true)} onPointerUp={()=>hold("left",false)} onPointerCancel={()=>hold("left",false)}>LEFT</button><button className={`${styles.touchButton} ${styles.touchJump}`} onPointerDown={()=>{game.current.pump=true}}>PUMP</button><button className={styles.touchButton} onPointerDown={()=>hold("right",true)} onPointerUp={()=>hold("right",false)} onPointerCancel={()=>hold("right",false)}>RIGHT</button></div>:null}</main>;
}
