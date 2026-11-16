/**
 * Reprodukcja nL × sR w fazie q3 (krok 4/7) — logika zbliżona do SimRuntime.
 * npx --yes tsx scripts/reproNlSr.ts
 */
import { AUTORSKIE } from "../src/sim/layouts/autorskieRondo";
import {
  createRoundaboutRoute,
  ccwSteps,
  ringLaneForExit,
  stopPredicate,
} from "../src/sim/paths/roundaboutRoute";
import { aabbFromCenter, aabbOverlap } from "../src/sim/collision";
import {
  isSignalGreen,
  resolveSignal,
  type DfaModel,
} from "../src/sim/signals";

const L = AUTORSKIE;
const DT = 1 / 60;
const ARM_RUN = 420;

const DFA: DfaModel = {
  name: "repro",
  states: [
    {
      id: "q0",
      duration_ms: 25000,
      outputs: {
        Wlot_Zachod: "ZIELONE",
        Wlot_Wschod: "ZIELONE",
        Wlot_Poludnie: "CZERWONE",
        Wlot_Polnoc: "CZERWONE",
        Tramwaj_Linia_WE: "TRAM_JAZDA",
        Tramwaj_Linia_NS: "TRAM_STOJ",
        Piesi_Przejscia: "CZERWONE",
      },
    },
    {
      id: "q1",
      duration_ms: 3000,
      outputs: {
        Wlot_Zachod: "ZOLTE",
        Wlot_Wschod: "ZOLTE",
        Wlot_Poludnie: "CZERWONE",
        Wlot_Polnoc: "CZERWONE",
        Tramwaj_Linia_WE: "TRAM_UWAGA",
        Tramwaj_Linia_NS: "TRAM_STOJ",
        Piesi_Przejscia: "CZERWONE",
      },
    },
    {
      id: "q2",
      duration_ms: 2000,
      outputs: {
        Wlot_Zachod: "CZERWONE",
        Wlot_Wschod: "CZERWONE",
        Wlot_Poludnie: "CZERWONE_ZOLTE",
        Wlot_Polnoc: "CZERWONE_ZOLTE",
        Tramwaj_Linia_WE: "TRAM_STOJ",
        Tramwaj_Linia_NS: "TRAM_STOJ",
        Piesi_Przejscia: "CZERWONE",
      },
    },
    {
      id: "q3",
      duration_ms: 22000,
      outputs: {
        Wlot_Zachod: "CZERWONE",
        Wlot_Wschod: "CZERWONE",
        Wlot_Poludnie: "ZIELONE",
        Wlot_Polnoc: "ZIELONE",
        Tramwaj_Linia_WE: "TRAM_STOJ",
        Tramwaj_Linia_NS: "TRAM_JAZDA",
        Piesi_Przejscia: "CZERWONE",
      },
    },
    {
      id: "q4",
      duration_ms: 3000,
      outputs: {
        Wlot_Zachod: "CZERWONE",
        Wlot_Wschod: "CZERWONE",
        Wlot_Poludnie: "ZOLTE",
        Wlot_Polnoc: "ZOLTE",
        Tramwaj_Linia_WE: "TRAM_STOJ",
        Tramwaj_Linia_NS: "TRAM_UWAGA",
        Piesi_Przejscia: "CZERWONE",
      },
    },
    {
      id: "q5",
      duration_ms: 15000,
      outputs: {
        Wlot_Zachod: "CZERWONE",
        Wlot_Wschod: "CZERWONE",
        Wlot_Poludnie: "CZERWONE",
        Wlot_Polnoc: "CZERWONE",
        Tramwaj_Linia_WE: "TRAM_STOJ",
        Tramwaj_Linia_NS: "TRAM_STOJ",
        Piesi_Przejscia: "ZIELONE",
      },
    },
    {
      id: "q6",
      duration_ms: 3000,
      outputs: {
        Wlot_Zachod: "CZERWONE_ZOLTE",
        Wlot_Wschod: "CZERWONE_ZOLTE",
        Wlot_Poludnie: "CZERWONE",
        Wlot_Polnoc: "CZERWONE",
        Tramwaj_Linia_WE: "TRAM_STOJ",
        Tramwaj_Linia_NS: "TRAM_STOJ",
        Piesi_Przejscia: "CZERWONE",
      },
    },
  ],
};

type Car = {
  id: string;
  role: string;
  entry: string;
  progress: number;
  speed: number;
  stopProgress: number;
  spawnHold: number;
  waitTimer: number;
  path: ReturnType<typeof createRoundaboutRoute>;
  ringR: number;
};

