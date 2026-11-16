/**
 * Pełny cykl pociągu + rogatek (logika jak SimRuntime, bez Konvy).
 * Wykrywa deadlock (pociąg stoi >N s) i brak zamknięcia belki.
 * npx --yes tsx scripts/cycleRailCheck.ts
 */
import { AUTORSKIE, RAIL_X, RAIL_STOP } from "../src/sim/layouts/autorskieRondo";
import {
  createRoundaboutRoute,
  ccwSteps,
  ringLaneForExit,
  stopPredicate,
} from "../src/sim/paths/roundaboutRoute";
import { isSignalGreen, resolveSignal, type DfaModel } from "../src/sim/signals";

const L = AUTORSKIE;
const DT = 1 / 30;
const SECONDS = 90;
const ARM_RUN = 420;
const MX = 240;

const DFA: DfaModel = {
  name: "cycle",
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
  progress: number;
  speed: number;
  stopProgress: number;
  spawnHold: number;
  path: ReturnType<typeof createRoundaboutRoute>;
  railGateIn: number | null;
};

function mapX(t: number) {
  return -MX + t * (L.width + 2 * MX);
}
function trainY(t: number) {
  const M = 180;
  return -M + t * (L.height + 2 * M);
}

function main() {
  const cars: Car[] = L.vehicles.map((v) => {
    const steps = ccwSteps(v.entry, v.exit);
    const exitRingR = v.exitRingR ?? ringLaneForExit(steps, L.ringLanes);
    const path = createRoundaboutRoute(L.cx, L.cy, v.ringR, exitRingR, v.entry, v.exit, {
      lane: Math.abs(v.laneOffset),
      approachDist: ARM_RUN,
      exitDist: ARM_RUN,
      approachRingR: L.ringOuter,
    });
    const stop = L.stops.find((s) => s.dir === v.entry)!;
    const pred = stopPredicate(v.entry, L.cx, L.cy, L.ringOuter, stop.out, 18);
    const westGate = RAIL_X - RAIL_STOP;
    const start = path.sample(0);
    let railGateIn: number | null = null;
    if (start.x < westGate - 5) {
      railGateIn = path.progressAtStop(
        (p) => Math.abs(p.y - L.cy) < L.arms[0].halfWidth + 30 && p.x >= westGate - 32,
      );
    }
    return {
      id: v.id,
      role: v.role,
      progress: 0,
      speed: v.speed,
      stopProgress: path.progressAtStop(pred),
      spawnHold: v.spawnDelay ?? 0,
      path,
      railGateIn,
    };
  });

  let stateIndex = 0;
  let stateRemaining = (DFA.states[0].duration_ms || 1000) / 1000;
  let tramEW = 0.02;
  let tramWE = 0.98;
  let trainT = -0.5;
  let barriersDown = false;
  let trainCrossings = 0;
  let barrierCloseEvents = 0;
  let maxHoldStreak = 0;
  let holdStreak = 0;
  let lastTrainT = trainT;
  const steps = Math.floor(SECONDS / DT);
  const errs: string[] = [];

  const trapped = () => {
    const west = RAIL_X - RAIL_STOP;
    const east = RAIL_X + RAIL_STOP;
    const hw = L.arms[0].halfWidth;
    const onTracks = (x: number, y: number) =>
      x > west + 2 && x < east - 2 && Math.abs(y - L.cy) < hw + 14;
    if (
      cars.some((v) => {
        const s = v.path.sample(Math.min(1, v.progress));
        return onTracks(s.x, s.y);
      })
    )
      return true;
    for (const [t, y] of [
      [tramEW, L.cy + 9.5],
      [tramWE, L.cy - 9.5],
    ] as const) {
      if (t <= 0.02 || t >= 0.98) continue;
      const x = mapX(t);
      if (onTracks(x, y) || onTracks(x - 36, y) || onTracks(x + 36, y)) return true;
    }
    return false;
  };

  for (let frame = 0; frame < steps; frame++) {
    stateRemaining -= DT;
    if (stateRemaining <= 0) {
      stateIndex = (stateIndex + 1) % DFA.states.length;
      stateRemaining = (DFA.states[stateIndex].duration_ms || 1000) / 1000;
    }
    const weGo = isSignalGreen(resolveSignal(DFA, stateIndex, "TRAM_WE"));
    const HOLD_LO = 0.12;
    const HOLD_HI = 0.88;
    const tramStep = DT * 0.16;
    const advance = (t: number, dir: 1 | -1, may: boolean) => {
      const committed = dir > 0 ? t > HOLD_LO + 0.01 : t < HOLD_HI - 0.01;
      if (may || committed) {
        let n = t + dir * tramStep;
        if (dir > 0 && n > 1.2) n = -0.2;
        if (dir < 0 && n < -0.2) n = 1.2;
        return n;
      }
      const n = t + dir * tramStep;
      return dir > 0 ? Math.min(n, HOLD_LO) : Math.max(n, HOLD_HI);
    };

    const y = trainY(trainT);
    const dist = Math.abs(y - L.cy);
    const onApproach = trainT > -0.02 && trainT < 1.02;
    const wantClose = onApproach && dist < 520;
    const railThreat = barriersDown || wantClose;
    const isTrapped = trapped();

    // Tram clamp at rail (jak SimRuntime)
    const halfLen = 52;
    const spanX = L.width + 2 * MX;
    const westT = (RAIL_X - RAIL_STOP - halfLen + MX) / spanX;
    const eastT = (RAIL_X + RAIL_STOP + halfLen + MX) / spanX;
    const clampTram = (t: number, dir: 1 | -1, next: number) => {
      if (!railThreat) return next;
      const x = mapX(t);
      const west = RAIL_X - RAIL_STOP;
      const east = RAIL_X + RAIL_STOP;
      if (x > west - halfLen && x < east + halfLen) return next;
      if (dir > 0 && t <= westT + 0.02 && next > westT) return westT;
      if (dir < 0 && t >= eastT - 0.02 && next < eastT) return eastT;
      return next;
    };
    tramEW = clampTram(tramEW, 1, advance(tramEW, 1, weGo));
    tramWE = clampTram(tramWE, -1, advance(tramWE, -1, weGo));

    const wasDown = barriersDown;
    if (!wantClose) barriersDown = false;
    else if (isTrapped) barriersDown = false;
    else barriersDown = true;
    if (!wasDown && barriersDown) barrierCloseEvents += 1;

    const stopBeforeRoad = L.cy - L.arms[0].halfWidth - 100;
    const approachingRoad = onApproach && y < L.cy + 10;
    const holdTrain = approachingRoad && y > stopBeforeRoad - 30 && isTrapped;
    if (holdTrain) {
      holdStreak += 1;
      maxHoldStreak = Math.max(maxHoldStreak, holdStreak);
    } else {
      holdStreak = 0;
      const prev = trainT;
      trainT += DT * 0.09;
      if (trainT > 1.25) {
        trainT = -0.45;
        trainCrossings += 1;
      }
      // Crossing mid-road counts too
      if (prev < 0.5 && trainT >= 0.5) trainCrossings += 0; // counted on wrap
      lastTrainT = trainT;
    }

    // Cars crude: green drive + rail clamp
    for (const v of cars) {
      if (v.spawnHold > 0) {
        v.spawnHold -= DT;
        continue;
      }
      const canDrive = isSignalGreen(resolveSignal(DFA, stateIndex, v.role));
      const step = (v.speed / Math.max(v.path.length, 1)) * DT;
      let next = v.progress;
      const pastStop = v.progress > v.stopProgress + 0.02;
      if (!canDrive && !pastStop) {
        next =
          v.progress < v.stopProgress - 0.004
            ? Math.min(v.stopProgress, v.progress + step)
            : v.stopProgress;
      } else next = v.progress + step;
      if (railThreat && v.railGateIn != null && v.progress <= v.railGateIn + 0.012 && next > v.railGateIn) {
        next = v.railGateIn;
      }
      if (next >= 1) {
        next = 0;
        v.spawnHold = 0.5;
      }
      v.progress = next;
    }
  }

  console.log(
    `t=${SECONDS}s crossings≈${trainCrossings} barrierCloses=${barrierCloseEvents} maxHoldFrames=${maxHoldStreak} (~${(maxHoldStreak * DT).toFixed(1)}s) lastTrainT=${lastTrainT.toFixed(3)}`,
  );

  if (trainCrossings < 2) {
    errs.push(`pociąg za mało okrążeń (${trainCrossings}, expect ≥2 w ${SECONDS}s)`);
  }
  if (barrierCloseEvents < 2) {
    errs.push(`rogatki za rzadko się zamykały (${barrierCloseEvents})`);
  }
  if (maxHoldStreak > 30 * 8) {
    errs.push(`pociąg trzymany ${(maxHoldStreak * DT).toFixed(1)}s — możliwy deadlock`);
  }
  // Stuck: trainT never moved much from hold zone
  if (errs.length) {
    console.error("CYCLE RAIL FAIL");
    for (const e of errs) console.error(" -", e);
    process.exit(2);
  }
  console.log("CYCLE RAIL PASS — pociąg jeździ, rogatki się zamykają, brak deadlocka");
}

main();
