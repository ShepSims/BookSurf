"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import styles from "./BookSurfGame.module.css";
import { getTrimAcceleration, getWipeoutReason, nextControlState } from "./surfPhysics";

type Phase="ready"|"playing"|"over";
type Kind="face"|"foam"|"mist"|"spray";
type Particle={kind:Kind;u:number;v:number;life:number;maxLife:number;size:number;seed:number;side:number};
type Runtime={
  phase:Phase;last:number;t:number;speed:number;face:number;faceVel:number;bank:number;heading:number;trim:number;
  left:boolean;right:boolean;forward:boolean;back:boolean;pump:boolean;pumpCd:number;pocket:number;score:number;best:number;
  particles:Particle[];faceSpawn:number;foamSpawn:number;mistSpawn:number;hudAt:number;statusText:string;statusUntil:number;
};

const TAU=Math.PI*2;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const smooth=(t:number)=>t*t*(3-2*t);
const rand=(n:number)=>{const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x)};

function spawn(g:Runtime,kind:Kind,seed:number,power=1){
  if(kind==="face"){const u=.025+rand(seed)*.95,crestBias=Math.pow(rand(seed+1),1.7);g.particles.push({kind,u,v:.08+crestBias*.82,life:5+rand(seed+2)*3,maxLife:8,size:.65+rand(seed+3)*1.45,seed,side:0});return}
  if(kind==="foam"){g.particles.push({kind,u:.01+rand(seed)*.12,v:.12+rand(seed+1)*.62,life:.8+rand(seed+2)*1.2,maxLife:2,size:2+rand(seed+3)*4.8,seed,side:0});return}
  if(kind==="mist"){g.particles.push({kind,u:.015+rand(seed)*.11,v:.02+rand(seed+1)*.16,life:.55+rand(seed+2)*.75,maxLife:1.3,size:1+rand(seed+3)*2.4,seed,side:0});return}
  const side=g.bank>=0?-1:1;g.particles.push({kind,u:.5,v:.84,life:.32+rand(seed+2)*.45,maxLife:.77,size:1.1+rand(seed+3)*3.4*power,seed,side});
}
function sprayBurst(g:Runtime,power:number){const count=10+Math.round(power*22),base=g.t*991;for(let i=0;i<count;i++)spawn(g,"spray",base+i*7.13,power)}

