"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./BookSurfGame.module.css";

type Phase = "ready" | "playing" | "over";
type Runtime = {
  phase: Phase;
  last: number;
  elapsed: number;
  speed: number;
  face: number;
  verticalVelocity: number;
  heading: number;
  bank: number;
  left: boolean;
  right: boolean;
  pumpQueued: boolean;
  pumpCooldown: number;
  pumpChain: number;
  score: number;
  best: number;
  pocket: number;
  spray: Array<{x:number;y:number;vx:number;vy:number;life:number;size:number}>;
};

const TAU = Math.PI * 2;
const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const lerp = (a:number,b:number,t:number)=>a+(b-a)*t;
const smooth = (t:number)=>t*t*(3-2*t);
const hash=(n:number)=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x);};

function spawnRailSpray(g:Runtime, side:-1|1, power:number){
  const count=Math.round(5+power*18);
  for(let i=0;i<count;i++){
    const s=(Math.random()-.5)*.7;
    g.spray.push({
      x:side*(42+Math.random()*20),y:12+Math.random()*10,
      vx:side*(70+Math.random()*130*power)+s*45,
      vy:-40-Math.random()*95*power,
      life:.25+Math.random()*.45,size:1+Math.random()*2.5,
    });
  }
}

export default function BookSurfFirstPerson(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const raf=useRef<number|undefined>(undefined);
  const game=useRef<Runtime>({
    phase:"ready",last:0,elapsed:0,speed:22,face:.72,verticalVelocity:-.08,heading:0,bank:0,
    left:false,right:false,pumpQueued:false,pumpCooldown:0,pumpChain:0,score:0,best:0,pocket:.34,spray:[],
  });
  const [phase,setPhase]=useState<Phase>("ready");
  const [score,setScore]=useState(0);
  const [best,setBest]=useState(0);
  const [status,setStatus]=useState("TRIM");
  const [hint,setHint]=useState("Use the rails. Pump only when the wave gives it back.");

  useEffect(()=>{
    const saved=Number(localStorage.getItem("booksurf-book-surf-best")||0);
    game.current.best=Number.isFinite(saved)?saved:0;setBest(game.current.best);
  },[]);

  const reset=useCallback(()=>{
    const g=game.current;
    Object.assign(g,{phase:"playing",last:0,elapsed:0,speed:22,face:.72,verticalVelocity:-.08,heading:0,bank:0,left:false,right:false,pumpQueued:false,pumpCooldown:0,pumpChain:0,score:0,pocket:.34,spray:[]});
    setPhase("playing");setScore(0);setStatus("TRIM");setHint("LEFT = left rail · RIGHT = right rail · SPACE = pump");
  },[]);

  const finish=useCallback((message:string)=>{
    const g=game.current;if(g.phase!=="playing")return;g.phase="over";
    const final=Math.floor(g.score);if(final>g.best){g.best=final;localStorage.setItem("booksurf-book-surf-best",String(final));setBest(final);}setScore(final);setHint(message);setPhase("over");
  },[]);

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(["ArrowLeft","ArrowRight","Space","KeyA","KeyD"].includes(e.code))e.preventDefault();
      const g=game.current;
      if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=true;
      if(e.code==="ArrowRight"||e.code==="KeyD")g.right=true;
      if(e.code==="Space"&&!e.repeat)g.pumpQueued=true;
      if(e.code==="Enter"&&g.phase!=="playing")reset();
    };
    const up=(e:KeyboardEvent)=>{const g=game.current;if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")g.right=false;};
    addEventListener("keydown",down,{passive:false});addEventListener("keyup",up);
    return()=>{removeEventListener("keydown",down);removeEventListener("keyup",up);};
  },[reset]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const resize=()=>{const d=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);};
    resize();addEventListener("resize",resize);

    const drawScene=(vw:number,vh:number,g:Runtime)=>{
      ctx.save();
      const bankVisual=g.bank*.42;
      ctx.translate(vw/2,vh*.52);ctx.rotate(bankVisual);ctx.translate(-vw/2,-vh*.52);
      const horizon=vh*.29;
      const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#87b8c6");sky.addColorStop(1,"#d5e6e4");ctx.fillStyle=sky;ctx.fillRect(-vw,-vh,vw*3,vh*2);
      const ocean=ctx.createLinearGradient(0,horizon,0,vh);ocean.addColorStop(0,"#2b7480");ocean.addColorStop(.35,"#0c6170");ocean.addColorStop(.72,"#064553");ocean.addColorStop(1,"#032d38");ctx.fillStyle=ocean;ctx.fillRect(-vw,horizon,vw*3,vh*2);

      // left-breaking wave: breaking pocket is on camera-left and peels across frame toward camera-right.
      const faceBase=vh*.92;
      const crestLeft=vh*.33 + (1-g.face)*vh*.08;
      const shoulderY=vh*.55 + (1-g.face)*vh*.18;
      ctx.beginPath();ctx.moveTo(-vw*.15,faceBase);
      ctx.bezierCurveTo(vw*.02,crestLeft+55,vw*.12,crestLeft-38,vw*.24,crestLeft);
      ctx.bezierCurveTo(vw*.42,crestLeft+18,vw*.7,shoulderY-18,vw*1.12,shoulderY+35);
      ctx.lineTo(vw*1.25,vh*1.2);ctx.lineTo(-vw*.2,vh*1.2);ctx.closePath();
      const faceGrad=ctx.createLinearGradient(vw*.12,crestLeft,vw*.82,faceBase);faceGrad.addColorStop(0,"#07505f");faceGrad.addColorStop(.18,"#087083");faceGrad.addColorStop(.48,"#0a8797");faceGrad.addColorStop(.78,"#0b6674");faceGrad.addColorStop(1,"#06424e");ctx.fillStyle=faceGrad;ctx.fill();

      // under-lip shadow and translucent pitching lip.
      const barrel=clamp((.48-g.pocket)*2.4,0,1);
      const lipReach=110+barrel*180;
      ctx.save();ctx.globalAlpha=.72;
      const lip=ctx.createLinearGradient(0,crestLeft,vw*.32,crestLeft+110);lip.addColorStop(0,"rgba(235,255,251,.95)");lip.addColorStop(.3,"rgba(137,221,220,.8)");lip.addColorStop(1,"rgba(17,93,107,.08)");
      ctx.beginPath();ctx.moveTo(-20,crestLeft+8);ctx.bezierCurveTo(vw*.04,crestLeft-42,vw*.16,crestLeft-26,vw*.19+lipReach,crestLeft+112);ctx.bezierCurveTo(vw*.15+lipReach*.55,crestLeft+74,vw*.07+lipReach*.22,crestLeft+46,-20,crestLeft+8);ctx.fillStyle=lip;ctx.fill();ctx.restore();
      ctx.save();ctx.globalAlpha=.45;ctx.strokeStyle="#022f3a";ctx.lineWidth=26;ctx.beginPath();ctx.arc(vw*.15,crestLeft+112,72+barrel*28,Math.PI*.95,Math.PI*1.85);ctx.stroke();ctx.restore();

      // whitewater behind the peeling lip, deliberately concentrated left.
      const foamX=vw*.02+g.pocket*vw*.2;
      ctx.fillStyle="rgba(226,247,244,.92)";ctx.beginPath();ctx.moveTo(-vw*.15,faceBase);ctx.lineTo(-vw*.15,crestLeft+70);
      for(let x=-vw*.1;x<foamX;x+=14){const y=crestLeft+70+Math.sin(x*.035+g.elapsed*4)*18+hash(x*.11+Math.floor(g.elapsed*5))*32;ctx.lineTo(x,y);}ctx.lineTo(foamX,faceBase);ctx.closePath();ctx.fill();

      // water-flow streaks along the clean face.
      ctx.globalAlpha=.16;ctx.strokeStyle="#d6f4f1";ctx.lineWidth=1;
      for(let i=0;i<12;i++){ctx.beginPath();for(let x=vw*.15;x<vw*1.05;x+=22){const t=(x-vw*.15)/(vw*.9);const y=lerp(crestLeft+36+i*13,faceBase-40+i*6,smooth(t))+Math.sin(t*8+i+g.elapsed*1.3)*2;x===vw*.15?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}ctx.globalAlpha=1;

      ctx.restore();

      // First-person board: only nose and rails are visible.
      const boardY=vh*.94;
      ctx.save();ctx.translate(vw/2,boardY);ctx.rotate(g.bank*.18);
      const board=ctx.createLinearGradient(-70,0,70,0);board.addColorStop(0,"#d6aa44");board.addColorStop(.5,"#f5db83");board.addColorStop(1,"#d6aa44");ctx.fillStyle=board;
      ctx.beginPath();ctx.moveTo(0,-118);ctx.bezierCurveTo(-34,-86,-58,-42,-64,14);ctx.quadraticCurveTo(0,32,64,14);ctx.bezierCurveTo(58,-42,34,-86,0,-118);ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-106);ctx.lineTo(0,18);ctx.stroke();
      ctx.restore();

      // Rail spray in board space.
      for(const p of g.spray){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle="#effffd";ctx.beginPath();ctx.arc(vw/2+p.x,boardY+p.y,p.size,0,TAU);ctx.fill();}ctx.globalAlpha=1;
    };

    const tick=(ts:number)=>{
      const r=canvas.getBoundingClientRect(),vw=r.width,vh=r.height,g=game.current,dt=g.last?Math.min(.032,(ts-g.last)/1000):0;g.last=ts;g.elapsed+=dt;
      if(g.phase==="playing"){
        const rail=Number(g.right)-Number(g.left); // left=-1 engages left rail; right=+1 engages right rail
        const targetBank=rail*.92;
        g.bank += (targetBank-g.bank)*Math.min(1,dt*(rail===0?5.2:7.8));

        // Rail/fin lift bends the path; more speed + more bank = tighter carve. Bank also creates induced/form drag.
        const railHold=clamp(g.speed/28,.45,1.25);
        const turnRate=Math.sin(g.bank)*(.62+railHold*.72);
        g.heading += turnRate*dt;
        const railDrag=Math.abs(g.bank)*(.34+.32*railHold)+g.bank*g.bank*.28;

        // Face coordinate: 0 = trough, 1 = lip. Heading and bank redirect momentum vertically on the face.
        const redirect=-Math.sin(g.bank)*g.speed*.012;
        g.verticalVelocity += redirect*dt;
        g.verticalVelocity -= .19*dt; // gravity pulls down the face
        g.verticalVelocity *= Math.pow(.992,dt*60);
        g.face += g.verticalVelocity*dt;

        // Gravity component down the face generates speed. Climbing spends kinetic energy.
        const descending=Math.max(0,-g.verticalVelocity),climbing=Math.max(0,g.verticalVelocity);
        const faceSteepness=.68+smooth(clamp((g.face-.12)/.7,0,1))*.72;
        g.speed += (descending*12.5*faceSteepness-climbing*7.5-railDrag-0.42)*dt;

        if(g.face<=.04){
          g.face=.04;
          if(g.bank<-.18){g.verticalVelocity=Math.abs(g.verticalVelocity)*.58+.22;g.speed+=1.1;setStatus("BOTTOM TURN · LEFT RAIL");}
          else if(g.bank>.18){g.verticalVelocity=Math.abs(g.verticalVelocity)*.4+.12;g.speed-=.5;setStatus("RIGHT RAIL · RUNNING OUT");}
          else{g.verticalVelocity=.05;g.speed-=1.2;setStatus("FLAT AT THE BOTTOM");}
        }
        if(g.face>=.96){g.face=.96;g.verticalVelocity=-Math.abs(g.verticalVelocity)*.55-.1;setStatus(Math.abs(g.bank)>.35?"CARVE OFF THE TOP":"HIGH LINE");}

        // Pump is an impulse whose reward depends on timing, not spam.
        g.pumpCooldown=Math.max(0,g.pumpCooldown-dt);
        if(g.pumpQueued){
          g.pumpQueued=false;
          if(g.pumpCooldown<=0){
            const lowZone=1-smooth(clamp((g.face-.18)/.42,0,1));
            const transition=clamp(Math.abs(g.verticalVelocity)*3.2,0,1);
            const railSet=clamp(Math.abs(g.bank)*1.25,0,1);
            const efficiency=clamp(.15+lowZone*.45+transition*.25+railSet*.2,0,1);
            const gain=efficiency*2.9;
            g.speed+=gain;
            g.pumpChain=efficiency>.68?Math.min(6,g.pumpChain+1):0;
            g.score+=Math.round(40*efficiency*(1+g.pumpChain*.22));
            g.pumpCooldown=.34;
            setStatus(efficiency>.78?"PUMP · PERFECT":efficiency>.52?"PUMP · DRIVE":"PUMP · POOR TIMING");
            if(efficiency>.55)spawnRailSpray(g,g.bank<0?-1:1,efficiency);
          }
        }

        // Left peels left-to-right from the beach: stay just ahead of the breaking pocket.
        const downLine=g.speed*Math.cos(g.heading);
        g.pocket += ((downLine-21.5)/170)*dt;
        g.pocket=clamp(g.pocket,-.08,1.05);
        if(g.pocket<.03)finish("THE WHITEWATER CAUGHT YOU");
        if(g.pocket>.92){g.speed-=1.8*dt;setStatus("TOO FAR ON THE SHOULDER");}
        if(g.speed<10.5)finish("YOU LOST TOO MUCH SPEED");

        const carveQuality=clamp(Math.abs(g.bank)*railHold,0,1.2);
        g.score+=dt*(g.speed*.7+carveQuality*18);
        setScore(Math.floor(g.score));
        setHint(`Speed ${g.speed.toFixed(1)} · Face ${Math.round(g.face*100)}% · Rail ${g.bank<-.12?"LEFT":g.bank>.12?"RIGHT":"FLAT"}`);
      }

      for(const p of g.spray){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;}g.spray=g.spray.filter(p=>p.life>0);
      drawScene(vw,vh,g);
      raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);
    return()=>{removeEventListener("resize",resize);if(raf.current)cancelAnimationFrame(raf.current);};
  },[finish]);

  const hold=(key:"left"|"right",on:boolean)=>{game.current[key]=on;};

  return <main className={styles.shell}>
    <canvas ref={canvasRef} className={styles.canvas} aria-label="First-person surfing game canvas" />
    <header className={styles.topbar}><Link href="/" className={styles.brand}><strong>BOOKSURF</strong><span>First-person carving prototype</span></Link><div className={styles.actions}><Link href="/surf" className={styles.ghost}>Find surf</Link>{phase==="playing"?<button className={styles.solid} onClick={reset}>Restart</button>:null}</div></header>
    {phase!=="ready"?<><div className={styles.hud}><div className={styles.pill}><small>Score</small><strong>{score.toLocaleString()}</strong></div><div className={styles.pill}><small>Status</small><strong>{status}</strong></div><div className={styles.pill}><small>Best</small><strong>{best.toLocaleString()}</strong></div></div><div className={styles.timingHud}><strong>LEFT-HANDER</strong><span>{hint}</span></div></>:null}
    {phase==="ready"?<section className={styles.intro}><div className={styles.introCard}><p className={styles.kicker}>Carving prototype</p><h1 className={styles.title}>FIRST<br/>PERSON</h1><p className={styles.tagline}>One left. No airs. Learn the face, set a rail, carry speed, and pump only when the board and wave are loaded.</p><button className={styles.start} onClick={reset}>Take off</button><p className={styles.instructions}>← left rail · → right rail · SPACE pump</p></div></section>:null}
    {phase==="over"?<section className={styles.gameOver}><p className={styles.kicker}>Wipeout</p><h2>{score.toLocaleString()} points</h2><p>{hint}</p><button className={styles.start} onClick={reset}>Take another wave</button></section>:null}
    {phase==="playing"?<div className={styles.touchControls}><button className={styles.touchButton} onPointerDown={()=>hold("left",true)} onPointerUp={()=>hold("left",false)} onPointerCancel={()=>hold("left",false)}>LEFT</button><button className={`${styles.touchButton} ${styles.touchJump}`} onPointerDown={()=>{game.current.pumpQueued=true;}}>PUMP</button><button className={styles.touchButton} onPointerDown={()=>hold("right",true)} onPointerUp={()=>hold("right",false)} onPointerCancel={()=>hold("right",false)}>RIGHT</button></div>:null}
  </main>;
}
