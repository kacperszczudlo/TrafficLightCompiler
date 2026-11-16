/**
 * Headless stress + assert równej linii startu.
 * npx --yes tsx scripts/stressHeadless.ts
 */
import { AUTORSKIE } from "../src/sim/layouts/autorskieRondo";
import {
  createRoundaboutRoute,
  ccwSteps,
  ringLaneForExit,
  stopPredicate,
} from "../src/sim/paths/roundaboutRoute";
import { aabbFromCenter, aabbOverlap } from "../src/sim/collision";

const L = AUTORSKIE;
const DT = 1 / 30;
const SECONDS = 120;

type Car = {
  id: string;
  entry: string;
  progress: number;
  speed: number;
  stopProgress: number;
  waitTimer: number;
  spawnHold: number;
  path: ReturnType<typeof createRoundaboutRoute>;
};

function buildCars(): Car[] {
  return L.vehicles.map((v) => {
    const steps = ccwSteps(v.entry, v.exit);
    const exitRingR = v.exitRingR ?? ringLaneForExit(steps, L.ringLanes);
    const path = createRoundaboutRoute(
      L.cx,
      L.cy,
      v.ringR,
      exitRingR,
      v.entry,
      v.exit,
      {
        lane: Math.abs(v.laneOffset),
        approachDist: 420,
        exitDist: 420,
        approachRingR: L.ringOuter,
      },
    );
    const stop = L.stops.find((s) => s.dir === v.entry)!;
    const pred = stopPredicate(v.entry, L.cx, L.cy, L.ringOuter, stop.out, 18);
    return {
      id: v.id,
      entry: v.entry,
      progress: 0,
      speed: v.speed, // px/s
      stopProgress: path.progressAtStop(pred),
      waitTimer: 0,
      spawnHold: v.spawnDelay ?? 0,
      path,
    };
  });
}

function assertAlignedStarts(cars: Car[]) {
  const errs: string[] = [];
  const byEntry = new Map<string, Car[]>();
  for (const c of cars) {
    const list = byEntry.get(c.entry) || [];
    list.push(c);
    byEntry.set(c.entry, list);
  }
  for (const [entry, group] of byEntry) {
    const poses = group.map((c) => c.path.sample(0));
    if (entry === "west" || entry === "east") {
      const xs = poses.map((p) => p.x);
      const spread = Math.max(...xs) - Math.min(...xs);
      if (spread > 2) errs.push(`${entry} start X spread=${spread.toFixed(1)} (want ~0)`);
    } else {
      const ys = poses.map((p) => p.y);
      const spread = Math.max(...ys) - Math.min(...ys);
      if (spread > 2) errs.push(`${entry} start Y spread=${spread.toFixed(1)} (want ~0)`);
    }
  }
  return errs;
}

function countCollisions(cars: Car[]): string[] {
  const hits: string[] = [];
  const boxes = cars.map((v) => {
    const s = v.path.sample(Math.min(1, v.progress));
    return {
      id: v.id,
      entry: v.entry,
      s,
      box: aabbFromCenter(s.x, s.y, 10, 18, s.angle - Math.PI / 2),
    };
  });
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (!aabbOverlap(a.box, b.box)) continue;
      // Równoległy pas tego samego wlotu — nie licz jako stłuczka
      if (a.entry === b.entry) {
        const fx = Math.cos(a.s.angle);
        const fy = Math.sin(a.s.angle);
        const side = Math.abs(-(b.s.x - a.s.x) * fy + (b.s.y - a.s.y) * fx);
        const ahead = (b.s.x - a.s.x) * fx + (b.s.y - a.s.y) * fy;
        if (side > 16 && Math.abs(ahead) < 20) continue;
      }
      hits.push(`${a.id}×${b.id}`);
    }
  }
  return hits;
}

