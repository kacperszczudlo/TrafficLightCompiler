/**
 * Macierz case'ów Czyżyńskiego: trasa, pas, stop, blinker (prawo/lewo), skok kąta.
 * npx --yes tsx scripts/caseMatrix.ts
 */
import { AUTORSKIE } from "../src/sim/layouts/autorskieRondo";
import {
  createRoundaboutRoute,
  ccwSteps,
  ringLaneForExit,
  stopPredicate,
  blinkerFor,
} from "../src/sim/paths/roundaboutRoute";

const L = AUTORSKIE;
const errs: string[] = [];

console.log("=== CASE MATRIX — pojazdy ===\n");
console.log(
  "id".padEnd(5),
  "entry→exit".padEnd(14),
  "steps",
  "lenPx",
  "eta_s",
  "blinkMid",
  "blinkExit",
  "maxJump°",
  "verdict",
);

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
  const stopP = path.progressAtStop(stopPredicate(v.entry, L.cx, L.cy, L.ringOuter, stop.out, 18));
  const midB = blinkerFor(0.45, steps, v.ringR, exitR);
  const exitB = blinkerFor(0.85, steps, v.ringR, exitR);
  const eta = path.length / Math.max(v.speed, 1);
  let maxJump = 0;
  let prev = path.sample(0).angle;
  for (let i = 1; i <= 80; i++) {
    const a = path.sample(i / 80).angle;
    let d = ((a - prev + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    maxJump = Math.max(maxJump, Math.abs((d * 180) / Math.PI));
    prev = a;
  }
  const expectMid =
    exitR > v.ringR + 5 ? "right" : exitR < v.ringR - 5 ? "left" : "none";
  const midOk = midB === expectMid || (expectMid === "none" && midB === "none");
  const exitOk = exitB === "right";
  const jumpOk = maxJump < 70;
  // Dłuższy approach/exit → stop to mniejszy ułamek trasy
  const stopOk = stopP > 0.02 && stopP < 0.35;
  const laneOk =
    (steps === 1 && v.ringR === 205) ||
    (steps === 2 && v.ringR === 180) ||
    (steps === 3 && v.ringR === 155);
  const ok = midOk && exitOk && jumpOk && stopOk && laneOk;
  if (!ok) {
    errs.push(
      `${v.id}: mid=${midB}/${expectMid} exit=${exitB} jump=${maxJump.toFixed(1)} stop=${stopP.toFixed(3)} lane=${laneOk}`,
    );
  }
  console.log(
    v.id.padEnd(5),
    `${v.entry}→${v.exit}`.padEnd(14),
    String(steps).padStart(5),
    String(Math.round(path.length)).padStart(6),
    eta.toFixed(1).padStart(5),
    midB.padStart(8),
    exitB.padStart(9),
    maxJump.toFixed(1).padStart(8),
    ok ? "PASS" : "FAIL",
  );
}

console.log("\n=== Sygnały / piesi / tram (pozycje) ===");
for (const s of L.signals) {
  console.log(`  ${s.id.padEnd(8)} ${s.kind.padEnd(12)} @ ${s.x},${s.y}  ${s.label || ""}`);
}
for (const p of L.pedestrians) {
  console.log(`  ped ${p.id.padEnd(4)} zebra=${p.zebra} fromStart=${p.fromStart}`);
}

console.log("\n---");
if (errs.length) {
  console.error("FAIL", errs);
  process.exit(1);
}
console.log("CASE MATRIX PASS");