function buildCars(): Car[] {
  return L.vehicles.map((v) => {
    const steps = ccwSteps(v.entry, v.exit);
    const path = createRoundaboutRoute(
      L.cx,
      L.cy,
      v.ringR,
      v.exitRingR ?? ringLaneForExit(steps, L.ringLanes),
      v.entry,
      v.exit,
      {
        lane: Math.abs(v.laneOffset),
        approachDist: ARM_RUN,
        exitDist: ARM_RUN,
        approachRingR: L.ringOuter,
      },
    );
    const stop = L.stops.find((s) => s.dir === v.entry)!;
    return {
      id: v.id,
      role: v.role,
      entry: v.entry,
      progress: 0,
      speed: v.speed,
      stopProgress: path.progressAtStop(
        stopPredicate(v.entry, L.cx, L.cy, L.ringOuter, stop.out, 18),
      ),
      spawnHold: v.spawnDelay ?? 0,
      waitTimer: 0,
      path,
      ringR: v.ringR,
    };
  });
}

function tick(cars: Car[], stateIndex: number) {
  const order = [...cars].sort((a, b) => b.progress - a.progress);
  const proposed = new Map<string, number>();
  for (const v of order) {
    if (v.spawnHold > 0) {
      v.spawnHold -= DT;
      proposed.set(v.id, v.progress);
      continue;
    }
    const canDrive = isSignalGreen(resolveSignal(DFA, stateIndex, v.role));
    const step = (v.speed / Math.max(v.path.length, 1)) * DT;
    const nowPose = v.path.sample(Math.min(1, v.progress));
    const lookPose = v.path.sample(Math.min(1, v.progress + step * 4));
    const nowBox = aabbFromCenter(
      nowPose.x,
      nowPose.y,
      10,
      18,
      nowPose.angle - Math.PI / 2,
    );
    const lookBox = aabbFromCenter(
      lookPose.x,
      lookPose.y,
      11,
      20,
      lookPose.angle - Math.PI / 2,
    );
    const pastStop = v.progress > v.stopProgress + 0.02;
    const onRing = pastStop && v.progress < 0.78;
    const followGap = onRing ? 40 : 42;
    let followScale = 1;
    const blocked = cars.some((o) => {
      if (o.id === v.id) return false;
      const oProg = proposed.get(o.id) ?? o.progress;
      const os = o.path.sample(Math.min(1, oProg));
      const dist = Math.hypot(nowPose.x - os.x, nowPose.y - os.y);
      if (dist > followGap + 12) return false;
      const oBox = aabbFromCenter(os.x, os.y, 10, 18, os.angle - Math.PI / 2);
      const fx = Math.cos(nowPose.angle);
      const fy = Math.sin(nowPose.angle);
      const ahead = (os.x - nowPose.x) * fx + (os.y - nowPose.y) * fy;
      const oAhead =
        (nowPose.x - os.x) * Math.cos(os.angle) +
        (nowPose.y - os.y) * Math.sin(os.angle);
      const relLead = ahead - oAhead;
      const shouldYieldToO =
        relLead > 1 || (Math.abs(relLead) <= 1 && v.id < o.id);
      const side = Math.abs(-(os.x - nowPose.x) * fy + (os.y - nowPose.y) * fx);
      if (o.entry === v.entry && side > 16 && Math.abs(ahead) < 14)
        return false;
      if (aabbOverlap(nowBox, oBox) && side < 15) return shouldYieldToO;
      if (relLead < -2 || ahead < -2) return false;
      if (side > (onRing ? 28 : 20)) return false;
      if (aabbOverlap(lookBox, oBox) && shouldYieldToO) return true;
      if (o.entry === v.entry && ahead > 8 && dist < followGap && side < 14)
        return shouldYieldToO;
      if (onRing && ahead > 0 && side < 22 && dist < followGap + 8) {
        const myR = Math.hypot(nowPose.x - L.cx, nowPose.y - L.cy);
        const myLookR = Math.hypot(lookPose.x - L.cx, lookPose.y - L.cy);
        const oR = Math.hypot(os.x - L.cx, os.y - L.cy);
        if (Math.abs(myR - oR) > 18 && Math.abs(myLookR - oR) > 16) {
          followScale = Math.min(followScale, 0.75);
          return false;
        }
        if (shouldYieldToO) {
          followScale = Math.min(
            followScale,
            Math.max(0.15, (dist - 14) / (followGap + 8)),
          );
          if (dist < 26) return true;
        }
        return false;
      }
      if (
        shouldYieldToO &&
        ahead > 6 &&
        side < (onRing ? 15 : 12) &&
        dist < followGap
      ) {
        followScale = Math.min(
          followScale,
          Math.max(0.3, (dist - 12) / followGap),
        );
        return dist < 18;
      }
      return false;
    });
    let next = v.progress;
    if (!blocked) {
      const move = step * followScale;
      if (!canDrive && !pastStop) {
        next =
          v.progress < v.stopProgress - 0.004
            ? Math.min(v.stopProgress, v.progress + move)
            : v.stopProgress;
      } else next = v.progress + move;
    }
    if (next >= 1) {
      v.waitTimer += DT;
      if (v.waitTimer > 2.2) {
        next = 0;
        v.waitTimer = 0;
        v.spawnHold = 0.8;
      } else next = 1;
    }
    proposed.set(v.id, next);
  }
  for (const v of cars) v.progress = proposed.get(v.id) ?? v.progress;
}

