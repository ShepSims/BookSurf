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
  const base=vh*.83;
  const faceWidth=Math.max(260,vw-lipX);
  const t=clamp((x-lipX)/faceWidth,0,1);
  const pocket=Math.pow(1-t,.3);
  const shoulder=1-smooth(clamp((t-.5)/.5,0,1))*.74;
  const bowl=18*Math.sin(Math.PI*clamp((t-.08)/.72,0,1));
  const chop=Math.sin(t*Math.PI*2.2)*3.5;
  return base-height*pocket*shoulder+bowl+chop;
}

function spawnSpray(g:Runtime,x:number,y:number,power:number,direction:number){
  const count=Math.round(18+power*34);
  for(let i=0;i<count;i++){
    const spread=(Math.random()-.5)*.9,velocity=130+Math.random()*230*power;
    g.particles.push({x,y,vx:Math.cos(direction+spread)*velocity,vy:Math.sin(direction+spread)*velocity-70,life:.55+Math.random()*.7,size:1+Math.random()*3.6});
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

export default function BookSurfGameV3(){
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
      const px=vw*.43,waveHeight=Math.min(vh*.61,430),lipX=px-g.pocket*vw*.49,base=vh*.83,horizon=vh*.29;
      const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#79aeb9");sky.addColorStop(.72,"#a9cfd2");sky.addColorStop(1,"#d8e7e4");ctx.fillStyle=sky;ctx.fillRect(0,0,vw,horizon+2);
      ctx.fillStyle="rgba(255,246,209,.18)";ctx.beginPath();ctx.arc(vw*.78,vh*.13,Math.min(vw,vh)*.085,0,TAU);ctx.fill();

      const sea=ctx.createLinearGradient(0,horizon,0,vh);sea.addColorStop(0,"#2f7580");sea.addColorStop(.2,"#176572");sea.addColorStop(.58,"#07505f");sea.addColorStop(1,"#023642");ctx.fillStyle=sea;ctx.fillRect(0,horizon,vw,vh-horizon);

      ctx.globalAlpha=.2;ctx.strokeStyle="#d6eff0";ctx.lineWidth=1;
      for(let i=0;i<8;i++){const yy=horizon+15+i*16;ctx.beginPath();for(let x=0;x<=vw;x+=22){const y=yy+Math.sin(x*.013+i*1.4+g.elapsed*.55)*2.6;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}ctx.globalAlpha=1;

      ctx.beginPath();ctx.moveTo(0,base);for(let x=0;x<=vw;x+=5)ctx.lineTo(x,waveTopY(x,vw,vh,lipX,waveHeight));ctx.lineTo(vw,vh);ctx.lineTo(0,vh);ctx.closePath();
      const face=ctx.createLinearGradient(lipX,base-waveHeight,vw,base);face.addColorStop(0,"#064859");face.addColorStop(.12,"#075d6c");face.addColorStop(.38,"#08788a");face.addColorStop(.68,"#0d7180");face.addColorStop(1,"#09515e");ctx.fillStyle=face;ctx.fill();

      const playerTop=waveTopY(px,vw,vh,lipX,waveHeight),crestY=base-waveHeight+14;

      const glow=ctx.createRadialGradient(lipX+waveHeight*.52,crestY+waveHeight*.34,20,lipX+waveHeight*.52,crestY+waveHeight*.34,waveHeight*.65);glow.addColorStop(0,"rgba(106,218,218,.3)");glow.addColorStop(.45,"rgba(55,173,184,.18)");glow.addColorStop(1,"rgba(12,80,95,0)");ctx.fillStyle=glow;ctx.fillRect(Math.max(0,lipX),crestY-80,vw-Math.max(0,lipX),waveHeight+150);

      ctx.globalAlpha=.15;ctx.strokeStyle="#bce8e8";ctx.lineWidth=1;
      for(let i=0;i<13;i++){ctx.beginPath();for(let x=Math.max(0,lipX+12);x<vw;x+=16){const y=waveTopY(x,vw,vh,lipX,waveHeight)+19+i*13+Math.sin(x*.021+i*.7+g.elapsed*.7)*2.5;x===Math.max(0,lipX+12)?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}ctx.globalAlpha=1;

      const tube=clamp((.55-g.pocket)*2.65,0,1),reach=170+tube*235;
      if(tube>.04){
        const lipGrad=ctx.createLinearGradient(lipX,crestY,lipX+reach,crestY+160);lipGrad.addColorStop(0,"rgba(238,255,251,.96)");lipGrad.addColorStop(.2,"rgba(184,235,232,.94)");lipGrad.addColorStop(.52,"rgba(63,169,177,.76)");lipGrad.addColorStop(1,"rgba(12,84,100,.2)");
        ctx.beginPath();ctx.moveTo(lipX-8,crestY+4);ctx.bezierCurveTo(lipX+30,crestY-75,lipX+reach*.72,crestY-45,lipX+reach,crestY+118);ctx.bezierCurveTo(lipX+reach*.8,crestY+80,lipX+reach*.46,crestY+56,lipX-8,crestY+4);ctx.closePath();ctx.fillStyle=lipGrad;ctx.fill();

        const innerX=lipX+reach*.58,innerY=crestY+104;
        ctx.save();ctx.beginPath();ctx.ellipse(innerX,innerY,reach*.3,72+tube*22,-.12,Math.PI*.92,Math.PI*1.94);ctx.lineWidth=34;ctx.strokeStyle="rgba(2,34,46,.82)";ctx.shadowBlur=28;ctx.shadowColor="rgba(0,0,0,.36)";ctx.stroke();ctx.restore();

        ctx.strokeStyle="rgba(242,255,252,.94)";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(lipX-14,crestY+2);ctx.bezierCurveTo(lipX+48,crestY-42,lipX+reach*.68,crestY-35,lipX+reach*.96,crestY+108);ctx.stroke();

        ctx.globalAlpha=.8;ctx.fillStyle="#effffd";for(let i=0;i<26;i++){const s=i*9.13;const x=lipX-24+hash(s)*Math.max(70,reach*.42),y=crestY-18+hash(s+3.2)*70,r=1+hash(s+8)*3;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}ctx.globalAlpha=1;
      }

      const foamEnd=Math.max(-40,lipX+70);ctx.beginPath();ctx.moveTo(0,base);ctx.lineTo(0,crestY+72);for(let x=0;x<=foamEnd;x+=10){const n=hash(x*.13+Math.floor(g.elapsed*5)),y=crestY+60+Math.sin(x*.042+g.elapsed*3.1)*13+n*31;ctx.lineTo(x,y);}ctx.lineTo(foamEnd,base);ctx.closePath();const foam=ctx.createLinearGradient(0,crestY,foamEnd,base);foam.addColorStop(0,"rgba(245,255,253,.96)");foam.addColorStop(.45,"rgba(211,242,240,.9)");foam.addColorStop(1,"rgba(108,183,191,.42)");ctx.fillStyle=foam;ctx.fill();

      ctx.globalAlpha=.55;ctx.fillStyle="#eefdfb";for(let i=0;i<46;i++){const s=i*15.7,x=lipX-105+hash(s)*175,y=crestY+18+hash(s+4)*165,r=1.2+hash(s+7)*4.2;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}ctx.globalAlpha=1;

      return{px,lipX,base,waveHeight,topAtPlayer:playerTop};
    };

    const drawSurfer=(x:number,y:number,angle:number,g:Runtime)=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.shadowBlur=8;ctx.shadowColor="rgba(0,0,0,.2)";ctx.fillStyle="#f4d06f";ctx.beginPath();ctx.ellipse(0,2,38,5.5,-.02,0,TAU);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle="#092728";ctx.lineWidth=6;ctx.lineCap="round";ctx.lineJoin="round";const crouch=g.crouch?7:0;ctx.beginPath();ctx.moveTo(-11,-4);ctx.lineTo(-14,-17+crouch);ctx.lineTo(-3,-34+crouch);ctx.lineTo(10,-21+crouch);ctx.lineTo(16,-5);ctx.stroke();ctx.strokeStyle="#d9a77c";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-3,-29+crouch);ctx.lineTo(g.grabbing?-25:-22,g.grabbing?-2:-21+crouch);ctx.moveTo(5,-29+crouch);ctx.lineTo(24,-17+crouch);ctx.stroke();ctx.fillStyle="#d5a276";ctx.beginPath();ctx.arc(-2,-43+crouch,8,0,TAU);ctx.fill();ctx.restore();};

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
          const steer=Number(g.right)-Number(g.left);g.airVy+=540*dt;g.airY+=g.airVy*dt;g.angle+=steer*3.45*dt;g.rotation+=Math.abs(steer)*3.45*dt;if(g.action)g.action=false;
          if(g.airVy>35){const target=-.12;const assist=clamp((g.airVy-35)/260,0,1)*1.55*dt;g.angle+=(target-g.angle)*assist;}
          const landingY=wave.topAtPlayer+wave.waveHeight*.15;
          if(g.airVy>0&&g.airY>=landingY){const diff=Math.abs(Math.atan2(Math.sin(g.angle+.12),Math.cos(g.angle+.12)));if(diff>1.02)finish("YOU COULDN'T RECOVER THE LANDING");else{const basePts=g.rotation>5.2?520:g.rotation>2.5?340:g.grabbing?250:180,landing=diff<.26?1.7:diff<.56?1.3:diff<.84?1:.78,critical=clamp(1-Math.abs(g.pocket-.3)/.4,.35,1),pts=Math.round(basePts*landing*critical*g.multiplier);g.score+=pts;g.multiplier=clamp(g.multiplier+(diff<.26?.6:diff<.56?.25:.08),1,8);setMultiplier(Number(g.multiplier.toFixed(1)));setCallout(`${g.grabbing?"GRAB · ":""}${g.rotation>2.5?"ROTATION · ":""}+${pts}${diff<.26?" · STOMPED":diff<.56?" · CLEAN":" · SKETCHY"}`);g.air=false;g.line=.82;g.lineVelocity=-.42;g.speed*=diff<.84?.92:.86;g.rotation=0;g.angle=0;g.grabbing=false;}}
        }
        g.score+=dt*Math.max(0,g.speed-120)*.05*g.multiplier;setScore(Math.floor(g.score));
      }
      for(const p of g.particles){p.life-=dt;p.vy+=250*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle="#ecfffd";ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}ctx.globalAlpha=1;g.particles=g.particles.filter(p=>p.life>0);
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
