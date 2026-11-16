/**
 * Śledzi powody zatrzymań aut na pierścieniu przez cykl Czyżyńskiego.
 * Uproszczona kopia reguł SimRuntime (tram corridor / ped / car-follow / red).
 * npx --yes tsx scripts/auditStops.ts
 */
import { AUTORSKIE } from "../src/sim/layouts/autorskieRondo";
import {
  createRoundaboutRoute,
  ccwSteps,
  ringLaneForExit,
  stopPredicate,
} from "../src/sim/paths/roundaboutRoute";
import { aabbFromCenter, aabbOverlap } from "../src/sim/collision";
import { isSignalGreen, resolveSignal, type DfaModel } from "../src/sim/signals";

const L = AUTORSKIE;
const DT = 1 / 20;

/** Cykl jak w examples/rondo_autorskie.traffic (skrócone nazwy → role). */
const DFA: DfaModel = {
  name: "rondo_autorskie",
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
  exit: string;
  progress: number;
  speed: number;
  stopProgress: number;
  spawnHold: number;
  path: ReturnType<typeof createRoundaboutRoute>;
};

function buildCars(): Car[] {
  return L.vehicles.map((v) => {
    const steps = ccwSteps(v.entry, v.exit);
    const exitR = v.exitRingR ?? ringLaneForExit(steps, L.ringLanes);
    const path = createRoundaboutRoute(L.cx, L.cy, v.ringR, exitR, v.entry, v.exit, {
      lane: Math.abs(v.laneOffset),
      approachDist: 420,
      exitDist: 420,
      approachRingR: L.ringOuter,
    });
    const stop = L.stops.find((s) => s.dir === v.entry)!;
    return {
      id: v.id,
      role: v.role,
      entry: v.entry,
      exit: v.exit,
      progress: 0,
      speed: v.speed, // px/s
      stopProgress: path.progressAtStop(
        stopPredicate(v.entry, L.cx, L.cy, L.ringOuter, stop.out, 18),
      ),
      spawnHold: v.spawnDelay ?? 0,
      path,
    };
  });
}

const reasonCount = new Map<string, number>();
const ringStops = new Map<string, number>(); // id → frames stopped on ring
const byState = new Map<string, Map<string, number>>();

function bump(map: Map<string, number>, k: string, n = 1) {
  map.set(k, (map.get(k) || 0) + n);
}

