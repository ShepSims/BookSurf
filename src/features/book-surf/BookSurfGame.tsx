"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./BookSurfGame.module.css";

type Phase = "ready" | "playing" | "over";
type RideState = "waiting-drop" | "riding";
type Trick = "none" | "grab" | "spin";
type Particle = { x:number; y:number; vx:number; vy:number; life:number; size:number };

type Runtime = {
  phase: Phase;
  rideState: RideState;
  last: number;
  elapsed: number;
  score: number;
  best: number;
  multiplier: number;
  speed: number;
  waveSpeed: number;
  pocket: number;
  line: number;
  lineVelocity: number;
  up: boolean;
  down: boolean;
  compress: boolean;
  wasCompressing: boolean;
  action: boolean;
  air: boolean;
  airY: number;
  airVy: number;
  angle: number;
  rotation: number;
  trick: Trick;
  barrelTime: number;
  inBarrel: boolean;
  lastTurnAt: number;
  particles: Particle[];
};

const TAU=Math.PI*2;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

function waveTopY(x:number,vw:number,vh:number,lipX:number,height:number){
  const base=vh*.79;
  const shoulder=Math.max(80,vw-lipX);
  const t=clamp((x-lipX)/shoulder,0,1);
  const face=Math.pow(1-t,.62);
  const undulation=Math.sin(t*Math.PI*1.2)*10;
  return base-height*face+undulation;
}

function spawnSpray(g:Runtime,x:number,y:number,power:number,direction:number){
  const count=Math.round(10+power*22);
  for(let i=0;i<count;i++){
    const spread=(Math.random()-.5)*1.2;
    const velocity=110+Math.random()*170*power;
    g.particles.push({
      x,
      y,
      vx:Math.cos(direction+spread)*velocity,
      vy:Math.sin(direction+spread)*velocity-50,
      life:.45+Math.random()*.55,
      size:1.2+Math.random()*3,
    });
  }
}

