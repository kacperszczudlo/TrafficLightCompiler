import type { Cardinal, Point } from "../layouts/types";
import type { Blinker } from "../components/actors";

export interface PathSample {
  x: number;
  y: number;
  angle: number;
  blinker: Blinker;
}

export interface SimPath {
  sample(t: number): PathSample;
  progressAtStop(pred: (p: PathSample) => boolean): number;
  /** Długość trasy [px] — krótsza kończy się szybciej przy stałym speedPx. */
  length: number;
}

const DIR_ANGLE: Record<Cardinal, number> = {
  east: 0,
  south: Math.PI * 0.5,
  west: Math.PI,
  north: -Math.PI * 0.5,
};

function ccwSpan(from: Cardinal, to: Cardinal): { start: number; end: number } {
  let start = DIR_ANGLE[from];
  let end = DIR_ANGLE[to];
  while (end >= start) end -= Math.PI * 2;
  if (start - end < 0.2) end -= Math.PI * 2;
  return { start, end };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function bezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): PathSample {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const x =
    uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x;
  const y =
    uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y;
  const dx =
    3 * uu * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * tt * (p3.x - p2.x);
  const dy =
    3 * uu * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * tt * (p3.y - p2.y);
  return { x, y, angle: Math.atan2(dy, dx), blinker: "none" };
}

export function ccwSteps(from: Cardinal, to: Cardinal): number {
  const order: Cardinal[] = ["east", "north", "west", "south"];
  const i = order.indexOf(from);
  const j = order.indexOf(to);
  return (j - i + 4) % 4 || 4;
}

/**
 * Pas docelowy przed zjazdem:
 * 1 krok = zewn., 2 = środek, 3+ = środek (NIE outer).
 * Dawniej 3+ → outer: nL (N→E, R155→205) wpadał w tor sR (S→E, R205) — AABB nL×sR.
 */
export function ringLaneForExit(steps: number, lanes: number[]): number {
  const outer = lanes[0] ?? 205;
  const mid = lanes[1] ?? 180;
  if (steps <= 1) return outer;
  return mid;
}

/** Kierunkowskaz tylko przy realnej zmianie pasa / przed zjazdem. */
export function blinkerFor(
  progress: number,
  _steps: number,
  entryR: number,
  exitR: number,
): Blinker {
  const inward = exitR < entryR - 5;
  const outward = exitR > entryR + 5;
  if (inward && progress > 0.3 && progress < 0.58) return "left";
  if (outward && progress > 0.3 && progress < 0.62) return "right";
  if (progress > 0.7) return "right";
  return "none";
}

/** RHT wlot: prawo względem nadjeżdżającego. */
function inboundLanePoint(
  dir: Cardinal,
  cx: number,
  cy: number,
  r: number,
  laneAbs: number,
): Point {
  switch (dir) {
    case "west":
      return { x: cx - r, y: cy + laneAbs };
    case "east":
      return { x: cx + r, y: cy - laneAbs };
    case "south":
      return { x: cx + laneAbs, y: cy + r };
    case "north":
      return { x: cx - laneAbs, y: cy - r };
  }
}

/** RHT zjazd: prawo względem wyjeżdżającego (przeciwna strona osi niż wlot). */
function outboundLanePoint(
  dir: Cardinal,
  cx: number,
  cy: number,
  r: number,
  laneAbs: number,
): Point {
  switch (dir) {
    case "west":
      return { x: cx - r, y: cy - laneAbs };
    case "east":
      return { x: cx + r, y: cy + laneAbs };
    case "south":
      return { x: cx - laneAbs, y: cy + r };
    case "north":
      return { x: cx + laneAbs, y: cy - r };
  }
}

const ARM_OUT: Record<Cardinal, Point> = {
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
  south: { x: 0, y: 1 },
  north: { x: 0, y: -1 },
};

/**
 * Wlot → fillet → pierścień (spirala entryR→exitR) → fillet C1 → zjazd.
 */
