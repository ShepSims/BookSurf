"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./BookSurfGame.module.css";

type Phase = "ready" | "playing" | "over";
type RideState = "waiting-drop" | "riding";
type Particle = { x:number; y:number; vx:number; vy:number; life:number; size:number };
type TutorialStep = 0|1|2|3|4|5;

type Runtime = {
  phase:Phase; rideState:RideState; last:number; elapsed:number; score:number; best:number; multiplier:number;
  speed:number; waveSpeed:number; pocket:number; line:number; lineVelocity:number;
  left:boolean; right:boolean; crouch:boolean; wasCrouching:boolean; action:boolean;
  air:boolean; airY:number; airVy:number; angle:number; rotation:number; grabbing:boolean;
  barrelTime:number; inBarrel:boolean; particles:Particle[]; tutorial:TutorialStep;
};

type WaveRender={px:number;lipX:number;base:number;waveHeight:number;topAtPlayer:number};
const TAU=Math.PI*2;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smooth=(t:number)=>t*t*(3-2*t);
const hash=(n:number)=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x);};

function waveTopY(x:number,vw:number,vh:number,lipX:number,height:number){
  const base=vh*.82,faceWidth=Math.max(180,vw-lipX),t=clamp((x-lipX)/faceWidth,0,1);
  const steep=Math.pow(1-t,.38),shoulder=1-smooth(clamp((t-.62)/.38,0,1))*.78;
  return base-height*steep*shoulder+Math.sin(t*Math.PI*1.6)*7;
}

function spawnSpray(g:Runtime,x:number,y:number,power:number,direction:number){
  const count=Math.round(14+power*30);
  for(let i=0;i<count;i++){
    const spread=(Math.random()-.5)*1.05,velocity=120+Math.random()*210*power;
    g.particles.push({x,y,vx:Math.cos(direction+spread)*velocity,vy:Math.sin(direction+spread)*velocity-65,life:.5+Math.random()*.65,size:1.2+Math.random()*3.7});
  }
}

const tutorialCopy:Record<TutorialStep,{title:string;body:string}>={
  0:{title:"1 · CATCH THE WAVE",body:"Press SPACE when the face reaches you. Too early = weak entry. Too late = lip on your head."},
  1:{title:"2 · POINT DOWN THE FACE",body:"Hold → to descend. Gravity is your engine — going down builds speed."},
  2:{title:"3 · BOTTOM TURN",body:"Near the bottom, hold ← to set the rail and redirect back up the face."},
  3:{title:"4 · PUMP FOR SPEED",body:"Hold ↓ to compress, then release near the bottom to extend and accelerate."},
  4:{title:"5 · HIT THE LIP",body:"Carry speed high on the face. Redirect with → for a snap, or SPACE to launch if the section is there."},
  5:{title:"FREE SURF",body:"Stay near the pocket, link turns, tuck into barrels, and use the whole face."},
};

