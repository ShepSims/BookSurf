"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./BookSurfGame.module.css";

type Phase = "ready" | "playing" | "over";
type ParticleKind = "face" | "foam" | "mist" | "spray";
type Particle = {
  kind: ParticleKind;
  u: number;
  v: number;
  du: number;
  dv: number;
  life: number;
  maxLife: number;
  size: number;
  seed: number;
};
type Runtime = {
  phase: Phase;
  last: number;
  t: number;
  speed: number;
  face: number;
  faceVel: number;
  bank: number;
  heading: number;
  left: boolean;
  right: boolean;
  pump: boolean;
  pumpCd: number;
  pocket: number;
  score: number;
  best: number;
  particles: Particle[];
  faceSpawn: number;
  foamSpawn: number;
  mistSpawn: number;
};

const TAU = Math.PI * 2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const smooth = (t: number) => t * t * (3 - 2 * t);
const rand = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

function addParticle(g: Runtime, kind: ParticleKind, seed: number, power = 1) {
  if (kind === "face") {
    g.particles.push({
      kind,
      u: rand(seed),
      v: rand(seed + 1),
      du: 0.045 + rand(seed + 2) * 0.035,
      dv: (rand(seed + 3) - 0.5) * 0.018,
      life: 7,
      maxLife: 7,
      size: 0.7 + rand(seed + 4) * 1.6,
      seed,
    });
    return;
  }

  if (kind === "foam") {
    g.particles.push({
      kind,
      u: rand(seed) * 0.16,
      v: 0.12 + rand(seed + 1) * 0.72,
      du: 0.05 + rand(seed + 2) * 0.08,
      dv: (rand(seed + 3) - 0.45) * 0.08,
      life: 1.2 + rand(seed + 4) * 1.2,
      maxLife: 2.4,
      size: 2.2 + rand(seed + 5) * 5.2,
      seed,
    });
    return;
  }

  if (kind === "mist") {
    g.particles.push({
      kind,
      u: 0.02 + rand(seed) * 0.16,
      v: rand(seed + 1) * 0.25,
      du: 0.025 + rand(seed + 2) * 0.05,
      dv: -0.08 - rand(seed + 3) * 0.08,
      life: 0.7 + rand(seed + 4) * 0.8,
      maxLife: 1.5,
      size: 1.1 + rand(seed + 5) * 2.5,
      seed,
    });
    return;
  }

  const side = g.bank < 0 ? -1 : 1;
  g.particles.push({
    kind,
    u: 0.5,
    v: 0.88,
    du: side * (0.14 + rand(seed) * 0.18) * power,
    dv: -0.18 - rand(seed + 1) * 0.25 * power,
    life: 0.35 + rand(seed + 2) * 0.45,
    maxLife: 0.8,
    size: 1.2 + rand(seed + 3) * 3.2 * power,
    seed,
  });
}

function sprayBurst(g: Runtime, power: number) {
  const count = 12 + Math.round(power * 22);
  const base = g.t * 997;
  for (let i = 0; i < count; i += 1) addParticle(g, "spray", base + i * 7.17, power);
}

