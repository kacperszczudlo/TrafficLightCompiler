/**
 * Audyt tras ronda: spirala pasów, fillet zjazdu, kierunkowskazy, skoki kąta.
 * npx --yes tsx scripts/auditRoutes.ts
 */
import { AUTORSKIE } from "../src/sim/layouts/autorskieRondo";
import {
  createRoundaboutRoute,
  ccwSteps,
  ringLaneForExit,
  stopPredicate,
} from "../src/sim/paths/roundaboutRoute";

const L = AUTORSKIE;
const notes: string[] = [];
const fails: string[] = [];

type Row = {
  id: string;
  entry: string;
  exit: string;
  steps: number;
  entryR: number;
  exitR: number;
  stopP: number;
};

const rows: Row[] = [];

for (const v of L.vehicles) {
  const steps = ccwSteps(v.entry, v.exit);
  const exitR = v.exitRingR ?? ringLaneForExit(steps, L.ringLanes);
  const path = createRoundaboutRoute(L.cx, L.cy, v.ringR, exitR, v.entry, v.exit, {
    lane: Math.abs(v.laneOffset),
    approachDist: 420,
    exitDist: 420,
    approachRingR: L.ringOuter,
  });
  const stop = L.stops.find((s) => s.dir === v.entry)!;
  const stopP = path.progressAtStop(
    stopPredicate(v.entry, L.cx, L.cy, L.ringOuter, stop.out, 18),
  );
  rows.push({
    id: v.id,
    entry: v.entry,
    exit: v.exit,
    steps,
    entryR: v.ringR,
    exitR,
    stopP: +stopP.toFixed(3),
  });

  // Próbkuj trasę
  let maxJump = 0;
  let maxDr = 0;
  let prevAng: number | null = null;
  let prevR: number | null = null;
  const blinkWindows: { t: number; b: string; r: number }[] = [];
  let onRingMinR = 999;
  let onRingMaxR = 0;
  let exitFilletWeird = false;

  for (let t = 0; t <= 1.0001; t += 0.01) {
    const s = path.sample(Math.min(1, t));
    const r = Math.hypot(s.x - L.cx, s.y - L.cy);
    if (prevAng != null) {
      let d = Math.abs(s.angle - prevAng);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d > maxJump) maxJump = d;
    }
    if (prevR != null && Math.abs(r - prevR) > maxDr) maxDr = Math.abs(r - prevR);
    prevAng = s.angle;
    prevR = r;
    if (t > 0.32 && t < 0.68) {
      onRingMinR = Math.min(onRingMinR, r);
      onRingMaxR = Math.max(onRingMaxR, r);
    }
    if (s.blinker !== "none") blinkWindows.push({ t: +t.toFixed(2), b: s.blinker, r: +r.toFixed(1) });
    // Zjazd: po łuku (t>~0.68) promień powinien rosnąć poza pierścień, nie wracać w wyspę
    if (t > 0.68 && t < 0.9 && r < L.islandR + 20) exitFilletWeird = true;
  }

  const expectedExitR = exitR;
  const spiralOk =
    Math.abs(onRingMinR - Math.min(v.ringR, exitR)) < 12 &&
    Math.abs(onRingMaxR - Math.max(v.ringR, exitR)) < 12;

  console.log(
    `\n=== ${v.id} ${v.entry}→${v.exit} steps=${steps} R ${v.ringR}→${exitR} stop@${stopP.toFixed(3)} ===`,
  );
  console.log(
    `  ringR span ~${onRingMinR.toFixed(0)}..${onRingMaxR.toFixed(0)} (expect ~${Math.min(v.ringR, expectedExitR)}..${Math.max(v.ringR, expectedExitR)}) spiralOk=${spiralOk}`,
  );
  console.log(`  maxAngleJump=${((maxJump * 180) / Math.PI).toFixed(1)}° maxΔr/step=${maxDr.toFixed(1)}`);
  console.log(
    `  blinkers: ${
      blinkWindows.length
        ? blinkWindows
            .filter((_, i) => i % 5 === 0)
            .map((b) => `${b.t}:${b.b}`)
            .join(" ")
        : "(brak)"
    }`,
  );

  // Policy PL: zjazd w prawo z prawego (zewn.) pasa; 1. zjazd ≈ outer; 3/4 ≈ outer po spirali
  if (steps === 1 && Math.abs(exitR - L.ringLanes[0]) > 5) {
    fails.push(`${v.id}: 1. zjazd powinien być z pasa zewn. (exitR=${exitR})`);
  }
  if (steps === 2 && v.ringR === L.ringLanes[0] && exitR < v.ringR - 10) {
    notes.push(
      `${v.id}: 2. zjazd spirala zewn→środek (${v.ringR}→${exitR}) — OK jeśli przed zjazdem wraca na zewn; sprawdź fillet`,
    );
  }
  if (steps === 2 && exitR === L.ringLanes[1] && v.ringR === L.ringLanes[2]) {
    notes.push(`${v.id}: 2. zjazd z wewn→środek — przed zjazdem brak wymuszenia pasa prawego (zewn.)`);
  }
  if (maxJump > 0.55) {
    fails.push(
      `${v.id}: skok kąta ${(maxJump * 180 / Math.PI).toFixed(0)}° (fillet wejścia/zjazdu)`,
    );
  }
  if (exitFilletWeird) {
    fails.push(`${v.id}: fillet zjazdu wchodzi w wyspę / za blisko centrum`);
  }
  if (!spiralOk && Math.abs(v.ringR - exitR) > 8) {
    notes.push(`${v.id}: spirala nie pokrywa pełnego zakresu entryR→exitR na środku łuku`);
  }

  // Kierunkowskaz: przy zmianie pasa w lewo (r maleje) powinien być left; zjazd right
  const hasLeft = blinkWindows.some((b) => b.b === "left");
  const hasRight = blinkWindows.some((b) => b.b === "right");
  if (exitR < v.ringR - 5 && !hasLeft) {
    fails.push(`${v.id}: spadek R bez kierunkowskazu LEFT`);
  }
  if (steps >= 1 && !hasRight) {
    notes.push(`${v.id}: brak RIGHT przed zjazdem (steps=${steps})`);
  }
  if (hasLeft && hasRight) {
    const firstL = blinkWindows.find((b) => b.b === "left")!.t;
    const firstR = blinkWindows.find((b) => b.b === "right")!.t;
    if (firstR < firstL) notes.push(`${v.id}: RIGHT wcześniej niż LEFT (${firstR}<${firstL}) — podejrzane`);
  }
}

console.log("\n======= TABELA =======");
console.table(rows);

console.log("\n======= NOTATKI =======");
notes.forEach((n) => console.log("NOTE:", n));
console.log("\n======= FAIL =======");
fails.forEach((f) => console.log("FAIL:", f));
console.log(`\nsummary notes=${notes.length} fails=${fails.length}`);
if (fails.length) process.exit(1);
