/**
 * TDD: poprawne trasy Czyżyńskiego (pas→zjazd, fillet, blinker).
 * npx --yes tsx scripts/testRoutes.ts
 */
import { AUTORSKIE as L } from "../src/sim/layouts/autorskieRondo";
import {
  createRoundaboutRoute,
  ccwSteps,
  ringLaneForExit,
} from "../src/sim/paths/roundaboutRoute";

const errs: string[] = [];

function expect(cond: boolean, msg: string) {
  if (!cond) errs.push(msg);
}

/** RHT: prawo = 1. zjazd, środek = 2., lewo = 3. */
const EXPECT: Record<string, { exit: string; steps: number }> = {
  wR: { exit: "south", steps: 1 },
  wM: { exit: "east", steps: 2 },
  wL: { exit: "north", steps: 3 },
  nR: { exit: "west", steps: 1 },
  nM: { exit: "south", steps: 2 },
  nL: { exit: "east", steps: 3 },
  eR: { exit: "north", steps: 1 },
  eM: { exit: "west", steps: 2 },
  eL: { exit: "south", steps: 3 },
  sR: { exit: "east", steps: 1 },
  sM: { exit: "north", steps: 2 },
  sL: { exit: "west", steps: 3 },
};

for (const v of L.vehicles) {
  const exp = EXPECT[v.id];
  expect(!!exp, `brak EXPECT dla ${v.id}`);
  if (!exp) continue;
  expect(v.exit === exp.exit, `${v.id}: exit=${v.exit} want ${exp.exit}`);
  const steps = ccwSteps(v.entry, v.exit);
  expect(steps === exp.steps, `${v.id}: steps=${steps} want ${exp.steps}`);
  const exitR = v.exitRingR ?? ringLaneForExit(steps, L.ringLanes);
  // 1. zjazd: zostań na zewn.; nie spirala z wewnątrz
  if (steps === 1) {
    expect(
      Math.abs(v.ringR - (L.ringLanes[0] ?? 205)) < 3,
      `${v.id}: 1. zjazd musi startować na pasie zewn. (ringR=${v.ringR})`,
    );
    expect(Math.abs(exitR - v.ringR) < 3, `${v.id}: 1. zjazd bez spirali (${v.ringR}→${exitR})`);
  }
  if (steps === 2) {
    expect(Math.abs(v.ringR - (L.ringLanes[1] ?? 180)) < 3, `${v.id}: 2. zjazd → pas środkowy`);
  }
  if (steps >= 3) {
    expect(Math.abs(v.ringR - (L.ringLanes[2] ?? 155)) < 3, `${v.id}: 3. zjazd → pas wewn.`);
  }

  const path = createRoundaboutRoute(L.cx, L.cy, v.ringR, exitR, v.entry, v.exit, {
    lane: Math.abs(v.laneOffset),
    approachDist: 420,
    exitDist: 420,
    approachRingR: L.ringOuter,
  });

  let maxJump = 0;
  let prevA: number | null = null;
  let falseLeft = false;
  for (let t = 0; t <= 1.001; t += 0.01) {
    const s = path.sample(Math.min(1, t));
    if (prevA != null) {
      let d = Math.abs(s.angle - prevA);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d > maxJump) maxJump = d;
    }
    prevA = s.angle;
    // LEFT tylko przy realnym zjeździe do wewnątrz
    if (s.blinker === "left" && exitR >= v.ringR - 5) falseLeft = true;
  }
  // Po remapingu na długość łuku ciasne filletty mają większy Δkąt / Δprogress
  // Dłuższy approach → rzadsze próbki na łuku; limit ~70°
  expect(maxJump < 1.22, `${v.id}: maxAngleJump=${((maxJump * 180) / Math.PI).toFixed(0)}° (limit ~70°)`);
  expect(!falseLeft, `${v.id}: fałszywy LEFT bez zmiany pasa do środka`);

  // Zjazd nie wchodzi w wyspę
  for (let t = 0.7; t <= 1; t += 0.02) {
    const s = path.sample(t);
    const r = Math.hypot(s.x - L.cx, s.y - L.cy);
    expect(r > L.islandR + 25, `${v.id}: t=${t.toFixed(2)} r=${r.toFixed(0)} w wyspie/za blisko`);
  }
}

if (errs.length) {
  console.error("FAIL\n" + errs.map((e) => " - " + e).join("\n"));
  process.exit(1);
}
console.log("testRoutes PASS");