export default function BookSurfFirstPersonV4() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const raf = useRef<number | undefined>(undefined);
  const game = useRef<Runtime>({
    phase: "ready",
    last: 0,
    t: 0,
    speed: 22,
    face: 0.56,
    faceVel: -0.04,
    bank: 0,
    heading: 0,
    left: false,
    right: false,
    pump: false,
    pumpCd: 0,
    pocket: 0.36,
    score: 0,
    best: 0,
    particles: [],
    faceSpawn: 0,
    foamSpawn: 0,
    mistSpawn: 0,
  });

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState("TRIM");
  const [hint, setHint] = useState("Wall left · shoulder right · stay near the pocket");

  useEffect(() => {
    const stored = Number(localStorage.getItem("booksurf-book-surf-best") || 0);
    game.current.best = Number.isFinite(stored) ? stored : 0;
    setBest(game.current.best);
  }, []);

  const reset = useCallback(() => {
    Object.assign(game.current, {
      phase: "playing",
      last: 0,
      t: 0,
      speed: 22,
      face: 0.56,
      faceVel: -0.04,
      bank: 0,
      heading: 0,
      left: false,
      right: false,
      pump: false,
      pumpCd: 0,
      pocket: 0.36,
      score: 0,
      particles: [],
      faceSpawn: 0,
      foamSpawn: 0,
      mistSpawn: 0,
    });
    setPhase("playing");
    setScore(0);
    setStatus("TRIM");
    setHint("← LEFT RAIL · → RIGHT RAIL · SPACE PUMP");
  }, []);

  const finish = useCallback((message: string) => {
    const g = game.current;
    if (g.phase !== "playing") return;
    g.phase = "over";
    const finalScore = Math.floor(g.score);
    if (finalScore > g.best) {
      g.best = finalScore;
      localStorage.setItem("booksurf-book-surf-best", String(finalScore));
      setBest(finalScore);
    }
    setScore(finalScore);
    setHint(message);
    setPhase("over");
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(event.code)) event.preventDefault();
      const g = game.current;
      if (event.code === "ArrowLeft" || event.code === "KeyA") g.left = true;
      if (event.code === "ArrowRight" || event.code === "KeyD") g.right = true;
      if (event.code === "Space" && !event.repeat) g.pump = true;
      if (event.code === "Enter" && g.phase !== "playing") reset();
    };
    const keyUp = (event: KeyboardEvent) => {
      const g = game.current;
      if (event.code === "ArrowLeft" || event.code === "KeyA") g.left = false;
      if (event.code === "ArrowRight" || event.code === "KeyD") g.right = false;
    };
    addEventListener("keydown", keyDown, { passive: false });
    addEventListener("keyup", keyUp);
    return () => {
      removeEventListener("keydown", keyDown);
      removeEventListener("keyup", keyUp);
    };
  }, [reset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener("resize", resize);

    const facePoint = (vw: number, vh: number, u: number, v: number, g: Runtime) => {
      const horizon = vh * 0.31;
      const crestX = vw * (0.055 + g.pocket * 0.04);
      const lipY = vh * (0.28 + (1 - g.face) * 0.045);
      const shoulderX = vw * 1.05;
      const troughY = vh * 0.94;
      const x = crestX + (shoulderX - crestX) * u;
      const crestCurve = lipY + Math.pow(u, 0.72) * vh * 0.23 + Math.pow(u, 2.4) * vh * 0.16;
      const lower = troughY - Math.sin(clamp(u, 0, 1) * Math.PI) * vh * 0.06;
      const y = crestCurve + (lower - crestCurve) * v;
      return { x, y, horizon, lipY, crestX, troughY };
    };

    const drawMain = (vw: number, vh: number, g: Runtime) => {
      const cameraRoll = g.bank * 0.11;
      ctx.save();
      ctx.translate(vw / 2, vh * 0.55);
      ctx.rotate(cameraRoll);
      ctx.translate(-vw / 2, -vh * 0.55);

      const horizon = vh * 0.31;
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#2f83d1");
      sky.addColorStop(0.62, "#66b6e5");
      sky.addColorStop(1, "#b8dce7");
      ctx.fillStyle = sky;
      ctx.fillRect(-vw, -vh, vw * 3, vh * 2);

      // Distant shore on the open shoulder gives a stable down-the-line reference.
      const shoreY = horizon + vh * 0.035;
      ctx.fillStyle = "rgba(216,194,145,.8)";
      ctx.beginPath();
      ctx.moveTo(vw * 0.43, shoreY + 8);
      ctx.quadraticCurveTo(vw * 0.72, shoreY - 6, vw * 1.15, shoreY + 3);
      ctx.lineTo(vw * 1.15, shoreY + 17);
      ctx.lineTo(vw * 0.43, shoreY + 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(35,78,67,.78)";
      for (let i = 0; i < 23; i += 1) {
        const x = vw * (0.47 + i * 0.03);
        const h = 4 + rand(i * 4.1) * 13;
        ctx.fillRect(x, shoreY - h, 2.4, h + 4);
      }

      const sea = ctx.createLinearGradient(0, horizon, 0, vh);
      sea.addColorStop(0, "#147ca0");
      sea.addColorStop(0.45, "#08647e");
      sea.addColorStop(1, "#043e55");
      ctx.fillStyle = sea;
      ctx.fillRect(-vw, horizon, vw * 3, vh * 2);

      // Wave wall: steep on LEFT, flattening toward the RIGHT shoulder.
      const crestX = vw * (0.055 + g.pocket * 0.04);
      const lipY = vh * (0.28 + (1 - g.face) * 0.045);
      const troughY = vh * 0.94;
      const shoulderY = vh * (0.49 + (1 - g.face) * 0.10);
      ctx.beginPath();
      ctx.moveTo(-vw * 0.2, troughY);
      ctx.bezierCurveTo(-vw * 0.08, vh * 0.58, crestX - 30, lipY + 28, crestX, lipY);
      ctx.bezierCurveTo(vw * 0.18, lipY + 25, vw * 0.39, shoulderY - 32, vw * 0.62, shoulderY);
      ctx.bezierCurveTo(vw * 0.82, shoulderY + 55, vw * 1.02, troughY - 115, vw * 1.2, troughY - 28);
      ctx.lineTo(vw * 1.2, vh * 1.2);
      ctx.lineTo(-vw * 0.2, vh * 1.2);
      ctx.closePath();
      const wave = ctx.createLinearGradient(crestX, lipY, vw * 0.75, troughY);
      wave.addColorStop(0, "#063f5b");
      wave.addColorStop(0.17, "#076f8e");
      wave.addColorStop(0.42, "#0a8da5");
      wave.addColorStop(0.68, "#08758c");
      wave.addColorStop(1, "#043f54");
      ctx.fillStyle = wave;
      ctx.fill();

      // Translucent pocket depth on the left wall.
      const pocketGlow = ctx.createRadialGradient(crestX + vw * 0.11, lipY + vh * 0.19, 6, crestX + vw * 0.12, lipY + vh * 0.19, vw * 0.31);
      pocketGlow.addColorStop(0, "rgba(15,155,181,.48)");
      pocketGlow.addColorStop(0.48, "rgba(4,103,132,.24)");
      pocketGlow.addColorStop(1, "rgba(0,42,63,0)");
      ctx.fillStyle = pocketGlow;
      ctx.fillRect(-vw * 0.05, horizon, vw * 0.75, vh * 0.7);

      // Curl/lip hanging from upper-left, like the POV reference.
      const pitch = clamp((0.58 - g.pocket) * 1.8, 0.05, 0.92);
      const reach = vw * (0.12 + pitch * 0.12);
      ctx.beginPath();
      ctx.moveTo(crestX - 20, lipY + 10);
      ctx.bezierCurveTo(crestX + 8, lipY - 56, crestX + reach * 0.64, lipY - 48, crestX + reach, lipY + 82);
      ctx.bezierCurveTo(crestX + reach * 0.68, lipY + 54, crestX + reach * 0.31, lipY + 38, crestX - 20, lipY + 10);
      const lip = ctx.createLinearGradient(crestX, lipY, crestX + reach, lipY + 90);
      lip.addColorStop(0, "rgba(245,255,255,.98)");
      lip.addColorStop(0.24, "rgba(169,229,235,.88)");
      lip.addColorStop(0.65, "rgba(32,137,159,.55)");
      lip.addColorStop(1, "rgba(4,72,94,.06)");
      ctx.fillStyle = lip;
      ctx.fill();

      // Dark tube/pocket under the pitching lip.
      ctx.fillStyle = "rgba(0,34,52,.34)";
      ctx.beginPath();
      ctx.moveTo(crestX + 8, lipY + 22);
      ctx.bezierCurveTo(crestX + reach * 0.32, lipY + 58, crestX + reach * 0.42, lipY + 128, crestX + reach * 0.58, lipY + 188);
      ctx.bezierCurveTo(crestX + reach * 0.18, lipY + 170, crestX - 10, lipY + 100, crestX - 20, lipY + 45);
      ctx.closePath();
      ctx.fill();

      // Particle water movement: no graphic flow lines.
      for (const p of g.particles) {
        if (p.kind !== "face") continue;
        const pt = facePoint(vw, vh, p.u, p.v, g);
        const shimmer = 0.32 + rand(p.seed + Math.floor(g.t * 3)) * 0.4;
        ctx.globalAlpha = shimmer;
        ctx.fillStyle = p.v < 0.34 ? "#bdebf0" : "#73cbd5";
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, p.size * 1.8, p.size * 0.72, 0.18, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Foam and feather particles cluster on the left/rear breaking section.
      for (const p of g.particles) {
        if (p.kind !== "foam" && p.kind !== "mist") continue;
        const alpha = clamp(p.life / Math.max(0.01, p.maxLife), 0, 1);
        const x = crestX + p.u * vw * 0.31;
        const baseY = lipY + p.v * vh * 0.46;
        const y = baseY + Math.sin(p.seed + g.t * 4) * 3;
        ctx.globalAlpha = alpha * (p.kind === "mist" ? 0.62 : 0.88);
        ctx.fillStyle = p.kind === "mist" ? "#efffff" : "#d9f2f2";
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Board nose / body reference stays stable while the world banks subtly.
      const boardY = vh * 0.985;
      ctx.save();
      ctx.translate(vw * 0.52, boardY);
      ctx.rotate(0.08 + g.bank * 0.16);
      const board = ctx.createLinearGradient(-54, 0, 54, 0);
      board.addColorStop(0, "#d5a22f");
      board.addColorStop(0.5, "#f4d361");
      board.addColorStop(1, "#d5a22f");
      ctx.fillStyle = board;
      ctx.beginPath();
      ctx.moveTo(0, -112);
      ctx.bezierCurveTo(-29, -88, -47, -44, -52, 8);
      ctx.quadraticCurveTo(0, 20, 52, 8);
      ctx.bezierCurveTo(47, -44, 29, -88, 0, -112);
      ctx.fill();
      ctx.restore();

      // Turn spray is screen-space so the carve feedback reads immediately.
      for (const p of g.particles) {
        if (p.kind !== "spray") continue;
        const alpha = clamp(p.life / Math.max(0.01, p.maxLife), 0, 1);
        const x = vw * 0.52 + (p.u - 0.5) * vw * 0.62;
        const y = boardY + (p.v - 0.88) * vh * 0.7;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#efffff";
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawInset = (vw: number, vh: number, g: Runtime) => {
      const w = Math.min(260, vw * 0.22);
      const h = w * 0.58;
      const x = vw - w - 22;
      const y = vh - h - 22;
      const radius = 15;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.clip();
      ctx.fillStyle = "rgba(4,34,48,.88)";
      ctx.fillRect(x, y, w, h);

      // Side/chase schematic: wall left, shoulder right, same orientation as main POV.
      const base = y + h * 0.86;
      const crestX = x + w * 0.12;
      const crestY = y + h * 0.23;
      ctx.beginPath();
      ctx.moveTo(x - 8, base);
      ctx.bezierCurveTo(x + w * 0.02, y + h * 0.45, crestX, crestY, crestX + w * 0.09, crestY + 3);
      ctx.bezierCurveTo(x + w * 0.35, y + h * 0.36, x + w * 0.7, y + h * 0.54, x + w * 1.08, base - h * 0.04);
      ctx.lineTo(x + w * 1.08, y + h);
      ctx.lineTo(x - 8, y + h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(crestX, crestY, x + w, base);
      grad.addColorStop(0, "#0c7991");
      grad.addColorStop(1, "#075064");
      ctx.fillStyle = grad;
      ctx.fill();

      // Whitewater behind the surfer on the left.
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#dcefee";
      for (let i = 0; i < 18; i += 1) {
        const px = x + rand(i * 3.4) * w * 0.23;
        const py = y + h * (0.34 + rand(i * 2.1 + 1) * 0.42);
        ctx.beginPath();
        ctx.arc(px, py, 2 + rand(i + 9) * 4, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Surfer position: face=0 trough, face=1 lip; pocket controls horizontal relation to breaking section.
      const riderX = x + w * (0.31 + clamp(g.pocket, 0, 1) * 0.46);
      const riderY = base - h * (0.08 + g.face * 0.55);
      ctx.save();
      ctx.translate(riderX, riderY);
      ctx.rotate(g.bank * 0.32);
      ctx.strokeStyle = "#f3d467";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, 2);
      ctx.lineTo(11, -2);
      ctx.stroke();
      ctx.fillStyle = "#f7f2df";
      ctx.beginPath();
      ctx.arc(0, -7, 4.5, 0, TAU);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,.88)";
      ctx.font = "700 9px system-ui, sans-serif";
      ctx.fillText("CHASE", x + 10, y + 16);
      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.stroke();
    };

    const updateParticles = (g: Runtime, dt: number) => {
      const speedFactor = clamp(g.speed / 22, 0.65, 1.55);
      g.faceSpawn += dt * (38 + g.speed * 1.5);
      while (g.faceSpawn >= 1) {
        addParticle(g, "face", g.t * 193 + g.faceSpawn * 17);
        g.faceSpawn -= 1;
      }

      g.foamSpawn += dt * (12 + clamp(0.55 - g.pocket, 0, 0.55) * 35);
      while (g.foamSpawn >= 1) {
        addParticle(g, "foam", g.t * 311 + g.foamSpawn * 23);
        g.foamSpawn -= 1;
      }

      g.mistSpawn += dt * 10;
      while (g.mistSpawn >= 1) {
        addParticle(g, "mist", g.t * 419 + g.mistSpawn * 31);
        g.mistSpawn -= 1;
      }

      for (const p of g.particles) {
        if (p.kind === "face") {
          p.u += p.du * dt * speedFactor;
          p.v += p.dv * dt + Math.sin(g.t * 1.5 + p.seed) * 0.0012;
          if (p.u > 1.03) p.u = -0.02;
          p.v = clamp(p.v, 0.02, 0.98);
        } else {
          p.u += p.du * dt;
          p.v += p.dv * dt;
          if (p.kind === "spray") p.dv += 0.55 * dt;
          if (p.kind === "foam") p.dv += (rand(p.seed) - 0.45) * 0.02 * dt;
          p.life -= dt;
        }
      }
      g.particles = g.particles.filter((p) => p.kind === "face" || p.life > 0).slice(-560);
    };

    const tick = (ts: number) => {
      const rect = canvas.getBoundingClientRect();
      const vw = rect.width;
      const vh = rect.height;
      const g = game.current;
      const dt = g.last ? Math.min(0.032, (ts - g.last) / 1000) : 0;
      g.last = ts;
      g.t += dt;

      if (g.phase === "playing") {
        const rail = Number(g.right) - Number(g.left);
        const targetBank = rail * 0.88;
        g.bank += (targetBank - g.bank) * Math.min(1, dt * (rail ? 6.2 : 4.2));

        const speedHold = clamp(g.speed / 27, 0.5, 1.25);
        const turnRate = Math.sin(g.bank) * (0.56 + speedHold * 0.62);
        g.heading += turnRate * dt;
        g.heading *= Math.pow(0.997, dt * 60);

        const railDrag = Math.abs(g.bank) * (0.22 + 0.25 * speedHold) + g.bank * g.bank * 0.22;
        // LEFT rail (-bank) climbs the left wall; RIGHT rail (+bank) releases down/open toward the shoulder.
        g.faceVel += (-Math.sin(g.bank) * g.speed * 0.0125 - 0.15) * dt;
        g.faceVel *= Math.pow(0.992, dt * 60);
        g.face += g.faceVel * dt;

        const descending = Math.max(0, -g.faceVel);
        const climbing = Math.max(0, g.faceVel);
        const steepness = 0.62 + smooth(clamp(g.face, 0, 1)) * 0.82;
        g.speed += (descending * 12.6 * steepness - climbing * 6.8 - railDrag - 0.28) * dt;

        if (g.face <= 0.04) {
          g.face = 0.04;
          if (g.bank < -0.15) {
            g.faceVel = Math.abs(g.faceVel) * 0.58 + 0.19;
            g.speed += 0.75;
            setStatus("BOTTOM TURN · LEFT RAIL");
            sprayBurst(g, clamp(Math.abs(g.bank) * speedHold, 0.4, 1));
          } else {
            g.faceVel = 0.05;
            g.speed -= 0.65;
            setStatus("TROUGH");
          }
        }

        if (g.face >= 0.96) {
          g.face = 0.96;
          g.faceVel = -Math.abs(g.faceVel) * 0.48 - 0.08;
          setStatus(g.bank > 0.16 ? "REDIRECT · RIGHT RAIL" : "HIGH LINE");
          if (Math.abs(g.bank) > 0.18) sprayBurst(g, clamp(Math.abs(g.bank) * speedHold, 0.35, 1));
        }

        const carvePower = Math.abs(g.bank) * speedHold * clamp(Math.abs(turnRate) * 1.7, 0, 1);
        if (carvePower > 0.47 && Math.floor(g.t * 12) !== Math.floor((g.t - dt) * 12)) sprayBurst(g, carvePower * 0.65);

        g.pumpCd = Math.max(0, g.pumpCd - dt);
        if (g.pump) {
          g.pump = false;
          if (g.pumpCd <= 0) {
            const transition = clamp(Math.abs(g.faceVel) * 3.2, 0, 1);
            const loaded = clamp(Math.abs(g.bank) * 1.25, 0, 1);
            const usefulZone = 1 - smooth(clamp((g.face - 0.28) / 0.5, 0, 1));
            const efficiency = clamp(0.1 + transition * 0.35 + loaded * 0.24 + usefulZone * 0.31, 0, 1);
            g.speed += efficiency * 2.45;
            g.score += Math.round(efficiency * 55);
            g.pumpCd = 0.34;
            setStatus(efficiency > 0.75 ? "PUMP · PERFECT" : efficiency > 0.5 ? "PUMP · DRIVE" : "PUMP · MISTIMED");
            if (efficiency > 0.52) sprayBurst(g, efficiency * 0.6);
          }
        }

        const downLine = g.speed * Math.cos(g.heading);
        g.pocket += ((downLine - 21.4) / 170) * dt;
        g.pocket = clamp(g.pocket, -0.08, 1.05);
        if (g.pocket < 0.018) finish("THE FOAM BALL CAUGHT YOU");
        if (g.pocket > 0.92) {
          g.speed -= 1.25 * dt;
          setStatus("TOO FAR ON THE SHOULDER");
        }
        if (g.speed < 10.5) finish("YOU LOST TOO MUCH SPEED");

        g.score += dt * (g.speed * 0.6 + Math.abs(g.bank) * 10);
        setScore(Math.floor(g.score));
        setHint(`Speed ${g.speed.toFixed(1)} · Face ${Math.round(g.face * 100)}% · ${g.bank < -0.12 ? "LEFT RAIL" : g.bank > 0.12 ? "RIGHT RAIL" : "FLAT"}`);
      }

      updateParticles(g, dt);
      drawMain(vw, vh, g);
      if (g.phase !== "ready") drawInset(vw, vh, g);
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      removeEventListener("resize", resize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [finish]);

  const hold = (key: "left" | "right", value: boolean) => {
    game.current[key] = value;
  };

  return (
    <main className={styles.shell}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="First-person left-hander surfing game with chase camera" />
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <strong>BOOKSURF</strong>
          <span>First-person carving prototype</span>
        </Link>
        <div className={styles.actions}>
          <Link href="/surf" className={styles.ghost}>Find surf</Link>
          {phase === "playing" ? <button className={styles.solid} onClick={reset}>Restart</button> : null}
        </div>
      </header>

      {phase !== "ready" ? (
        <>
          <div className={styles.hud}>
            <div className={styles.pill}><small>Score</small><strong>{score.toLocaleString()}</strong></div>
            <div className={styles.pill}><small>Status</small><strong>{status}</strong></div>
            <div className={styles.pill}><small>Best</small><strong>{best.toLocaleString()}</strong></div>
          </div>
          <div className={styles.timingHud}><strong>LEFT-HANDER</strong><span>{hint}</span></div>
        </>
      ) : null}

      {phase === "ready" ? (
        <section className={styles.intro}>
          <div className={styles.introCard}>
            <p className={styles.kicker}>Pocket POV</p>
            <h1 className={styles.title}>READ<br />THE WAVE</h1>
            <p className={styles.tagline}>Wall on your left. Shoulder opens right. Use the inset to read your line, then surf by feel.</p>
            <button className={styles.start} onClick={reset}>Take off</button>
            <p className={styles.instructions}>← left rail · → right rail · SPACE pump</p>
          </div>
        </section>
      ) : null}

      {phase === "over" ? (
        <section className={styles.gameOver}>
          <p className={styles.kicker}>Wipeout</p>
          <h2>{score.toLocaleString()} points</h2>
          <p>{hint}</p>
          <button className={styles.start} onClick={reset}>Take another wave</button>
        </section>
      ) : null}

      {phase === "playing" ? (
        <div className={styles.touchControls}>
          <button className={styles.touchButton} onPointerDown={() => hold("left", true)} onPointerUp={() => hold("left", false)} onPointerCancel={() => hold("left", false)}>LEFT</button>
          <button className={`${styles.touchButton} ${styles.touchJump}`} onPointerDown={() => { game.current.pump = true; }}>PUMP</button>
          <button className={styles.touchButton} onPointerDown={() => hold("right", true)} onPointerUp={() => hold("right", false)} onPointerCancel={() => hold("right", false)}>RIGHT</button>
        </div>
      ) : null}
    </main>
  );
}