function tick(cars: Car[]) {
  const order = [...cars].sort((a, b) => b.progress - a.progress);
  const proposed = new Map<string, number>();
  for (const v of order) {
    if (v.spawnHold > 0) {
      v.spawnHold -= DT;
      proposed.set(v.id, v.progress);
      continue;
    }
    const step = (v.speed / Math.max(v.path.length, 1)) * DT;
    let next = v.progress;
    const lookProg = Math.min(1, v.progress + step * 4);
    const lookPose = v.path.sample(lookProg);
    const onRing = v.progress > v.stopProgress + 0.02 && v.progress < 0.78;
    const followGap = onRing ? 40 : 42;
    const lookBox = aabbFromCenter(lookPose.x, lookPose.y, 11, 20, lookPose.angle - Math.PI / 2);
    const nowPose = v.path.sample(Math.min(1, v.progress));
    const nowBox = aabbFromCenter(nowPose.x, nowPose.y, 10, 18, nowPose.angle - Math.PI / 2);
    let followScale = 1;
    const blocked = cars.some((o) => {
      if (o.id === v.id) return false;
      if ((proposed.get(o.id) ?? o.progress) === 0 && o.spawnHold > 0 && v.progress === 0) return false;
      const oProg = proposed.get(o.id) ?? o.progress;
      const os = o.path.sample(Math.min(1, oProg));
      const dist = Math.hypot(nowPose.x - os.x, nowPose.y - os.y);
      if (dist > followGap + 12) return false;
      const oBox = aabbFromCenter(os.x, os.y, 10, 18, os.angle - Math.PI / 2);
      const fx = Math.cos(nowPose.angle);
      const fy = Math.sin(nowPose.angle);
      const ahead = (os.x - nowPose.x) * fx + (os.y - nowPose.y) * fy;
      const side = Math.abs(-(os.x - nowPose.x) * fy + (os.y - nowPose.y) * fx);
      if (o.entry === v.entry && side > 16 && Math.abs(ahead) < 14) return false;
      const overlapped = aabbOverlap(nowBox, oBox) && side < 14;
      if (overlapped) return oProg >= v.progress - 0.001;
      if (oProg < v.progress - 0.02) return false;
      if (ahead < -8) return false;
      if (side > (onRing ? 28 : 20)) return false;
      if (aabbOverlap(lookBox, oBox) && ahead > 2) return true;
      if (o.entry === v.entry && ahead > 10 && dist < followGap && side < 12) return true;
      if (o.entry !== v.entry && onRing && ahead > -2 && side < 22 && dist < followGap + 8) {
        followScale = Math.min(followScale, Math.max(0.2, (dist - 8) / (followGap + 8)));
        return dist < 18;
      }
      if (ahead > 6 && side < (onRing ? 14 : 11) && dist < followGap) {
        followScale = Math.min(followScale, Math.max(0.35, (dist - 10) / followGap));
        return dist < 14;
      }
      return false;
    });
    if (!blocked) next = v.progress + step * followScale;
    if (next >= 1) {
      v.waitTimer += DT;
      if (v.waitTimer > 2.2) {
        const startPose = v.path.sample(0);
        const clear = !cars.some((o) => {
          if (o.id === v.id) return false;
          const op = proposed.get(o.id) ?? o.progress;
          if (op > 0.12) return false;
          const os = o.path.sample(Math.min(1, op));
          return Math.hypot(startPose.x - os.x, startPose.y - os.y) < 40;
        });
        if (clear) {
          next = 0;
          v.waitTimer = 0;
          v.spawnHold = 0.8;
        } else next = 1;
      } else next = 1;
    }
    proposed.set(v.id, next);
  }
  for (const v of cars) v.progress = proposed.get(v.id) ?? v.progress;
}

function main() {
  const cars = buildCars();
  const alignErrs = assertAlignedStarts(cars);
  if (alignErrs.length) {
    console.error("ALIGN FAIL", alignErrs);
    process.exit(1);
  }
  console.log("aligned starts OK");

  const uniqueHits = new Map<string, number>();
  let framesWithHit = 0;
  const steps = Math.floor(SECONDS / DT);
  for (let i = 0; i < steps; i++) {
    tick(cars);
    const hits = countCollisions(cars);
    if (hits.length) {
      framesWithHit += 1;
      for (const h of hits) uniqueHits.set(h, (uniqueHits.get(h) || 0) + 1);
    }
  }
  const sustained = [...uniqueHits.entries()].filter(([, n]) => n > 45);
  console.log(`frames=${steps} hitFrames=${framesWithHit} uniquePairs=${uniqueHits.size}`);
  if (uniqueHits.size) {
    console.log("GRAZE/HITS", [...uniqueHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));
  }
  // Krótki styk AABB przy merge OK; fail tylko przy „zawieszeniu” (paraliż)
  if (sustained.length || framesWithHit > 100) {
    console.error("COLLISIONS SUSTAINED", sustained);
    process.exit(2);
  }
  console.log("STRESS PASS — brak trwałego AABB car×car");
}

main();