function main() {
  const cars = buildCars();
  let stateIndex = 0;
  let stateLeft = (DFA.states[0].duration_ms || 1000) / 1000;
  // Uproszczone tram progress
  let tramEW = 0.05;
  let tramWE = 0.92;
  let tramNS = 0.08;
  let tramSN = 0.94;
  let tramTurn = -0.25;
  const HOLD_LO = 0.12;
  const HOLD_HI = 0.88;
  const totalT = 73 * 2; // 2 pełne cykle
  let tSim = 0;

  while (tSim < totalT) {
    stateLeft -= DT;
    if (stateLeft <= 0) {
      stateIndex = (stateIndex + 1) % DFA.states.length;
      stateLeft = (DFA.states[stateIndex].duration_ms || 1000) / 1000;
    }
    const stId = DFA.states[stateIndex].id || `q${stateIndex}`;
    const weGo = isSignalGreen(resolveSignal(DFA, stateIndex, "TRAM_WE"));
    const nsGo = isSignalGreen(resolveSignal(DFA, stateIndex, "TRAM_NS"));
    const pedGo = isSignalGreen(resolveSignal(DFA, stateIndex, "PEDESTRIAN"));

    // tram advance (jak SimRuntime, bez carOn*)
    const stepTram = DT * 0.18;
    const adv = (t: number, dir: 1 | -1, may: boolean) => {
      const inJ = t > 0.42 && t < 0.58;
      const committed = dir > 0 ? t > HOLD_LO + 0.01 : t < HOLD_HI - 0.01;
      if (may || inJ || committed) {
        let n = t + dir * stepTram;
        if (dir > 0 && n > 1.15) n = -0.15;
        if (dir < 0 && n < -0.15) n = 1.15;
        return n;
      }
      const n = t + dir * stepTram;
      return dir > 0 ? Math.min(n, HOLD_LO) : Math.max(n, HOLD_HI);
    };
    tramEW = adv(tramEW, 1, weGo);
    tramWE = adv(tramWE, -1, weGo);
    tramNS = adv(tramNS, 1, nsGo);
    tramSN = adv(tramSN, -1, nsGo);
    if (weGo) {
      if (tramTurn < 0) tramTurn = 0.02;
      tramTurn += stepTram * 0.9;
      if (tramTurn > 1.15) tramTurn = -0.4;
    }

    // Jak SimRuntime
    const tramBody = (t: number) => t > 0.38 && t < 0.62;
    const nsThreat =
      tramBody(tramNS) ||
      tramBody(tramSN) ||
      (nsGo && tramNS > HOLD_LO - 0.02 && tramNS < HOLD_LO + 0.05);
    const weThreat =
      tramBody(tramEW) ||
      tramBody(tramWE) ||
      (weGo && tramEW > HOLD_LO - 0.02 && tramEW < HOLD_LO + 0.05);
    const turnHot = tramTurn > 0.4 && tramTurn < 0.6;

    const order = [...cars].sort((a, b) => b.progress - a.progress);
    const proposed = new Map<string, number>();

    for (const v of order) {
      if (v.spawnHold > 0) {
        v.spawnHold -= DT;
        proposed.set(v.id, v.progress);
        bump(reasonCount, "spawnHold");
        continue;
      }
      const canDrive = isSignalGreen(resolveSignal(DFA, stateIndex, v.role));
      const step = (v.speed / Math.max(v.path.length, 1)) * DT;
      let reason = "move";
      let next = v.progress;
      const lookProg = Math.min(1, v.progress + step * 4);
      const lookPose = v.path.sample(lookProg);
      const nowPose = v.path.sample(Math.min(1, v.progress));
      const nowBox = aabbFromCenter(nowPose.x, nowPose.y, 14, 26, nowPose.angle - Math.PI / 2);
      const lookBox = aabbFromCenter(lookPose.x, lookPose.y, 14, 26, lookPose.angle - Math.PI / 2);

      let tramCorridor = false;
      for (let tt = v.progress; tt <= Math.min(1, v.progress + 0.055); tt += 0.012) {
        const p = v.path.sample(tt);
        const nearNS = Math.abs(p.x - L.cx) < 28;
        const nearWE = Math.abs(p.y - L.cy) < 28;
        const inSw = p.x < L.cx - 28 && p.y > L.cy + 28;
        if ((nearNS && nsThreat) || (nearWE && weThreat) || (turnHot && inSw)) {
          tramCorridor = true;
          break;
        }
      }

      const onRing = v.progress > v.stopProgress + 0.02 && v.progress < 0.78;
      const followGap = onRing ? 56 : 44;
      const wouldHitCar = cars.some((o) => {
        if (o.id === v.id) return false;
        const oProg = proposed.get(o.id) ?? o.progress;
        if (oProg === 0 && o.spawnHold > 0 && v.progress === 0) return false;
        const os = o.path.sample(Math.min(1, oProg));
        const dist = Math.hypot(lookPose.x - os.x, lookPose.y - os.y);
        if (dist > followGap + 8) return false;
        const oBox = aabbFromCenter(os.x, os.y, 12, 22, os.angle - Math.PI / 2);
        if (aabbOverlap(lookBox, oBox) || aabbOverlap(nowBox, oBox)) return true;
        const fx = Math.cos(lookPose.angle);
        const fy = Math.sin(lookPose.angle);
        const ahead = (os.x - lookPose.x) * fx + (os.y - lookPose.y) * fy;
        if (ahead < 1) return false;
        const side = Math.abs(-(os.x - lookPose.x) * fy + (os.y - lookPose.y) * fx);
        if (side > (onRing ? 30 : 22)) return false;
        if (o.entry === v.entry && dist < followGap) return true;
        return side < (onRing ? 26 : 18);
      });

      const pastStop = v.progress > v.stopProgress + 0.02;
      const beforeStop = v.progress <= v.stopProgress + 0.02;
      const nearExit = v.progress >= 0.72;
      // Uproszczenie pieszych: w fazie ZIELONE blokuj wlot/zjazd (jak pedBlocksVehicle)
      const pedBlock = pedGo && (beforeStop || nearExit);

      if (tramCorridor) reason = "tramCorridor";
      else if (wouldHitCar) reason = "carFollow";
      else if (pedBlock) reason = "pedEntry";
      else if (!canDrive && !pastStop) {
        if (v.progress < v.stopProgress - 0.004) reason = "approachRed";
        else reason = "stopLineRed";
      } else if (!canDrive && pastStop) reason = "clearingRed";
      else reason = "move";

      // Czerwone wlotu NIE blokuje po przekroczeniu linii stop (jak SimRuntime)
      const blocked =
        reason === "tramCorridor" || reason === "carFollow" || reason === "pedEntry";

      if (blocked) {
        next = v.progress;
      } else if (reason === "approachRed") {
        next = Math.min(v.stopProgress, v.progress + step * 0.85);
      } else if (reason === "stopLineRed") {
        next = v.stopProgress;
      } else {
        next = v.progress + step;
      }

      if (next >= 1) next = 0;

      // stop na pierścieniu
      if (onRing && Math.abs(next - v.progress) < 1e-9) {
        bump(ringStops, v.id);
        const key = `${stId}|${reason}`;
        if (!byState.has(stId)) byState.set(stId, new Map());
        bump(byState.get(stId)!, reason);
        bump(reasonCount, `RING:${reason}`);
      } else {
        bump(reasonCount, reason);
      }

      proposed.set(v.id, next);
    }
    for (const v of cars) v.progress = proposed.get(v.id) ?? v.progress;
    tSim += DT;
  }

  console.log("======= POWODY (wszystkie ticki) =======");
  [...reasonCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => console.log(`${n.toString().padStart(6)}  ${k}`));

  console.log("\n======= STOPY NA PIERŚCIENIU per auto =======");
  [...ringStops.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, n]) => console.log(`${n.toString().padStart(6)}  ${id}`));

  console.log("\n======= STOPY NA PIERŚCIENIU per stan cyklu =======");
  for (const st of DFA.states) {
    const id = st.id || "?";
    const m = byState.get(id);
    if (!m) {
      console.log(`${id}: (brak)`);
      continue;
    }
    const parts = [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([r, n]) => `${r}:${n}`)
      .join(", ");
    console.log(`${id}: ${parts}`);
  }
}

main();
