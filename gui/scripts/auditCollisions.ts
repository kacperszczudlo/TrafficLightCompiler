/**
 * Pełny cykl: loguje KAŻDĄ kolizję AABB (auto×auto, auto×tram, auto×pociąg).
 * Uruchamia ponownie i wypisuje pary do naprawy.
 * npx --yes tsx scripts/auditCollisions.ts
 */
import { AUTORSKIE } from "../src/sim/layouts/autorskieRondo";
import { RAIL_X, RAIL_STOP } from "../src/sim/layouts/autorskieRondo";
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
const DT = 1 / 30;
const SECONDS = 200; // >2 pełne cykle (~73s) — łapie kolizje po restarcie q0
const ARM_RUN = 420;

const DFA: DfaModel = {
  name: "audit",
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
        approachDist: ARM_RUN,
        exitDist: ARM_RUN,
        approachRingR: L.ringOuter,
      },
    );
    const stop = L.stops.find((s) => s.dir === v.entry)!;
    const pred = stopPredicate(v.entry, L.cx, L.cy, L.ringOuter, stop.out, 18);
    return {
      id: v.id,
      role: v.role,
      entry: v.entry,
      progress: 0,
      speed: v.speed,
      stopProgress: path.progressAtStop(pred),
      waitTimer: 0,
      spawnHold: v.spawnDelay ?? 0,
      path,
    };
  });
}

function mapX(t: number) {
  const MX = 240;
  return -MX + t * (L.width + 2 * MX);
}
function mapY(t: number) {
  const MY = 200;
  return -MY + t * (L.height + 2 * MY);
}
function trainY(t: number) {
  const M = 180;
  return -M + t * (L.height + 2 * M);
}

type HitLog = {
  frame: number;
  t: number;
  pair: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
};

