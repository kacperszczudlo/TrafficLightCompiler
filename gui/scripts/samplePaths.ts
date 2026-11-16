import { AUTORSKIE as L } from "../src/sim/layouts/autorskieRondo";
import {
  createRoundaboutRoute,
  ccwSteps,
  ringLaneForExit,
} from "../src/sim/paths/roundaboutRoute";

const ids = ["wR", "wM", "eL", "eR", "sL", "wL"];
for (const id of ids) {
  const v = L.vehicles.find((x) => x.id === id)!;
  const steps = ccwSteps(v.entry, v.exit);
  const exitR = v.exitRingR ?? ringLaneForExit(steps, L.ringLanes);
  const path = createRoundaboutRoute(L.cx, L.cy, v.ringR, exitR, v.entry, v.exit, {
    lane: Math.abs(v.laneOffset),
    approachDist: 420,
    exitDist: 420,
    approachRingR: L.ringOuter,
  });
  console.log(`\n## ${id} ${v.entry}->${v.exit} steps=${steps} R ${v.ringR}->${exitR}`);
  let prev: { angle: number } | null = null;
  for (let t = 0; t <= 1.001; t += 0.02) {
    const s = path.sample(Math.min(1, t));
    const r = Math.hypot(s.x - L.cx, s.y - L.cy);
    let jump = 0;
    if (prev) {
      let d = Math.abs(s.angle - prev.angle);
      if (d > Math.PI) d = Math.PI * 2 - d;
      jump = (d * 180) / Math.PI;
    }
    const seg =
      t < 0.14 ? "approach" : t < 0.32 ? "filletIn" : t < 0.68 ? "ring" : t < 0.86 ? "filletOut" : "exit";
    if (jump > 15 || t < 0.36 || t > 0.64) {
      console.log(
        `  t=${t.toFixed(2)} [${seg}] r=${r.toFixed(0)} ang=${((s.angle * 180) / Math.PI).toFixed(0)} jump=${jump.toFixed(0)} blink=${s.blinker}`,
      );
    }
    prev = s;
  }
}