export default function BookSurfGameCanvas(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null),raf=useRef<number|undefined>(undefined);
  const game=useRef<Runtime>({phase:"ready",last:0,t:0,speed:22,face:.58,faceVel:-.035,bank:0,heading:0,trim:0,left:false,right:false,forward:false,back:false,pump:false,pumpCd:0,pocket:.36,score:0,best:0,particles:[],faceSpawn:0,foamSpawn:0,mistSpawn:0,hudAt:0,statusText:"TRIM",statusUntil:0});
  const [phase,setPhase]=useState<Phase>("ready"),[score,setScore]=useState(0),[best,setBest]=useState(0),[status,setStatus]=useState("TRIM"),[hint,setHint]=useState("Wall left · shoulder right · stay near the pocket");

  useEffect(()=>{const b=Number(localStorage.getItem("booksurf-book-surf-best")||0);game.current.best=Number.isFinite(b)?b:0;setBest(game.current.best)},[]);
  const reset=useCallback(()=>{Object.assign(game.current,{phase:"playing",last:0,t:0,speed:22,face:.58,faceVel:-.035,bank:0,heading:0,trim:0,left:false,right:false,forward:false,back:false,pump:false,pumpCd:0,pocket:.36,score:0,particles:[],faceSpawn:0,foamSpawn:0,mistSpawn:0,hudAt:0,statusText:"TRIM",statusUntil:0});setPhase("playing");setScore(0);setStatus("TRIM");setHint("←/→ RAILS · ↑ FORWARD · ↓ STALL · SPACE PUMP")},[]);
  const finish=useCallback((m:string)=>{const g=game.current;if(g.phase!=="playing")return;g.phase="over";const s=Math.floor(g.score);if(s>g.best){g.best=s;localStorage.setItem("booksurf-book-surf-best",String(s));setBest(s)}setScore(s);setHint(m);setPhase("over")},[]);

  useEffect(()=>{
    const kd=(e:KeyboardEvent)=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","KeyA","KeyD","KeyW","KeyS"].includes(e.code))e.preventDefault();const g=game.current;if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=true;if(e.code==="ArrowRight"||e.code==="KeyD")g.right=true;if(e.code==="ArrowUp"||e.code==="KeyW")g.forward=true;if(e.code==="ArrowDown"||e.code==="KeyS")g.back=true;if(e.code==="Space"&&!e.repeat)g.pump=true;if(e.code==="Enter"&&g.phase!=="playing")reset()};
    const ku=(e:KeyboardEvent)=>{const g=game.current;if(e.code==="ArrowLeft"||e.code==="KeyA")g.left=false;if(e.code==="ArrowRight"||e.code==="KeyD")g.right=false;if(e.code==="ArrowUp"||e.code==="KeyW")g.forward=false;if(e.code==="ArrowDown"||e.code==="KeyS")g.back=false};
    const release=()=>Object.assign(game.current,{left:false,right:false,forward:false,back:false,pump:false});
    addEventListener("keydown",kd,{passive:false});addEventListener("keyup",ku);addEventListener("blur",release);return()=>{removeEventListener("keydown",kd);removeEventListener("keyup",ku);removeEventListener("blur",release)};
  },[reset]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const resize=()=>{const d=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0)};resize();addEventListener("resize",resize);

    // Project wave-space around the surfer. The player remains fixed in the POV while the
    // pocket, shoulder, and water particles move relative to the same coordinates as the inset.
    const facePoint=(vw:number,vh:number,u:number,v:number,g:Runtime)=>{
      const playerU=clamp(g.pocket,0,1),playerV=1-clamp(g.face,0,1);
      const topAt=(n:number)=>.23+Math.pow(Math.max(0,n),.72)*.20+Math.pow(Math.max(0,n),2.25)*.16;
      const bottomAt=(n:number)=>.97-Math.sin(clamp(n,0,1)*Math.PI)*.055;
      const playerTop=topAt(playerU),playerBottom=bottomAt(playerU),playerWorldY=playerTop+(playerBottom-playerTop)*playerV;
      const topWorld=topAt(u),bottomWorld=bottomAt(u),scale=1.34;
      const x=vw*.52+(u-playerU)*vw*.92;
      const top=vh*(.60+(topWorld-playerWorldY)*scale),bottom=vh*(.60+(bottomWorld-playerWorldY)*scale);
      return{x,y:top+(bottom-top)*v,top,bottom,crestX:vw*.52-playerU*vw*.92,lipY:vh*(.60+(topAt(0)-playerWorldY)*scale),troughY:bottom};
    };
    const flow=(u:number,v:number,g:Runtime)=>{const pocket=1-smooth(clamp(u/.42,0,1)),high=1-smooth(clamp(v/.62,0,1)),low=smooth(clamp((v-.38)/.62,0,1));return{du:.035+.08*low+.035*pocket,dv:.045*pocket*high-.025*low+Math.sin(g.t*1.7+u*8)*.004}};

    const drawMain=(vw:number,vh:number,g:Runtime)=>{
      const worldRoll=g.bank*.105;ctx.save();ctx.translate(vw/2,vh*.55);ctx.rotate(worldRoll);ctx.translate(-vw/2,-vh*.55);
      const horizon=vh*.31,sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,"#2f82ce");sky.addColorStop(.62,"#69b7e4");sky.addColorStop(1,"#bddfe9");ctx.fillStyle=sky;ctx.fillRect(-vw,-vh,vw*3,vh*2);
      const shoreY=horizon+vh*.032;ctx.fillStyle="rgba(222,199,151,.78)";ctx.beginPath();ctx.moveTo(vw*.43,shoreY+8);ctx.quadraticCurveTo(vw*.72,shoreY-6,vw*1.15,shoreY+3);ctx.lineTo(vw*1.15,shoreY+17);ctx.lineTo(vw*.43,shoreY+16);ctx.closePath();ctx.fill();ctx.fillStyle="rgba(34,76,64,.75)";for(let i=0;i<24;i++){const x=vw*(.47+i*.03),h=4+rand(i*4.1)*12;ctx.fillRect(x,shoreY-h,2.3,h+4)}
      const sea=ctx.createLinearGradient(0,horizon,0,vh);sea.addColorStop(0,"#147b9d");sea.addColorStop(.46,"#08637b");sea.addColorStop(1,"#033e53");ctx.fillStyle=sea;ctx.fillRect(-vw,horizon,vw*3,vh*2);
      const lipPoint=facePoint(vw,vh,0,0,g),crestX=lipPoint.x,lipY=lipPoint.y,troughY=facePoint(vw,vh,0,1,g).y;
      ctx.beginPath();for(let i=0;i<=44;i++){const u=-.08+i/40,pt=facePoint(vw,vh,u,0,g);i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y)}ctx.lineTo(vw*1.2,vh*1.25);ctx.lineTo(-vw*.2,vh*1.25);ctx.closePath();const wave=ctx.createLinearGradient(crestX,lipY,vw*.72,vh);wave.addColorStop(0,"#063f5a");wave.addColorStop(.18,"#07748f");wave.addColorStop(.43,"#0a8ca4");wave.addColorStop(.7,"#087389");wave.addColorStop(1,"#043e52");ctx.fillStyle=wave;ctx.fill();
      const glow=ctx.createRadialGradient(crestX+vw*.1,lipY+vh*.16,6,crestX+vw*.1,lipY+vh*.16,vw*.3);glow.addColorStop(0,"rgba(15,158,182,.47)");glow.addColorStop(.5,"rgba(4,103,132,.23)");glow.addColorStop(1,"rgba(0,42,63,0)");ctx.fillStyle=glow;ctx.fillRect(-vw*.2,-vh*.2,vw*1.4,vh*1.4);
      const proximity=1-smooth(clamp((g.pocket-.04)/.88,0,1)),pitch=clamp(proximity*(.55+g.face*.45),.03,1),reach=vw*(.08+pitch*.22);ctx.beginPath();ctx.moveTo(crestX-20,lipY+10);ctx.bezierCurveTo(crestX+8,lipY-36-pitch*42,crestX+reach*.64,lipY-28-pitch*35,crestX+reach,lipY+55+pitch*50);ctx.bezierCurveTo(crestX+reach*.68,lipY+42,crestX+reach*.31,lipY+30,crestX-20,lipY+10);const lip=ctx.createLinearGradient(crestX,lipY,crestX+reach,lipY+90);lip.addColorStop(0,"rgba(245,255,255,.98)");lip.addColorStop(.24,"rgba(170,230,236,.88)");lip.addColorStop(.65,"rgba(32,137,159,.55)");lip.addColorStop(1,"rgba(4,72,94,.06)");ctx.fillStyle=lip;ctx.fill();ctx.fillStyle="rgba(0,33,51,.34)";ctx.beginPath();ctx.moveTo(crestX+8,lipY+22);ctx.bezierCurveTo(crestX+reach*.32,lipY+58,crestX+reach*.42,lipY+128,crestX+reach*.58,lipY+188);ctx.bezierCurveTo(crestX+reach*.18,lipY+170,crestX-10,lipY+100,crestX-20,lipY+45);ctx.closePath();ctx.fill();
      for(const p of g.particles){if(p.kind!=="face")continue;const pt=facePoint(vw,vh,p.u,p.v,g),alpha=.22+.46*(1-p.v)*(.55+.45*rand(p.seed));ctx.globalAlpha=alpha;ctx.fillStyle=p.v<.32?"#c8eef2":"#79ced7";ctx.beginPath();ctx.arc(pt.x,pt.y,p.size,0,TAU);ctx.fill()}ctx.globalAlpha=1;for(const p of g.particles){if(p.kind!=="foam"&&p.kind!=="mist")continue;const a=clamp(p.life/p.maxLife,0,1),pt=facePoint(vw,vh,p.u,clamp(p.v,0,1),g);ctx.globalAlpha=a*(p.kind==="mist"?.58:.88);ctx.fillStyle=p.kind==="mist"?"#f2ffff":"#dbf3f2";ctx.beginPath();ctx.arc(pt.x-(p.kind==="mist"?(1-a)*22:0),pt.y-(p.kind==="mist"?(1-a)*34:0),p.size,0,TAU);ctx.fill()}ctx.globalAlpha=1;ctx.restore();

      // Positive trim is weight forward: the visible nose drops toward the water. Negative trim
      // lifts the nose toward the rider. Move the actual tip instead of scaling the whole board,
      // which made the shorter forward-weight silhouette read as nose-up.
      const boardY=vh*(.985+g.trim*.006),noseY=-112+g.trim*42,railY=-44+g.trim*15;ctx.save();ctx.translate(vw*.52,boardY);ctx.rotate(.07-g.bank*.18);const bg=ctx.createLinearGradient(-54,0,54,0);bg.addColorStop(0,"#d5a22f");bg.addColorStop(.5,"#f4d361");bg.addColorStop(1,"#d5a22f");ctx.fillStyle=bg;ctx.beginPath();ctx.moveTo(0,noseY);ctx.bezierCurveTo(-29,noseY+24,-47,railY,-52,8);ctx.quadraticCurveTo(0,20,52,8);ctx.bezierCurveTo(47,railY,29,noseY+24,0,noseY);ctx.fill();ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,noseY+8);ctx.lineTo(0,12);ctx.stroke();ctx.restore();for(const p of g.particles){if(p.kind!=="spray")continue;const a=clamp(p.life/p.maxLife,0,1),age=1-a,x=vw*.52+p.side*age*(45+p.seed%38),y=boardY-age*(70+(p.seed%55));ctx.globalAlpha=a;ctx.fillStyle="#efffff";ctx.beginPath();ctx.arc(x,y,p.size,0,TAU);ctx.fill()}ctx.globalAlpha=1;
    };

    const drawInset=(vw:number,vh:number,g:Runtime)=>{const w=Math.min(250,vw*.21),h=w*.58,x=vw-w-20,y=vh-h-20,r=14;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.clip();ctx.fillStyle="rgba(3,31,45,.9)";ctx.fillRect(x,y,w,h);const base=y+h*.86,cx=x+w*.11,cy=y+h*.23;ctx.beginPath();ctx.moveTo(x-8,base);ctx.bezierCurveTo(x+w*.01,y+h*.45,cx,cy,cx+w*.08,cy+3);ctx.bezierCurveTo(x+w*.34,y+h*.35,x+w*.7,y+h*.54,x+w*1.08,base-h*.04);ctx.lineTo(x+w*1.08,y+h);ctx.lineTo(x-8,y+h);ctx.closePath();const grad=ctx.createLinearGradient(cx,cy,x+w,base);grad.addColorStop(0,"#0c7b92");grad.addColorStop(1,"#075064");ctx.fillStyle=grad;ctx.fill();ctx.globalAlpha=.82;ctx.fillStyle="#dcefee";for(let i=0;i<18;i++){const px=x+rand(i*3.4)*w*.22,py=y+h*(.34+rand(i*2.1+1)*.42);ctx.beginPath();ctx.arc(px,py,2+rand(i+9)*4,0,TAU);ctx.fill()}ctx.globalAlpha=1;const rx=x+w*(.31+clamp(g.pocket,0,1)*.45),ry=base-h*(.08+g.face*.55);ctx.save();ctx.translate(rx,ry);ctx.rotate(-g.bank*.32);ctx.strokeStyle="#f3d467";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-10,2-g.trim*2);ctx.lineTo(11,-2+g.trim*5);ctx.stroke();ctx.fillStyle="#f7f2df";ctx.beginPath();ctx.arc(2+g.trim*3,-7+g.trim*2,4.5,0,TAU);ctx.fill();ctx.restore();ctx.fillStyle="rgba(255,255,255,.88)";ctx.font="700 9px system-ui,sans-serif";ctx.fillText("CHASE",x+10,y+16);ctx.restore();ctx.strokeStyle="rgba(255,255,255,.25)";ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.stroke()};

    const updateParticles=(g:Runtime,dt:number)=>{g.faceSpawn+=dt*(52+g.speed*1.4);while(g.faceSpawn>=1){spawn(g,"face",g.t*193+g.faceSpawn*17);g.faceSpawn-=1}g.foamSpawn+=dt*(14+clamp(.55-g.pocket,0,.55)*38);while(g.foamSpawn>=1){spawn(g,"foam",g.t*311+g.foamSpawn*23);g.foamSpawn-=1}g.mistSpawn+=dt*11;while(g.mistSpawn>=1){spawn(g,"mist",g.t*419+g.mistSpawn*31);g.mistSpawn-=1}const speedFactor=clamp(g.speed/22,.65,1.55);for(const p of g.particles){if(p.kind==="face"){const f=flow(p.u,p.v,g);p.u+=f.du*dt*speedFactor;p.v+=f.dv*dt;if(p.u>1.02||p.v>1.02){p.u=.015+rand(p.seed+g.t)*.18;p.v=.03+rand(p.seed+g.t+3)*.5}p.life-=dt;if(p.life<=0){p.u=.02+rand(p.seed+g.t)*.96;p.v=.05+rand(p.seed+g.t+1)*.88;p.life=p.maxLife}}else if(p.kind==="foam"){const f=flow(p.u,p.v,g);p.u+=f.du*dt*.45;p.v+=Math.abs(f.dv)*dt*.7+.08*dt;p.life-=dt}else if(p.kind==="mist"){p.u+=.018*dt;p.v-=.06*dt;p.life-=dt}else p.life-=dt}g.particles=g.particles.filter(p=>p.kind==="face"||p.life>0).slice(-620)};

    const tick=(ts:number)=>{const r=canvas.getBoundingClientRect(),vw=r.width,vh=r.height,g=game.current,dt=g.last?Math.min(.032,(ts-g.last)/1000):0;g.last=ts;g.t+=dt;if(g.phase==="playing"){
      Object.assign(g,nextControlState(g.bank,g.trim,g,dt));
      const hold=clamp(g.speed/27,.5,1.25),turn=-Math.sin(g.bank)*(.56+hold*.62);g.heading+=turn*dt;g.heading*=Math.pow(.997,dt*60);const drag=Math.abs(g.bank)*(.22+.25*hold)+g.bank*g.bank*.22;
      g.faceVel+=(Math.sin(g.bank)*g.speed*.0125-.15)*dt;g.faceVel*=Math.pow(.992,dt*60);g.face+=g.faceVel*dt;
      const descending=Math.max(0,-g.faceVel),climbing=Math.max(0,g.faceVel),steep=.62+smooth(clamp(g.face,0,1))*.82;
      const trimAcceleration=getTrimAcceleration(g.trim,descending,hold);g.speed+=(descending*12.6*steep-climbing*6.8-drag-.28+trimAcceleration)*dt;
      if(g.face<=.04){g.face=.04;if(g.bank>.15){g.faceVel=Math.abs(g.faceVel)*.58+.19;g.speed+=.75;g.statusText="BOTTOM TURN · LEFT RAIL";g.statusUntil=g.t+.7;sprayBurst(g,clamp(Math.abs(g.bank)*hold,.4,1))}else{g.faceVel=.05;g.speed-=.65}}
      if(g.face>=.96){g.face=.96;g.faceVel=-Math.abs(g.faceVel)*.48-.08;g.statusText=g.bank<-.16?"REDIRECT · RIGHT RAIL":"HIGH LINE";g.statusUntil=g.t+.7;if(Math.abs(g.bank)>.18)sprayBurst(g,clamp(Math.abs(g.bank)*hold,.35,1))}
      const carve=Math.abs(g.bank)*hold*clamp(Math.abs(turn)*1.7,0,1);if(carve>.47&&Math.floor(g.t*12)!==Math.floor((g.t-dt)*12))sprayBurst(g,carve*.65);
      g.pumpCd=Math.max(0,g.pumpCd-dt);if(g.pump){g.pump=false;if(g.pumpCd<=0){const transition=clamp(Math.abs(g.faceVel)*3.2,0,1),loaded=clamp(Math.abs(g.bank)*1.25,0,1),zone=1-smooth(clamp((g.face-.28)/.5,0,1)),eff=clamp(.1+transition*.35+loaded*.24+zone*.31,0,1);g.speed+=eff*2.45;g.score+=Math.round(eff*55);g.pumpCd=.34;g.statusText=eff>.75?"PUMP · PERFECT":eff>.5?"PUMP · DRIVE":"PUMP · MISTIMED";g.statusUntil=g.t+.7;if(eff>.52)sprayBurst(g,eff*.6)}}
      const downLine=g.speed*Math.cos(g.heading);g.pocket+=((downLine-21.4)/170)*dt;g.pocket=clamp(g.pocket,-.08,1.05);
      const wipeout=getWipeoutReason(g.pocket,g.speed);
      if(wipeout){finish(wipeout)}else{
        if(g.pocket>.92){g.speed-=1.25*dt;if(g.t>=g.statusUntil)g.statusText="TOO FAR ON THE SHOULDER"}
        else if(g.t>=g.statusUntil)g.statusText=Math.abs(g.trim)>.28?(g.trim>0?"WEIGHT FORWARD · DRIVE":"WEIGHT BACK · STALL"):"TRIM";
        g.score+=dt*(g.speed*.6+Math.abs(g.bank)*10);
        if(g.t>=g.hudAt){g.hudAt=g.t+.1;setScore(Math.floor(g.score));setStatus(g.statusText);const trimLabel=g.trim>.2?"FORWARD":g.trim<-.2?"STALL":"NEUTRAL";setHint(`Speed ${g.speed.toFixed(1)} · Face ${Math.round(g.face*100)}% · ${g.bank>.12?"LEFT RAIL":g.bank<-.12?"RIGHT RAIL":"FLAT"} · ${trimLabel}`)}
      }
    }updateParticles(g,dt);drawMain(vw,vh,g);if(g.phase!=="ready")drawInset(vw,vh,g);raf.current=requestAnimationFrame(tick)};
    raf.current=requestAnimationFrame(tick);return()=>{removeEventListener("resize",resize);if(raf.current)cancelAnimationFrame(raf.current)};
  },[finish]);

  const hold=(k:"left"|"right"|"forward"|"back",v:boolean)=>{game.current[k]=v};
  const holdProps=(key:"left"|"right"|"forward"|"back")=>({onPointerDown:(e:PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);hold(key,true)},onPointerUp:()=>hold(key,false),onPointerCancel:()=>hold(key,false),onLostPointerCapture:()=>hold(key,false)});
  return <main className={styles.shell}><canvas ref={canvasRef} className={styles.canvas} aria-label="First-person left-hander surfing game with fore-aft trim"/><header className={styles.topbar}><Link href="/" className={styles.brand}><strong>BOOKSURF</strong><span>First-person carving prototype</span></Link><div className={styles.actions}><Link href="/surf" className={styles.ghost}>Find surf</Link>{phase==="playing"?<button className={styles.solid} onClick={reset}>Restart</button>:null}</div></header>{phase!=="ready"?<><div className={styles.hud}><div className={styles.pill}><small>Score</small><strong>{score.toLocaleString()}</strong></div><div className={styles.pill}><small>Status</small><strong>{status}</strong></div><div className={styles.pill}><small>Best</small><strong>{best.toLocaleString()}</strong></div></div><div className={styles.timingHud}><strong>LEFT-HANDER</strong><span>{hint}</span></div></>:null}{phase==="ready"?<section className={styles.intro}><div className={styles.introCard}><p className={styles.kicker}>Pocket POV</p><h1 className={styles.title}>READ<br/>THE WAVE</h1><p className={styles.tagline}>Rails control your carve. Shift your weight fore and aft to drive or stall in the pocket.</p><button className={styles.start} onClick={reset}>Take off</button><p className={styles.instructions}>←/→ rails · ↑ weight forward · ↓ stall · SPACE pump</p></div></section>:null}{phase==="over"?<section className={styles.gameOver}><p className={styles.kicker}>Wipeout</p><h2>{score.toLocaleString()} points</h2><p>{hint}</p><button className={styles.start} onClick={reset}>Take another wave</button></section>:null}{phase==="playing"?<div className={styles.touchControls}><button className={styles.touchButton} {...holdProps("left")}>LEFT</button><button className={styles.touchButton} {...holdProps("back")}>STALL</button><button className={`${styles.touchButton} ${styles.touchJump}`} onPointerDown={()=>{game.current.pump=true}}>PUMP</button><button className={styles.touchButton} {...holdProps("forward")}>DRIVE</button><button className={styles.touchButton} {...holdProps("right")}>RIGHT</button></div>:null}</main>;
}