function main() {
  const cars = buildCars();
  let stateIndex = 0;
  let stateRemaining = (DFA.states[0].duration_ms || 1000) / 1000;
  let tramEW = 0.02;
  let tramWE = 0.98;
  let tramNS = 0.04;
  let tramSN = 0.96;
  let trainT = -0.5;
  let barriersDown = false;

  const logs: HitLog[] = [];
  const pairFrames = new Map<string, number>();
  const steps = Math.floor(SECONDS / DT);

  for (let frame = 0; frame < steps; frame++) {
    stateRemaining -= DT;
    if (stateRemaining <= 0) {
      stateIndex = (stateIndex + 1) % DFA.states.length;
      stateRemaining = (DFA.states[stateIndex].duration_ms || 1000) / 1000;
    }
    const weGo = isSignalGreen(resolveSignal(DFA, stateIndex, "TRAM_WE"));
    const nsGo = isSignalGreen(resolveSignal(DFA, stateIndex, "TRAM_NS"));
    const HOLD_LO = 0.05;
    const HOLD_HI = 0.95;
    const tramStep = DT * 0.16;
    const inJ = (t: number) => t > 0.42 && t < 0.58;
    const carBlockingTram = (
      axis: "we" | "ns",
      t: number,
      dir: 1 | -1,
    ): boolean => {
      const tx = axis === "we" ? mapX(t) : L.cx + (dir > 0 ? 9.5 : -9.5);
      const ty = axis === "we" ? L.cy + (dir > 0 ? 9.5 : -9.5) : mapY(t);
      return cars.some((v) => {
        if (v.progress <= v.stopProgress - 0.01 || v.progress >= 0.9)
          return false;
        const s = v.path.sample(Math.min(1, v.progress));
        if (Math.hypot(s.x - L.cx, s.y - L.cy) > L.ringOuter + 28) return false;
        if (axis === "we") {
          const ahead = (s.x - tx) * dir;
          return Math.abs(s.y - L.cy) < 21.5 && ahead > 32 && ahead < 84;
        } else {
          const ahead = (s.y - ty) * dir;
          return Math.abs(s.x - L.cx) < 21.5 && ahead > 32 && ahead < 84;
        }
      });
    };
    const advance = (
      axis: "we" | "ns",
      t: number,
      dir: 1 | -1,
      may: boolean,
    ) => {
      if (carBlockingTram(axis, t, dir)) return t;
      const atRailHold = axis === "we" && dir > 0 && t > 0.13 && t < 0.22;
      const committed =
        !atRailHold && (dir > 0 ? t > HOLD_LO + 0.01 : t < HOLD_HI - 0.01);
      if (may || inJ(t) || committed) {
        let n = t + dir * tramStep;
        if (dir > 0 && n > 1.2) n = -0.2;
        if (dir < 0 && n < -0.2) n = 1.2;
        return n;
      }
      const n = t + dir * tramStep;
      if (atRailHold) return t;
      return dir > 0 ? Math.min(n, HOLD_LO) : Math.max(n, HOLD_HI);
    };
    const carOnWe = cars.some((v) => {
      if (v.progress <= v.stopProgress || v.progress >= 0.9) return false;
      const s = v.path.sample(Math.min(1, v.progress));
      return (
        Math.abs(s.y - L.cy) < 30 && Math.abs(s.x - L.cx) < L.ringOuter + 20
      );
    });
    const carOnNs = cars.some((v) => {
      if (v.progress <= v.stopProgress || v.progress >= 0.9) return false;
      const s = v.path.sample(Math.min(1, v.progress));
      return (
        Math.abs(s.x - L.cx) < 30 && Math.abs(s.y - L.cy) < L.ringOuter + 20
      );
    });
    tramEW = advance(
      "we",
      tramEW,
      1,
      weGo && !carOnWe && !inJ(tramNS) && !inJ(tramSN),
    );
    tramWE = advance(
      "we",
      tramWE,
      -1,
      weGo && !carOnWe && !inJ(tramNS) && !inJ(tramSN),
    );
    tramNS = advance(
      "ns",
      tramNS,
      1,
      nsGo && !carOnNs && !inJ(tramEW) && !inJ(tramWE),
    );
    tramSN = advance(
      "ns",
      tramSN,
      -1,
      nsGo && !carOnNs && !inJ(tramEW) && !inJ(tramWE),
    );

    trainT += DT * 0.09;
    if (trainT > 1.25) trainT = -0.45;
    const ty = trainY(trainT);
    const dist = Math.abs(ty - L.cy);
    const onApproach = trainT > -0.02 && trainT < 1.02;
    if (!barriersDown) barriersDown = onApproach && dist < 400;
    else barriersDown = onApproach && dist < 240;
    const railThreat = barriersDown || (onApproach && dist < 400);

    const tramBoxes: {
      id: string;
      x: number;
      y: number;
      box: ReturnType<typeof aabbFromCenter>;
    }[] = [];
    const pushTram = (
      id: string,
      t: number,
      x: number,
      y: number,
      ang: number,
    ) => {
      if (t < 0.08 || t > 0.92) return;
      tramBoxes.push({ id, x, y, box: aabbFromCenter(x, y, 40, 10, ang) });
    };
    pushTram("tram-EW", tramEW, mapX(tramEW), L.cy + 9.5, 0);
    pushTram("tram-WE", tramWE, mapX(tramWE), L.cy - 9.5, Math.PI);
    pushTram("tram-NS", tramNS, L.cx + 9.5, mapY(tramNS), Math.PI * 0.5);
    pushTram("tram-SN", tramSN, L.cx - 9.5, mapY(tramSN), -Math.PI * 0.5);

    const trainBox =
      trainT > 0.02 &&
      trainT < 0.98 &&
      Math.abs(ty - L.cy) < L.arms[0].halfWidth + 80
        ? aabbFromCenter(RAIL_X, ty, 22, 96, 0)
        : null;

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
      const carBox = aabbFromCenter(
        lookPose.x,
        lookPose.y,
        12,
        22,
        lookPose.angle - Math.PI / 2,
      );

      const inWeTrackNow =
        Math.abs(nowPose.y - L.cy) < 22.5 &&
        Math.hypot(nowPose.x - L.cx, nowPose.y - L.cy) < L.ringOuter + 20;
      const inNsTrackNow =
        Math.abs(nowPose.x - L.cx) < 22.5 &&
        Math.hypot(nowPose.x - L.cx, nowPose.y - L.cy) < L.ringOuter + 20;
      const wouldHitTram =
        !inWeTrackNow &&
        !inNsTrackNow &&
        tramBoxes.some((tb) => {
          if (Math.hypot(nowPose.x - tb.x, nowPose.y - tb.y) < 38) return true;
          if (Math.hypot(lookPose.x - tb.x, lookPose.y - tb.y) < 42)
            return true;
          return aabbOverlap(carBox, tb.box) || aabbOverlap(nowBox, tb.box);
        });
      const wouldHitTrain =
        !!trainBox &&
        (aabbOverlap(nowBox, trainBox) ||
          aabbOverlap(carBox, trainBox) ||
          Math.hypot(nowPose.x - RAIL_X, nowPose.y - ty) < 48);

      const ewX = mapX(tramEW);
      const weX = mapX(tramWE);
      const nsY = mapY(tramNS);
      const snY = mapY(tramSN);
      const ewActive = tramEW > 0.22 && tramEW < 0.78;
      const weActive = tramWE > 0.22 && tramWE < 0.78;
      const nsActive = tramNS > 0.18 && tramNS < 0.82;
      const snActive = tramSN > 0.18 && tramSN < 0.82;
      let tramCorridor = false;
      if (v.progress > v.stopProgress + 0.035 && v.progress < 0.78) {
        for (
          let t = v.progress + 0.008;
          t <= Math.min(1, v.progress + 0.06);
          t += 0.008
        ) {
          const p = v.path.sample(t);
          if (Math.hypot(p.x - L.cx, p.y - L.cy) > L.ringOuter + 8) continue;
          if (!inWeTrackNow && Math.abs(p.y - L.cy) < 21.5) {
            const ewNear = ewActive && p.x - ewX > -42 && p.x - ewX < 105;
            const weNear = weActive && weX - p.x > -42 && weX - p.x < 105;
            if (ewNear || weNear) {
              tramCorridor = true;
              break;
            }
          }
          if (!inNsTrackNow && Math.abs(p.x - L.cx) < 21.5) {
            const nsNear = nsActive && p.y - nsY > -42 && p.y - nsY < 105;
            const snNear = snActive && snY - p.y > -42 && snY - p.y < 105;
            if (nsNear || snNear) {
              tramCorridor = true;
              break;
            }
          }
        }
      }

      let railBlock = false;
      if (
        railThreat &&
        Math.abs(nowPose.y - L.cy) <= L.arms[0].halfWidth + 10
      ) {
        const westStop = RAIL_X - RAIL_STOP;
        const eastStop = RAIL_X + RAIL_STOP;
        const fx = Math.cos(nowPose.angle);
        if (!(nowPose.x > westStop + 2 && nowPose.x < eastStop - 2)) {
          if (
            fx > 0.2 &&
            nowPose.x <= westStop + 8 &&
            lookPose.x >= westStop - 30
          )
            railBlock = true;
          if (
            fx < -0.2 &&
            nowPose.x >= eastStop - 8 &&
            lookPose.x <= eastStop + 30
          )
            railBlock = true;
        }
      }

      const pastStop = v.progress > v.stopProgress + 0.02;
      const onRing = pastStop && v.progress < 0.78;
      const followGap = onRing ? 40 : 42;
      let followScale = 1;
      const wouldHitCar = cars.some((o) => {
        if (o.id === v.id) return false;
        const oProg = proposed.get(o.id) ?? o.progress;
        const os = o.path.sample(Math.min(1, oProg));
        const dist2 = Math.hypot(nowPose.x - os.x, nowPose.y - os.y);
        if (dist2 > followGap + 12) return false;
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
        const side = Math.abs(
          -(os.x - nowPose.x) * fy + (os.y - nowPose.y) * fx,
        );
        if (o.entry === v.entry && side > 16 && Math.abs(ahead) < 14)
          return false;
        if (aabbOverlap(nowBox, oBox) && side < 15) return shouldYieldToO;
        if (relLead < -2 || ahead < -2) return false;
        if (side > (onRing ? 28 : 20)) return false;
        if (
          (aabbOverlap(lookBox, oBox) || aabbOverlap(carBox, oBox)) &&
          shouldYieldToO
        )
          return true;
        if (o.entry === v.entry && ahead > 8 && dist2 < followGap && side < 14)
          return shouldYieldToO;
        if (onRing && ahead > 0 && side < 22 && dist2 < followGap + 8) {
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
              Math.max(0.15, (dist2 - 14) / (followGap + 8)),
            );
            if (dist2 < 26) return true;
          }
          return false;
        }
        if (
          shouldYieldToO &&
          ahead > 6 &&
          side < (onRing ? 15 : 12) &&
          dist2 < followGap
        ) {
          followScale = Math.min(
            followScale,
            Math.max(0.3, (dist2 - 12) / followGap),
          );
          return dist2 < 18;
        }
        return false;
      });

      const hard =
        wouldHitTram ||
        wouldHitTrain ||
        tramCorridor ||
        railBlock ||
        wouldHitCar;
      let next = v.progress;
      if (!hard) {
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

    // Detect hits
    const boxes = cars.map((v) => {
      const s = v.path.sample(Math.min(1, v.progress));
      return {
        id: v.id,
        entry: v.entry,
        x: s.x,
        y: s.y,
        angle: s.angle,
        box: aabbFromCenter(s.x, s.y, 10, 18, s.angle - Math.PI / 2),
      };
    });
    const report = (
      a: (typeof boxes)[0],
      b: {
        id: string;
        x: number;
        y: number;
        box: ReturnType<typeof aabbFromCenter>;
        entry?: string;
        angle?: number;
      },
    ) => {
      if (!aabbOverlap(a.box, b.box)) return;
      if (a.entry && a.entry === b.entry && b.angle != null) {
        const fx = Math.cos(a.angle);
        const fy = Math.sin(a.angle);
        const side = Math.abs(-(b.x - a.x) * fy + (b.y - a.y) * fx);
        const ahead = (b.x - a.x) * fx + (b.y - a.y) * fy;
        if (side > 16 && Math.abs(ahead) < 22) return;
      }
      if (b.id.startsWith("tram-") || b.id === "train") {
        if (Math.hypot(a.x - b.x, a.y - b.y) > 22) return;
      }
      const pair = `${a.id}×${b.id}`;
      pairFrames.set(pair, (pairFrames.get(pair) || 0) + 1);
      if (
        (pairFrames.get(pair) || 0) <= 3 ||
        (pairFrames.get(pair) || 0) % 30 === 0
      ) {
        logs.push({
          frame,
          t: frame * DT,
          pair,
          ax: a.x,
          ay: a.y,
          bx: b.x,
          by: b.y,
        });
      }
    };
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) report(boxes[i], boxes[j]);
    }
    for (const c of boxes) {
      for (const t of tramBoxes) report(c, t);
      if (trainBox) report(c, { id: "train", x: RAIL_X, y: ty, box: trainBox });
    }
  }

  const sustained = [...pairFrames.entries()]
    .filter(([, n]) => n >= 12)
    .sort((a, b) => b[1] - a[1]);
  console.log(
    `frames=${steps} uniquePairs=${pairFrames.size} sustained(≥12)=${sustained.length}`,
  );
  if (sustained.length) {
    console.log("\n=== SUSTAINED COLLISIONS ===");
    for (const [p, n] of sustained) {
      console.log(`  ${p.padEnd(28)} frames=${n}`);
    }
    console.log("\n=== SAMPLE LOG (first hits) ===");
    const seen = new Set<string>();
    for (const l of logs) {
      if (seen.has(l.pair)) continue;
      if (!sustained.some(([p]) => p === l.pair)) continue;
      seen.add(l.pair);
      console.log(
        `  t=${l.t.toFixed(2)}s ${l.pair} @ car(${l.ax.toFixed(0)},${l.ay.toFixed(0)}) other(${l.bx.toFixed(0)},${l.by.toFixed(0)})`,
      );
    }
    process.exit(2);
  }
  console.log("AUDIT COLLISIONS PASS — brak trwałych stłuczek w pełnym cyklu");
}

main();