export function createRoundaboutRoute(
  cx: number,
  cy: number,
  entryRingR: number,
  exitRingR: number,
  entry: Cardinal,
  exit: Cardinal,
  opts: {
    lane?: number;
    approachDist?: number;
    exitDist?: number;
    approachRingR?: number;
  } = {},
): SimPath {
  const lane = Math.abs(opts.lane ?? 36);
  const approachDist = opts.approachDist ?? 160;
  const exitDist = opts.exitDist ?? 170;
  const approachRingR = opts.approachRingR ?? entryRingR;
  const steps = ccwSteps(entry, exit);
  const { start } = ccwSpan(entry, exit);
  const filletIn = 0.24;
  const filletOut = steps <= 1 ? 0.3 : 0.36;

  const pt = (ang: number, r: number) => ({
    x: cx + Math.cos(ang) * r,
    y: cy + Math.sin(ang) * r,
  });
  const toAng = (p: Point) => Math.atan2(p.y - cy, p.x - cx);
  const snapRing = (p: Point, r: number) => {
    const a = toAng(p);
    return { ang: a, ...pt(a, r) };
  };
  const tangCCW = (ang: number) => ({ x: Math.sin(ang), y: -Math.cos(ang) });

  const entrySnap = snapRing(
    inboundLanePoint(entry, cx, cy, entryRingR, lane),
    entryRingR,
  );
  const exitSnap = snapRing(
    outboundLanePoint(exit, cx, cy, exitRingR, lane * 0.9),
    exitRingR,
  );

  let entryAng = entrySnap.ang;
  let exitAng = exitSnap.ang;
  while (entryAng - start > Math.PI) entryAng -= Math.PI * 2;
  while (entryAng - start < -Math.PI) entryAng += Math.PI * 2;
  while (exitAng >= entryAng) exitAng -= Math.PI * 2;
  if (entryAng - exitAng < 0.25) exitAng -= Math.PI * 2;

  const arcStart = entryAng - filletIn;
  const arcEnd = exitAng + filletOut;
  const entryGate = pt(entryAng, entryRingR);
  const arcIn = pt(arcStart, entryRingR);
  const exitGate = pt(exitAng, exitRingR);
  const exitArcPt = pt(arcEnd, exitRingR);
  const tIn = tangCCW(arcStart);
  const tExit = tangCCW(arcEnd);
  const ao = ARM_OUT[exit];

  const far: Record<Cardinal, Point> = {
    east: { x: cx + approachRingR + approachDist, y: cy - lane },
    west: { x: cx - approachRingR - approachDist, y: cy + lane },
    south: { x: cx + lane, y: cy + approachRingR + approachDist },
    north: { x: cx - lane, y: cy - approachRingR - approachDist },
  };
  const outFar: Record<Cardinal, Point> = {
    east: { x: cx + approachRingR + exitDist, y: cy + lane * 0.9 },
    west: { x: cx - approachRingR - exitDist, y: cy - lane * 0.9 },
    south: { x: cx - lane * 0.9, y: cy + approachRingR + exitDist },
    north: { x: cx + lane * 0.9, y: cy - approachRingR - exitDist },
  };
  const entryMid: Record<Cardinal, Point> = {
    east: { x: entryGate.x + 55, y: far.east.y },
    west: { x: entryGate.x - 55, y: far.west.y },
    south: { x: far.south.x, y: entryGate.y + 55 },
    north: { x: far.north.x, y: entryGate.y - 55 },
  };

  const a0 = far[entry];
  const d1 = outFar[exit];
  const em = entryMid[entry];
  // Punkt na ramieniu zjazdu: ta sama laterala co outFar, za pierścieniem
  const xm: Point = {
    east: { x: Math.max(exitGate.x + 75, cx + approachRingR + 40), y: d1.y },
    west: { x: Math.min(exitGate.x - 75, cx - approachRingR - 40), y: d1.y },
    south: { x: d1.x, y: Math.max(exitGate.y + 75, cy + approachRingR + 40) },
    north: { x: d1.x, y: Math.min(exitGate.y - 75, cy - approachRingR - 40) },
  }[exit];

  // Wagi ≈ długości odcinków (nie równe %) — potem i tak remap po łuku
  const ringFrac = Math.min(0.55, 0.22 + steps * 0.1);
  const weights = [0.16, 0.14, ringFrac, 0.18, 0.12];
  const wSum = weights.reduce((s, w) => s + w, 0);
  const handle = 72;

  function withBlink(p: PathSample, progress: number): PathSample {
    return {
      ...p,
      blinker: blinkerFor(progress, steps, entryRingR, exitRingR),
    };
  }

  /** Parametr u∈[0,1] wzdłuż segmentów (jeszcze nie po długości). */
  function sampleParam(uIn: number): PathSample {
    const uClamped = Math.max(0, Math.min(1, uIn));
    let u = uClamped * wSum;
    if (u <= weights[0]) {
      const t = u / weights[0];
      return {
        x: lerp(a0.x, em.x, t),
        y: lerp(a0.y, em.y, t),
        angle: Math.atan2(em.y - a0.y, em.x - a0.x),
        blinker: "none",
      };
    }
    u -= weights[0];
    if (u <= weights[1]) {
      const t = u / weights[1];
      const handleIn = Math.min(
        handle,
        Math.hypot(arcIn.x - em.x, arcIn.y - em.y) * 0.45,
      );
      return bezier(
        em,
        {
          x: em.x * 0.25 + entryGate.x * 0.75,
          y: em.y * 0.25 + entryGate.y * 0.75,
        },
        { x: arcIn.x - tIn.x * handleIn, y: arcIn.y - tIn.y * handleIn },
        arcIn,
        t,
      );
    }
    u -= weights[1];
    if (u <= weights[2]) {
      const t = u / weights[2];
      const ang = lerp(arcStart, arcEnd, t);
      const spiralT =
        steps >= 3 ? smoothstep(Math.max(0, (t - 0.5) / 0.5)) : smoothstep(t);
      const r = lerp(entryRingR, exitRingR, spiralT);
      const tang = tangCCW(ang);
      return {
        x: cx + Math.cos(ang) * r,
        y: cy + Math.sin(ang) * r,
        angle: Math.atan2(tang.y, tang.x),
        blinker: "none",
      };
    }
    u -= weights[2];
    if (u <= weights[3]) {
      const t = u / weights[3];
      return bezier(
        exitArcPt,
        {
          x: exitArcPt.x + tExit.x * handle,
          y: exitArcPt.y + tExit.y * handle,
        },
        { x: xm.x - ao.x * handle, y: xm.y - ao.y * handle },
        xm,
        t,
      );
    }
    u -= weights[3];
    const t = Math.min(1, u / weights[4]);
    return {
      x: lerp(xm.x, d1.x, t),
      y: lerp(xm.y, d1.y, t),
      angle: Math.atan2(ao.y, ao.x),
      blinker: "none",
    };
  }

  // LUT: stała prędkość liniowa (progress ↔ dystans wzdłuż trasy)
  const LUT_N = 64;
  const lutU: number[] = [0];
  const lutS: number[] = [0];
  let prev = sampleParam(0);
  let acc = 0;
  for (let i = 1; i <= LUT_N; i++) {
    const u = i / LUT_N;
    const p = sampleParam(u);
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    lutU.push(u);
    lutS.push(acc);
    prev = p;
  }
  const totalLen = Math.max(acc, 1);

  function uAtDistanceFrac(frac: number): number {
    const target = Math.max(0, Math.min(1, frac)) * totalLen;
    let lo = 0;
    let hi = LUT_N;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lutS[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const s0 = lutS[i - 1];
    const s1 = lutS[i];
    const t = s1 > s0 ? (target - s0) / (s1 - s0) : 0;
    return lerp(lutU[i - 1], lutU[i], t);
  }

  function sample(progress: number): PathSample {
    const prog = Math.max(0, Math.min(1, progress));
    return withBlink(sampleParam(uAtDistanceFrac(prog)), prog);
  }

  function progressAtStop(pred: (p: PathSample) => boolean): number {
    let lo = 0;
    let hi = 0.45;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) * 0.5;
      if (pred(sample(mid))) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  return { sample, progressAtStop, length: totalLen };
}

export function stopPredicate(
  entry: Cardinal,
  cx: number,
  cy: number,
  ringOuter: number,
  stopOut: number,
  nose: number,
): (p: PathSample) => boolean {
  const stopN = cy - ringOuter - stopOut - nose;
  const stopS = cy + ringOuter + stopOut + nose;
  const stopW = cx - ringOuter - stopOut - nose;
  const stopE = cx + ringOuter + stopOut + nose;
  return {
    north: (p: PathSample) => p.y >= stopN,
    south: (p: PathSample) => p.y <= stopS,
    west: (p: PathSample) => p.x >= stopW,
    east: (p: PathSample) => p.x <= stopE,
  }[entry];
}
