import { AUTORSKIE } from "../src/sim/layouts/autorskieRondo";
import { createRoundaboutRoute, ccwSteps, ringLaneForExit } from "../src/sim/paths/roundaboutRoute";
import { aabbFromCenter, aabbOverlap } from "../src/sim/collision";

const L = AUTORSKIE;
const paths: Record<string, ReturnType<typeof createRoundaboutRoute>> = {};
for (const id of ["nL", "sR"]) {
  const v = L.vehicles.find((x) => x.id === id)!;
  const steps = ccwSteps(v.entry, v.exit);
  const exitR = v.exitRingR ?? ringLaneForExit(steps, L.ringLanes);
  console.log(id, { entry: v.entry, exit: v.exit, steps, ringR: v.ringR, exitR, lane: v.laneOffset });
  paths[id] = createRoundaboutRoute(L.cx, L.cy, v.ringR, exitR, v.entry, v.exit, {
    lane: Math.abs(v.laneOffset),
    approachDist: 420,
    exitDist: 420,
    approachRingR: L.ringOuter,
  });
}

let minD = 999;
let minT = { ta: 0, tb: 0 };
for (let ta = 0.2; ta <= 0.9; ta += 0.01) {
  const a = paths.nL.sample(ta);
  for (let tb = 0.2; tb <= 0.9; tb += 0.01) {
    const b = paths.sR.sample(tb);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const ba = aabbFromCenter(a.x, a.y, 10, 18, a.angle - Math.PI / 2);
    const bb = aabbFromCenter(b.x, b.y, 10, 18, b.angle - Math.PI / 2);
    if (aabbOverlap(ba, bb) && d < minD) {
      minD = d;
      minT = { ta, tb };
      const ra = Math.hypot(a.x - L.cx, a.y - L.cy);
      const rb = Math.hypot(b.x - L.cx, b.y - L.cy);
      const fx = Math.cos(a.angle);
      const fy = Math.sin(a.angle);
      const side = Math.abs(-(b.x - a.x) * fy + (b.y - a.y) * fx);
      console.log("overlap", {
        ta: +ta.toFixed(2),
        tb: +tb.toFixed(2),
        d: +d.toFixed(1),
        ra: +ra.toFixed(1),
        rb: +rb.toFixed(1),
        side: +side.toFixed(1),
        a: [+a.x.toFixed(0), +a.y.toFixed(0)],
        b: [+b.x.toFixed(0), +b.y.toFixed(0)],
      });
    }
  }
}
console.log("closest overlap", minT, "d", minD);
