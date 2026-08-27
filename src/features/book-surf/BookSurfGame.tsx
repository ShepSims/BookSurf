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

type WaveRender = {
  px:number;
  lipX:number;
  base:number;
  waveHeight:number;
  topAtPlayer:number;
};

const TAU=Math.PI*2;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smooth=(t:number)=>t*t*(3-2*t);
const hash=(n:number)=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x);};

function waveTopY(x:number,vw:number,vh:number,lipX:number,height:number){
  const base=vh*.82;
  const faceWidth=Math.max(180,vw-lipX);
  const t=clamp((x-lipX)/faceWidth,0,1);
  const steepPocket=Math.pow(1-t,.38);
  const shoulderFalloff=1-smooth(clamp((t-.62)/.38,0,1))*.78;
  const pulse=Math.sin(t*Math.PI*1.6)*7;
  return base-height*steepPocket*shoulderFalloff+pulse;
}

function spawnSpray(g:Runtime,x:number,y:number,power:number,direction:number){
  const count=Math.round(14+power*30);
  for(let i=0;i<count;i++){
    const spread=(Math.random()-.5)*1.05;
    const velocity=120+Math.random()*210*power;
    g.particles.push({x,y,vx:Math.cos(direction+spread)*velocity,vy:Math.sin(direction+spread)*velocity-65,life:.5+Math.random()*.65,size:1.2+Math.random()*3.7});
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
    game.current.best=Number.isFinite(saved)?saved:0;
    setBest(game.current.best);
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

    const drawWave=(vw:number,vh:number,g:Runtime):WaveRender=>{
      const px=vw*.43;
      const waveHeight=Math.min(vh*.58,410);
      const lipX=px-g.pocket*vw*.5;
      const base=vh*.82;
      const horizon=vh*.31;

      const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#8fc2c9");sky.addColorStop(.72,"#b8dadd");sky.addColorStop(1,"#d4e7e5");ctx.fillStyle=sky;ctx.fillRect(0,0,vw,horizon+2);
      ctx.fillStyle="rgba(255,244,205,.22)";ctx.beginPath();ctx.arc(vw*.77,vh*.14,Math.min(vw,vh)*.095,0,TAU);ctx.fill();

      const sea=ctx.createLinearGradient(0,horizon,0,vh);sea.addColorStop(0,"#286e78");sea.addColorStop(.28,"#0b5b68");sea.addColorStop(.72,"#073f4d");sea.addColorStop(1,"#032e39");ctx.fillStyle=sea;ctx.fillRect(0,horizon,vw,vh-horizon);

      ctx.globalAlpha=.25;ctx.strokeStyle="#d4edf0";ctx.lineWidth=1;
      for(let i=0;i<7;i++){
        const yy=horizon+18+i*18;
        ctx.beginPath();
        for(let x=0;x<=vw;x+=24){const y=yy+Math.sin(x*.012+i*1.7+g.elapsed*.45)*3+(hash(i*9+x*.01)-.5)*2;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
      }
      ctx.globalAlpha=1;

      ctx.beginPath();ctx.moveTo(0,base);
      for(let x=0;x<=vw;x+=6)ctx.lineTo(x,waveTopY(x,vw,vh,lipX,waveHeight));
      ctx.lineTo(vw,vh);ctx.lineTo(0,vh);ctx.closePath();
      const face=ctx.createLinearGradient(lipX,base-waveHeight,vw,base);
      face.addColorStop(0,"#0d5361");face.addColorStop(.18,"#07606e");face.addColorStop(.5,"#08798a");face.addColorStop(.82,"#0b6877");face.addColorStop(1,"#07515f");ctx.fillStyle=face;ctx.fill();

      const playerTop=waveTopY(px,vw,vh,lipX,waveHeight);
      const faceGlow=ctx.createRadialGradient(lipX+waveHeight*.38,base-waveHeight*.46,20,lipX+waveHeight*.38,base-waveHeight*.46,waveHeight*.62);
      faceGlow.addColorStop(0,"rgba(88,201,205,.34)");faceGlow.addColorStop(.5,"rgba(65,174,183,.14)");faceGlow.addColorStop(1,"rgba(20,90,105,0)");ctx.fillStyle=faceGlow;ctx.fillRect(Math.max(0,lipX),base-waveHeight-80,vw-Math.max(0,lipX),waveHeight+110);

      ctx.globalAlpha=.17;ctx.strokeStyle="#bce3e5";ctx.lineWidth=1;
      for(let i=0;i<11;i++){
        const offset=20+i*15;
        ctx.beginPath();
        for(let x=Math.max(0,lipX+18);x<vw;x+=18){const y=waveTopY(x,vw,vh,lipX,waveHeight)+offset+Math.sin(x*.021+i*.8+g.elapsed*.8)*2;x===Math.max(0,lipX+18)?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();
      }
      ctx.globalAlpha=1;

      const tube=clamp((.52-g.pocket)*2.7,0,1);
      const barrelReach=150+tube*205;
      const crestY=base-waveHeight+12;
      if(tube>.05){
        const lipGradient=ctx.createLinearGradient(lipX,crestY,lipX+barrelReach,crestY+150);
        lipGradient.addColorStop(0,"rgba(230,251,247,.98)");lipGradient.addColorStop(.25,"rgba(177,232,229,.95)");lipGradient.addColorStop(.58,"rgba(67,164,172,.68)");lipGradient.addColorStop(1,"rgba(21,93,108,.22)");
        ctx.beginPath();ctx.moveTo(lipX-8,crestY+4);ctx.bezierCurveTo(lipX+36,crestY-62,lipX+barrelReach*.8,crestY-18,lipX+barrelReach,crestY+128);ctx.bezierCurveTo(lipX+barrelReach*.78,crestY+88,lipX+barrelReach*.43,crestY+65,lipX-8,crestY+4);ctx.closePath();ctx.fillStyle=lipGradient;ctx.fill();

        const innerX=lipX+barrelReach*.57,innerY=crestY+108;
        ctx.save();ctx.beginPath();ctx.ellipse(innerX,innerY,barrelReach*.29,70+tube*16,-.12,Math.PI*.92,Math.PI*1.93);ctx.lineWidth=30;ctx.strokeStyle="rgba(2,41,52,.78)";ctx.shadowBlur=22;ctx.shadowColor="rgba(0,0,0,.28)";ctx.stroke();ctx.restore();

        ctx.strokeStyle="rgba(232,255,251,.88)";ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(lipX-18,crestY+2);ctx.bezierCurveTo(lipX+50,crestY-33,lipX+barrelReach*.68,crestY-18,lipX+barrelReach*.97,crestY+112);ctx.stroke();
      }

      const whitewaterEnd=Math.max(-40,lipX+55);
      const foamGradient=ctx.createLinearGradient(0,crestY,whitewaterEnd,base);foamGradient.addColorStop(0,"rgba(244,255,252,.96)");foamGradient.addColorStop(.55,"rgba(206,237,236,.92)");foamGradient.addColorStop(1,"rgba(114,189,194,.48)");
      ctx.beginPath();ctx.moveTo(0,base);ctx.lineTo(0,crestY+65);for(let x=0;x<=whitewaterEnd;x+=12){const n=hash(x*.17+Math.floor(g.elapsed*6));const y=crestY+58+Math.sin(x*.045+g.elapsed*3.4)*16+n*26;ctx.lineTo(x,y);}ctx.lineTo(whitewaterEnd,base);ctx.closePath();ctx.fillStyle=foamGradient;ctx.fill();

      ctx.fillStyle="rgba(240,255,252,.88)";
      for(let i=0;i<42;i++){
        const seed=i*17.23;
        const x=lipX-95+hash(seed)*150;
        const y=crestY+20+hash(seed+4.1)*145;
        const r=1.5+hash(seed+9.4)*4.5;
        ctx.globalAlpha=.35+hash(seed+6)*.6;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
      }
      ctx.globalAlpha=1;

      return{px,lipX,base,waveHeight,topAtPlayer:playerTop};
    };

    const drawSurfer=(x:number,y:number,angle:number,g:Runtime)=>{
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);
      ctx.shadowBlur=8;ctx.shadowColor="rgba(0,0,0,.2)";
      ctx.fillStyle="#f4d06f";ctx.beginPath();ctx.ellipse(0,2,38,5.5,-.02,0,TAU);ctx.fill();ctx.shadowBlur=0;
      ctx.strokeStyle="#092728";ctx.lineWidth=6;ctx.lineCap="round";ctx.lineJoin="round";
      const crouch=g.compress?7:0;
      ctx.beginPath();ctx.moveTo(-11,-4);ctx.lineTo(-14,-17+crouch);ctx.lineTo(-3,-34+crouch);ctx.lineTo(10,-21+crouch);ctx.lineTo(16,-5);ctx.stroke();
      ctx.strokeStyle="#d9a77c";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-3,-29+crouch);ctx.lineTo(g.trick==="grab"?-25:-22,g.trick==="grab"?-2:-21+crouch);ctx.moveTo(5,-29+crouch);ctx.lineTo(24,-17+crouch);ctx.stroke();
      ctx.fillStyle="#d5a276";ctx.beginPath();ctx.arc(-2,-43+crouch,8,0,TAU);ctx.fill();
      ctx.restore();
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

          if(g.compress){g.speed-=4*dt;if(g.line<.28&&descending>.15)g.speed+=18*dt;}
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
              g.action=false;g.air=true;g.airY=wave.topAtPlayer-(wave.waveHeight*(1-g.line))-8;g.airVy=-190-g.speed*.32;g.angle=-.12;g.rotation=0;g.trick="none";g.line=.88;setCallout(critical>.6?"HIT THE LIP · AIR":"AIR OFF THE SHOULDER");
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

      for(const p of g.particles){p.life-=dt;p.vy+=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle="#ecfffd";ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}
      ctx.globalAlpha=1;g.particles=g.particles.filter(p=>p.life>0);

      const surferY=g.air?g.airY:wave.base-(wave.base-wave.topAtPlayer)*clamp(g.line,0,1)-8;
      const surferAngle=g.air?g.angle:clamp(-g.lineVelocity*.18,-.45,.42);
      drawSurfer(wave.px,surferY,surferAngle,g);

      ctx.fillStyle="rgba(235,248,246,.7)";ctx.font="700 11px Arial";ctx.fillText(`SPEED ${Math.round(g.speed)}`,wave.px+54,vh*.92);ctx.fillText(`POCKET ${Math.round(g.pocket*100)}%`,wave.px+54,vh*.92+18);
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
    {phase==="ready"?<section className={styles.intro}><div className={styles.introCard}><p className={styles.kicker}>A BookSurf game</p><h1 className={styles.title}>BOOK<br/>SURF</h1><p className={styles.tagline}>Time the drop. Use gravity and rail pressure to make speed. Bottom-turn into the pocket, throw spray off the lip, and sit deep enough to get barreled.</p><button className={styles.start} onClick={reset}>Paddle out</button><p className={styles.instructions}>A / ← carve up · D / → drive down · S / ↓ compress & pump · SPACE commit the drop / hit the lip · Q grab · E spin</p></div></section>:null}
    {phase==="over"?<section className={styles.gameOver}><p className={styles.kicker}>Wipeout</p><h2>{score.toLocaleString()} points</h2><p>{callout}</p><button className={styles.start} onClick={reset}>Paddle back out</button></section>:null}
    {phase==="playing"?<div className={styles.touchControls}><button className={styles.touchButton} onPointerDown={()=>hold("up",true)} onPointerUp={()=>hold("up",false)} onPointerCancel={()=>hold("up",false)}>UP</button><button className={styles.touchButton} onPointerDown={()=>hold("compress",true)} onPointerUp={()=>hold("compress",false)} onPointerCancel={()=>hold("compress",false)}>PUMP</button><button className={`${styles.touchButton} ${styles.touchJump}`} onPointerDown={action}>GO</button><button className={styles.touchButton} onPointerDown={()=>hold("down",true)} onPointerUp={()=>hold("down",false)} onPointerCancel={()=>hold("down",false)}>DOWN</button></div>:null}
  </main>;
}