function hitNlSr(cars: Car[], useFilter: boolean): boolean {
  const nL = cars.find((c) => c.id === "nL")!;
  const sR = cars.find((c) => c.id === "sR")!;
  const a = nL.path.sample(Math.min(1, nL.progress));
  const b = sR.path.sample(Math.min(1, sR.progress));
  const ba = aabbFromCenter(a.x, a.y, 10, 18, a.angle - Math.PI / 2);
  const bb = aabbFromCenter(b.x, b.y, 10, 18, b.angle - Math.PI / 2);
  if (!aabbOverlap(ba, bb)) return false;
  if (!useFilter) return true;
  const fx = Math.cos(a.angle);
  const fy = Math.sin(a.angle);
  const side = Math.abs(-(b.x - a.x) * fy + (b.y - a.y) * fx);
  const ahead = (b.x - a.x) * fx + (b.y - a.y) * fy;
  const ra = Math.hypot(a.x - L.cx, a.y - L.cy);
  const rb = Math.hypot(b.x - L.cx, b.y - L.cy);
  if (Math.abs(ra - rb) > 18 && side > 14) return false;
  if (side > 24 && Math.abs(ahead) < 36) return false;
  return true;
}

function runOnce(label: string) {
  const cars = buildCars();
  let stateIndex = 0;
  let stateRemaining = (DFA.states[0].duration_ms || 1000) / 1000;
  let streak = 0;
  let firstHit: null | {
    t: number;
    rem: number;
    step: number;
    nL: { p: number; x: number; y: number; r: number };
    sR: { p: number; x: number; y: number; r: number };
    side: number;
    dist: number;
  } = null;

  const totalSteps = Math.floor(160 / DT); // >2 cykle
  for (let i = 0; i < totalSteps; i++) {
    stateRemaining -= DT;
    if (stateRemaining <= 0) {
      stateIndex = (stateIndex + 1) % DFA.states.length;
      stateRemaining = (DFA.states[stateIndex].duration_ms || 1000) / 1000;
    }
    tick(cars, stateIndex);

    const raw = hitNlSr(cars, false);
    const filtered = hitNlSr(cars, true);
    if (raw) {
      streak += 1;
      if (!firstHit || streak === 3) {
        const nL = cars.find((c) => c.id === "nL")!;
        const sR = cars.find((c) => c.id === "sR")!;
        const a = nL.path.sample(Math.min(1, nL.progress));
        const b = sR.path.sample(Math.min(1, sR.progress));
        const fx = Math.cos(a.angle);
        const fy = Math.sin(a.angle);
        const side = Math.abs(-(b.x - a.x) * fy + (b.y - a.y) * fx);
        firstHit = {
          t: i * DT,
          rem: stateRemaining,
          step: stateIndex + 1,
          nL: {
            p: nL.progress,
            x: a.x,
            y: a.y,
            r: Math.hypot(a.x - L.cx, a.y - L.cy),
          },
          sR: {
            p: sR.progress,
            x: b.x,
            y: b.y,
            r: Math.hypot(b.x - L.cx, b.y - L.cy),
          },
          side,
          dist: Math.hypot(a.x - b.x, a.y - b.y),
        };
        if (streak === 3) {
          console.log(
            `[${label}] HIT streak=3 @ t=${firstHit.t.toFixed(2)}s step=${firstHit.step}/7 rem=${firstHit.rem.toFixed(1)}s`,
          );
          console.log(
            `  nL p=${firstHit.nL.p.toFixed(3)} (${firstHit.nL.x.toFixed(0)},${firstHit.nL.y.toFixed(0)}) R=${firstHit.nL.r.toFixed(1)}`,
          );
          console.log(
            `  sR p=${firstHit.sR.p.toFixed(3)} (${firstHit.sR.x.toFixed(0)},${firstHit.sR.y.toFixed(0)}) R=${firstHit.sR.r.toFixed(1)}`,
          );
          console.log(
            `  dist=${firstHit.dist.toFixed(1)} side=${firstHit.side.toFixed(1)} filteredWouldPause=${filtered}`,
          );
          return { hit: true, filtered, firstHit };
        }
      }
    } else streak = 0;
  }
  console.log(`[${label}] no nL×sR streak≥3 in 160s`);
  return { hit: false, filtered: false, firstHit };
}

console.log("=== pass 1 (first compile/run) ===");
const a = runOnce("1");
console.log("=== pass 2 (second run, fresh cars) ===");
const b = runOnce("2");
if (a.hit || b.hit) {
  console.error("REPRODUCED nL×sR");
  process.exit(2);
}
console.log("NO REPRO under headless yield rules");