export default function BookSurfGameV2(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),raf=useRef<number|undefined>(undefined);
  const game=useRef<Runtime>({phase:"ready",rideState:"waiting-drop",last:0,elapsed:0,score:0,best:0,multiplier:1,speed:118,waveSpeed:205,pocket:.68,line:.92,lineVelocity:0,left:false,right:false,crouch:false,wasCrouching:false,action:false,air:false,airY:0,airVy:0,angle:0,rotation:0,grabbing:false,barrelTime:0,inBarrel:false,particles:[],tutorial:0});
  const [phase,setPhase]=useState<Phase>("ready"),[score,setScore]=useState(0),[best,setBest]=useState(0),[multiplier,setMultiplier]=useState(1),[callout,setCallout]=useState("WAIT FOR THE FACE"),[status,setStatus]=useState("PADDLE"),[tutorial,setTutorial]=useState<TutorialStep>(0);

  const setStep=(step:TutorialStep)=>{const g=game.current;if(step>g.tutorial){g.tutorial=step;setTutorial(step);}};
  const reset=useCallback(()=>{const g=game.current;Object.assign(g,{phase:"playing",rideState:"waiting-drop",last:0,elapsed:0,score:0,multiplier:1,speed:118,waveSpeed:205,pocket:.68,line:.92,lineVelocity:0,left:false,right:false,crouch:false,wasCrouching:false,action:false,air:false,airY:0,airVy:0,angle:0,rotation:0,grabbing:false,barrelTime:0,inBarrel:false,particles:[],tutorial:0});setPhase("playing");setScore(0);setMultiplier(1);setCallout("WAIT FOR THE FACE");setStatus("PADDLE");setTutorial(0);},[]);

  useEffect(()=>{const saved=Number(localStorage.getItem("booksurf-book-surf-best")||0);game.current.best=Number.isFinite(saved)?saved:0;setBest(game.current.best);},[]);
  const finish=useCallback((message:string)=>{const g=game.current;if(g.phase!=="playing")return;g.phase="over";setCallout(message);const final=Math.floor(g.score);if(final>g.best){g.best=final;localStorage.setItem("booksurf-book-surf-best",String(final));setBest(final);}setScore(final);setPhase("over");},[]);
  const action=useCallback(()=>{if(game.current.phase==="playing")game.current.action=true;},[]);

  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{if(["ArrowLeft","ArrowRight","ArrowDown","Space","KeyA","KeyD","KeyS"].includes(e.code))e.preventDefault();const g=game.current;if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=true;if(e.code==="ArrowRight"||e.code==="KeyD")g.right=true;if(e.code==="ArrowDown"||e.code==="KeyS"){g.crouch=true;if(g.air)g.grabbing=true;}if(e.code==="Space")action();if(e.code==="Enter"&&g.phase!=="playing")reset();};
    const up=(e:KeyboardEvent)=>{const g=game.current;if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")g.right=false;if(e.code==="ArrowDown"||e.code==="KeyS"){g.crouch=false;g.grabbing=false;}};
    addEventListener("keydown",down,{passive:false});addEventListener("keyup",up);return()=>{removeEventListener("keydown",down);removeEventListener("keyup",up);};
  },[action,reset]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const resize=()=>{const d=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);};resize();addEventListener("resize",resize);

    const drawWave=(vw:number,vh:number,g:Runtime):WaveRender=>{
      const px=vw*.43,waveHeight=Math.min(vh*.58,410),lipX=px-g.pocket*vw*.5,base=vh*.82,horizon=vh*.31;
      const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#8fc2c9");sky.addColorStop(.72,"#b8dadd");sky.addColorStop(1,"#d4e7e5");ctx.fillStyle=sky;ctx.fillRect(0,0,vw,horizon+2);
      ctx.fillStyle="rgba(255,244,205,.22)";ctx.beginPath();ctx.arc(vw*.77,vh*.14,Math.min(vw,vh)*.095,0,TAU);ctx.fill();
      const sea=ctx.createLinearGradient(0,horizon,0,vh);sea.addColorStop(0,"#286e78");sea.addColorStop(.28,"#0b5b68");sea.addColorStop(.72,"#073f4d");sea.addColorStop(1,"#032e39");ctx.fillStyle=sea;ctx.fillRect(0,horizon,vw,vh-horizon);
      ctx.globalAlpha=.22;ctx.strokeStyle="#d4edf0";for(let i=0;i<7;i++){const yy=horizon+18+i*18;ctx.beginPath();for(let x=0;x<=vw;x+=24){const y=yy+Math.sin(x*.012+i*1.7+g.elapsed*.45)*3;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}ctx.globalAlpha=1;
      ctx.beginPath();ctx.moveTo(0,base);for(let x=0;x<=vw;x+=6)ctx.lineTo(x,waveTopY(x,vw,vh,lipX,waveHeight));ctx.lineTo(vw,vh);ctx.lineTo(0,vh);ctx.closePath();const face=ctx.createLinearGradient(lipX,base-waveHeight,vw,base);face.addColorStop(0,"#0d5361");face.addColorStop(.18,"#07606e");face.addColorStop(.5,"#08798a");face.addColorStop(.82,"#0b6877");face.addColorStop(1,"#07515f");ctx.fillStyle=face;ctx.fill();
      const playerTop=waveTopY(px,vw,vh,lipX,waveHeight),tube=clamp((.52-g.pocket)*2.7,0,1),reach=150+tube*205,crestY=base-waveHeight+12;
      if(tube>.05){const grad=ctx.createLinearGradient(lipX,crestY,lipX+reach,crestY+150);grad.addColorStop(0,"rgba(230,251,247,.98)");grad.addColorStop(.25,"rgba(177,232,229,.95)");grad.addColorStop(.58,"rgba(67,164,172,.68)");grad.addColorStop(1,"rgba(21,93,108,.22)");ctx.beginPath();ctx.moveTo(lipX-8,crestY+4);ctx.bezierCurveTo(lipX+36,crestY-62,lipX+reach*.8,crestY-18,lipX+reach,crestY+128);ctx.bezierCurveTo(lipX+reach*.78,crestY+88,lipX+reach*.43,crestY+65,lipX-8,crestY+4);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.save();ctx.beginPath();ctx.ellipse(lipX+reach*.57,crestY+108,reach*.29,70+tube*16,-.12,Math.PI*.92,Math.PI*1.93);ctx.lineWidth=30;ctx.strokeStyle="rgba(2,41,52,.78)";ctx.shadowBlur=22;ctx.shadowColor="rgba(0,0,0,.28)";ctx.stroke();ctx.restore();}
      const foamEnd=Math.max(-40,lipX+55);ctx.beginPath();ctx.moveTo(0,base);ctx.lineTo(0,crestY+65);for(let x=0;x<=foamEnd;x+=12){const n=hash(x*.17+Math.floor(g.elapsed*6)),y=crestY+58+Math.sin(x*.045+g.elapsed*3.4)*16+n*26;ctx.lineTo(x,y);}ctx.lineTo(foamEnd,base);ctx.closePath();ctx.fillStyle="rgba(220,245,243,.88)";ctx.fill();
      return{px,lipX,base,waveHeight,topAtPlayer:playerTop};
    };

    const drawSurfer=(x:number,y:number,angle:number,g:Runtime)=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle="#f4d06f";ctx.beginPath();ctx.ellipse(0,2,38,5.5,-.02,0,TAU);ctx.fill();ctx.strokeStyle="#092728";ctx.lineWidth=6;ctx.lineCap="round";ctx.lineJoin="round";const crouch=g.crouch?7:0;ctx.beginPath();ctx.moveTo(-11,-4);ctx.lineTo(-14,-17+crouch);ctx.lineTo(-3,-34+crouch);ctx.lineTo(10,-21+crouch);ctx.lineTo(16,-5);ctx.stroke();ctx.strokeStyle="#d9a77c";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-3,-29+crouch);ctx.lineTo(g.grabbing?-25:-22,g.grabbing?-2:-21+crouch);ctx.moveTo(5,-29+crouch);ctx.lineTo(24,-17+crouch);ctx.stroke();ctx.fillStyle="#d5a276";ctx.beginPath();ctx.arc(-2,-43+crouch,8,0,TAU);ctx.fill();ctx.restore();};

    const tick=(ts:number)=>{
      const r=canvas.getBoundingClientRect(),vw=r.width,vh=r.height,g=game.current,dt=g.last?Math.min(.032,(ts-g.last)/1000):0;g.last=ts;g.elapsed+=dt;const wave=drawWave(vw,vh,g);
      if(g.phase==="playing"){
        if(g.rideState==="waiting-drop"){
          g.pocket=clamp(g.pocket-.072*dt,.2,.7);setStatus(g.pocket>.56?"WAIT":g.pocket>.46?"GET READY":g.pocket>.36?"GO":g.pocket>.29?"LATE":"CLOSING OUT");
          if(g.action){g.action=false;if(g.pocket<.285)finish("THE LIP LANDED ON YOU");else{const clean=g.pocket>=.36&&g.pocket<=.46;g.rideState="riding";g.line=.9;g.lineVelocity=clean?-1.35:-.9;g.speed=clean?245:g.pocket>.46?185:215;g.multiplier=clean?1.5:1;setMultiplier(g.multiplier);setCallout(clean?"CLEAN DROP · POINT DOWN THE FACE":"YOU'RE IN · BUILD SPEED");setStatus("RIDING");setStep(1);}}
        }else if(!g.air){
          const steer=Number(g.left)-Number(g.right),faceControl=(g.speed/230)*(1.25+g.line*.4);g.lineVelocity+=steer*1.95*faceControl*dt;g.lineVelocity-=.72*dt;g.lineVelocity*=Math.pow(.985,dt*60);const priorLine=g.line;g.line+=g.lineVelocity*dt;
          const descending=Math.max(0,-g.lineVelocity),climbing=Math.max(0,g.lineVelocity);g.speed+=descending*82*dt-climbing*42*dt-11*dt;
          if(g.right&&descending>.22&&g.tutorial===1)setStep(2);
          if(g.crouch){g.speed-=4*dt;if(g.line<.28&&descending>.15)g.speed+=18*dt;}
          if(g.wasCrouching&&!g.crouch&&g.line<.3){g.speed+=30;setCallout("PUMP · +SPEED");if(g.tutorial===3)setStep(4);}g.wasCrouching=g.crouch;
          if(g.line<=.06){if(g.left&&g.speed>150){const power=clamp(g.speed/300,.45,1.2);g.line=.07;g.lineVelocity=.95+power*.95;g.speed*=.94;g.score+=Math.round(95*power*g.multiplier);spawnSpray(g,wave.px,wave.base-10,power,-2.45);setCallout("BOTTOM TURN · DRIVE BACK UP");if(g.tutorial===2)setStep(3);}else{g.line=.03;g.lineVelocity=0;g.speed-=70*dt;setCallout("BOGGING · TURN BACK UP");}}
          if(g.line>=.91){const critical=clamp(1-Math.abs(g.pocket-.34)/.34,0,1);if(g.action&&g.speed>225){g.action=false;g.air=true;g.airY=wave.topAtPlayer-wave.waveHeight*(1-g.line)-8;g.airVy=-190-g.speed*.32;g.angle=-.12;g.rotation=0;g.grabbing=false;g.line=.88;setCallout(critical>.6?"AIR OFF THE LIP":"AIR OFF THE SHOULDER");if(g.tutorial===4)setStep(5);}else if(g.right){if(g.pocket<.21)finish("CAUGHT BY THE LIP");else{const power=clamp((g.speed-130)/170,.25,1.2),pts=Math.round((180+critical*260)*power*g.multiplier);g.score+=pts;g.line=.89;g.lineVelocity=-1.05-power*.7;g.speed*=.91;spawnSpray(g,wave.px,wave.topAtPlayer,power,-.8);setCallout(critical>.68?`CRITICAL SNAP +${pts}`:`CUTBACK +${pts}`);g.multiplier=clamp(g.multiplier+(critical>.65?.5:.2),1,8);setMultiplier(Number(g.multiplier.toFixed(1)));if(g.tutorial===4)setStep(5);}}else{g.line=.92;g.lineVelocity=Math.min(0,g.lineVelocity);g.speed-=34*dt;}}
          g.pocket+=((g.speed-g.waveSpeed)/430)*dt;g.pocket=clamp(g.pocket,-.05,1.08);if(g.pocket<.08)finish("THE FOAM BALL GOT YOU");if(g.pocket>1){g.speed-=25*dt;setCallout("TOO FAR ON THE SHOULDER · TURN BACK");}
          const barrel=g.pocket>.14&&g.pocket<.42&&g.line>.42&&g.line<.73&&g.speed>185;if(barrel){if(!g.inBarrel){g.inBarrel=true;g.barrelTime=0;setCallout("BARREL · HOLD YOUR LINE");}g.barrelTime+=dt;g.score+=dt*150*g.multiplier;setStatus(`BARREL ${g.barrelTime.toFixed(1)}s`);}else if(g.inBarrel){const bonus=Math.round(g.barrelTime*220*g.multiplier);g.score+=bonus;g.multiplier=clamp(g.multiplier+.75,1,8);setMultiplier(Number(g.multiplier.toFixed(1)));setCallout(`BARREL EXIT +${bonus}`);g.inBarrel=false;g.barrelTime=0;}else setStatus(g.pocket<.28?"DEEP":"ON RAIL");
          if(g.speed<95)finish("YOU LOST SPEED AND FELL BEHIND");if(priorLine>.2&&g.line<=.2&&g.right)spawnSpray(g,wave.px,wave.base-18,.35,-2.6);
        }else{
          const steer=Number(g.right)-Number(g.left);g.airVy+=560*dt;g.airY+=g.airVy*dt;g.angle+=steer*3.8*dt;g.rotation+=Math.abs(steer)*3.8*dt;if(g.action)g.action=false;
          const landingY=wave.topAtPlayer+wave.waveHeight*.12;if(g.airVy>0&&g.airY>=landingY){const diff=Math.abs(Math.atan2(Math.sin(g.angle+.12),Math.cos(g.angle+.12)));if(diff>.72)finish("YOU DIDN'T MATCH THE LANDING");else{const base=g.rotation>5.2?520:g.rotation>2.5?340:g.grabbing?250:180,landing=diff<.2?1.7:diff<.42?1.3:1,critical=clamp(1-Math.abs(g.pocket-.3)/.4,.35,1),pts=Math.round(base*landing*critical*g.multiplier);g.score+=pts;g.multiplier=clamp(g.multiplier+(diff<.2?.6:.25),1,8);setMultiplier(Number(g.multiplier.toFixed(1)));setCallout(`${g.grabbing?"GRAB · ":""}${g.rotation>2.5?"ROTATION · ":""}+${pts}${diff<.2?" · STOMPED":""}`);g.air=false;g.line=.82;g.lineVelocity=-.48;g.speed*=.9;g.rotation=0;g.angle=0;g.grabbing=false;}}
        }
        g.score+=dt*Math.max(0,g.speed-120)*.05*g.multiplier;setScore(Math.floor(g.score));
      }
      for(const p of g.particles){p.life-=dt;p.vy+=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle="#ecfffd";ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}ctx.globalAlpha=1;g.particles=g.particles.filter(p=>p.life>0);
      const surferY=g.air?g.airY:wave.base-(wave.base-wave.topAtPlayer)*clamp(g.line,0,1)-8,surferAngle=g.air?g.angle:clamp(-g.lineVelocity*.18,-.45,.42);drawSurfer(wave.px,surferY,surferAngle,g);
      ctx.fillStyle="rgba(235,248,246,.72)";ctx.font="700 11px Arial";ctx.fillText(`SPEED ${Math.round(g.speed)}`,wave.px+54,vh*.92);ctx.fillText(`POCKET ${Math.round(g.pocket*100)}%`,wave.px+54,vh*.92+18);raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);return()=>{removeEventListener("resize",resize);if(raf.current)cancelAnimationFrame(raf.current);};
  },[finish]);

  const hold=(key:"left"|"right"|"crouch",on:boolean)=>{game.current[key]=on;if(key==="crouch"&&game.current.air)game.current.grabbing=on;};
  const guide=tutorialCopy[tutorial];
  return <main className={styles.shell}>
    <canvas ref={canvasRef} className={styles.canvas} aria-label="Book Surf surfing game canvas" />
    <header className={styles.topbar}><Link href="/" className={styles.brand}><strong>BOOKSURF</strong><span>Surf books. Book surf.</span></Link><div className={styles.actions}><Link href="/surf" className={styles.ghost}>Find surf</Link>{phase==="playing"?<button className={styles.solid} onClick={reset}>Restart</button>:null}</div></header>
    {phase!=="ready"?<><div className={styles.hud}><div className={styles.pill}><small>Score</small><strong>{score.toLocaleString()}</strong></div><div className={styles.pill}><small>Line</small><strong>x{multiplier}</strong></div><div className={styles.pill}><small>Best</small><strong>{best.toLocaleString()}</strong></div></div><div className={styles.timingHud}><strong>{status}</strong><span>{callout}</span></div>{phase==="playing"?<div style={{position:"absolute",zIndex:6,left:"50%",top:88,transform:"translateX(-50%)",width:"min(520px,calc(100% - 32px))",padding:"12px 16px",borderRadius:16,background:"rgba(3,23,27,.72)",border:"1px solid rgba(255,255,255,.18)",backdropFilter:"blur(12px)",textAlign:"center",pointerEvents:"none"}}><strong style={{fontSize:13,letterSpacing:".08em"}}>{guide.title}</strong><div style={{fontSize:12,marginTop:4,color:"rgba(247,242,232,.75)"}}>{guide.body}</div></div>:null}</>:null}
    {phase==="ready"?<section className={styles.intro}><div className={styles.introCard}><p className={styles.kicker}>A BookSurf game</p><h1 className={styles.title}>BOOK<br/>SURF</h1><p className={styles.tagline}>Steer the board, use the wave for speed, and time your turns around the pocket.</p><button className={styles.start} onClick={reset}>Paddle out</button><p className={styles.instructions}>← / → steer · ↓ crouch & pump · SPACE commit · in the air: ← / → rotate · ↓ grab</p></div></section>:null}
    {phase==="over"?<section className={styles.gameOver}><p className={styles.kicker}>Wipeout</p><h2>{score.toLocaleString()} points</h2><p>{callout}</p><button className={styles.start} onClick={reset}>Paddle back out</button></section>:null}
    {phase==="playing"?<div className={styles.touchControls}><button className={styles.touchButton} onPointerDown={()=>hold("left",true)} onPointerUp={()=>hold("left",false)} onPointerCancel={()=>hold("left",false)}>←</button><button className={styles.touchButton} onPointerDown={()=>hold("crouch",true)} onPointerUp={()=>hold("crouch",false)} onPointerCancel={()=>hold("crouch",false)}>↓</button><button className={`${styles.touchButton} ${styles.touchJump}`} onPointerDown={action}>SPACE</button><button className={styles.touchButton} onPointerDown={()=>hold("right",true)} onPointerUp={()=>hold("right",false)} onPointerCancel={()=>hold("right",false)}>→</button></div>:null}
  </main>;
}