export default function BookSurfGame(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const raf=useRef<number|undefined>(undefined);
  const game=useRef<Runtime>({
    phase:"ready",rideState:"waiting-drop",last:0,elapsed:0,score:0,best:0,multiplier:1,
    speed:118,waveSpeed:205,pocket:.68,line:.92,lineVelocity:0,up:false,down:false,
    compress:false,wasCompressing:false,action:false,air:false,airY:0,airVy:0,angle:0,rotation:0,
    trick:"none",barrelTime:0,inBarrel:false,lastTurnAt:0,particles:[],
  });
  const [phase,setPhase]=useState<Phase>("ready");
  const [score,setScore]=useState(0);
  const [best,setBest]=useState(0);
  const [multiplier,setMultiplier]=useState(1);
  const [callout,setCallout]=useState("WAIT FOR THE FACE");
  const [status,setStatus]=useState("PADDLE");

  const reset=useCallback(()=>{
    const g=game.current;
    Object.assign(g,{phase:"playing",rideState:"waiting-drop",last:0,elapsed:0,score:0,multiplier:1,speed:118,waveSpeed:205,pocket:.68,line:.92,lineVelocity:0,up:false,down:false,compress:false,wasCompressing:false,action:false,air:false,airY:0,airVy:0,angle:0,rotation:0,trick:"none",barrelTime:0,inBarrel:false,lastTurnAt:0,particles:[]});
    setPhase("playing");setScore(0);setMultiplier(1);setCallout("WAIT FOR THE FACE");setStatus("PADDLE");
  },[]);

  useEffect(()=>{
    const saved=Number(localStorage.getItem("booksurf-book-surf-best")||0);
    game.current.best=Number.isFinite(saved)?saved:0;setBest(game.current.best);
  },[]);

  const finish=useCallback((message:string)=>{
    const g=game.current;if(g.phase!=="playing")return;
    g.phase="over";setCallout(message);
    const final=Math.floor(g.score);
    if(final>g.best){g.best=final;localStorage.setItem("booksurf-book-surf-best",String(final));setBest(final);}
    setScore(final);setPhase("over");
  },[]);

  const action=useCallback(()=>{if(game.current.phase==="playing")game.current.action=true;},[]);
  const setTrick=useCallback((trick:Trick)=>{const g=game.current;if(g.phase==="playing"&&g.air)g.trick=trick;},[]);

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","KeyA","KeyD","KeyS","KeyQ","KeyE"].includes(e.code))e.preventDefault();
      const g=game.current;
      if(e.code==="ArrowLeft"||e.code==="KeyA"||e.code==="ArrowUp")g.up=true;
      if(e.code==="ArrowRight"||e.code==="KeyD")g.down=true;
      if(e.code==="ArrowDown"||e.code==="KeyS")g.compress=true;
      if(e.code==="Space")action();
      if(e.code==="KeyQ")setTrick("grab");
      if(e.code==="KeyE")setTrick("spin");
      if(e.code==="Enter"&&g.phase!=="playing")reset();
    };
    const up=(e:KeyboardEvent)=>{
      const g=game.current;
      if(e.code==="ArrowLeft"||e.code==="KeyA"||e.code==="ArrowUp")g.up=false;
      if(e.code==="ArrowRight"||e.code==="KeyD")g.down=false;
      if(e.code==="ArrowDown"||e.code==="KeyS")g.compress=false;
    };
    addEventListener("keydown",down,{passive:false});addEventListener("keyup",up);
    return()=>{removeEventListener("keydown",down);removeEventListener("keyup",up);};
  },[action,reset,setTrick]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const resize=()=>{const d=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);};
    resize();addEventListener("resize",resize);

    const drawWave=(vw:number,vh:number,g:Runtime)=>{
      const px=vw*.34;
      const waveHeight=Math.min(vh*.52,340);
      const lipX=px-g.pocket*vw*.48;
      const base=vh*.79;

      const ocean=ctx.createLinearGradient(0,vh*.2,0,vh);ocean.addColorStop(0,"#0b4544");ocean.addColorStop(.55,"#0e7069");ocean.addColorStop(1,"#063c3b");ctx.fillStyle=ocean;ctx.fillRect(0,0,vw,vh);

      ctx.beginPath();ctx.moveTo(0,base);
      for(let x=0;x<=vw;x+=10){const y=waveTopY(x,vw,vh,lipX,waveHeight);ctx.lineTo(x,y);}ctx.lineTo(vw,vh);ctx.lineTo(0,vh);ctx.closePath();
      const face=ctx.createLinearGradient(lipX,base-waveHeight,vw,base);face.addColorStop(0,"rgba(16,111,105,.95)");face.addColorStop(.55,"rgba(18,126,118,.9)");face.addColorStop(1,"rgba(20,95,90,.92)");ctx.fillStyle=face;ctx.fill();

      ctx.globalAlpha=.18;ctx.strokeStyle="#d7fff8";ctx.lineWidth=1;
      for(let i=0;i<12;i++){ctx.beginPath();for(let x=Math.max(0,lipX);x<vw;x+=18){const y=waveTopY(x,vw,vh,lipX,waveHeight)+16+i*14+Math.sin(x*.018+i)*4;x===Math.max(0,lipX)?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
      ctx.globalAlpha=1;

      const tubeSize=clamp((.58-g.pocket)*2.4,0,1);
      if(tubeSize>0){
        const curlReach=130+tubeSize*150;
        ctx.beginPath();ctx.moveTo(lipX-12,base-waveHeight+8);ctx.bezierCurveTo(lipX+25,base-waveHeight-38,lipX+curlReach,base-waveHeight+18,lipX+curlReach*1.05,base-waveHeight+105);ctx.bezierCurveTo(lipX+curlReach*.73,base-waveHeight+68,lipX+curlReach*.36,base-waveHeight+54,lipX-12,base-waveHeight+8);ctx.fillStyle="rgba(224,251,246,.88)";ctx.fill();
        ctx.beginPath();ctx.arc(lipX+curlReach*.56,base-waveHeight+86,48+tubeSize*32,Math.PI*.98,Math.PI*1.93);ctx.strokeStyle="rgba(8,68,65,.75)";ctx.lineWidth=16;ctx.stroke();
      }

      ctx.fillStyle="rgba(238,255,252,.92)";for(let i=0;i<28;i++){const x=lipX-60+Math.random()*95,y=base-waveHeight+Math.random()*110;ctx.beginPath();ctx.arc(x,y,2+Math.random()*5,0,TAU);ctx.fill();}

      return{px,lipX,base,waveHeight,topAtPlayer:waveTopY(px,vw,vh,lipX,waveHeight)};
    };

    const drawSurfer=(x:number,y:number,angle:number,g:Runtime)=>{
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);
      ctx.fillStyle="#f7d59d";ctx.beginPath();ctx.ellipse(0,0,32,5,0,0,TAU);ctx.fill();
      ctx.strokeStyle="#062923";ctx.lineWidth=5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-6,-5);ctx.lineTo(-11,-20);ctx.lineTo(-1,-36);ctx.lineTo(9,-20);ctx.lineTo(13,-6);ctx.stroke();
      ctx.strokeStyle="#efc49d";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-1,-31);ctx.lineTo(g.trick==="grab"?-22:-17,g.trick==="grab"?-3:-21);ctx.moveTo(4,-29);ctx.lineTo(18,-19);ctx.stroke();
      ctx.fillStyle="#e6bb91";ctx.beginPath();ctx.arc(-1,-42,7,0,TAU);ctx.fill();ctx.restore();
    };

    const tick=(ts:number)=>{
      const rect=canvas.getBoundingClientRect(),vw=rect.width,vh=rect.height,g=game.current,dt=g.last?Math.min(.032,(ts-g.last)/1000):0;g.last=ts;g.elapsed+=dt;
      const wave=drawWave(vw,vh,g);

      if(g.phase==="playing"){
        if(g.rideState==="waiting-drop"){
          g.pocket=clamp(g.pocket-.072*dt,.2,.7);
          const grade=g.pocket>.56?"TOO EARLY":g.pocket>.46?"EARLY":g.pocket>.36?"GO":g.pocket>.29?"LATE":"CLOSING OUT";
          setStatus(grade);
          if(g.action){
            g.action=false;
            if(g.pocket<.285){finish("THE LIP LANDED ON YOU");}
            else{
              const clean=g.pocket>=.36&&g.pocket<=.46;
              g.rideState="riding";g.line=.9;g.lineVelocity=clean?-1.35:-.9;g.speed=clean?245:g.pocket>.46?185:215;g.multiplier=clean?1.5:1;setMultiplier(g.multiplier);setCallout(clean?"CLEAN DROP · DRIVE TO THE BOTTOM":"MAKE THE DROP");setStatus("ON RAIL");
            }
          }
        }else if(!g.air){
          const up=Number(g.up),down=Number(g.down);
          const faceControl=(g.speed/230)*(1.25+g.line*.4);
          g.lineVelocity+=(up-down)*1.95*faceControl*dt;
          g.lineVelocity-=.72*dt;
          g.lineVelocity*=Math.pow(.985,dt*60);
          const priorLine=g.line;g.line+=g.lineVelocity*dt;

          const descending=Math.max(0,-g.lineVelocity),climbing=Math.max(0,g.lineVelocity);
          g.speed+=descending*82*dt-climbing*42*dt;
          g.speed-=11*dt;

          if(g.compress){
            g.speed-=4*dt;
            if(g.line<.28&&descending>.15)g.speed+=18*dt;
          }
          if(g.wasCompressing&&!g.compress&&g.line<.24){g.speed+=28;setCallout("PUMPED OUT OF THE BOTTOM");}
          g.wasCompressing=g.compress;

          if(g.line<=.06){
            if(g.up&&g.speed>150){
              const power=clamp(g.speed/300,.45,1.2);g.line=.07;g.lineVelocity=.95+power*.95;g.speed*=.94;g.score+=Math.round(95*power*g.multiplier);spawnSpray(g,wave.px,wave.base-10,power,-2.45);setCallout("BOTTOM TURN");g.lastTurnAt=g.elapsed;
            }else{g.line=.03;g.lineVelocity=0;g.speed-=70*dt;setCallout("BOGGING · SET THE RAIL");}
          }

          if(g.line>=.91){
            const critical=clamp(1-Math.abs(g.pocket-.34)/.34,0,1);
            if(g.action&&g.speed>225){
              g.action=false;g.air=true;g.airY=wave.topAtPlayer-(wave.waveHeight*(1-g.line)) - 8;g.airVy=-190-g.speed*.32;g.angle=-.12;g.rotation=0;g.trick="none";g.line=.88;setCallout(critical>.6?"HIT THE LIP · AIR":"AIR OFF THE SHOULDER");
            }else if(g.down){
              const tooLate=g.pocket<.21;
              if(tooLate){finish("CAUGHT BY THE LIP");}
              else{
                const power=clamp((g.speed-130)/170,.25,1.2),points=Math.round((180+critical*260)*power*g.multiplier);g.score+=points;g.line=.89;g.lineVelocity=-1.05-power*.7;g.speed*=.91;spawnSpray(g,wave.px,wave.topAtPlayer,power,-.8);setCallout(critical>.68?`CRITICAL SNAP +${points}`:`CUTBACK +${points}`);g.multiplier=clamp(g.multiplier+(critical>.65?.5:.2),1,8);setMultiplier(Number(g.multiplier.toFixed(1)));g.lastTurnAt=g.elapsed;
              }
            }else{g.line=.92;g.lineVelocity=Math.min(0,g.lineVelocity);g.speed-=34*dt;}
          }

          g.pocket+=((g.speed-g.waveSpeed)/430)*dt;
          g.pocket=clamp(g.pocket,-.05,1.08);
          if(g.pocket<.08){finish("THE FOAM BALL GOT YOU");}
          if(g.pocket>1){g.speed-=25*dt;setCallout("TOO FAR ON THE SHOULDER · CUT BACK");}

          const barrelZone=g.pocket>.14&&g.pocket<.42&&g.line>.42&&g.line<.73&&g.speed>185;
          if(barrelZone){
            if(!g.inBarrel){g.inBarrel=true;g.barrelTime=0;setCallout("PACKING THE TUBE");}
            g.barrelTime+=dt;g.score+=dt*150*g.multiplier;setStatus(`BARREL ${g.barrelTime.toFixed(1)}s`);
          }else if(g.inBarrel){
            const bonus=Math.round(g.barrelTime*220*g.multiplier);g.score+=bonus;g.multiplier=clamp(g.multiplier+.75,1,8);setMultiplier(Number(g.multiplier.toFixed(1)));setCallout(`BARREL EXIT +${bonus}`);g.inBarrel=false;g.barrelTime=0;
          }else setStatus(g.pocket<.28?"DEEP":"ON RAIL");

          if(g.speed<95)finish("YOU LOST SPEED AND FELL BEHIND");
          if(priorLine>.2&&g.line<=.2&&g.down)spawnSpray(g,wave.px,wave.base-18,.35,-2.6);
        }else{
          const steer=Number(g.down)-Number(g.up);g.airVy+=560*dt;g.airY+=g.airVy*dt;g.angle+=steer*3.3*dt;
          if(g.trick==="spin"){g.angle+=5.8*dt;g.rotation+=5.8*dt;}
          if(g.action)g.action=false;
          const landingY=wave.topAtPlayer+wave.waveHeight*.12;
          if(g.airVy>0&&g.airY>=landingY){
            const diff=Math.abs(Math.atan2(Math.sin(g.angle+.12),Math.cos(g.angle+.12)));
            if(diff>.72){finish("YOU DIDN'T MATCH THE LANDING");}
            else{
              const trickBase=g.trick==="spin"?(Math.abs(g.rotation)>5.2?520:320):g.trick==="grab"?240:180;
              const landing=diff<.2?1.7:diff<.42?1.3:1;const critical=clamp(1-Math.abs(g.pocket-.3)/.4,.35,1);const pts=Math.round(trickBase*landing*critical*g.multiplier);g.score+=pts;g.multiplier=clamp(g.multiplier+(diff<.2?.6:.25),1,8);setMultiplier(Number(g.multiplier.toFixed(1)));setCallout(`${g.trick==="spin"?"AIR ROTATION":g.trick==="grab"?"INDY GRAB":"STRAIGHT AIR"} +${pts}${diff<.2?" · STOMPED":""}`);g.air=false;g.line=.82;g.lineVelocity=-.48;g.speed*=.9;g.trick="none";g.rotation=0;g.angle=0;
            }
          }
        }

        g.score+=dt*Math.max(0,g.speed-120)*.05*g.multiplier;setScore(Math.floor(g.score));
      }

      for(const p of g.particles){p.life-=dt;p.vy+=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle="#eafffb";ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}
      ctx.globalAlpha=1;g.particles=g.particles.filter(p=>p.life>0);

      const surferY=g.air?g.airY:wave.base-(wave.base-wave.topAtPlayer)*clamp(g.line,0,1)-8;
      const surferAngle=g.air?g.angle:clamp(-g.lineVelocity*.18,-.45,.42);
      drawSurfer(wave.px,surferY,surferAngle,g);

      ctx.fillStyle="rgba(247,242,232,.72)";ctx.font="700 11px Arial";ctx.fillText(`SPEED ${Math.round(g.speed)}`,wave.px+46,vh*.91);ctx.fillText(`POCKET ${Math.round(g.pocket*100)}%`,wave.px+46,vh*.91+18);
      raf.current=requestAnimationFrame(tick);
    };

    raf.current=requestAnimationFrame(tick);
    return()=>{removeEventListener("resize",resize);if(raf.current)cancelAnimationFrame(raf.current);};
  },[finish]);

  const hold=(key:"up"|"down"|"compress",on:boolean)=>{game.current[key]=on;};

  return <main className={styles.shell}>
    <canvas ref={canvasRef} className={styles.canvas} aria-label="Book Surf surfing game canvas" />
    <header className={styles.topbar}><Link href="/" className={styles.brand}><strong>BOOKSURF</strong><span>Surf books. Book surf.</span></Link><div className={styles.actions}><Link href="/surf" className={styles.ghost}>Find surf</Link>{phase==="playing"?<button className={styles.solid} onClick={reset}>Restart</button>:null}</div></header>
    {phase!=="ready"?<><div className={styles.hud}><div className={styles.pill}><small>Score</small><strong>{score.toLocaleString()}</strong></div><div className={styles.pill}><small>Line</small><strong>x{multiplier}</strong></div><div className={styles.pill}><small>Best</small><strong>{best.toLocaleString()}</strong></div></div><div className={styles.timingHud}><strong>{status}</strong><span>{callout}</span></div></>:null}
    {phase==="ready"?<section className={styles.intro}><div className={styles.introCard}><p className={styles.kicker}>A BookSurf game</p><h1 className={styles.title}>BOOK<br/>SURF</h1><p className={styles.tagline}>Surf the wave, not a ramp. Time the drop. Use the bottom to make speed. Hit the pocket. Get barreled. Throw an air only when the section gives it to you.</p><button className={styles.start} onClick={reset}>Paddle out</button><p className={styles.instructions}>A / ← carve up · D / → drive down · S / ↓ compress & pump · SPACE commit the drop / hit the lip · Q grab · E spin</p></div></section>:null}
    {phase==="over"?<section className={styles.gameOver}><p className={styles.kicker}>Wipeout</p><h2>{score.toLocaleString()} points</h2><p>{callout}</p><button className={styles.start} onClick={reset}>Paddle back out</button></section>:null}
    {phase==="playing"?<div className={styles.touchControls}><button className={styles.touchButton} onPointerDown={()=>hold("up",true)} onPointerUp={()=>hold("up",false)} onPointerCancel={()=>hold("up",false)}>UP</button><button className={styles.touchButton} onPointerDown={()=>hold("compress",true)} onPointerUp={()=>hold("compress",false)} onPointerCancel={()=>hold("compress",false)}>PUMP</button><button className={`${styles.touchButton} ${styles.touchJump}`} onPointerDown={action}>GO</button><button className={styles.touchButton} onPointerDown={()=>hold("down",true)} onPointerUp={()=>hold("down",false)} onPointerCancel={()=>hold("down",false)}>DOWN</button></div>:null}
  </main>;
}
